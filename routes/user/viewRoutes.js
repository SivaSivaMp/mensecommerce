import { Router } from 'express';
import viewController from '../../controllers/user/viewController.js';

const router = Router();

router.route('/').get(viewController.loadHomepage);
router.route('/shop').get(viewController.loadShoppingPage);
router.route('/product-details').get(viewController.getProductDetails);
router.route('/about-us').get(viewController.getAboutus);
router
    .route('/contact')
    .get(viewController.getContact)
    .post(viewController.getinTouch);
router.route('/privacy-policy').get(viewController.getPrivacyPolicy);
export default router;
