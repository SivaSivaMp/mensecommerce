import { Router } from 'express';
import adminAuthContoller from '../../controllers/admin/adminAuthContoller.js';
import adminDashboardController from '../../controllers/admin/adminDashboardController.js';
import reportController from '../../controllers/admin/reportController.js';
const router = Router();

router
    .route('/login')
    .get(adminAuthContoller.getAdminLogin)
    .post(adminAuthContoller.login);
router.route('/logout').get(adminAuthContoller.logout);
router.route('/dashboard').get(adminDashboardController.loadDashboard);
router.route('/dashboard-summary').get(adminDashboardController.getSummary);
router
    .route('/reports/dashboard-excel')
    .get(reportController.generateDashboardExcel);
router
    .route('/reports/dashboard-pdf')
    .get(reportController.generateDashboardPDF);
export default router;
