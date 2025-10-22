import customerController from '../../controllers/admin/customerController.js';
import { Router } from 'express';

const router = Router();

router.route('/').get(customerController.customerInfo);
router.route('/blockCustomer').patch(customerController.customerBlocked);
router.route('/unblockCustomer').patch(customerController.customerUnBlocked);

export default router;
