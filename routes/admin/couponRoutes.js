import { Router } from 'express';
import couponController from '../../controllers/admin/couponController.js';

const router = Router();

router.route('/').get(couponController.getCouponList);
router.route('/add').get(couponController.getAddCoupon);

export default router;
