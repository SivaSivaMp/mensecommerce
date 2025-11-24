import { Router } from 'express';
import orderController from '../../controllers/user/orderController.js';
import orderFetchController from '../../controllers/user/orderFetchController.js';
const router = Router();

router.route('/place').post(orderController.placeOrder);
router.route('/cancel-item').post(orderController.cancelItem);
router.route('/return-item').post(orderController.returnItem);
router.route('/success/:orderId').get(orderFetchController.getOrderSuccessPage);
router.route('/verify').post(orderController.verifyPayment);
router.get('/failure/payment', orderFetchController.getPaymentFailpage);
router.post('/retry-payment', orderController.retryPayment);
router.get('/invoice/:orderId', orderFetchController.renderFullInvoice);
export default router;
