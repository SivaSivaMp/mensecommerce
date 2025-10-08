import User from '../models/userSchema.js';
import { getCurrentUserId } from '../helpers/getCurrentUserId.js';
const userAuth = async (req, res, next) => {
    try {
        if (!getCurrentUserId(req)) {
            return res.redirect('/login');
        }
        const user = await User.findById(getCurrentUserId(req));

        if (!user || user.isBlocked) {
            req.session.destroy((err) => {
                if (err) {
                    console.log('Error destroying session:', err);
                }
                return res.redirect('/login');
            });
            return;
        }
        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            image: user.profileImage,
        };
        next();
    } catch (error) {
        console.log('Error in user auth middleware:', error);
        req.session.destroy((err) => {
            if (err) {
                console.log('Error destroying session:', err);
            }
        });
        return res.status(500).send('Internal Server error');
    }
};

const blockCheck = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next();
        }

        const userData = await User.findById(userId);

        if (userData.isBlocked) {
            req.session.destroy((err) => {
                if (err) {
                    console.log('Error destroying session:', err);
                }
            });
        }

        next();
    } catch (error) {
        console.log('Error in block check middleware:', error);
        next();
    }
};

const adminAuth = (req, res, next) => {
    User.findOne({ isAdmin: true })
        .then((data) => {
            if (data) {
                next();
            } else {
                res.redirect('/admin/login');
            }
        })
        .catch((error) => {
            console.log('Error in adminauth middleware', error);
            res.status(500).send('Internal Server Error');
        });
};

const adminCheck = (req, res, next) => {
    if (req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

export default { userAuth, blockCheck, adminAuth, adminCheck };
