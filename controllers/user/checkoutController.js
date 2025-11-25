import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';

import Address from '../../models/addressSchema.js';
import Cart from '../../models/cartSchema.js';

import Coupon from '../../models/couponSchema.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import { calculatePriceDetails } from '../../helpers/calculatePriceDetails.js';

const getCheckout = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 2;

        if (!userId) {
            return next(
                new AppError(
                    'Please login to proceed to checkout',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice images isListed category',
                populate: { path: 'category', select: 'isListed categoryName' },
            })
            .populate({
                path: 'appliedCoupon.couponId',
                select: 'code discountValue discountType maxDiscountAmount minPurchaseAmount expiresAt isActive',
            });

        if (!cart || !cart.items.length) {
            return res.render('checkout', {
                cartItems: [],
                cartEmpty: true,
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,
                    totalAmount: 0,
                    savings: 0,
                },
                addresses: [],
                currentPage: 1,
                totalPages: 0,
                pagination: {
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: null,
                    prevPage: null,
                },
                couponCode: null,
                discount: 0,
            });
        }

        const { cartItems, priceDetails, couponCode, couponDiscount } =
            await calculatePriceDetails(cart);

        const totalAddresses = await Address.countDocuments({ userId });
        const totalPages = Math.ceil(totalAddresses / itemsPerPage);
        const validPage = Math.min(Math.max(page, 1), totalPages || 1);

        const addresses = await Address.find({ userId })
            .sort({ createdAt: -1 })
            .skip((validPage - 1) * itemsPerPage)
            .limit(itemsPerPage);

        const formattedAddresses = addresses.map((addr) => ({
            _id: addr._id,
            addressType: addr.addressType,
            name: addr.name,
            phone: addr.phone,
            altPhone: addr.altPhone,
            pincode: addr.pincode,
            city: addr.city,
            street: addr.street,
            building: addr.building,
            landmark: addr.landmark,
            state: addr.state,
            fullAddress: `${addr.building}, ${addr.street}${
                addr.landmark ? ', ' + addr.landmark : ''
            }, ${addr.city}, ${addr.state} - ${addr.pincode}`,
        }));

        const pagination = {
            hasNextPage: validPage < totalPages,
            hasPrevPage: validPage > 1,
            nextPage: validPage < totalPages ? validPage + 1 : null,
            prevPage: validPage > 1 ? validPage - 1 : null,
        };

        return res.render('checkout', {
            cartItems,
            cartEmpty: false,
            priceDetails,
            itemCount: cartItems.length,
            addresses: formattedAddresses,
            currentPage: validPage,
            totalPages,
            pagination,
            couponCode,
            discount: couponDiscount,
        });
    } catch (error) {
        console.error('Error in getCheckout:', error);
        return next(
            new AppError(
                'Internal server error',
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            )
        );
    }
};
const getCheckoutAddAddress = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(
                new AppError(
                    'Please login to view cart',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice images isListed category',
                populate: { path: 'category', select: 'isListed categoryName' },
            })
            .populate({
                path: 'appliedCoupon.couponId',
                select: 'code discountValue discountType maxDiscountAmount minPurchaseAmount expiresAt isActive',
            });

        if (!cart || cart.items.length === 0) {
            return res.render('cart', {
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,
                    totalAmount: 0,
                    savings: 0,
                },
                itemCount: 0,
            });
        }
        const { priceDetails, couponCode, couponDiscount } =
            await calculatePriceDetails(cart);
        return res.render('checkout-addaddress', {
            priceDetails: priceDetails,
            itemCount: cart.items.length,
            couponCode,
            discount: couponDiscount,
        });
    } catch (error) {
        console.log('error while loading checkout edit address', error);
    }
};
const getCheckoutEditAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userAddress = await Address.findById(id);

        if (!userAddress) {
            return next(
                new AppError('address not found', HTTP_STATUS.BAD_REQUEST)
            );
        }
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(
                new AppError(
                    'Please login to view cart',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice images isListed category',
                populate: { path: 'category', select: 'isListed categoryName' },
            })
            .populate({
                path: 'appliedCoupon.couponId',
                select: 'code discountValue discountType maxDiscountAmount minPurchaseAmount expiresAt isActive',
            });
        if (!cart || cart.items.length === 0) {
            return res.render('cart', {
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,

                    totalAmount: 0,
                    savings: 0,
                },
                itemCount: 0,
            });
        }
        const { priceDetails, couponCode, couponDiscount } =
            await calculatePriceDetails(cart);
        res.render('checkout-editaddress', {
            address: userAddress,
            priceDetails: priceDetails,
            itemCount: cart.items.length,
            couponCode,
            discount: couponDiscount,
        });
    } catch (error) {
        console.log('error while geting edit address');
        next(error);
    }
};
const applyCoupon = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const couponCode = req.body.couponcode;
        const { totalAmount } = req.body;

        if (!userId) {
            return next(
                new AppError('Please login first', HTTP_STATUS.UNAUTHORIZED)
            );
        }
        const cart = await Cart.findOne({ userId });
        if (!cart || cart.items.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Cart is empty',
            });
        }
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            isActive: true,
        });
        if (!couponCode || !totalAmount) {
            return next(
                new AppError(
                    'Coupon code and total amount are required',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        if (!coupon) {
            return next(
                new AppError('Invalid coupon code', HTTP_STATUS.BAD_REQUEST)
            );
        }

        if (coupon.isExpired()) {
            return next(
                new AppError('Coupon has expired', HTTP_STATUS.BAD_REQUEST)
            );
        }

        if (!coupon.isStarted()) {
            return next(
                new AppError('Coupon not started yet', HTTP_STATUS.BAD_REQUEST)
            );
        }

        const total = parseFloat(totalAmount);
        if (total < coupon.minPurchaseAmount) {
            return next(
                new AppError(
                    `Minimum purchase of ₹${coupon.minPurchaseAmount} required`,
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        if (!coupon.isUserEligible(userId)) {
            return next(
                new AppError(
                    `You have already used this coupon or not eligible`,
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (coupon.usedUsers.length >= coupon.usageLimit) {
            return next(
                new AppError(
                    'Coupon usage limit reached',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        let discount = 0;
        if (coupon.discountType === 'flat') {
            discount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
            discount = (total * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount)
                discount = Math.min(discount, coupon.maxDiscountAmount);
        }

        const newTotal = Math.max(total - discount, 0);
        cart.appliedCoupon = {
            couponId: coupon._id,
            code: coupon.code,
            discount: discount,
            appliedAt: new Date(),
        };

        await cart.save();
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon applied successfully!',
            couponCode: coupon.code,
            discount: Math.round(discount),
            finalAmount: Math.round(newTotal),
            applied: true,
        });
    } catch (error) {
        console.error('Error in applyCoupon:', error);
        return res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json({ success: false, message: 'Failed to apply coupon' });
    }
};

const removeCoupon = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(
                new AppError('Please login firs', HTTP_STATUS.UNAUTHORIZED)
            );
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || !cart.appliedCoupon?.code) {
            return next(
                new AppError('No coupon applied', HTTP_STATUS.BAD_REQUEST)
            );
        }

        cart.appliedCoupon = {
            couponId: null,
            code: null,
            discount: 0,
            appliedAt: null,
        };
        await cart.save();

        const subtotal = cart.items.reduce(
            (sum, item) => sum + item.productId.salesPrice * item.quantity,
            0
        );

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon removed successfully',
            finalAmount: Math.round(subtotal),
        });
    } catch (error) {
        console.error('Error in removeCoupon:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to remove coupon',
        });
    }
};
const getAvailableCoupons = async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId)
            return res
                .status(HTTP_STATUS.UNAUTHORIZED)
                .json({ success: false, message: 'Please login first' });

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || !cart.items.length)
            return res
                .status(HTTP_STATUS.BAD_REQUEST)
                .json({ success: false, message: 'Your cart is empty' });

        const cartTotal = cart.items.reduce(
            (sum, item) => sum + item.productId.salesPrice * item.quantity,
            0
        );

        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            startsAt: { $lte: now },
            expiresAt: { $gte: now },
        }).lean();

        const eligibleCoupons = coupons.filter((coupon) => {
            const notExpired = new Date() <= new Date(coupon.expiresAt);
            const meetsMin = cartTotal >= coupon.minPurchaseAmount;
            const notUsed = !coupon.usedUsers.includes(userId);
            return notExpired && meetsMin && notUsed;
        });

        if (!eligibleCoupons.length)
            return res.status(200).json({
                success: true,
                coupons: [],
                message: 'No coupons available for your current total.',
            });

        res.status(200).json({
            success: true,
            coupons: eligibleCoupons,
        });
    } catch (err) {
        console.error('Error in getAvailableCoupons:', err);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch coupons',
        });
    }
};

export default {
    getCheckout,
    getCheckoutAddAddress,
    getCheckoutEditAddress,
    applyCoupon,
    removeCoupon,
    getAvailableCoupons,
};
