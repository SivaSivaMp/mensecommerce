import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import AppError from '../../utils/appError.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';

async function getSalesData(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

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
                localField: 'userId',
                foreignField: '_id',
                as: 'userData',
            },
        },
        { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                orderId: '$orderId',
                customerName: '$userData.name',
                createdAt: 1,
                paymentMethod: 1,
                status: '$status',
                orderItemStatus: '$orderedItems.status',
                subtotal: {
                    $multiply: [
                        '$orderedItems.quantity',
                        '$orderedItems.price',
                    ],
                },
                discount: { $ifNull: ['$discount', 0] },
                couponCode: { $ifNull: ['$couponCode', '-'] },
                couponDiscount: { $ifNull: ['$couponDiscount', 0] },
                finalAmount: '$finalAmount',
                itemsOrdered: '$orderedItems.productName',
                quantity: '$orderedItems.quantity',
            },
        },
        { $sort: { createdAt: -1 } },
    ]);

    const totalOrders = [...new Set(orderSummary.map((o) => o.orderId))].length;
    const validStatuses = ['Delivered', 'Return Rejected'];
    const totalAmount = orderSummary.reduce(
        (sum, o) => sum + (o.subtotal || 0),
        0
    );
    const totalDiscount = orderSummary.reduce(
        (sum, o) => sum + (o.discount || 0),
        0
    );
    const totalCouponDeduction = orderSummary.reduce(
        (sum, o) => sum + (o.couponDiscount || 0),
        0
    );

    const cancelledOrders = orderSummary.filter(
        (o) => o.orderItemStatus === 'Cancelled'
    ).length;
    const cancelledValue = orderSummary
        .filter((o) => o.orderItemStatus === 'Cancelled')
        .reduce((sum, o) => sum + (o.subtotal || 0), 0);

    const returnedOrders = orderSummary.filter(
        (o) => o.orderItemStatus === 'Returned'
    ).length;
    const returnedValue = orderSummary
        .filter((o) => o.orderItemStatus === 'Returned')
        .reduce((sum, o) => sum + (o.subtotal || 0), 0);

    const totalOrderPrice = totalAmount - totalDiscount - totalCouponDeduction;
    const netRevenue = totalOrderPrice - cancelledValue - returnedValue;

    const groupedOrders = {};
    orderSummary.forEach((order) => {
        if (!groupedOrders[order.orderId]) {
            groupedOrders[order.orderId] = {
                ...order,
                items: [],
            };
        }
        groupedOrders[order.orderId].items.push({
            name: order.itemsOrdered,
            quantity: order.quantity,
        });
    });

    return {
        summary: {
            totalOrders,
            totalAmount,
            totalDiscount,
            totalCouponDeduction,
            totalOrderPrice,
            cancelledOrders,
            cancelledValue,
            returnedOrders,
            returnedValue,
            netRevenue,
        },
        orders: Object.values(groupedOrders),
        period: {
            start,
            end,
        },
    };
}

const generateDashboardExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const data = await getSalesData(startDate, endDate);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sales Report');

        sheet.mergeCells('A1', 'L1');
        sheet.getCell('A1').value = 'Sales Summary Overview';
        sheet.getCell('A1').font = {
            size: 16,
            bold: true,
            color: { argb: '4472C4' },
        };
        // sheet.getCell('A1').fill = {
        //     type: 'pattern',
        //     pattern: 'solid',
        //     fgColor: { argb: '4472C4' },
        // };
        sheet.getCell('A1').alignment = {
            horizontal: 'center',
            vertical: 'middle',
        };

        sheet.addRow([]);

        const summaryHeaders = [
            'Total Orders',
            'Total Amount (₹)',
            'Total Discount (₹)',
            'Coupon Deduction (₹)',
            'Total Order Price (₹)',
            'Cancelled Orders',
            'Cancelled Value (₹)',
            'Returned Orders',
            'Returned Value (₹)',
            'Net Revenue (₹)',
        ];

        const summaryRow = sheet.addRow(summaryHeaders);
        summaryRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        summaryRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '70AD47' },
        };
        summaryRow.alignment = { horizontal: 'center', vertical: 'middle' };

        const summaryValues = [
            data.summary.totalOrders,
            data.summary.totalAmount,
            data.summary.totalDiscount,
            data.summary.totalCouponDeduction,
            data.summary.totalOrderPrice,
            data.summary.cancelledOrders,
            data.summary.cancelledValue,
            data.summary.returnedOrders,
            data.summary.returnedValue,
            data.summary.netRevenue,
        ];

        const valuesRow = sheet.addRow(summaryValues);
        valuesRow.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.addRow([]);
        sheet.addRow([]);

        sheet.mergeCells(
            `A${sheet.lastRow.number + 1}`,
            `L${sheet.lastRow.number + 1}`
        );
        const detailsHeaderCell = sheet.getCell(`A${sheet.lastRow.number}`);
        detailsHeaderCell.value = 'Order Details';
        detailsHeaderCell.font = {
            size: 14,
            bold: true,
            color: { argb: 'FFFFFF' },
        };
        detailsHeaderCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4472C4' },
        };
        detailsHeaderCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
        };

        sheet.addRow([]);

        const orderHeaders = [
            'Order ID',
            'Customer Name',
            'Order Date',
            'Payment Method',
            'Order Status',
            'Subtotal (₹)',
            'Discount (₹)',
            'Coupon Code',
            'Coupon Deduction (₹)',
            'Total Price (₹)',
            'Items Ordered',
        ];

        const headerRow = sheet.addRow(orderHeaders);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '203864' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        data.orders.forEach((order) => {
            const itemsText = order.items
                .map((item) => `${item.name} (${item.quantity})`)
                .join(', ');

            const row = sheet.addRow([
                order.orderId,
                order.customerName || 'N/A',
                new Date(order.createdAt).toLocaleDateString(),
                order.paymentMethod
                    ? order.paymentMethod.charAt(0).toUpperCase() +
                      order.paymentMethod.slice(1)
                    : 'N/A',
                order.orderItemStatus,
                order.subtotal,
                order.discount,
                order.couponCode,
                order.couponDiscount,
                order.finalAmount,
                itemsText,
            ]);

            row.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        sheet.columns = [
            { width: 20 },
            { width: 25 },
            { width: 15 },
            { width: 18 },
            { width: 18 },
            { width: 15 },
            { width: 15 },
            { width: 20 },
            { width: 20 },
            { width: 15 },
            { width: 50 },
        ];

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Sales-Report-${
                data.period.start.toISOString().split('T')[0]
            }_${data.period.end.toISOString().split('T')[0]}.xlsx`
        );
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            message: 'Error generating sales report',
        });
    }
};

const generateDashboardPDF = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await getSalesData(startDate, endDate);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Sales-Report-${data.period.start.toLocaleDateString()}-${data.period.end.toLocaleDateString()}.pdf`
        );
        doc.pipe(res);

        doc.fontSize(20).text('SALES REPORT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Period: October 2025`, { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, {
            align: 'center',
        });
        doc.moveDown(2);

        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown(1);

        const summaryData = [
            ['Total Sales Count:', data.summary.totalOrders],
            [
                'Total Order Amount:',
                `Rs.${data.summary.totalAmount.toFixed(2)}`,
            ],
            ['Total Discount:', `Rs.${data.summary.totalDiscount.toFixed(2)}`],
            [
                'Total Coupon Deduction:',
                `Rs.${data.summary.totalCouponDeduction.toFixed(2)}`,
            ],
            [
                'Total Order Price:',
                `Rs.${data.summary.totalOrderPrice.toFixed(2)}`,
            ],
            ['Cancelled Orders Count:', data.summary.cancelledOrders],
            [
                'Cancelled Amount:',
                `Rs.${data.summary.cancelledValue.toFixed(2)}`,
            ],
            ['Returned Orders Count:', data.summary.returnedOrders],
            ['Returned Amount:', `Rs.${data.summary.returnedValue.toFixed(2)}`],
        ];

        summaryData.forEach(([label, value]) => {
            const y = doc.y;
            doc.fontSize(11).text(label, 50, y, {
                width: 250,
                continued: false,
            });
            doc.text(value.toString(), 350, y, { align: 'right' });
            doc.moveDown(0.5);
        });

        doc.moveDown(1);

        const netY = doc.y;
        doc.fontSize(12)
            .fillColor('green')
            .text('Net Revenue:', 50, netY, { continued: false });
        doc.text(`Rs.${data.summary.netRevenue.toFixed(2)}`, 350, netY, {
            align: 'right',
        });
        doc.fillColor('black');
        doc.moveDown(2);

        doc.fontSize(14).text('Order Details', { underline: true });
        doc.moveDown(1);

        const tableTop = doc.y;
        const colWidths = [30, 120, 80, 80, 100, 100];
        const headers = [
            '#',
            'Order ID',
            'Date',
            'Items',
            'Subtotal',
            'Total Amount',
        ];

        doc.fontSize(10).fillColor('white');
        doc.rect(50, tableTop, 530, 20).fill('#4472C4');

        let xPos = 50;
        headers.forEach((header, i) => {
            doc.text(header, xPos + 5, tableTop + 5, {
                width: colWidths[i],
                align: 'center',
            });
            xPos += colWidths[i];
        });

        doc.fillColor('black');
        let currentY = tableTop + 25;

        data.orders.forEach((order, index) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }

            const itemCount = order.items.reduce(
                (sum, item) => sum + item.quantity,
                0
            );

            xPos = 50;
            const rowData = [
                (index + 1).toString(),
                order.orderId,
                new Date(order.createdAt).toLocaleDateString(),
                itemCount.toString(),
                `Rs.${order.subtotal.toFixed(2)}`,
                `Rs.${order.finalAmount.toFixed(2)}`,
            ];

            rowData.forEach((text, i) => {
                doc.fontSize(9).text(text, xPos + 5, currentY, {
                    width: colWidths[i] - 10,
                    align: i === 0 ? 'center' : 'left',
                });
                xPos += colWidths[i];
            });

            currentY += 20;
        });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            message: 'Error generating PDF report',
        });
    }
};
const validateReportRequest = (req, res, next) => {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
        return res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json({ message: 'Start and end dates are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    if (now < start) {
        return next(
            new AppError(
                `Future date cannot be given for start date`,
                HTTP_STATUS.BAD_REQUEST
            )
        );
    }
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return next(
            new AppError(`Invalid date format.`, HTTP_STATUS.BAD_REQUEST)
        );
    }

    if (start > end) {
        return next(
            new AppError(
                `Start date cannot be after end date.`,
                HTTP_STATUS.BAD_REQUEST
            )
        );
    }

    if (end > now) {
        return next(
            new AppError(
                `End date cannot be in the future.`,
                HTTP_STATUS.BAD_REQUEST
            )
        );
    }

    return res.status(HTTP_STATUS.OK).json({ message: 'OK' });
};

export default {
    generateDashboardExcel,
    generateDashboardPDF,
    validateReportRequest,
};
