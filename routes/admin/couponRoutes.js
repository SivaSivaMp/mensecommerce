import { Router } from 'express';
import couponController from '../../controllers/admin/couponController.js';

const router = Router();

router.route('/').get(couponController.getCouponList);
router
    .route('/add')
    .get(couponController.getAddCoupon)
    .post(couponController.addCoupon);
router.route('/toggle/:id').get(couponController.changeCouponStatus);
router
    .route('/edit/:id')
    .get(couponController.getEditCoupon)
    .post(couponController.editCoupon);
export default router;
