import { Router } from 'express';
import checkoutController from '../../controllers/user/checkoutController.js';

const router = Router();

router.route('/').get(checkoutController.getCheckout);
router.route('/add-address').get(checkoutController.getCheckoutAddAddress);
router
    .route('/edit-address/:id')
    .get(checkoutController.getCheckoutEditAddress);

router.post('/apply-coupon', checkoutController.applyCoupon);
router.get('/remove-coupon', checkoutController.removeCoupon);
router.get('/available-coupons', checkoutController.getAvailableCoupons);

export default router;
