import { Router } from 'express';
import authRoutes from './authRoutes.js';
import viewRoutes from './viewRoutes.js';
import auth from '../../middleware/auth.js';
import profileRoutes from './profileRoutes.js';
import wishlistRoutes from './wishlistRoutes.js';
import cartRoutes from './cartRoutes.js';
const userRouter = Router();

// authenticaation related routes
userRouter.use('/', authRoutes);
// profile related route
userRouter.use('/profile', auth.userAuth, profileRoutes);
// main view routes
userRouter.use('/', auth.blockCheck, viewRoutes);
// wishlist related routes
userRouter.use('/wishlist', auth.userAuth, wishlistRoutes);

// cart routes

userRouter.use('/cart', cartRoutes);

userRouter.use('/page-notfound', async (req, res) => {
    res.render('page-404');
});
export default userRouter;
