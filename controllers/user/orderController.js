import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Cart from '../../models/cartSchema.js';
import Product from '../../models/productSchema.js';
import Address from '../../models/addressSchema.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Wallet from '../../models/walletSchema.js';
import Order from '../../models/orderSchema.js';
import Coupon from '../../models/couponSchema.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import razorpay from '../../config/razorpay.js';
import crypto from 'crypto';
/**
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns
 */
const placeOrder = async (req, res, next) => {
    let appliedCouponCode = null;
    let couponId = null;

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

        if (!['cod', 'online', 'wallet'].includes(paymentMethod)) {
            return next(new AppError('Invalid payment method', 400));
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice category',
            })
            .populate({
                path: 'items.variantId',
                select: 'quantity size',
            })
            .populate({
                path: 'appliedCoupon.couponId',
                select: 'code discountType discountValue maxDiscountAmount minPurchaseAmount usageLimit isActive startsAt expiresAt usedUsers',
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
        let totalSalePrice = 0;
        let totalDiscount = 0;
        const orderedItems = [];

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id).populate(
                'category',
                'isListed categoryName'
            );
            const variant = await ProductVariant.findById(item.variantId._id);

            if (!product || !variant) {
                return next(new AppError('Product or variant not found', 404));
            }

            if (!product.isListed) {
                return next(
                    new AppError(
                        `The item ${product.name} is currently unavailable, please remove it to place order`,
                        400
                    )
                );
            }

            if (!product.category || !product.category.isListed) {
                return next(
                    new AppError(
                        `The category ${
                            product.category?.categoryName || 'for this product'
                        } is currently unavailable, please remove it to place order`,
                        400
                    )
                );
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
            totalSalePrice += itemSaleTotal;
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
        }

        const shipping = 0;
        const subtotal = totalPrice - totalDiscount;
        let finalAmount = subtotal + shipping;
        let couponDiscount = 0;

        if (cart.appliedCoupon && cart.appliedCoupon.couponId) {
            const coupon = cart.appliedCoupon.couponId;

            if (!coupon || !coupon.isActive) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                await cart.save();
                return next(
                    new AppError('Applied coupon is no longer valid', 400)
                );
            }

            const now = new Date();
            if (now > new Date(coupon.expiresAt)) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                await cart.save();
                return next(new AppError('Coupon has expired', 400));
            }

            if (now < new Date(coupon.startsAt)) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                await cart.save();
                return next(new AppError('Coupon has not started yet', 400));
            }

            if (subtotal < coupon.minPurchaseAmount) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                await cart.save();
                return next(
                    new AppError(
                        `Minimum purchase of ₹${coupon.minPurchaseAmount} required`,
                        400
                    )
                );
            }

            if (
                coupon.usedUsers &&
                coupon.usedUsers.length >= coupon.usageLimit
            ) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                await cart.save();
                return next(
                    new AppError(
                        'Coupon usage limit reached please try any other coupon',
                        400
                    )
                );
            }

            const userIdString = userId.toString();

            const hasUsedCoupon =
                coupon.usedUsers &&
                coupon.usedUsers.some((id) => id.toString() === userIdString);

            if (hasUsedCoupon) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                await cart.save();
                return next(
                    new AppError('You have already used this coupon', 400)
                );
            }

            let calculatedDiscount = 0;
            if (coupon.discountType === 'flat') {
                calculatedDiscount = coupon.discountValue;
            } else if (coupon.discountType === 'percentage') {
                calculatedDiscount = (subtotal * coupon.discountValue) / 100;
                if (coupon.maxDiscountAmount) {
                    calculatedDiscount = Math.min(
                        calculatedDiscount,
                        coupon.maxDiscountAmount
                    );
                }
            }

            couponDiscount = Math.round(calculatedDiscount);
            finalAmount = Math.max(subtotal - couponDiscount + shipping, 0);
            appliedCouponCode = coupon.code;
            couponId = coupon._id;
        }
        // cod
        if (paymentMethod === 'cod') {
            for (const item of orderedItems) {
                await ProductVariant.updateOne(
                    { _id: item.variant },
                    { $inc: { quantity: -item.quantity } }
                );
            }
            if (finalAmount > 1000) {
                return next(
                    new AppError(
                        'Your Total exceeds 1000, please try wallet payment or online payment for completing the order',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
            }
            const order = new Order({
                userId,
                orderedItems,
                totalPrice,
                totalSalePrice,
                discount: totalDiscount,
                couponDiscount: couponDiscount,
                couponCode: appliedCouponCode,
                couponId: couponId,
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
                paymentStatus: 'Pending',
            });
            if (couponId) {
                await Coupon.updateOne(
                    { _id: couponId },
                    { $addToSet: { usedUsers: userId } }
                );
            }
            await order.save();
            await Cart.deleteOne({ userId });

            return res.status(201).json({
                success: true,
                message: 'Order placed successfully (COD)',
                orderId: order.orderId,
            });
        }
        // wallet
        if (paymentMethod === 'wallet') {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < finalAmount)
                return next(new AppError('Insufficient wallet balance', 400));
            for (const item of orderedItems) {
                await ProductVariant.updateOne(
                    { _id: item.variant },
                    { $inc: { quantity: -item.quantity } }
                );
            }
            const order = new Order({
                userId,
                orderedItems,
                totalPrice,
                totalSalePrice,
                discount: totalDiscount,
                couponDiscount: couponDiscount,
                couponCode: appliedCouponCode,
                couponId: couponId,
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
                paymentMethod: 'wallet',
                paymentStatus: 'Completed',
            });

            await wallet.addTransaction(
                'debit',
                finalAmount,
                'Order payment',
                order._id,
                order._id,
                order.orderId
            );
            if (couponId) {
                await Coupon.updateOne(
                    { _id: couponId },
                    { $addToSet: { usedUsers: userId } }
                );
            }
            order.paymentStatus = 'Completed';
            await order.save();
            await Cart.deleteOne({ userId });

            return res.status(201).json({
                success: true,
                message: 'Order placed successfully (Wallet)',
                orderId: order.orderId,
            });
        }

        // online
        if (paymentMethod === 'online') {
            const razorpayOrder = await razorpay.orders.create({
                amount: finalAmount * 100,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
            });

            return res.status(201).json({
                success: true,
                message: 'Razorpay order created',
                razorpayOrderId: razorpayOrder.id,
                amount: finalAmount,
                currency: 'INR',
                pendingOrder: {
                    userId,
                    orderedItems,
                    totalPrice,
                    totalSalePrice,
                    discount: totalDiscount,
                    couponDiscount: couponDiscount,
                    couponCode: appliedCouponCode,
                    couponId: couponId,
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
                },
            });
        }
    } catch (error) {
        console.error('placeOrder Error:', error);
        return res
            .status(500)
            .json({ success: false, message: 'Internal Server Error' });
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            pendingOrder,
        } = req.body;

        const hmac = crypto.createHmac(
            'sha256',
            process.env.RAZORPAY_KEY_SECRET
        );
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed',
            });
        }

        for (const item of pendingOrder.orderedItems) {
            await ProductVariant.updateOne(
                { _id: item.variant },
                { $inc: { quantity: -item.quantity } }
            );
        }

        const order = new Order({
            ...pendingOrder,
            paymentMethod: 'online',
            paymentStatus: 'Completed',
            status: 'Pending',
        });

        await order.save();

        if (pendingOrder.couponId) {
            await Coupon.updateOne(
                { _id: pendingOrder.couponId },
                { $addToSet: { usedUsers: pendingOrder.userId } }
            );
        }

        await Cart.deleteOne({ userId: pendingOrder.userId });

        return res.status(200).json({
            success: true,
            message: 'Payment verified and order confirmed',
            orderId: order.orderId,
        });
    } catch (err) {
        console.error('Payment verification error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error verifying payment',
            orderId: req.body.orderId,
        });
    }
};

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
const cancelItem = async (req, res, next) => {
    try {
        const { itemId, reason } = req.body;
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(new AppError('Please login to cancel items', 401));
        }

        if (!itemId || !reason) {
            return next(new AppError('Item ID and reason are required', 400));
        }

        const order = await Order.findOne({
            userId,
            'orderedItems._id': itemId,
        }).populate('couponId');
        if (!order) {
            return next(new AppError('Order item not found', 404));
        }

        const item = order.orderedItems.id(itemId);
        if (!item) return next(new AppError('Item not found', 404));

        const cancellableStatuses = ['Pending', 'Processing'];
        if (!cancellableStatuses.includes(item.status)) {
            return next(
                new AppError(
                    `Cannot cancel item with status: ${item.status}`,
                    400
                )
            );
        }

        const itemTotal = item.price * item.quantity;

        item.status = 'Cancelled';
        item.cancellationReason = reason;

        const productVariant = await ProductVariant.findById(item.variant);
        if (productVariant) {
            productVariant.quantity += item.quantity;
            await productVariant.save();
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

        const originalFinalAmount = order.finalAmount;
        const newFinalAmount = Math.max(newActiveTotal - newCouponDiscount, 0);

        const refundAmount = Number(
            (originalFinalAmount - newFinalAmount).toFixed(2)
        );

        if (
            refundAmount > 0 &&
            (order.paymentMethod === 'online' ||
                order.paymentMethod === 'wallet')
        ) {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ userId, balance: 0, transactions: [] });
            }

            await wallet.addTransaction(
                'credit',
                refundAmount,
                `Refund for cancelled item: ${item.productName}`,
                order._id,
                item._id,
                order.orderId
            );
        }

        order.finalAmount = newFinalAmount;

        if (activeItems.length === 0) {
            order.status = 'Cancelled';
        }

        await order.save();

        return res.status(200).json({
            success: true,
            refundAmount,
            message:
                refundAmount > 0
                    ? `Item cancelled. ₹${refundAmount} refunded to wallet.`
                    : 'Item cancelled successfully.',
        });
    } catch (error) {
        return next(
            new AppError(`Failed to cancel item: ${error.message}`, 500)
        );
    }
};
const returnItem = async (req, res, next) => {
    try {
        const { itemId, reason } = req.body;
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next(new AppError('Please login to return items', 401));
        }

        if (!itemId || !reason) {
            return next(new AppError('Item ID and reason are required', 400));
        }

        const order = await Order.findOne({
            userId: userId,
            'orderedItems._id': itemId,
        });

        if (!order) {
            return next(new AppError('Order item not found', 404));
        }

        const item = order.orderedItems.id(itemId);

        if (!item) {
            return next(new AppError(' item not found', 404));
        }

        if (item.status !== 'Delivered') {
            return next(
                new AppError('Only delivered items can be returned', 400)
            );
        }

        if (
            [
                'Return Request',
                'Return Approved',
                'Return Rejected',
                'Returned',
            ].includes(item.status)
        ) {
            return next(
                new AppError('Return request already exists for this item', 400)
            );
        }

        if (!item.deliveredDate) {
            return next(new AppError('Delivery date not found', 400));
        }

        const daysSinceDelivery =
            (new Date() - new Date(item.deliveredDate)) / (1000 * 60 * 60 * 24);

        if (daysSinceDelivery > 7) {
            return next(
                new AppError(
                    'Return window has expired. Returns are only allowed within 7 days of delivery',
                    400
                )
            );
        }

        item.status = 'Return Request';
        item.returnStatus = 'Requested';
        item.returnReason = reason;
        item.returnRequestDate = new Date();

        const activeItems = order.orderedItems.filter(
            (orderItem) =>
                ![
                    'Cancelled',
                    'Return Request',
                    'Return Approved',
                    'Returned',
                ].includes(orderItem.status)
        );

        if (activeItems.length === 0) {
            order.status = 'Return Request';
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message:
                'Return request submitted successfully. We will review your request shortly.',
            order: order,
        });
    } catch (error) {
        console.error('Error in returnItem:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit return request',
        });
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

export default {
    placeOrder,
    getOrders,
    getOrderDetails,
    cancelItem,
    returnItem,
    renderItemInvoice,
    getOrderSuccessPage,
    verifyPayment,
    getPaymentFailpage,
};
