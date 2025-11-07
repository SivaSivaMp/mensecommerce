import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';

const addCategoryOffer = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { offer } = req.body;

        const category = await Category.findById(id);
        if (!category) {
            return next(
                new AppError('Category not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        if (!category.isListed) {
            return next(
                new AppError(
                    `Unlisted category, can't add offer`,
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const offerValue = parseFloat(offer);
        if (isNaN(offerValue) || offerValue < 0 || offerValue > 100) {
            return next(
                new AppError(
                    'Offer percentage should be between 0 and 100',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        category.categoryOffer = offerValue;
        await category.save();

        const productsToUpdate = await Product.find({ category: id });
        let updatedCount = 0;

        for (const product of productsToUpdate) {
            product.appliedCategoryOffer = offerValue;

            const effectiveOffer = Math.max(
                product.productOffer || 0,
                product.appliedCategoryOffer || 0
            );

            product.salesPrice = parseFloat(
                (
                    product.originalPrice -
                    (product.originalPrice * effectiveOffer) / 100
                ).toFixed(2)
            );

            await product.save({ validateBeforeSave: false });
            updatedCount++;
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Category offer of ${offerValue}% applied successfully to ${updatedCount} products.`,
        });
    } catch (error) {
        console.error('Error updating Offer:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error while updating offer.',
        });
    }
};

const removeCategoryOffer = async (req, res, next) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);
        if (!category) {
            return next(
                new AppError('Category not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        category.categoryOffer = 0;
        await category.save();

        const productsToUpdate = await Product.find({
            category: id,
            appliedCategoryOffer: { $gt: 0 },
        });

        let updatedCount = 0;

        for (const product of productsToUpdate) {
            product.appliedCategoryOffer = 0;

            const effectiveOffer = Math.max(
                product.productOffer || 0,
                product.appliedCategoryOffer || 0
            );

            product.salesPrice = parseFloat(
                (
                    product.originalPrice -
                    (product.originalPrice * effectiveOffer) / 100
                ).toFixed(2)
            );

            await product.save({ validateBeforeSave: false });
            updatedCount++;
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Category offer removed successfully and ${updatedCount} products updated.`,
        });
    } catch (error) {
        console.error('Error removing Offer:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error while removing Offer.',
        });
    }
};
const addProductOffer = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { offer } = req.body;
        const product = await Product.findById(id);
        if (!product) {
            return next(
                new AppError('Product Not found', HTTP_STATUS.NOT_FOUND)
            );
        }
        if (!product.isListed) {
            return next(
                new AppError(
                    `you cannot add offer this porduct, since the product is unlisted`,
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (offer < 0 || offer > 100) {
            return next(
                new AppError(
                    'offer percentage should be in between 0-100',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (isNaN(offer)) {
            return next(
                new AppError(
                    'Offer value must be a valid number.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        product.productOffer = offer;
        const effectiveOffer = Math.max(
            offer || 0,
            product.appliedCategoryOffer || 0
        );
        product.salesPrice = parseFloat(
            (
                product.originalPrice -
                (product.originalPrice * effectiveOffer) / 100
            ).toFixed(2)
        );

        await product.save();
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Offer added successfully',
        });
    } catch (error) {
        console.error('Error updating Offer:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error while updating Offer.',
        });
    }
};
const removeProductOffer = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);
        if (!product) {
            return next(
                new AppError('Product not found.', HTTP_STATUS.NOT_FOUND)
            );
        }

        if (!product.isListed) {
            return next(
                new AppError(
                    'You cannot modify this product because it is unlisted.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        if (product.productOffer === 0) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'No offer exists for this product.',
            });
        }

        product.productOffer = 0;

        const effectiveOffer = Math.max(0, product.appliedCategoryOffer || 0);
        product.salesPrice = parseFloat(
            (
                product.originalPrice -
                (product.originalPrice * effectiveOffer) / 100
            ).toFixed(2)
        );

        await product.save();

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Offer removed successfully.',
        });
    } catch (error) {
        console.error('Error removing offer:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error while removing offer.',
        });
    }
};
export default {
    addCategoryOffer,
    removeCategoryOffer,
    addProductOffer,
    removeProductOffer,
};
