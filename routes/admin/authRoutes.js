import { Router } from 'express';
import adminAuthContoller from '../../controllers/admin/adminAuthContoller.js';
const router = Router();

router
    .route('/login')
    .get(adminAuthContoller.getAdminLogin)
    .post(adminAuthContoller.login);
router.route('/dashboard').get(adminAuthContoller.loadDashboard);

export default router;
