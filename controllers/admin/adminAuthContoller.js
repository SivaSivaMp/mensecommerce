import AppError from '../../utils/appError.js';
import User from '../../models/userSchema.js';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { HTTP_STATUS } from '../../utils/httpStatus.js';

const getAdminLogin = async (req, res, next) => {
    try {
        if (req.session?.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin-login', { title: 'Admin Login', error: null });
    } catch (error) {
        console.log('Error in loading admin-login', error);
    }
};
// logout
const logout = async (req, res, next) => {
    req.session.destroy((err) => {
        next(new AppError('logout unsuccsfull', HTTP_STATUS.BAD_REQUEST));
    });
    res.clearCookie('admin_session');
    return res.redirect('/admin/login');
};
// login

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return next(
                new AppError(
                    'provide email and password',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!validator.isEmail(email)) {
            return next(new AppError('Invalid email', HTTP_STATUS.BAD_REQUEST));
        }
        const admin = await User.findOne({ email, isAdmin: true }).select(
            '+password'
        );
        if (!admin) {
            return next(
                new AppError(
                    'Invalid email or password',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            admin.password
        );
        if (!isPasswordCorrect) {
            return next(
                new AppError('Password does not match', HTTP_STATUS.BAD_REQUEST)
            );
        }
        req.session.admin = {
            id: admin._id,
            name: admin.name,
            email: admin.email,
        };
        res.status(200).json({
            status: 'success',
            message: 'Welcome to ecomus admin app',
            redirectUrl: '/admin/dashboard',
        });
    } catch (error) {
        console.log('error while login', error);
    }
};
//load dashboard

export default { getAdminLogin, login, logout };
