import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';

async function getDashboardData(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const [
        totalCustomers,
        totalOrders,
        discountAgg,
        salesAgg,
        totalCategories,
        totalProducts,
        orderItem,
        totalOrderItem,
    ] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
        Order.countDocuments({ createdAt: { $gte: start, $lte: end } }),
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: { $in: ['Delivered', 'Return Rejected'] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalDiscount: {
                        $sum: {
                            $add: [
                                { $ifNull: ['$discount', 0] },
                                { $ifNull: ['$couponDiscount', 0] },
                            ],
                        },
                    },
                },
            },
        ]),
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: { $in: ['Delivered', 'Return Rejected'] },
                },
            },
            { $group: { _id: null, totalSales: { $sum: '$finalAmount' } } },
        ]),
        Category.countDocuments(),
        Product.countDocuments(),
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                },
            },
            {
                $unwind: '$orderedItems',
            },
            {
                $match: {
                    'orderedItems.status': {
                        $in: ['Delivered', 'Return Rejected'],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    orderItemCount: { $sum: 1 },
                },
            },
        ]),
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                },
            },
            {
                $unwind: '$orderedItems',
            },

            {
                $group: {
                    _id: null,
                    totalOrderItemCount: { $sum: 1 },
                },
            },
        ]),
    ]);

    const totalDiscount = discountAgg[0]?.totalDiscount || 0;
    const totalSales = salesAgg[0]?.totalSales || 0;
    const orderItemCount = orderItem[0]?.orderItemCount || 0;
    const avgSale =
        orderItemCount > 0 ? (totalSales / orderItemCount).toFixed(2) : 0;
    const totalOrderItemCount = totalOrderItem[0]?.totalOrderItemCount || 0;

    const [
        paymentBreakdown,
        categoryBreakdown,
        topProducts,
        dailyTrend,
        returnStats,
    ] = await Promise.all([
        // Payment breakdown
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: { $in: ['Delivered', 'Return Rejected'] },
                },
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    total: { $sum: '$finalAmount' },
                },
            },
        ]),

        // Category breakdown
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    'orderedItems.status': {
                        $in: ['Delivered', 'Return Rejected'],
                    },
                },
            },
            { $unwind: '$orderedItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderedItems.product',
                    foreignField: '_id',
                    as: 'productData',
                },
            },
            { $unwind: '$productData' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productData.category',
                    foreignField: '_id',
                    as: 'categoryData',
                },
            },
            { $unwind: '$categoryData' },
            {
                $group: {
                    _id: '$categoryData.categoryName',
                    totalSales: {
                        $sum: {
                            $multiply: [
                                '$orderedItems.quantity',
                                '$orderedItems.price',
                            ],
                        },
                    },
                    totalItems: { $sum: '$orderedItems.quantity' },
                },
            },
            { $sort: { totalSales: -1 } },
        ]),

        // Top 10 products
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    'orderedItems.status': {
                        $in: ['Delivered', 'Return Rejected'],
                    },
                },
            },
            { $unwind: '$orderedItems' },
            {
                $group: {
                    _id: '$orderedItems.productName',
                    totalQuantity: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: '$orderedItems.price' },
                },
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
        ]),

        // Daily trend
        Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: { $in: ['Delivered', 'Return Rejected'] },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                        },
                    },
                    total: { $sum: '$finalAmount' },
                },
            },
            { $sort: { _id: 1 } },
        ]),

        // Returns and cancellations
        Order.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end } } },
            {
                $facet: {
                    returns: [
                        { $unwind: '$orderedItems' },
                        { $match: { 'orderedItems.status': 'Returned' } },
                        { $count: 'count' },
                    ],
                    cancellations: [
                        { $unwind: '$orderedItems' },
                        { $match: { 'orderedItems.status': 'Cancelled' } },
                        { $count: 'count' },
                    ],
                },
            },
        ]),
    ]);
    const orderSummary = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end },
            },
        },
        {
            $unwind: '$orderedItems',
        },
        {
            $lookup: {
                from: Product.collection.name,
                localField: 'orderedItems.product',
                foreignField: '_id',
                as: 'productData',
            },
        },
        { $unwind: { path: '$productData', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: Category.collection.name,
                localField: 'productData.category',
                foreignField: '_id',
                as: 'categoryData',
            },
        },
        {
            $unwind: {
                path: '$categoryData',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: User.collection.name,
                localField: 'user',
                foreignField: '_id',
                as: 'userData',
            },
        },
        { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                orderId: '$orderId',
                createdAt: 1,
                paymentMethod: 1,
                'orderedItems.status': 1,
                'orderedItems.quantity': 1,
                'orderedItems.price': 1,
                productName: '$orderedItems.productName',
                categoryName: '$categoryData.categoryName',
                userName: '$userData.name',
                userEmail: '$userData.email',
            },
        },
        { $sort: { createdAt: -1 } },
    ]);
    return {
        range: `${start.toDateString()} to ${end.toDateString()}`,
        totalCustomers,
        totalOrders,
        totalDiscount,
        totalSales,
        avgSale,
        totalCategories,
        totalProducts,
        orderItemCount,
        totalOrderItemCount,
        paymentBreakdown,
        categoryBreakdown,
        topProducts,
        dailyTrend,
        returnStats,
        orderSummary,
    };
}

const generateDashboardExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const data = await getDashboardData(startDate, endDate);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sales Report');

        // --- HEADER ---
        sheet.mergeCells('A1', 'E1');
        sheet.getCell('A1').value = 'Comprehensive Sales Report';
        sheet.getCell('A1').font = {
            size: 18,
            bold: true,
            color: { argb: '003366' },
        };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.addRow([]);
        sheet.addRow(['Report Period', data.range]);
        sheet.addRow(['Generated On', new Date().toLocaleString()]);
        sheet.addRow([]);
        sheet.addRow([]);

        // --- SUMMARY KPIs ---
        sheet.addRow(['🧾 Sales Summary']);
        sheet.lastRow.font = { bold: true, size: 14 };
        sheet.addRow(['Metric', 'Value']);
        sheet.addRows([
            ['Total Customers', data.totalCustomers],
            ['Total Orders', data.totalOrders],
            ['Total Order Items', data.totalOrderItemCount],
            ['Total Sales', `$${data.totalSales}`],
            ['Total Discount', `$${data.totalDiscount}`],
            ['Average Sale Value', `$${data.avgSale}`],
        ]);
        sheet.addRow([]);
        sheet.addRow([]);

        // --- PAYMENT BREAKDOWN ---
        sheet.addRow(['💳 Sales by Payment Method']);
        sheet.lastRow.font = { bold: true, size: 14 };
        sheet.addRow(['Payment Method', 'Revenue']);
        data.paymentBreakdown.forEach((p) => {
            sheet.addRow([p._id?.toUpperCase() || 'UNKNOWN', `$${p.total}`]);
        });
        sheet.addRow([]);
        sheet.addRow([]);

        // --- CATEGORY BREAKDOWN ---
        sheet.addRow(['📦 Category-wise Sales']);
        sheet.lastRow.font = { bold: true, size: 14 };
        sheet.addRow(['Category', 'Revenue', 'Items Sold']);
        data.categoryBreakdown.forEach((c) => {
            sheet.addRow([c._id, `$${c.totalSales}`, c.totalItems]);
        });
        sheet.addRow([]);
        sheet.addRow([]);

        // --- TOP PRODUCTS ---
        sheet.addRow(['🏆 Top 10 Products']);
        sheet.lastRow.font = { bold: true, size: 14 };
        sheet.addRow(['Product', 'Revenue', 'Quantity']);
        data.topProducts.forEach((p) => {
            sheet.addRow([p._id, `$${p.totalRevenue}`, p.totalQuantity]);
        });
        sheet.addRow([]);
        sheet.addRow([]);

        // --- DAILY TREND ---
        sheet.addRow(['📈 Daily Sales Trend']);
        sheet.lastRow.font = { bold: true, size: 14 };
        sheet.addRow(['Date', 'Total Sales']);
        data.dailyTrend.forEach((d) => {
            sheet.addRow([d._id, `$${d.total}`]);
        });
        sheet.addRow([]);
        sheet.addRow([]);

        // --- RETURNS / CANCELLATIONS ---
        sheet.addRow(['⚖️ Returns & Cancellations']);
        sheet.lastRow.font = { bold: true, size: 14 };
        const returns = data.returnStats[0]?.returns[0]?.count || 0;
        const cancels = data.returnStats[0]?.cancellations[0]?.count || 0;
        sheet.addRows([
            ['Returned Items', returns],
            ['Cancelled Items', cancels],
        ]);

        sheet.columns.forEach((col) => (col.width = 25));
        sheet.eachRow((row) => {
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        /* ------------------------------------------------------------
       🧾 SECOND SHEET: ORDER SUMMARY (DETAILED ITEMS)
    ------------------------------------------------------------ */
        const orderSheet = workbook.addWorksheet('Order Summary');

        orderSheet.mergeCells('A1', 'K1');
        orderSheet.getCell('A1').value = 'Detailed Order Summary';
        orderSheet.getCell('A1').font = {
            size: 16,
            bold: true,
            color: { argb: '003366' },
        };
        orderSheet.getCell('A1').alignment = { horizontal: 'center' };
        orderSheet.addRow([]);
        orderSheet.addRow([
            'Order ID',
            'Order Date',
            'Product Name',
            'Category',
            'Quantity',
            'Price',
            'Subtotal',
            'Status',
            'Payment Method',
            'Customer Name',
            'Customer Email',
        ]);

        // Style header row
        const headerRow = orderSheet.lastRow;
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4472C4' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        // Add all order items
        data.orderSummary.forEach((o) => {
            const subtotal = o.orderedItems.price * o.orderedItems.quantity;
            orderSheet.addRow([
                o.orderId, // short order ID
                new Date(o.createdAt).toLocaleDateString(),
                o.productName || 'N/A',
                o.categoryName || 'N/A',
                o.orderedItems.quantity,
                `$${o.orderedItems.price}`,
                `$${subtotal}`,
                o.orderedItems.status,
                o.paymentMethod.toUpperCase(),
                o.userName || 'N/A',
                o.userEmail || 'N/A',
            ]);
        });

        orderSheet.columns.forEach((col) => (col.width = 20));
        orderSheet.eachRow((row) => {
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Response
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Sales-Report(${
                start.toISOString().split('T')[0]
            }_${end.toISOString().split('T')[0]}).xlsx`
        );
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'Error generating detailed sales report',
        });
    }
};

/* --------------------------------------------
   🔹 4. PDF Report
--------------------------------------------- */
const generateDashboardPDF = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await getDashboardData(startDate, endDate);

        const start = new Date(startDate);
        const end = new Date(endDate);
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Dashboard-Report(${start.toLocaleDateString()}-${end.toLocaleDateString()}).pdf`
        );
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Dashboard Summary Report', { align: 'center' });
        doc.moveDown(2);
        doc.fontSize(12).text(`Report Period: ${data.range}`);
        doc.moveDown(1);

        // Table-like output
        const metrics = [
            ['Total Customers', data.totalCustomers],
            ['Total Orders', data.totalOrders],
            ['Total Discount', `$${data.totalDiscount}`],
            ['Average Sale', `$${data.avgSale}`],
            ['Total Sales', `$${data.totalSales}`],
            ['Total Categories', data.totalCategories],
            ['Total Products', data.totalProducts],
        ];

        metrics.forEach(([label, value]) => {
            doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
            doc.font('Helvetica').text(value.toString());
            doc.moveDown(0.4);
        });

        doc.moveDown(2);
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, {
            align: 'right',
            oblique: true,
        });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error generating PDF report' });
    }
};

export default {
    generateDashboardExcel,
    generateDashboardPDF,
};
