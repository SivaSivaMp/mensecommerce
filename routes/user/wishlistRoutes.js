import { Router } from 'express';
import wishlistController from '../../controllers/user/wishlistController.js';
const router = Router();

router.route('/').get(wishlistController.getWishlist);
router.route('/:productId').post(wishlistController.addToWishlist);
router.post('/remove/:productId', wishlistController.removeFromWishlist);

export default router;
