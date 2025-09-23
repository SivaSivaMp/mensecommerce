import AppError from '../../utils/appError.js';
import User from '../../models/userSchema.js';
import bcrypt from 'bcryptjs';

// get login page
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
const logout = async (req, res) => {
    try {
        if (req.session.admin) {
            delete req.session.admin;
        }
        res.redirect('/admin/login');
    } catch (error) {
        console.log('unexpected error during logout');
        res.redirect('/admin/dashbord');
    }
};

// login

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return next(new AppError('provide email and password', 400));
        }
        const admin = await User.findOne({ email, isAdmin: true }).select(
            '+password'
        );
        if (!admin) {
            return next(new AppError('Invalid email or password', 400));
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            admin.password
        );
        if (!isPasswordCorrect) {
            return next(new AppError('Password does not match', 400));
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
const loadDashboard = async (req, res) => {
    return res.render('dashboard');
};
export default { getAdminLogin, loadDashboard, login };
