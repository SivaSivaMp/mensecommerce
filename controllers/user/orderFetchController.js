import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';

import Order from '../../models/orderSchema.js';

import { HTTP_STATUS } from '../../utils/httpStatus.js';

const getOrders = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.query || '';
        const statusFilter = req.query.status || '';
        if (!userId) {
            return next(new AppError('Please login to view your orders', 401));
        }

        let searchFilter = { userId };

        if (searchQuery) {
            searchFilter.$or = [
                { orderId: { $regex: searchQuery, $options: 'i' } },
                {
                    'orderedItems.productName': {
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
                path: 'orderedItems.product',

                select: 'name images',
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const formattedOrders = [];

        orders.forEach((order) => {
            order.orderedItems.forEach((item) => {
                if (!statusFilter || item.status === statusFilter) {
                    formattedOrders.push({
                        orderId: order.orderId,
                        orderMongoId: order._id,
                        itemId: item._id,
                        productName: item.productName,
                        productImage:
                            item.product?.images?.[0] ||
                            '/images/placeholder.jpg',
                        size: item.size,
                        quantity: item.quantity,
                        price: item.price,
                        totalPrice: item.price * item.quantity,
                        status: item.status,
                        orderDate: order.createdAt,
                        deliveredDate: item.deliveredDate,
                        canReview:
                            item.status === 'Delivered' && item.deliveredDate,
                    });
                }
            });
        });

        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: [],
        };

        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        for (let i = startPage; i <= endPage; i++) {
            pagination.pages.push(i);
        }

        return res.render('my-account-orders', {
            orders: formattedOrders,
            searchQuery: searchQuery,
            pagination: pagination,
            totalOrders: totalOrders,
            statusFilter,
        });
    } catch (error) {
        console.error('Error in getOrders:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const getOrderDetails = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const { orderId, itemId } = req.params;

        if (!userId) {
            return next(
                new AppError('Please login to view order details', 401)
            );
        }

        const order = await Order.findOne({
            orderId: orderId,
            userId: userId,
        })
            .populate({
                path: 'orderedItems.product',
                select: 'name images originalPrice salesPrice',
            })
            .populate({
                path: 'orderedItems.variant',
                select: 'size quantity',
            });

        if (!order) {
            return next(new AppError('Order not found', 404));
        }

        const specificItem = order.orderedItems.find(
            (item) => item._id.toString() === itemId
        );

        if (!specificItem) {
            return next(new AppError('Order item not found', 404));
        }

        const orderItem = {
            _id: specificItem._id,
            productId: specificItem.product._id,
            productName: specificItem.productName,
            productImage:
                specificItem.product?.images?.[0] || '/images/placeholder.jpg',
            size: specificItem.size,
            quantity: specificItem.quantity,
            price: specificItem.price,

            totalPrice: specificItem.price * specificItem.quantity,
            status: specificItem.status,
            cancellationReason: specificItem.cancellationReason,
            returnReason: specificItem.returnReason,
            returnStatus: specificItem.returnStatus,
            deliveredDate: specificItem.deliveredDate,
            canCancel: ['Pending', 'Processing'].includes(specificItem.status),
            canReturn:
                specificItem.status === 'Delivered' &&
                specificItem.deliveredDate &&
                new Date() - new Date(specificItem.deliveredDate) <=
                    7 * 24 * 60 * 60 * 1000,
        };

        const itemPrice = specificItem.price * specificItem.quantity;
        const originalItemPrice =
            Number(specificItem.product?.originalPrice || 0) *
            specificItem.quantity;
        const discount = originalItemPrice - itemPrice;

        const itemSummary = {
            itemPrice: itemPrice,
            originalItemPrice: originalItemPrice,
            discount: discount > 0 ? discount : 0,
        };

        const shippingAddress = {
            addressType: order.shippingAddress.addressType,
            name: order.shippingAddress.name,
            building: order.shippingAddress.building,
            street: order.shippingAddress.street,
            landmark: order.shippingAddress.landmark,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            pincode: order.shippingAddress.pincode,
            phone: order.shippingAddress.phone,
            altPhone: order.shippingAddress.altPhone,
        };

        const statusTimeline = [
            {
                status: 'Pending',
                label: 'Order Placed',
                completed: true,
                current: specificItem.status === 'Pending',
            },
            {
                status: 'Processing',
                label: 'Processing',
                completed: [
                    'Processing',
                    'Shipped',
                    'Out for Delivery',
                    'Delivered',
                ].includes(specificItem.status),
                current: specificItem.status === 'Processing',
            },
            {
                status: 'Shipped',
                label: 'Shipped',
                completed: [
                    'Shipped',
                    'Out for Delivery',
                    'Delivered',
                ].includes(specificItem.status),
                current: specificItem.status === 'Shipped',
            },
            {
                status: 'Out for Delivery',
                label: 'Out for Delivery',
                completed: ['Out for Delivery', 'Delivered'].includes(
                    specificItem.status
                ),
                current: specificItem.status === 'Out for Delivery',
            },
            {
                status: 'Delivered',
                label: 'Delivered',
                completed: specificItem.status === 'Delivered',
                current: specificItem.status === 'Delivered',
            },
        ];

        const trackingInfo = order.trackingInfo || {};

        return res.render('order-details', {
            order: {
                orderId: order.orderId,
                _id: order._id,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                couponCode: order.couponCode,
                createdAt: order.createdAt,
            },
            orderItem: orderItem,
            itemSummary: itemSummary,
            shippingAddress: shippingAddress,
            statusTimeline: statusTimeline,
            trackingInfo: trackingInfo,
        });
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        return next(new AppError('Internal server error', 500));
    }
};
const renderItemInvoice = async (req, res, next) => {
    try {
        const { orderId, itemId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate('userId', 'name email')
            .lean();

        if (!order) {
            return next(
                new AppError('Order not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        const item = order.orderedItems.find(
            (i) => i._id.toString() === itemId
        );
        if (!item) {
            return next(
                new AppError(
                    'Item not found in this order',
                    HTTP_STATUS.NOT_FOUND
                )
            );
        }

        const originalTotal = item.originalPrice * item.quantity;
        const salesTotal = item.salesPrice * item.quantity;
        const discount = originalTotal - salesTotal;

        return res.render('invoice', {
            order,
            item,
            originalTotal,
            salesTotal,
            discount,
            user: order.userId,
        });
    } catch (error) {
        console.error('Error rendering invoice:', error);
        next(error);
    }
};

const getOrderSuccessPage = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId })
            .populate('userId')
            .populate('address')
            .populate('orderedItems.product')
            .populate('orderedItems.variant')
            .lean();

        if (!order) {
            return next(new AppError('Order not found', HTTP_STATUS.NOT_FOUND));
        }

        res.render('order-success-page', {
            order,
            user: order.userId,
            address: order.address,
            items: order.orderedItems,
        });
    } catch (error) {
        console.error('Error loading order success page:', error);
        next(error);
    }
};
const getPaymentFailpage = async (req, res) => {
    const { orderId, msg } = req.query;

    return res.render('order-failure-payment', {
        orderId,
        message: msg,
    });
};

const listOrdersOnly = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next(new AppError('Please login to view your orders', 401));
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search || '';
        const statusFilter = req.query.status || '';

        let filter = { userId };

        // Search by orderId
        if (searchQuery) {
            filter.orderId = { $regex: searchQuery, $options: 'i' };
        }

        // Main order status (top level)
        if (statusFilter) {
            filter.status = statusFilter;
        }

        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch orders (not items)
        const orders = await Order.find(filter)
            .populate({
                path: 'orderedItems.product',
                select: 'images',
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const formattedOrders = orders.map((order) => {
            const thumbnail =
                order.orderedItems[0]?.product?.images?.[0] ||
                '/images/placeholder.jpg';

            return {
                orderId: order.orderId,
                orderMongoId: order._id,
                itemCount: order.orderedItems.length,
                status: order.status,
                totalAmount: order.finalAmount,
                orderDate: order.createdAt,
                thumbnail,
            };
        });

        const pagination = {
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            pages: Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => Math.max(1, page - 2) + i
            ),
        };

        return res.render('order-list', {
            orders: formattedOrders,
            searchQuery,
            pagination,
            totalOrders,
            statusFilter,
        });
    } catch (error) {
        console.error('Error in listOrdersOnly:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const getOrderDetailsAllItems = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const { orderId } = req.params;

        if (!userId) {
            return next(
                new AppError('Please login to view order details', 401)
            );
        }

        const order = await Order.findOne({
            orderId: orderId,
            userId: userId,
        })
            .populate({
                path: 'orderedItems.product',
                select: 'name images originalPrice salesPrice',
            })
            .populate({
                path: 'orderedItems.variant',
                select: 'size quantity',
            });

        if (!order) {
            return next(new AppError('Order not found', 404));
        }

        // ⭐ Format all order items (NOT just one)
        const orderItems = order.orderedItems.map((item) => {
            const originalItemPrice =
                Number(item.product?.originalPrice || 0) * item.quantity;
            const itemPrice = item.price * item.quantity;
            const discount = originalItemPrice - itemPrice;

            return {
                _id: item._id,
                productId: item.product._id,
                productName: item.productName,
                productImage:
                    item.product?.images?.[0] || '/images/placeholder.jpg',
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                totalPrice: itemPrice,
                originalItemPrice,
                discount: discount > 0 ? discount : 0,
                status: item.status,
                cancellationReason: item.cancellationReason,
                returnReason: item.returnReason,
                returnStatus: item.returnStatus,
                deliveredDate: item.deliveredDate,
                canCancel: ['Pending', 'Processing'].includes(item.status),
                canReturn:
                    item.status === 'Delivered' &&
                    item.deliveredDate &&
                    new Date() - new Date(item.deliveredDate) <=
                        7 * 24 * 60 * 60 * 1000,
            };
        });

        const shippingAddress = order.shippingAddress;

        return res.render('order-details-all', {
            order: {
                orderId: order.orderId,
                _id: order._id,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                couponCode: order.couponCode,
                totalPrice: order.totalPrice,
                totalSalePrice: order.totalSalePrice,
                discount: order.discount,
                couponDiscount: order.couponDiscount,
                createdAt: order.createdAt,
                finalAmount: order.finalAmount,
                itemCount: order.orderedItems.length,
            },

            orderItems, // ⭐ ALL ITEMS
            shippingAddress, // ⭐ Address
        });
    } catch (error) {
        console.error('Error in getOrderDetailsAllItems:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const renderFullInvoice = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate('userId', 'name email')
            .populate({
                path: 'orderedItems.product',
                select: 'name images originalPrice salesPrice',
            })
            .lean();

        if (!order) {
            return next(
                new AppError('Order not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        // Build all item-level invoice details
        const invoiceItems = order.orderedItems.map((item) => {
            const originalTotal =
                Number(item.product?.originalPrice || 0) * item.quantity;

            const salesTotal = item.price * item.quantity;

            const discount = originalTotal - salesTotal;

            return {
                _id: item._id,
                name: item.productName,
                image: item.product?.images?.[0] || '/images/placeholder.jpg',
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                originalTotal,
                salesTotal,
                discount: discount > 0 ? discount : 0,
                status: item.status,
            };
        });

        // Order-level totals
        const invoiceSummary = {
            subTotal: order.totalPrice, // total listing price
            discount: order.discount || 0,
            couponCode: order.couponCode || null,
            couponDiscount: order.couponDiscount || 0,
            finalAmount: order.finalAmount,
        };

        return res.render('invoice-all', {
            order,
            invoiceItems,
            invoiceSummary,
            user: order.userId,
        });
    } catch (error) {
        console.error('Error rendering full invoice:', error);
        next(error);
    }
};

export default {
    getOrders,
    getOrderDetails,
    renderItemInvoice,
    getOrderSuccessPage,
    getPaymentFailpage,
    listOrdersOnly,
    getOrderDetailsAllItems,
    renderFullInvoice,
};
