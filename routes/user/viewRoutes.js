import { Router } from 'express';
import viewController from '../../controllers/user/viewController.js';

const router = Router();

router.route('/').get(viewController.loadHomepage);
router.route('/shop').get(viewController.loadShoppingPage);
router.route('/product-details').get(viewController.getProductDetails);

export default router;
