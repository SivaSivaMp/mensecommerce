import AppError from '../../utils/appError.js';
import User from '../../models/userSchema.js';
import { generateOtp } from '../../utils/generateOtp.js';
import { sendVerificationEmail } from '../../utils/email.js';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import cloudinary from '../../config/cloudinaryConfig.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
const getForgotPassword = async (req, res) => {
    if (getCurrentUserId(req)) {
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
            return next(
                new AppError('email field is missing', HTTP_STATUS.BAD_REQUEST)
            );
        }
        if (!validator.isEmail(email)) {
            return next(new AppError('invalid email', HTTP_STATUS.BAD_REQUEST));
        }
        const validEmail = await User.findOne({ email });
        if (!validEmail) {
            return next(
                new AppError(
                    'this user is not signed up, please signu',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        req.session.userEmail = email;
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return next(
                new AppError(
                    'verification email not sent, try again',
                    HTTP_STATUS.BAD_REQUEST
                )
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
            return next(
                new AppError('please enter the otp', HTTP_STATUS.BAD_REQUEST)
            );
        }
        if (otp !== req.session.userOtp) {
            return next(
                new AppError(
                    'Invalid otp,please check the otp',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        req.session.userOtp = null;
        req.session.userEmail = null;
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
            return next(
                new AppError('Enter new Password', HTTP_STATUS.BAD_REQUEST)
            );
        }
        if (newPassword !== resetPassword) {
            return next(
                new AppError(
                    'Your Password is not matching',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
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
        console.log(
            'error while reseting with new password',
            HTTP_STATUS.BAD_REQUEST
        );
        next(error);
    }
};
// profile page loading controller
const getProfile = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const userData = await User.findById(userId);
        res.render('account', {
            user: userData,
            status: 'success',
            message: 'profile loaded successfully',
        });
    } catch (error) {
        console.log('error while profile load', error);
        next(error);
    }
};
// profile page chnage password
const profileChangePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        if (
            !currentPassword.trim() ||
            !newPassword.trim() ||
            !confirmNewPassword.trim()
        ) {
            return next(
                new AppError(
                    'please provide required fields',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const userId = getCurrentUserId(req);
        const userData = await User.findById(userId).select('+password');
        const isPasswordCorrect = await bcrypt.compare(
            currentPassword,
            userData.password
        );

        if (!isPasswordCorrect) {
            return next(
                new AppError(
                    'Invalid user credentials',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const isStrong = validator.isStrongPassword(newPassword, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1,
        });

        if (!isStrong) {
            return next(
                new AppError(
                    'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (newPassword !== confirmNewPassword) {
            return next(
                new AppError('password mismatch', HTTP_STATUS.BAD_REQUEST)
            );
        }
        userData.password = newPassword;
        await userData.save();
        return res.status(200).json({
            status: 'success',
            message: 'password reset is succesful',
        });
    } catch (error) {
        console.log('Error while changing password', error);
        if (error.name === 'ValidationError') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: Object.values(error.errors).map((e) => e.message),
            });
        }
        return res.status(500).json({
            status: 'error',
            message: 'Something went wrong while adding product',
        });
    }
};
// get edit profil
const getEditProfile = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const userData = await User.findById(userId);
        res.render('account-edit', {
            user: userData,
            status: 'success',
            message: 'profile loaded successfully',
        });
    } catch (error) {
        console.log('error while edit-profile load', error);
        next(error);
    }
};
// edit personal information

const editPersonalInformation = async (req, res, next) => {
    try {
        const { newName, newPhone } = req.body;
        const name = newName.trim();
        const phone = newPhone.trim();
        console.log(phone);
        if (!name) {
            return next(
                new AppError(
                    'please fill the required field',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const namepattern = /^[A-Za-z\s]+$/;
        if (!namepattern.test(name)) {
            return next(
                new AppError(
                    'name must contain only letter and spaces',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!validator.isMobilePhone(phone, 'en-IN')) {
            return next(
                new AppError('Invalid phone number', HTTP_STATUS.BAD_REQUEST)
            );
        }
        const userId = getCurrentUserId(req);
        const userData = await User.findById(userId);
        userData.name = name;
        userData.phone = phone;
        await userData.save();
        return res.status(200).json({
            status: 'success',
            message: 'personal information has been updated',
            redirectUrl: '/profile',
        });
    } catch (error) {
        console.log('error while editing profile', error);
        next(error);
    }
};
// edit email
const editEmail = async (req, res, next) => {
    try {
        const { newEmail } = req.body;
        const emailtrim = newEmail.trim();
        if (!emailtrim) {
            return next(new AppError('please fill the email field', 400));
        }
        if (!validator.isEmail(emailtrim)) {
            return next(new AppError('please fill a valid email', 400));
        }
        const exisitingUser = await User.findOne({ email: emailtrim });
        if (exisitingUser) {
            return next(
                new AppError('user with same email-id already present', 400)
            );
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(emailtrim, otp);
        if (!emailSent) {
            return next(
                new AppError('verification email not sent, try again', 400)
            );
        }
        req.session.userOtp = otp;
        req.session.newEmail = emailtrim;
        console.log('email change otp:', otp);
        return res.status(200).json({
            status: 'success',
            message: 'OTP sent succesfully',
            redirectUrl: '/profile/email-change-otp',
        });
    } catch (error) {
        console.log('error while otp generation', error);
        next(error);
    }
};

// email change otp verification page render
const getEmailChangeotp = async (req, res, next) => {
    try {
        res.render('emailchange-otp');
    } catch (error) {
        console.log('error while change email otp page genaration', error);
        next(error);
    }
};
// reset email otp verification

const resetEmailOtpVerification = async (req, res, next) => {
    try {
        if (!req.session.userOtp || !req.session.newEmail) {
            return next(
                new AppError(
                    'session expired or invalid, please try again',
                    400
                )
            );
        }
        const { enteredOtp } = req.body;
        if (enteredOtp !== req.session.userOtp) {
            return next(
                new AppError(
                    'Invalide otp, please try again with correcct otp',
                    400
                )
            );
        }
        const newEmail = req.session.newEmail;
        const userId = req.session.user.id;

        await User.findByIdAndUpdate(userId, { email: newEmail });
        req.session.newEmail = null;
        req.session.userOtp = null;

        return res.status(200).json({
            status: 'success',
            message: 'otp verification success, email updated successfully',
            redirectUrl: '/profile',
        });
    } catch (error) {
        console.log('error while otp verification', 400);
        next(error);
    }
};
const uploadProfileImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('No image file provided.', 400));
        }

        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    { folder: 'profile_images', resource_type: 'image' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                )
                .end(req.file.buffer);
        });

        await User.findByIdAndUpdate(getCurrentUserId(req), {
            profileImage: uploadResult.secure_url,
        });

        res.json({
            status: 'success',
            message: 'Profile image updated successfully.',
            imageUrl: uploadResult.secure_url,
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({
            status: 'fail',
            message: 'Error uploading profile image.',
        });
    }
};
export default {
    getForgotPassword,
    emailVerification,
    getForgetPasswordOtp,
    verifyForgetPasswordOtp,
    getResetPassword,
    resetPassword,
    getProfile,
    uploadProfileImage,
    profileChangePassword,
    getEditProfile,
    editPersonalInformation,
    editEmail,
    getEmailChangeotp,
    resetEmailOtpVerification,
};
