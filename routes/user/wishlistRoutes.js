import { Router } from 'express';
import wishlistController from '../../controllers/user/wishlistController.js';
import auth from '../../middleware/auth.js';
const router = Router();

router.route('/').get(auth.userAuth, wishlistController.getWishlist);
router.route('/:productId').post(wishlistController.addToWishlist);
router.post('/remove/:productId', wishlistController.removeFromWishlist);

export default router;
