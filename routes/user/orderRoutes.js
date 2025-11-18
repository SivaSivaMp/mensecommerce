import { Router } from 'express';
import orderController from '../../controllers/user/orderController.js';

const router = Router();

router.route('/place').post(orderController.placeOrder);
router.route('/cancel-item').post(orderController.cancelItem);
router.route('/return-item').post(orderController.returnItem);
router.route('/success/:orderId').get(orderController.getOrderSuccessPage);
router.route('/verify').post(orderController.verifyPayment);
router.get('/failure/payment', orderController.getPaymentFailpage);

export default router;
