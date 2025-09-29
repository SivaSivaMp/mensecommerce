import AppError from '../../utils/appError.js';
import User from '../../models/userSchema.js';

const getForgotPassword = async (req, res) => {
    if (req.session?.user) {
        return res.redirect('/');
    }
    res.render('forgot-password', {
        title: 'Forgot-Password',
        error: null,
    });
};
const emailVerification = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return next(new AppError('email field is missing'));
        }
        const validEmail = await User.findOne({ email });
        if (!validEmail) {
            return next(
                new AppError('this user is not signed up, please signu', 400)
            );
        }
        req.session.userEmail = email;
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return next(
                new AppError('verification email not sent, try again', 400)
            );
        }
        req.session.userOtp = otp;
        console.log('reset otp', otp);
        res.status(200).json({
            status: 'success',
            message: 'otp generated successfuly',
            redirectUrl: '/forget-password-otp',
        });
    } catch (error) {
        console.log('error while verifying the email', error);
        next(error);
    }
};
const getForgetPasswordOtp = async (req, res) => {
    res.render('forgetpassword-otp');
};
const verifyForgetPasswordOtp = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userOtp || !req.session.userEmail) {
            res.redirect('/forgot-password');
        }
        const { otp } = req.body;
        if (!otp) {
            return next(new AppError('please enter the otp', 400));
        }
        if (otp !== req.session.userOtp) {
            return next(new AppError('Invalid otp,please check the otp', 400));
        }
        res.status(200).json({
            status: 'success',
            message: 'otp verified',
            redirectUrl: '/reset-password',
        });
    } catch (error) {
        console.log('error while otp verification', error);
        next(error);
    }
};
const getResetPassword = async (req, res) => {
    res.render('reset-password');
};
const resetPassword = async (req, res, next) => {
    try {
        const { newPassword, resetPassword } = req.body;
        const email = req.session.email;
        if (!newPassword || !resetPassword) {
            return next(new AppError('Enter new Password', 500));
        }
        if (newPassword !== resetPassword) {
            return next(new AppError('Your Password is not matching', 400));
        }
        await User.updateOne(
            { email: email },
            { $set: { password: newPassword } }
        );

        return res.status(200).json({
            status: 'success',
            message: 'password reset successful',
            redirectUrl: '/login',
        });
    } catch (error) {
        console.log('error while reseting with new password', 400);
        next(error);
    }
};

export default {
    getForgotPassword,
    emailVerification,
    getForgetPasswordOtp,
    verifyForgetPasswordOtp,
    getResetPassword,
    resetPassword,
};
