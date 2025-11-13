import Wishlist from '../../models/whishListSchema.js';
import Product from '../../models/productSchema.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import AppError from '../../utils/appError.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Cart from '../../models/cartSchema.js';
const getWishlist = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next(
                new AppError(
                    'Please login to view your wishlist',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }
        const wishlist = await Wishlist.findOne({ userId })
            .populate('items.productId')
            .lean();
        if (!wishlist || !wishlist.items) {
            return res.render('wishlist', {
                products: [],
                message: 'Your wishlist is empty',
            });
        }
        const productsPromises = wishlist.items.map(async (item) => {
            const product = item.productId;
            const variants = await ProductVariant.find({
                productId: product._id,
            });
            const availableSizes = variants.map((v) => v.size);
            const totalQuantity = variants.reduce(
                (sum, v) => sum + v.quantity,
                0
            );
            const discountPercentage =
                product.salesPrice && product.salesPrice < product.originalPrice
                    ? Math.round(
                          ((product.originalPrice - product.salesPrice) /
                              product.originalPrice) *
                              100
                      )
                    : 0;

            return {
                _id: product._id,
                name: product.name,
                description: product.description,
                images: product.images,
                originalPrice: product.originalPrice,
                salesPrice: product.salesPrice || product.originalPrice,
                colorName: product.colorName,
                colorCode: product.colorCode,
                availableSizes,
                totalQuantity,
                discountPercentage,
                isListed: product.isListed,
            };
        });

        const products = await Promise.all(productsPromises);

        return res.render('wishlist', {
            products: products,
            message:
                products.length === 0
                    ? 'No available items in your wishlist'
                    : null,
        });
    } catch (error) {
        console.log('Error while fetching wishlist:', error);
        next(error);
    }
};

const addToWishlist = async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const userId = getCurrentUserId(req);
        const product = await Product.findById(productId);
        if (!userId) {
            return next(
                new AppError(
                    'please login before adding to wishlist',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }
        if (!product) {
            return next(
                new AppError('product not found', HTTP_STATUS.NOT_FOUND)
            );
        }
        if (!product.isListed) {
            return next(
                new AppError(
                    'product currently unavailable',
                    HTTP_STATUS.NOT_FOUND
                )
            );
        }
        let existingInCart = await Cart.findOne({
            userId: userId,
            'items.productId': productId,
        });
        if (existingInCart) {
            return next(
                new AppError(
                    `The product ${product.name} already exist in cart`,
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        let wishList = await Wishlist.findOne({ userId });
        if (!wishList) {
            wishList = new Wishlist({ userId, items: [] });
        }

        const itemIndex = wishList.items.findIndex(
            (item) => item.productId.toString() === productId.toString()
        );

        if (itemIndex !== -1) {
            wishList.items.splice(itemIndex, 1);
            await wishList.save();
            return res.status(200).json({
                status: 'success',
                removed: true,
                message: 'Product removed from wishlist',
            });
        }

        wishList.items.push({ productId });
        await wishList.save();
        return res.status(200).json({
            status: 'success',
            added: true,
            message: 'Product added to wishlist',
        });
    } catch (error) {
        console.log('error while adding to wishlist', error);
        next(error);
    }
};
const removeFromWishlist = async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const userId = getCurrentUserId(req);
        if (!userId) {
            return next(
                new AppError(
                    'Please login to remove from Wishlist',
                    HTTP_STATUS.UNAUTHORIZED
                )
            );
        }
        const wishList = await Wishlist.findOne({ userId });
        if (!wishList) {
            return next(
                new AppError('Wishlist not found', HTTP_STATUS.NOT_FOUND)
            );
        }
        const itemIndex = wishList.items.findIndex(
            (item) => item.productId.toString() === productId.toString()
        );
        if (itemIndex === -1) {
            return next(
                new AppError(
                    'Product not found in wishlist',
                    HTTP_STATUS.NOT_FOUND
                )
            );
        }
        wishList.items.splice(itemIndex, 1);
        await wishList.save();
        return res.status(200).json({
            status: 'success',
            message: 'Product removed from wishlist',
            removed: true,
        });
    } catch (error) {
        console.log('error while removing from wishlist', error);
        next(error);
    }
};
export default { addToWishlist, getWishlist, removeFromWishlist };
