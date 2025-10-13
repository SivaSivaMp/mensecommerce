import { Router } from 'express';
import cartController from '../../controllers/user/cartController.js';

const router = Router();

router.route('/').get(cartController.viewCart);
router.route('/:productId').post(cartController.addToCart);
router.delete('/remove/:itemId', cartController.removeFromCart);
router.put('/update/:itemId', cartController.updateCartQuantity);
export default router;
