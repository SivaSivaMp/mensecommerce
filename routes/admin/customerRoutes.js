import customerController from '../../controllers/admin/customerController.js';
import { Router } from 'express';

const router = Router();

router.route('/').get(customerController.customerInfo);
router.route('/blockCustomer').get(customerController.customerBlocked);
router.route('/unblockCustomer').get(customerController.customerUnBlocked);

export default router;
