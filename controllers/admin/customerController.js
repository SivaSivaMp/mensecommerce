import User from '../../models/userSchema.js';
import AppError from '../../utils/appError.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
// ccustomer list
const customerInfo = async (req, res, next) => {
    try {
        let search = req.query.search || '';
        let page = parseInt(req.query.page) || 1;
        const limit = 10;
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

        res.render('customers', {
            status: 'success',
            message: 'customer info loaded succesfully',
            data: userData,
            currentCount: userCount,
            search: search,
            totalPages: totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.log('error while loading user info', error);
        next(error);
    }
};
// block customer

const customerBlocked = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await User.findByIdAndUpdate(
            id,
            { isBlocked: true },
            { new: true }
        );
        if (!updated) {
            return next(
                new AppError('Customer not found', HTTP_STATUS.NOT_FOUND)
            );
        }
        return res.status(HTTP_STATUS.OK).json({
            message: 'Customer blocked successfully',
        });
    } catch (error) {
        console.error('Block Customer error:', error);
        next(error);
    }
};

// unblock customer

const customerUnBlocked = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await User.findByIdAndUpdate(
            id,
            { isBlocked: false },
            { new: true }
        );
        if (!updated) {
            return next(
                new AppError('Customer not found', HTTP_STATUS.NOT_FOUND)
            );
        }
        return res.status(HTTP_STATUS.OK).json({
            message: 'Customer Unblocked successfully',
        });
    } catch (error) {
        console.error('UnBlock Customer error:', error);
        next(error);
    }
};
export default { customerInfo, customerBlocked, customerUnBlocked };
