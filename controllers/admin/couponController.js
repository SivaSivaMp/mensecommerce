import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Coupon from '../../models/couponSchema.js';

const getCouponList = async (req, res, next) => {
    res.render('coupons-list');
};

const getAddCoupon = async (req, res, next) => {
    res.render('coupon-add');
};

export default { getAddCoupon, getCouponList };
