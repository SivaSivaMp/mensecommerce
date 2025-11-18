import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';

const loadDashboard = async (req, res) => {
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

export default {
    getSummary,
    loadDashboard,
};
