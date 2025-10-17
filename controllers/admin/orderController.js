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
const getAdminOrderDetails = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findOne({ orderId: orderId })
            .populate({
                path: 'orderedItems.product',
                select: 'name images originalPrice salesPrice',
            })
            .populate({
                path: 'userId',
                select: 'name email',
            });

        if (!order) {
            return next(new AppError('Order not found', 404));
        }

        const orderedItems = order.orderedItems.map((item) => ({
            _id: item._id,
            productId: item.product?._id,
            productName: item.productName,
            productImage:
                item.product?.images?.[0] || '/images/placeholder.jpg',
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.product?.originalPrice || item.price,
            salesPrice: item.product?.salesPrice || item.price,
            totalPrice: item.price * item.quantity,
            status: item.status,
        }));

        const totalQuantity = orderedItems.reduce(
            (sum, item) => sum + item.quantity,
            0
        );

        const orderData = {
            orderId: order.orderId,
            _id: order._id,
            status: order.status,
            paymentMethod:
                order.paymentMethod === 'cod'
                    ? 'Cash on Delivery'
                    : 'Online Payment',
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            deliveredAt: order.deliveredAt,
            totalQuantity: totalQuantity,
            totalPrice: order.totalPrice,
            discount: order.discount,
            shipping: order.shipping,
            finalAmount: order.finalAmount,
        };

        const shippingAddress = {
            addressType: order.shippingAddress.addressType || 'N/A',
            name: order.shippingAddress.name || 'N/A',
            building: order.shippingAddress.building || 'N/A',
            street: order.shippingAddress.street || 'N/A',
            landmark: order.shippingAddress.landmark || 'N/A',
            city: order.shippingAddress.city || 'N/A',
            state: order.shippingAddress.state || 'N/A',
            pincode: order.shippingAddress.pincode || 'N/A',
            phone: order.shippingAddress.phone || 'N/A',
            altPhone: order.shippingAddress.altPhone || 'N/A',
        };

        return res.render('adminorder-details', {
            order: orderData,
            orderedItems: orderedItems,
            shippingAddress: shippingAddress,
            user: req.user || null,
        });
    } catch (error) {
        console.error('Error in getAdminOrderDetails:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const VALID_STATUS_TRANSITIONS = {
    Pending: ['Processing', 'Cancelled'],
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Cancelled'],
    Delivered: ['Return Request'],
    'Return Request': ['Return Approved', 'Return Rejected'],
    'Return Approved': ['Returned'],
    'Return Rejected': [],
    Cancelled: [],
    Returned: [],
};

const isValidStatusTransition = (currentStatus, newStatus) => {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions) {
        return false;
    }

    return allowedTransitions.includes(newStatus);
};

const updateOrderItemStatus = async (req, res, next) => {
    try {
        const { orderId, itemId, status } = req.body;

        if (!orderId || !itemId || !status) {
            return res.status(400).json({
                status: 'error',
                message: 'Order ID, Item ID and Status are required',
            });
        }

        const order = await Order.findOne({ orderId: orderId });

        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found',
            });
        }

        const item = order.orderedItems.id(itemId);

        if (!item) {
            return res.status(404).json({
                status: 'error',
                message: 'Item not found in order',
            });
        }

        const currentStatus = item.status;

        if (!isValidStatusTransition(currentStatus, status)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid status transition: Cannot change from "${currentStatus}" to "${status}". Valid transitions are: ${
                    VALID_STATUS_TRANSITIONS[currentStatus].join(', ') || 'None'
                }`,
            });
        }

        item.status = status;

        if (status === 'Delivered') {
            item.deliveredDate = new Date();
        }

        if (status === 'Return Request') {
            item.returnRequestDate = new Date();
        }

        if (status === 'Return Approved') {
            item.returnApprovedDate = new Date();
        }

        if (status === 'Returned') {
            item.returnCompletedDate = new Date();
        }

        const allStatuses = order.orderedItems.map((i) => i.status);

        if (allStatuses.every((s) => s === 'Delivered')) {
            order.status = 'Delivered';
            order.deliveredAt = new Date();
        } else if (allStatuses.every((s) => s === 'Cancelled')) {
            order.status = 'Cancelled';
        } else if (allStatuses.every((s) => s === 'Returned')) {
            order.status = 'Returned';
        } else if (allStatuses.some((s) => s === 'Return Request')) {
            order.status = 'Return Request';
        } else if (
            allStatuses.some((s) => s === 'Shipped' || s === 'Out for Delivery')
        ) {
            order.status = 'Shipped';
        } else if (allStatuses.some((s) => s === 'Processing')) {
            order.status = 'Processing';
        }

        await order.save();

        return res.status(200).json({
            status: 'success',
            message: 'Order item status updated successfully',
        });
    } catch (error) {
        console.error('Error in updateOrderItemStatus:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};
export default { getOrdersList, getAdminOrderDetails, updateOrderItemStatus };
