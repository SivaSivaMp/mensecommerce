import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Cart from '../../models/cartSchema.js';
import Product from '../../models/productSchema.js';
import Address from '../../models/addressSchema.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Order from '../../models/orderSchema.js';
const placeOrder = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const { shippingAddressId, paymentMethod } = req.body;

        if (!userId) {
            return next(new AppError('Please login to place an order', 401));
        }

        if (!shippingAddressId || !paymentMethod) {
            return next(
                new AppError(
                    'Shipping address and payment method are required',
                    400
                )
            );
        }

        if (!['cod', 'online'].includes(paymentMethod)) {
            return next(new AppError('Invalid payment method', 400));
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice',
            })
            .populate({
                path: 'items.variantId',
                select: 'quantity size',
            });

        if (!cart || cart.items.length === 0) {
            return next(new AppError('Cart is empty', 400));
        }

        const shippingAddress = await Address.findById(shippingAddressId);
        if (
            !shippingAddress ||
            shippingAddress.userId.toString() !== userId.toString()
        ) {
            return next(new AppError('Invalid shipping address', 404));
        }

        let totalPrice = 0;
        let totalDiscount = 0;
        const orderedItems = [];

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            const variant = await ProductVariant.findById(item.variantId._id);

            if (!product || !variant) {
                return next(new AppError('Product or variant not found', 404));
            }

            if (variant.quantity < item.quantity) {
                return next(
                    new AppError(`Insufficient stock for ${product.name}`, 400)
                );
            }

            const originalPrice = Number(product.originalPrice) || 0;
            const salePrice =
                product.salesPrice && Number(product.salesPrice) > 0
                    ? Number(product.salesPrice)
                    : originalPrice;

            const itemOriginalTotal = originalPrice * item.quantity;
            const itemSaleTotal = salePrice * item.quantity;
            const itemDiscount = itemOriginalTotal - itemSaleTotal;

            totalPrice += itemOriginalTotal;
            totalDiscount += itemDiscount;

            orderedItems.push({
                product: item.productId._id,
                variant: item.variantId._id,
                productName: product.name,
                quantity: item.quantity,
                price: salePrice,
                size: item.size,
                status: 'Pending',
            });

            variant.quantity -= item.quantity;
            await variant.save();
        }

        const shipping = 0;
        const finalAmount = totalPrice - totalDiscount + shipping;

        const order = new Order({
            userId,
            orderedItems,
            totalPrice,
            discount: totalDiscount,
            shipping,
            finalAmount,
            address: shippingAddressId,
            shippingAddress: {
                addressType: shippingAddress.addressType,
                name: shippingAddress.name,
                building: shippingAddress.building,
                street: shippingAddress.street,
                landmark: shippingAddress.landmark,
                city: shippingAddress.city,
                state: shippingAddress.state,
                pincode: shippingAddress.pincode,
                phone: shippingAddress.phone,
                altPhone: shippingAddress.altPhone,
            },
            status: 'Pending',
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'Pending' : 'Pending',
        });

        await order.save();

        await Cart.deleteOne({ userId });

        return res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            orderId: order.orderId,
            orderData: {
                _id: order._id,
                orderId: order.orderId,
                finalAmount: order.finalAmount,
                paymentMethod: order.paymentMethod,
            },
        });
    } catch (error) {
        console.error('Error in placeOrder:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const getOrders = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const page = parseInt(req.query.page) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.query || '';

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
                formattedOrders.push({
                    orderId: order.orderId,
                    orderMongoId: order._id,
                    productName: item.productName,
                    productImage:
                        item.product?.images?.[0] || '/images/placeholder.jpg',
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
        });
    } catch (error) {
        console.error('Error in getOrders:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const getOrderDetails = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const orderId = req.params.orderId;

        if (!userId) {
            return next(
                new AppError('Please login to view order details', 401)
            );
        }

        const order = await Order.findOne({ orderId: orderId })
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

        if (order.userId.toString() !== userId.toString()) {
            return next(new AppError('Unauthorized access', 403));
        }

        const orderedItems = order.orderedItems.map((item) => ({
            _id: item._id,
            productId: item.product._id,
            productName: item.productName,
            productImage:
                item.product?.images?.[0] || '/images/placeholder.jpg',
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.price * item.quantity,
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
        }));

        const orderSummary = {
            totalPrice: order.totalPrice,
            discount: order.discount,
            shipping: order.shipping,
            finalAmount: order.finalAmount,
            savings: order.discount,
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
                current: order.status === 'Pending',
            },
            {
                status: 'Processing',
                label: 'Processing',
                completed: [
                    'Processing',
                    'Shipped',
                    'Out for Delivery',
                    'Delivered',
                ].includes(order.status),
                current: order.status === 'Processing',
            },
            {
                status: 'Shipped',
                label: 'Shipped',
                completed: [
                    'Shipped',
                    'Out for Delivery',
                    'Delivered',
                ].includes(order.status),
                current: order.status === 'Shipped',
            },
            {
                status: 'Out for Delivery',
                label: 'Out for Delivery',
                completed: ['Out for Delivery', 'Delivered'].includes(
                    order.status
                ),
                current: order.status === 'Out for Delivery',
            },
            {
                status: 'Delivered',
                label: 'Delivered',
                completed: order.status === 'Delivered',
                current: order.status === 'Delivered',
            },
        ];

        const trackingInfo = order.trackingInfo || {};

        return res.render('order-details', {
            order: {
                orderId: order.orderId,
                _id: order._id,
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                createdAt: order.createdAt,
                deliveredAt: order.deliveredAt,
            },
            orderedItems: orderedItems,
            orderSummary: orderSummary,
            shippingAddress: shippingAddress,
            statusTimeline: statusTimeline,
            trackingInfo: trackingInfo,
        });
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        return next(new AppError('Internal server error', 500));
    }
};

export default { placeOrder, getOrders, getOrderDetails };
