import { Router } from 'express';
import authRoutes from './authRoutes.js';

const userRouter = Router();

userRouter.use('/', authRoutes);

export default userRouter;
