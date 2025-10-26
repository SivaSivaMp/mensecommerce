import { Router } from 'express';
import orderController from '../../controllers/admin/orderController.js';

const router = Router();

router.route('/').get(orderController.getOrdersList);
router.route('/:orderId').get(orderController.getAdminOrderDetails);
router.route('/update-status').post(orderController.updateOrderItemStatus);
router.post('/approve-return', orderController.approveReturn);
router.post('/reject-return', orderController.rejectReturn);
router.post('/complete-return', orderController.completeReturn);
export default router;
