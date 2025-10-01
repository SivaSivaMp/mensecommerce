import { Router } from 'express';
import authRoutes from './authRoutes.js';
import viewRoutes from './viewRoutes.js';
import auth from '../../middleware/auth.js';
const userRouter = Router();

// authenticaation related routes
userRouter.use('/', authRoutes);

userRouter.use('/', auth.blockCheck, viewRoutes);
userRouter.use('/page-notfound', async (req, res) => {
    res.render('page-404');
});
export default userRouter;
