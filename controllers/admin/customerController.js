import AppError from '../../utils/appError.js';
import User from '../../models/userSchema.js';
import nocache from 'nocache';

// const customerInfo = async (req, res) => {
//     try {
//         const search = req.query.search || '';
//         const page = parseInt(req.query.page, 10) || 1;
//         const limit = 10;

//         // Common filter for search
//         const filter = {
//             isAdmin: false,
//             $or: [
//                 { name: { $regex: search, $options: 'i' } },
//                 { email: { $regex: search, $options: 'i' } },
//             ],
//         };

//         // First: count total matching users
//         const count = await User.countDocuments(filter);

//         // Second: fetch paginated data
//         const userData = await User.find(filter)
//             .sort({ createdAt: -1 })
//             .skip((page - 1) * limit)
//             .limit(limit)
//             .exec();

//         const totalPages = Math.ceil(count / limit);

//         // Render page only if admin session exists
//         if (req.session.admin) {
//             return res.render('customers', {
//                 data: userData,
//                 search,
//                 totalPages,
//                 currentPage: page,
//             });
//         }

//         res.redirect('/login'); // non-admin users
//     } catch (error) {
//         console.error('Error fetching customers:', error);
//         res.redirect('/pageerror');
//     }
// };

const customerInfo = async (req, res, next) => {
    try {
        let search = req.query.search || '';
        let page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const filter = {
            isAdmin: false,
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ],
        };
        const userCount = await User.countDocuments(filter);
        const userData = await User.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .exec();
        const totalPages = Math.ceil(userCount / limit);
        if (req.session.admin) {
            res.render('customers', {
                status: 'success',
                message: 'customer info loaded succesfully',
                data: userData,
                currentCount: userCount,
                search: search,
                totalPages: totalPages,
                currentPage: page,
            });
        }
    } catch (error) {
        console.log('error while loading user info', error);
        next(error);
    }
};

const customerBlocked = async (req, res, next) => {
    try {
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect('/admin/users');
    } catch (error) {
        console.log('error while blocking the user', error);
        next(error);
    }
};
const customerUnBlocked = async (req, res, next) => {
    try {
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect('/admin/users');
    } catch (error) {
        console.log('error while blocking the user', error);
        next(error);
    }
};
export default { customerInfo, customerBlocked, customerUnBlocked };
