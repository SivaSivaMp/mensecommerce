import { Router } from 'express';
import cartController from '../../controllers/user/cartController.js';
import auth from '../../middleware/auth.js';
const router = Router();

router.route('/').get(auth.userAuth, cartController.viewCart);
router.route('/validate').get(auth.userAuth, cartController.validateCart);
router.route('/:productId').post(cartController.addToCart);
router.delete('/remove/:itemId', cartController.removeFromCart);
router.put('/update/:itemId', cartController.updateCartQuantity);
export default router;
