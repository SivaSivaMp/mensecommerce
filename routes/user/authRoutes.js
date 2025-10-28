import { Router } from 'express';
import authController from '../../controllers/user/authController.js';
import passport from 'passport';
import profileController from '../../controllers/user/profileController.js';

const router = Router();

router.route('/login').get(authController.loadLogin).post(authController.login);
router.route('/logout').get(authController.logout);

router
    .route('/signup')
    .get(authController.loadSignup)
    .post(authController.signup);

router
    .route('/verify-otp')
    .get(authController.getverifyOtp)
    .post(authController.verifyOtp);
router.route('/resend-otp').post(authController.resendOtp);
router.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get(
    '/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/signup',
        successRedirect: '/',
    })
);

router
    .route('/forgot-password')
    .get(profileController.getForgotPassword)
    .post(profileController.emailVerification);

router
    .route('/forget-password-otp')
    .get(profileController.getForgetPasswordOtp)
    .post(profileController.verifyForgetPasswordOtp);

router
    .route('/reset-password')
    .get(profileController.getResetPassword)
    .post(profileController.resetPassword);

export default router;
