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
import {
    calculateCartTotals,
    calculateCouponDiscount,
    calculateShipping,
} from '../../helpers/orderCalculation.js';
/**
 *order placement management
 *basic  validation, cart stock calculation. and places order according to the payment method
 
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns Order confirmation / payment initiation response
 */
const placeOrder = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const { shippingAddressId, paymentMethod } = req.body;

        if (!userId)
            return next(
                new AppError(
                    'Please login to place an order',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );

        if (!shippingAddressId || !paymentMethod)
            return next(
                new AppError(
                    'Shipping address and payment method are required',
                    HTTP_STATUS.BAD_REQUEST
                )
            );

        if (!['cod', 'online', 'wallet'].includes(paymentMethod))
            return next(
                new AppError('Invalid payment method', HTTP_STATUS.BAD_REQUEST)
            );

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice category ',
            })
            .populate({ path: 'items.variantId', select: 'quantity size' })
            .populate({ path: 'appliedCoupon.couponId' });

        if (!cart || cart.items.length === 0)
            return next(new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST));

        const shippingAddress = await Address.findById(shippingAddressId);
        if (
            !shippingAddress ||
            shippingAddress.userId.toString() !== userId.toString()
        )
            return next(
                new AppError('Invalid shipping address', HTTP_STATUS.NOT_FOUND)
            );

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id).populate(
                'category',
                'isListed categoryName'
            );
            const variant = await ProductVariant.findById(item.variantId._id);

            if (!product || !variant)
                return next(
                    new AppError(
                        'Product or variant not found',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );

            if (!product.isListed)
                return next(
                    new AppError(
                        `${product.name} is currently unavailable`,
                        HTTP_STATUS.BAD_REQUEST
                    )
                );

            if (!product.category?.isListed)
                return next(
                    new AppError(
                        `Category ${product.category.categoryName} is unavailable`,
                        HTTP_STATUS.BAD_REQUEST
                    )
                );

            if (variant.quantity < item.quantity)
                return next(
                    new AppError(
                        `Insufficient stock for ${product.name}`,
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
        }

        const {
            orderedItems,
            totalPrice,
            totalSalePrice,
            totalDiscount,
            subtotal,
        } = await calculateCartTotals(cart);

        let couponDiscount = 0,
            couponId = null,
            couponCode = null;

        if (cart.appliedCoupon?.couponId) {
            const coupon = await Coupon.findById(cart.appliedCoupon.couponId);
            if (!coupon || !coupon.isActive)
                return next(
                    new AppError(' inactive coupon', HTTP_STATUS.BAD_REQUEST)
                );

            const now = new Date();
            if (now > coupon.expiresAt)
                return next(
                    new AppError('Coupon expired', HTTP_STATUS.BAD_REQUEST)
                );
            if (now < coupon.startsAt)
                return next(
                    new AppError('Coupon not started', HTTP_STATUS.BAD_REQUEST)
                );
            if (subtotal < coupon.minPurchaseAmount)
                return next(
                    new AppError(
                        `Minimum purchase of ₹${coupon.minPurchaseAmount} required`,
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
            if (coupon.usedUsers.includes(userId))
                return next(
                    new AppError(
                        'You have already used this coupon',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );

            const couponData = await calculateCouponDiscount(
                subtotal,
                cart.appliedCoupon,
                userId
            );
            couponDiscount = couponData.couponDiscount;
            couponId = couponData.couponId;
            couponCode = couponData.couponCode;
        }

        const amountAfterCoupon = subtotal - couponDiscount;
        const shipping = calculateShipping(amountAfterCoupon);
        const finalAmount = amountAfterCoupon + shipping;

        const orderPayload = {
            userId,
            orderedItems,
            totalPrice,
            totalSalePrice,
            discount: totalDiscount,
            couponDiscount,
            couponCode,
            couponId,
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
        };

        if (paymentMethod === 'cod') {
            if (finalAmount > 1000)
                return next(
                    new AppError(
                        'Total exceeds 1000, please choose online or wallet payment',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );

            for (const item of orderedItems) {
                await ProductVariant.updateOne(
                    { _id: item.variant },
                    { $inc: { quantity: -item.quantity } }
                );
            }

            const order = await Order.create(orderPayload);

            if (couponId)
                await Coupon.updateOne(
                    { _id: couponId },
                    { $addToSet: { usedUsers: userId } }
                );

            await Cart.deleteOne({ userId });

            return res.status(201).json({
                success: true,
                message: 'Order placed successfully (COD)',
                orderId: order.orderId,
            });
        }

        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < finalAmount)
                return next(
                    new AppError(
                        'Insufficient wallet balance',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );

            for (const item of orderedItems) {
                await ProductVariant.updateOne(
                    { _id: item.variant },
                    { $inc: { quantity: -item.quantity } }
                );
            }

            const order = await Order.create({
                ...orderPayload,
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

            if (couponId)
                await Coupon.updateOne(
                    { _id: couponId },
                    { $addToSet: { usedUsers: userId } }
                );

            await Cart.deleteOne({ userId });

            return res.status(201).json({
                success: true,
                message: 'Order placed successfully (Wallet)',
                orderId: order.orderId,
            });
        }

        if (paymentMethod === 'online') {
            const tempOrder = await Order.create({
                ...orderPayload,
                paymentStatus: 'Pending',
                status: 'Pending',
            });

            const razorpayOrder = await razorpay.orders.create({
                amount: finalAmount * 100,
                currency: 'INR',
                receipt: `order_${tempOrder._id}`,
            });

            return res.status(201).json({
                success: true,
                message: 'Proceed to payment',
                razorpayOrderId: razorpayOrder.id,
                orderDbId: tempOrder._id,
                amount: finalAmount,
                currency: 'INR',
            });
        }
    } catch (error) {
        console.error('placeOrder Error:', error);
        next(
            new AppError(
                'Internal Server Error',
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            )
        );
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderDbId,
        } = req.body;

        if (!orderDbId) {
            return res
                .status(HTTP_STATUS.BAD_REQUEST)
                .json({ success: false, message: 'Missing order reference' });
        }

        const hmac = crypto.createHmac(
            'sha256',
            process.env.RAZORPAY_KEY_SECRET
        );
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Payment verification failed',
            });
        }

        const order = await Order.findById(orderDbId);
        if (!order) {
            return res
                .status(HTTP_STATUS.NOT_FOUND)
                .json({ success: false, message: 'Order not found' });
        }

        if (order.paymentStatus === 'Completed') {
            return res.status(200).json({
                success: true,
                message: 'Payment already processed',
                orderId: order.orderId,
            });
        }

        for (const item of order.orderedItems) {
            const variant = await ProductVariant.findById(item.variant);

            if (!variant || variant.quantity < item.quantity) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: `Insufficient stock for ${item.productName}`,
                });
            }
        }

        for (const item of order.orderedItems) {
            await ProductVariant.updateOne(
                { _id: item.variant },
                { $inc: { quantity: -item.quantity } }
            );
        }

        if (order.couponId) {
            await Coupon.updateOne(
                { _id: order.couponId },
                { $addToSet: { usedUsers: order.userId } }
            );
        }

        order.paymentMethod = 'online';
        order.paymentStatus = 'Completed';
        order.status = 'Pending';
        await order.save();

        await Cart.deleteOne({ userId: order.userId });

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            orderId: order.orderId,
        });
    } catch (err) {
        console.error('verifyPayment Error:', err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error verifying payment',
        });
    }
};

const cancelItem = async (req, res, next) => {
    try {
        const { itemId, reason } = req.body;
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(
                new AppError(
                    'Please login to cancel items',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }

        if (!itemId || !reason) {
            return next(
                new AppError(
                    'Item ID and reason are required',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const order = await Order.findOne({
            userId,
            'orderedItems._id': itemId,
        }).populate('couponId');
        if (!order) {
            return next(
                new AppError('Order item not found', HTTP_STATUS.NOT_FOUND)
            );
        }

        const item = order.orderedItems.id(itemId);
        if (!item)
            return next(new AppError('Item not found', HTTP_STATUS.NOT_FOUND));

        const cancellableStatuses = ['Pending', 'Processing'];
        if (!cancellableStatuses.includes(item.status)) {
            return next(
                new AppError(
                    `Cannot cancel item with status: ${item.status}`,
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

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
            new AppError(
                `Failed to cancel item: ${error.message}`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            )
        );
    }
};
const returnItem = async (req, res, next) => {
    try {
        const { itemId, reason } = req.body;
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next(
                new AppError(
                    'Please login to return items',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }

        if (!itemId || !reason) {
            return next(
                new AppError(
                    'Item ID and reason are required',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const order = await Order.findOne({
            userId: userId,
            'orderedItems._id': itemId,
        });

        if (!order) {
            return next(
                new AppError('Order item not found', HTTP_STATUS.NOT_FOUND)
            );
        }

        const item = order.orderedItems.id(itemId);

        if (!item) {
            return next(new AppError(' item not found', HTTP_STATUS.NOT_FOUND));
        }

        if (item.status !== 'Delivered') {
            return next(
                new AppError(
                    'Only delivered items can be returned',
                    HTTP_STATUS.BAD_REQUEST
                )
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
                new AppError(
                    'Return request already exists for this item',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        if (!item.deliveredDate) {
            return next(
                new AppError('Delivery date not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        const daysSinceDelivery =
            (new Date() - new Date(item.deliveredDate)) / (1000 * 60 * 60 * 24);

        if (daysSinceDelivery > 7) {
            return next(
                new AppError(
                    'Return window has expired. Returns are only allowed within 7 days of delivery',
                    HTTP_STATUS.BAD_REQUEST
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
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to submit return request',
        });
    }
};
const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order)
            return res.json({ success: false, message: 'Order not found' });

        if (order.paymentStatus !== 'Pending') {
            return res.json({
                success: false,
                message: 'Payment is already completed or invalid',
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: order.finalAmount * 100,
            currency: 'INR',
            receipt: `retry_${order._id}`,
        });

        return res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            orderDbId: order._id,
            amount: order.finalAmount,
            currency: 'INR',
        });
    } catch (err) {
        console.log(err);
        return res.json({ success: false, message: 'Error retrying payment' });
    }
};

export default {
    placeOrder,
    cancelItem,
    returnItem,
    verifyPayment,
    retryPayment,
};
