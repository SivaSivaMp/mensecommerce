import { Router } from 'express';
import adminAuthContoller from '../../controllers/admin/adminAuthContoller.js';
import adminDashboardController from '../../controllers/admin/adminDashboardController.js';
import reportController from '../../controllers/admin/reportController.js';
import auth from '../../middleware/auth.js';
const router = Router();

router
    .route('/login')
    .get(adminAuthContoller.getAdminLogin)
    .post(adminAuthContoller.login);
router.route('/logout').get(adminAuthContoller.logout);
router
    .route('/dashboard')
    .get(auth.adminCheck, adminDashboardController.loadDashboard);
router
    .route('/dashboard-summary')
    .get(auth.adminCheck, adminDashboardController.getSummary);
router
    .route('/reports/dashboard-excel')
    .get(auth.adminCheck, reportController.generateDashboardExcel);
router
    .route('/reports/dashboard-pdf')
    .get(auth.adminCheck, reportController.generateDashboardPDF);
router
    .route('/reports/validate')
    .post(auth.adminCheck, reportController.validateReportRequest);

router.get('/dashboard-charts', adminDashboardController.getDashboardCharts);
export default router;
