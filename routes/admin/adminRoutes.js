import { Router } from 'express';
import authRoutes from './authRoutes.js';
import customerRoutes from './customerRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import productRoutes from './productRoutes.js';

const adminRouter = Router();

adminRouter.use('/', authRoutes);
adminRouter.use('/users', customerRoutes);
adminRouter.use('/category', categoryRoutes);
adminRouter.use('/product', productRoutes);

export default adminRouter;
