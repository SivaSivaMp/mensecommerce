import { Router } from 'express';
import orderController from '../../controllers/admin/orderController.js';

const router = Router();

router.route('/').get(orderController.getOrdersList);
router.route('/details').get(orderController.getOrderDetails);
export default router;
