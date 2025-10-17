import { Router } from 'express';
import authRoutes from './authRoutes.js';
import customerRoutes from './customerRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import productRoutes from './productRoutes.js';
import auth from '../../middleware/auth.js';
import orderRoutes from './orderRoutes.js';
const adminRouter = Router();

adminRouter.use('/', authRoutes);
adminRouter.use('/users', auth.adminCheck, customerRoutes);
adminRouter.use('/category', auth.adminCheck, categoryRoutes);
adminRouter.use('/product', auth.adminCheck, productRoutes);
adminRouter.use('/orders', auth.adminCheck, orderRoutes);
adminRouter.use('/pagenotfound', async (req, res) => {
    res.render('adminpage-404');
});

export default adminRouter;
