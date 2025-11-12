import { Router } from 'express';
import walletController from '../../controllers/user/walletController.js';

const router = Router();

router.route('/create-order').post(walletController.createWalletOrder);
router.route('/verify-payment').post(walletController.verifyWalletPayment);
export default router;
