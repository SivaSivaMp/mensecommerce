import { Router } from 'express';
import orderController from '../../controllers/user/orderController.js';

const router = Router();

router.route('/place').post(orderController.placeOrder);

export default router;
