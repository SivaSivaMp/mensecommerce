import { Router } from 'express';
import authRoutes from './authRoutes.js';
import customerRoutes from './customerRoutes.js';

const adminRouter = Router();

adminRouter.use('/', authRoutes);
adminRouter.use('/users', customerRoutes);

export default adminRouter;
