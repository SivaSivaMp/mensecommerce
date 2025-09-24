import { Router } from 'express';
import authRoutes from './authRoutes.js';
import customerRoutes from './customerRoutes.js';
import categoryRoutes from './categoryRoutes.js';

const adminRouter = Router();

adminRouter.use('/', authRoutes);
adminRouter.use('/users', customerRoutes);
adminRouter.use('/category', categoryRoutes);

export default adminRouter;
