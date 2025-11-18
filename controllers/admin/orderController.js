import AppError from '../../utils/appError.js';
import Coupon from '../../models/couponSchema.js';
import Order from '../../models/orderSchema.js';
import Wallet from '../../models/walletSchema.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Product from '../../models/productSchema.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';

const getOrdersList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || '';
        const statusFilter = req.query.status || '';
        const paymentFilter = req.query.paymentMethod || '';
        let filter = {};

        if (searchQuery) {
            filter.$or = [
                { orderId: { $regex: searchQuery, $options: 'i' } },
                {
                    'shippingAddress.name': {
                        $regex: searchQuery,
                        $options: 'i',
                    },
                },
            ];
        }
        if (statusFilter) {
            filter.status = statusFilter;
        }
        if (paymentFilter) {
            filter.paymentMethod = paymentFilter;
        }

        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(filter)
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
            orderIdshort: order.orderId,
            _id: order._id,
            userName:
                order.userId?.name || order.shippingAddress?.name || 'N/A',
            userEmail: order.userId?.email || 'N/A',
            billingDate: order.createdAt,
            totalAmount: order.finalAmount,
            paymentMethod:
                order.paymentMethod === 'cod'
                    ? 'Cash on Delivery'
                    : order.paymentMethod === 'online'
                    ? 'Online Payment'
                    : 'Wallet Payment',
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
            pages: Array.from({ length: totalPages }, (_, i) => i + 1),
        };

        return res.render('orders', {
            orders: formattedOrders,
            searchQuery: searchQuery,
            statusFilter,
            paymentFilter,
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
            productImage: item.product?.images?.[0],
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.product?.originalPrice || item.price,
            salesPrice: item.product?.salesPrice || item.price,
            totalPrice: item.price * item.quantity,
            status: item.status,
            returnStatus: item.returnStatus,
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
                    : order.paymentMethod === 'online'
                    ? 'Online Payment'
                    : 'Wallet Payment',
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
    Pending: ['Processing'],
    Processing: ['Shipped'],
    Shipped: ['Out for Delivery'],
    'Out for Delivery': ['Delivered'],
    Delivered: [],
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
            return next(
                new AppError(
                    'Order ID, Item ID and Status are required',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const order = await Order.findOne({ orderId: orderId });

        if (!order) {
            return next(new AppError('Order not found', HTTP_STATUS.NOT_FOUND));
        }

        const item = order.orderedItems.id(itemId);

        if (!item) {
            return next(
                new AppError('Item not found in order', HTTP_STATUS.NOT_FOUND)
            );
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

        return res.status(HTTP_STATUS.OK).json({
            status: 'success',
            message: 'Order item status updated successfully',
        });
    } catch (error) {
        console.error('Error in updateOrderItemStatus:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};
const approveReturn = async (req, res, next) => {
    try {
        const { itemId } = req.body;

        if (!itemId) {
            return next(
                new AppError('Item ID is required', HTTP_STATUS.BAD_REQUEST)
            );
        }

        const order = await Order.findOne({ 'orderedItems._id': itemId });
        if (!order)
            return next(new AppError('Order not found', HTTP_STATUS.NOT_FOUND));

        const item = order.orderedItems.id(itemId);
        if (!item)
            return next(new AppError('Item not found', HTTP_STATUS.NOT_FOUND));

        if (
            ['Return Approved', 'Return Rejected', 'Returned'].includes(
                item.returnStatus
            )
        ) {
            return next(
                new AppError(
                    'Return action already processed and cannot be changed.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        item.status = 'Return Approved';
        item.returnStatus = 'Approved';
        item.returnApprovedDate = new Date();
        order.status = 'Return Approved';

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Return request approved successfully.',
        });
    } catch (error) {
        console.error('Error in approveReturn:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while approving return.',
        });
    }
};

// Reject return
const rejectReturn = async (req, res, next) => {
    try {
        const { itemId, rejectionReason } = req.body;

        if (!itemId || !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Item ID and rejection reason are required',
            });
        }

        const order = await Order.findOne({ 'orderedItems._id': itemId });
        if (!order)
            return next(new AppError('Order not found', HTTP_STATUS.NOT_FOUND));

        const item = order.orderedItems.id(itemId);
        if (!item)
            return next(new AppError('Item not found', HTTP_STATUS.NOT_FOUND));

        if (
            ['Return Approved', 'Return Rejected', 'Returned'].includes(
                item.returnStatus
            )
        ) {
            return next(
                new AppError(
                    'Return action already processed and cannot be changed.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        item.status = 'Return Rejected';
        item.returnStatus = 'Rejected';
        item.returnRejectionReason = rejectionReason;
        item.returnRejectionDate = new Date();
        order.status = 'Return Rejected';

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Return request rejected successfully.',
        });
    } catch (error) {
        console.error('Error in rejectReturn:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while rejecting return.',
        });
    }
};

const completeReturn = async (req, res, next) => {
    try {
        const { itemId } = req.body;

        if (!itemId) {
            return next(new AppError('Item ID is required', 400));
        }

        const order = await Order.findOne({
            'orderedItems._id': itemId,
        }).populate('couponId');

        if (!order) {
            return next(new AppError('Order not found', 404));
        }

        const item = order.orderedItems.id(itemId);
        if (!item) return next(new AppError('Item not found', 404));

        if (item.returnStatus !== 'Approved') {
            return next(new AppError('Return must be approved first.', 400));
        }

        const itemTotal = item.price * item.quantity;
        const originalFinalAmount = order.finalAmount;

        item.status = 'Returned';
        item.returnStatus = 'Returned';
        item.returnCompletedDate = new Date();

        const variant = await ProductVariant.findById(item.variant);
        if (variant) {
            variant.quantity += item.quantity;
            await variant.save();

            const product = await Product.findById(variant.productId);
            if (product) {
                const allVariants = await ProductVariant.find({
                    productId: product._id,
                });
                product.totalStock = allVariants.reduce(
                    (sum, v) => sum + v.quantity,
                    0
                );
                await product.save();
            }
        }

        const activeItems = order.orderedItems.filter(
            (i) => !['Cancelled', 'Returned'].includes(i.status)
        );

        const newActiveTotal = activeItems.reduce(
            (sum, i) => sum + i.price * i.quantity,
            0
        );

        let newCouponDiscount = 0;
        const coupon = order.couponId;

        if (coupon && newActiveTotal >= coupon.minPurchaseAmount) {
            if (coupon.discountType === 'flat') {
                newCouponDiscount = coupon.discountValue;
            } else if (coupon.discountType === 'percentage') {
                const raw = (newActiveTotal * coupon.discountValue) / 100;
                const max = coupon.maxDiscountAmount || Infinity;
                newCouponDiscount = Math.min(raw, max);
            }
        }

        const newFinalAmount = Math.max(newActiveTotal - newCouponDiscount, 0);

        const refundAmount = Number(
            (originalFinalAmount - newFinalAmount).toFixed(2)
        );

        if (refundAmount > 0) {
            let wallet = await Wallet.findOne({ userId: order.userId });

            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    transactions: [],
                });
            }

            await wallet.addTransaction(
                'credit',
                refundAmount,
                `Refund for returned item: ${item.productName}`,
                order._id,
                item._id,
                order.orderId
            );
        }

        order.finalAmount = newFinalAmount;

        const allItemsReturned = order.orderedItems.every((i) =>
            ['Returned', 'Cancelled'].includes(i.status)
        );

        if (allItemsReturned) {
            order.status = 'Returned';
        }

        await order.save();

        return res.status(200).json({
            success: true,
            refundAmount,
            message:
                refundAmount > 0
                    ? `Return completed. ₹${refundAmount} refunded to wallet.`
                    : 'Return completed.',
        });
    } catch (error) {
        return next(new AppError(error.message, 500));
    }
};

export default {
    getOrdersList,
    getAdminOrderDetails,
    updateOrderItemStatus,
    approveReturn,
    rejectReturn,
    completeReturn,
};
