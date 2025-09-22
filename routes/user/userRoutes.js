import { Router } from 'express';
import authRoutes from './authRoutes.js';

const userRouter = Router();
// authenticaation related routes
userRouter.use('/', authRoutes);

export default userRouter;
