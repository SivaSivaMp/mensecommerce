import { Router } from 'express';
import viewController from '../../controllers/user/viewController.js';
import authController from '../../controllers/user/authController.js';
import passport from 'passport';

const router = Router();

router.route('/').get(viewController.loadHomepage);
router.route('/login').get(authController.loadLogin).post(authController.login);
router.route('/logout').get(authController.logout)

router
    .route('/signup')
    .get(authController.loadSignup)
    .post(authController.signup);

router.route('/verify-otp').get(authController.getverifyOtp).post(authController.verifyOtp);
router.route('/resend-otp').post(authController.resendOtp)
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/signup',
    successRedirect: '/',
  }),
);

export default router;
