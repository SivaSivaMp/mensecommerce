import { Router } from 'express';
import orderController from '../../controllers/admin/orderController.js';

const router = Router();

router.route('/').get(orderController.getOrdersList);
router.route('/:orderId').get(orderController.getAdminOrderDetails);
router.route('/update-status').post(orderController.updateOrderItemStatus);
export default router;
