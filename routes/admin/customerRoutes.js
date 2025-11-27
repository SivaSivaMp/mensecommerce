import customerController from '../../controllers/admin/customerController.js';
import { Router } from 'express';

const router = Router();

router.route('/').get(customerController.customerInfo);
router.route('/:id/block').put(customerController.customerBlocked);
router.route('/:id/unblock').put(customerController.customerUnBlocked);

export default router;
