import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Order from '../../models/orderSchema.js';
import validator from 'validator';
import User from '../../models/userSchema.js';

const getOrdersList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || '';
        let searchFilter = {};

        if (searchQuery) {
            searchFilter.$or = [
                { orderId: { $regex: searchQuery, $options: 'i' } },
                {
                    'shippingAddress.name': {
                        $regex: searchQuery,
                        $options: 'i',
                    },
                },
            ];
        }

        const totalOrders = await Order.countDocuments(searchFilter);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(searchFilter)
            .populate({
                path: 'userId',
                select: 'name email',
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const formattedOrders = orders.map((order) => ({
            orderId: order.orderId,
            orderIdshort: order.orderId.split('-')[0],
            _id: order._id,
            userName:
                order.userId?.name || order.shippingAddress?.name || 'N/A',
            userEmail: order.userId?.email || 'N/A',
            billingDate: order.createdAt,
            totalAmount: order.finalAmount,
            paymentMethod:
                order.paymentMethod === 'cod'
                    ? 'Cash on Delivery'
                    : 'Online Payment',
            paymentStatus: order.paymentStatus,
            status: order.status,
            itemCount: order.orderedItems.length,
        }));

        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: [],
        };

        return res.render('orders', {
            orders: formattedOrders,
            searchQuery: searchQuery,
            pagination: pagination,
            totalOrders: totalOrders,
            user: req.user || null,
        });
    } catch (error) {
        console.log('Error in getAdminOrders:', error);
        return next(new AppError('Internal server error', 500));
    }
};
const getOrderDetails = async (req, res, next) => {
    try {
        res.render('order-details');
    } catch (error) {}
};
export default { getOrdersList, getOrderDetails };
