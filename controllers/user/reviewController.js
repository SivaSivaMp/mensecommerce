import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import Review from '../../models/reviewSchema.js';
import Order from '../../models/orderSchema.js';

const submitReview = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;

        const { title, rating, review } = req.body;
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next(
                new AppError(
                    'You must be logged in to review.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!title || !rating || !review) {
            return next(
                new AppError('Kindly fill the field.', HTTP_STATUS.BAD_REQUEST)
            );
        }
        const order = await Order.findById(orderId).populate(
            'orderedItems.product'
        );
        if (!order) {
            return next(
                new AppError('Order not found.', HTTP_STATUS.NOT_FOUND)
            );
        }
        if (order.userId.toString() !== userId.toString()) {
            return next(
                new AppError(
                    'Unauthorized access to this order.',
                    HTTP_STATUS.FORBIDDEN
                )
            );
        }
        const deliveredItem = order.orderedItems.find(
            (item) => item.status === 'Delivered'
        );

        if (!deliveredItem) {
            return next(
                new AppError(
                    'You can only review delivered items..',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const productId = deliveredItem.product._id;
        const existingReview = await Review.findOne({ userId, productId });

        if (existingReview) {
            return next(
                new AppError(
                    'You already reviewed this product...',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        await Review.create({
            userId,
            productId,
            title,
            rating,
            review,
        });

        return res.status(200).json({
            success: true,
            message: 'Review submitted successfully.',
        });
    } catch (error) {
        console.error('Review Error:', error);
        next(error);
    }
};

export default { submitReview };
