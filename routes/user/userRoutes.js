import { Router } from 'express';
import authRoutes from './authRoutes.js';
import viewRoutes from './viewRoutes.js';

const userRouter = Router();
// authenticaation related routes
userRouter.use('/', authRoutes);

userRouter.use('/', viewRoutes);

export default userRouter;
