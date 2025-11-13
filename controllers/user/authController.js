import AppError from '../../utils/appError.js';
import bcrypt from 'bcryptjs';
import User from '../../models/userSchema.js';
import { sendVerificationEmail } from '../../utils/email.js';
import { generateOtp } from '../../utils/generateOtp.js';
import validator from 'validator';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import crypto from 'crypto';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import Wallet from '../../models/walletSchema.js';
// load login

const loadLogin = async (req, res) => {
    if (getCurrentUserId(req)) {
        return res.redirect('/');
    }

    res.render('login', {
        title: 'Login',
        error: null,
    });
};

// load signup
const loadSignup = async (req, res) => {
    if (getCurrentUserId(req)) {
        return res.redirect('/');
    }
    console.log(generateReferralCode());

    res.render('signup', {
        title: 'Register',
        error: null,
    });
};

// login-post

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!validator.isEmail(email)) {
            return next(new AppError('Invalid email'));
        }
        if (getCurrentUserId(req)) {
            return next(
                new AppError('user already logged in', HTTP_STATUS.BAD_REQUEST)
            );
        }
        if (!email || !password) {
            return next(
                new AppError(
                    'email or password is missing',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return next(
                new AppError(
                    'Invalid user credentials',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (user.isBlocked) {
            return next(
                new AppError('user is blocked', HTTP_STATUS.BAD_REQUEST)
            );
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return next(
                new AppError(
                    'Invalid user credentials',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            image: user.profileImage,
        };
        res.status(200).json({
            status: 'success',
            message: 'login is successful',
            redirectUrl: '/',
        });
    } catch (error) {
        next(error);
        console.error();
    }
};

// signup-post
const generateReferralCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};
const signup = async (req, res, next) => {
    try {
        const { name, email, password, cpassword, referralCode } = req.body;

        if (!name || !email || !password || !cpassword) {
            return next(
                new AppError(
                    'please add all necessary fields',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!validator.isEmail(email)) {
            return next(new AppError('Invalid email', HTTP_STATUS.BAD_REQUEST));
        }

        if (password !== cpassword) {
            return next(
                new AppError('password do not match', HTTP_STATUS.BAD_REQUEST)
            );
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return next(
                new AppError(
                    'this user already exists',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        console.log('otp is :', otp);

        if (!emailSent) {
            return next(
                new AppError(
                    'Failed to send verification emil. Try again',
                    HTTP_STATUS.INTERNAL_SERVER_ERROR
                )
            );
        }

        req.session.userOtp = otp;
        req.session.userData = { name, email, password, referralCode };

        res.status(200).json({
            status: 'success',
            message: 'OTP sent succesfully',
            redirectUrl: '/verify-otp',
        });
    } catch (error) {
        console.log('Error occured', error);
        next(error);
    }
};

// get verify-otp

const getverifyOtp = async (req, res) => {
    try {
        res.render('verify-otp', { title: 'verify-otp', error: null });
    } catch (error) {
        console.log('error while rendering verify-otp page :', error);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { otp } = req.body;
        if (!req.session || !req.session.userOtp || !req.session.userData) {
            return next(
                new AppError(
                    'session expired or invalid, please try again',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (otp !== req.session.userOtp) {
            return next(new AppError('Invalid otp', HTTP_STATUS.BAD_REQUEST));
        }

        const { name, email, password, referralCode } = req.session.userData;
        const newReferralCode = crypto
            .randomBytes(4)
            .toString('hex')
            .toUpperCase();
        const newUser = new User({
            name,
            email,
            password,
            referralCode: newReferralCode,
            referredBy: referralCode || null,
        });
        await newUser.save();
        if (referralCode) {
            const referrer = await User.findOne({ referralCode: referralCode });
            if (!referrer) {
                return next(
                    new AppError(
                        'Invalid referral code',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
            }
            const referrerReward = 100;
            const newUserReward = 50;
            await Wallet.findOneAndUpdate(
                { userId: referrer._id },
                {
                    $inc: { balance: referrerReward },
                    $push: {
                        transactions: {
                            transactionId: `TXN-${Date.now()}-${Math.floor(
                                Math.random() * 10000
                            )}`,
                            type: 'credit',
                            amount: referrerReward,
                            description: `Referral reward for inviting ${email}`,
                        },
                    },
                },
                { upsert: true, new: true }
            );
            await Wallet.findOneAndUpdate(
                { userId: newUser._id },
                {
                    $inc: { balance: newUserReward },
                    $push: {
                        transactions: {
                            transactionId: `TXN-${Date.now()}-${Math.floor(
                                Math.random() * 10000
                            )}`,
                            type: 'credit',
                            amount: newUserReward,
                            description: `Welcome bonus for using referral code ${referralCode}`,
                        },
                    },
                },
                { upsert: true, new: true }
            );
        }

        req.session.user = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
        };
        req.session.userOtp = null;
        req.session.userData = null;

        return res.status(200).json({
            status: 'success',
            message: 'OTP verified succesfully, welcome',
            redirectUrl: '/',
        });
    } catch (error) {
        console.log('Error during verifying otp', error);
        if (error.name === 'ValidationError') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: Object.values(error.errors).map((e) => e.message),
            });
        }
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            status: 'error',
            message: 'Something went wrong while adding product',
        });
    }
};

const resendOtp = async (req, res, next) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return next(
                new AppError(
                    'Email not Found in the session',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const otp = generateOtp();
        console.log(`Resend OTP:`, otp);

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return next(
                new AppError(
                    'Failed to resend the OTP',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        req.session.userOtp = otp;
        res.status(200).json({
            success: true,
            status: 'success',
            message: 'OTP resent successfully',
        });
    } catch (error) {
        console.log('error during resending the otp', error);
    }
};

const logout = (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return next(
                new AppError('Logout unsuccessful', HTTP_STATUS.BAD_REQUEST)
            );
        }

        res.clearCookie('user_session');
        return res.redirect('/');
    });
};

export default {
    loadLogin,
    loadSignup,
    login,
    signup,
    getverifyOtp,
    verifyOtp,
    resendOtp,
    logout,
};
