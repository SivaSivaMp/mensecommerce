import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Coupon from '../../models/couponSchema.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';

const getCouponList = async (req, res, next) => {
    try {
        const search = req.query.search?.trim() || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const query = {};
        if (search) {
            query.code = { $regex: search, $options: 'i' };
        }
        const totalCoupon = await Coupon.countDocuments(query);
        const coupons = await Coupon.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalPages = Math.ceil(totalCoupon / limit);
        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: Array.from({ length: totalPages }, (_, i) => i + 1),
        };

        return res.render('coupons-list', {
            title: 'Coupons List',
            coupons,
            currentPage: page,
            totalPages,
            search,
            user: req.user || null,
            pagination,
        });
    } catch (error) {
        console.error('Error loading coupons list:', error);
        return next(
            new AppError(
                'Internal server error',
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            )
        );
    }
};

const getAddCoupon = async (req, res, next) => {
    res.render('coupon-add');
};

const addCoupon = async (req, res, next) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            maxDiscountAmount,
            minPurchaseAmount,
            startsAt,
            expiresAt,
            usageLimit,
            usageLimitPerUser,
        } = req.body;

        if (
            !code ||
            !discountType ||
            !discountValue ||
            !minPurchaseAmount ||
            !expiresAt ||
            !usageLimit
        ) {
            return next(
                new AppError(
                    'Please fill all required fields.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const codePattern = /^[A-Za-z0-9-]+$/;
        if (!codePattern.test(code)) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid coupon code. Only letters, numbers, and hyphens (-) are allowed.',
            });
        }
        const existingCoupon = await Coupon.findOne({
            code: code.toUpperCase(),
        });
        if (existingCoupon) {
            return next(
                new AppError(
                    'Coupon code already exists',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (discountType === 'percentage' && discountValue > 100) {
            return next(
                new AppError(
                    'Percentage discount cannot exceed 100%.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const invalid = [
            discountValue,
            usageLimit,
            minPurchaseAmount,
            usageLimit,
            maxDiscountAmount,
            usageLimitPerUser,
        ].some((v) => v < 0);
        if (invalid) {
            return next(
                new AppError(
                    'Numeric values cannot be negative',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const startDate = startsAt ? new Date(startsAt) : new Date();
        const endDate = new Date(expiresAt);

        if (endDate <= startDate) {
            return next(
                new AppError(
                    'Expiry date must be after start date.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const newCoupon = await Coupon.create({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue,
            maxDiscountAmount: maxDiscountAmount || null,
            minPurchaseAmount,
            startsAt: startDate,
            expiresAt: endDate,
            usageLimit,
            usageLimitPerUser,
        });
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Coupon created successfully!',
            data: newCoupon,
        });
    } catch (error) {
        console.error('Error creating coupon:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(
                (err) => err.message
            );
            return res.status(400).json({
                success: false,
                message: 'Validation failed.',
                errors: messages,
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Server error while creating coupon.',
        });
    }
};
const changeCouponStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const action = req.query.action;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return next(
                new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND)
            );
        }
        if (action === 'activate') {
            if (!coupon.isStarted()) {
                return next(
                    new AppError(
                        'Cannot activate coupon before it start date',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
            }
            if (coupon.isExpired()) {
                return next(
                    new AppError(
                        'Cannot activate coupon since it is expired',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
            }
            coupon.isActive = true;
        }
        if (action === 'deactivate') {
            coupon.isActive = false;
        }
        await coupon.save();
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Coupon ${
                action === 'activate' ? 'activated' : 'deactivated'
            } successfully.`,
        });
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating coupon status.',
        });
    }
};
const getEditCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            res.redirect('/admin/coupons');
        }
        res.render('coupon-edit', {
            title: 'Edit Coupon',
            coupon,
        });
    } catch (error) {
        console.error('Error loading edit coupon:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('admin/error', {
            message: 'Server error loading coupon edit page',
        });
    }
};
const editCoupon = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            code,
            description,
            discountType,
            discountValue,
            maxDiscountAmount,
            minPurchaseAmount,
            startsAt,
            expiresAt,
            usageLimit,
            usageLimitPerUser,
        } = req.body;
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return next(
                new AppError('coupon not Found', HTTP_STATUS.NOT_FOUND)
            );
        }
        if (
            !code ||
            !discountType ||
            !discountValue ||
            !minPurchaseAmount ||
            !expiresAt ||
            !usageLimit
        ) {
            return next(
                new AppError(
                    'Please fill all required fields.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const codePattern = /^[A-Za-z0-9-]+$/;
        if (!codePattern.test(code)) {
            return next(
                new AppError(
                    'Invalid coupon code. Only letters, numbers, and hyphens (-) are allowed.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (minPurchaseAmount <= discountValue) {
            return next(
                new AppError(
                    'minimum purchase amount should be greater than discount value'
                )
            );
        }
        const existingCoupon = await Coupon.findOne({
            code: code.toUpperCase(),
            _id: { $ne: id },
        });
        if (existingCoupon) {
            return next(
                new AppError(
                    'Coupon code already exists',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (discountType === 'percentage' && discountValue > 100) {
            return next(
                new AppError(
                    'Percentage discount cannot exceed 100%.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const invalid = [
            discountValue,
            usageLimit,
            minPurchaseAmount,
            usageLimit,
            maxDiscountAmount,
            usageLimitPerUser,
        ].some((v) => v < 0);
        if (invalid) {
            return next(
                new AppError(
                    'Numeric values cannot be negative',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const startDate = startsAt ? new Date(startsAt) : new Date();
        const endDate = new Date(expiresAt);

        if (endDate <= startDate) {
            return next(
                new AppError(
                    'Expiry date must be after start date.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        // if (startDate < new Date()) {
        //     return next(
        //         new AppError(
        //             'start date should not be before todays date',
        //             HTTP_STATUS.BAD_REQUEST
        //         )
        //     );
        // }
        Object.assign(coupon, {
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue,
            maxDiscountAmount: maxDiscountAmount || null,
            minPurchaseAmount,
            startsAt,
            expiresAt,
            usageLimit,
            usageLimitPerUser,
        });
        await coupon.save();
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Coupon updated successfully!',
            data: coupon,
        });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error while updating coupon.',
        });
    }
};
export default {
    getAddCoupon,
    getCouponList,
    addCoupon,
    changeCouponStatus,
    getEditCoupon,
    editCoupon,
};
