import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';

const loadDashboard = async (req, res, next) => {
    try {
        const bestSellingProducts = await Order.aggregate([
            { $unwind: '$orderedItems' },
            // {
            //     $match: {
            //         'orderedItems.status': {
            //             $in: ['Delivered', 'Return Rejected'],
            //         },
            //     },
            // },
            {
                $group: {
                    _id: '$orderedItems.product',
                    totalUnitsSold: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: '$orderedItems.price' },
                    totalOrders: { $addToSet: '$_id' },
                },
            },
            {
                $set: {
                    totalOrders: { $size: '$totalOrders' },
                },
            },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productData',
                },
            },
            { $unwind: '$productData' },
            {
                $lookup: {
                    from: Category.collection.name,
                    localField: 'productData.category',
                    foreignField: '_id',
                    as: 'categoryData',
                },
            },
            { $unwind: '$categoryData' },
            {
                $project: {
                    productName: '$productData.name',
                    categoryName: '$categoryData.categoryName',
                    totalUnitsSold: 1,
                    totalRevenue: 1,
                    totalOrders: 1,
                },
            },
            { $sort: { totalUnitsSold: -1 } },
            { $limit: 10 },
        ]);

        const bestSellingCategories = await Order.aggregate([
            { $unwind: '$orderedItems' },
            // {
            //     $match: {
            //         'orderedItems.status': {
            //             $in: ['Delivered', 'Return Rejected'],
            //         },
            //     },
            // },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: 'orderedItems.product',
                    foreignField: '_id',
                    as: 'productData',
                },
            },
            { $unwind: '$productData' },
            {
                $group: {
                    _id: '$productData.category',
                    totalUnitsSold: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: '$orderedItems.price' },
                    totalOrders: { $addToSet: '$_id' },
                },
            },
            {
                $set: {
                    totalOrders: { $size: '$totalOrders' },
                },
            },

            {
                $lookup: {
                    from: Category.collection.name,
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryData',
                },
            },
            { $unwind: '$categoryData' },
            {
                $project: {
                    categoryName: '$categoryData.categoryName',
                    totalUnitsSold: 1,
                    totalRevenue: 1,
                    totalOrders: 1,
                },
            },
            { $sort: { totalUnitsSold: -1 } },
            { $limit: 10 },
        ]);
        return res.render('dashboard', {
            bestSellingProducts,
            bestSellingCategories,
        });
    } catch (error) {
        console.error(error);
        next(error);
    }

    return res.render('dashboard');
};

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
                    // status: { $in: ['Delivered', 'Return Rejected'] },
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
                    // status: { $in: ['Delivered', 'Return Rejected'] },
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
    };
}

const getSummary = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();
        if (now < start) {
            return next(new AppError(`Future date cannot be given`, 400));
        }

        if (!startDate || !endDate) {
            return res
                .status(400)
                .json({ message: 'Start and end dates are required' });
        }

        const data = await getDashboardData(startDate, endDate);

        return res.status(200).json({
            ...data,
            range: { startDate, endDate },
        });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getDashboardCharts = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const salesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: { $ne: 'Cancelled' },
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
                    totalSales: { $sum: '$finalAmount' },
                    orderItemCount: {
                        $sum: { $size: '$orderedItems' },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const dates = salesData.map((d) => d._id);
        const sales = salesData.map((d) => d.totalSales);
        const orderItems = salesData.map((d) => d.orderItemCount);

        const statusData = await Order.aggregate([
            { $unwind: '$orderedItems' },
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: '$orderedItems.status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const statusCounts = {};
        statusData.forEach((item) => {
            statusCounts[item._id] = item.count;
        });

        return res.json({
            dates,
            sales,
            orderItems,
            statusCounts,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Chart loading failed' });
    }
};

export default {
    getSummary,
    loadDashboard,
    getDashboardCharts,
};
