import { Router } from 'express';
import viewController from '../../controllers/user/viewController.js';

const router = Router();

router.route('/').get(viewController.loadHomepage);

export default router;
