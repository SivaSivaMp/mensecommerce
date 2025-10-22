import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import mongoose from 'mongoose';
import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Wishlist from '../../models/whishListSchema.js';

import Cart from '../../models/cartSchema.js';
// get cart page

const viewCart = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        if (!userId) {
            return next(new AppError('Please login to view your cart', 401));
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice images isListed',
                populate: {
                    path: 'category',
                    select: 'isListed categoryName',
                },
            })
            .populate({
                path: 'items.variantId',
                select: 'size quantity',
            });

        if (!cart || !cart.items.length) {
            return res.render('view-cart', {
                cartItems: [],
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,
                    totalAmount: 0,
                    savings: 0,
                },
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false,
                },
            });
        }

        const totalItems = cart.items.length;
        const totalPages = Math.ceil(totalItems / limit);

        const paginatedItems = cart.items.slice(skip, skip + limit);

        let totalPrice = 0;
        let totalDiscount = 0;

        const cartItems = paginatedItems.map((item) => {
            const originalPrice = Number(item.productId?.originalPrice || 0);
            const salePrice =
                Number(item.productId?.salesPrice) > 0
                    ? Number(item.productId.salesPrice)
                    : originalPrice;
            const variantQuantity = item.variantId?.quantity || 0;
            const isUnlisted = !item.productId?.isListed;
            const isOutOfStock =
                item.quantity > variantQuantity || variantQuantity === 0;
            const isUnlistedCategory = !item.productId?.category?.isListed;

            if (!isUnlisted && !isOutOfStock && !isUnlistedCategory) {
                const itemOriginalTotal = originalPrice * item.quantity;
                const itemSaleTotal = salePrice * item.quantity;
                const itemDiscount = itemOriginalTotal - itemSaleTotal;

                totalPrice += itemOriginalTotal;
                totalDiscount += itemDiscount;
            }

            return {
                _id: item._id,
                productId: item.productId?._id,
                productName: item.productId?.name || 'Unknown',
                productImage:
                    item.productId?.images?.[0] || '/images/placeholder.jpg',
                originalPrice,
                salePrice,
                quantity: item.quantity,
                variantQuantity,
                size: item.size || item.variantId?.size || '',
                totalPrice: salePrice * item.quantity,
                isOutOfStock: item.quantity > variantQuantity,
                isUnlisted: isUnlisted || isUnlistedCategory,
            };
        });

        const totalAmount = totalPrice - totalDiscount;
        const savings = totalDiscount;

        const priceDetails = {
            totalPrice,
            discount: totalDiscount,
            totalAmount,
            savings,
        };

        const pagination = {
            currentPage: page,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };

        return res.render('view-cart', {
            cartItems,
            priceDetails,
            itemCount: totalItems,
            pagination,
        });
    } catch (error) {
        console.error('Error in viewCart:', error);
        return next(new AppError('Internal server error', 500));
    }
};

const addToCart = async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const userId = getCurrentUserId(req);
        const size = req.body.size || '';
        const quantityToAdd = parseInt(req.body.quantity) || 1;

        if (!userId) {
            return next(
                new AppError('Please login before adding to cart', 401)
            );
        }

        if (!size) {
            return next(new AppError('Please select a size', 400));
        }

        const product = await Product.findById(productId);
        if (!product) {
            return next(new AppError('Product not found', 404));
        }

        const variant = await ProductVariant.findOne({ productId, size });
        if (!variant) {
            return next(new AppError('Product variant not found', 404));
        }

        if (variant.quantity <= 0) {
            return next(new AppError('This product is out of stock', 400));
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(
            (item) =>
                item.productId.toString() === productId &&
                item.variantId.toString() === variant._id.toString()
        );

        const salesPrice = Number(product.salesPrice) || 0;
        const originalPrice = Number(product.originalPrice) || 0;
        const price = salesPrice > 0 ? salesPrice : originalPrice;

        if (!price || price <= 0) {
            return next(new AppError('Invalid product price', 400));
        }

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantityToAdd;

            if (newQuantity > variant.quantity) {
                return next(
                    new AppError(
                        `Only ${variant.quantity} units available`,
                        400
                    )
                );
            }
            if (newQuantity > 5) {
                return next(
                    new AppError(`Only 5 units can be added for a product`, 400)
                );
            }

            existingItem.quantity = newQuantity;
            existingItem.totalPrice =
                existingItem.totalPrice + price * quantityToAdd;

            await cart.save();

            return res.status(200).json({
                success: true,
                alreadyInCart: true,
                message: `Quantity updated to ${newQuantity}`,
            });
        }

        const totalPrice = price * quantityToAdd;

        cart.items.push({
            productId,
            variantId: variant._id,
            quantity: quantityToAdd,
            size: size,
            totalPrice,
        });

        await cart.save();
        await Wishlist.updateOne(
            { userId },
            { $pull: { items: { productId } } }
        );

        return res.status(200).json({
            success: true,
            message: 'Item added to cart successfully',
        });
    } catch (error) {
        console.error('Error in addToCart:', error);
        return next(new AppError('Internal server error', 500));
    }
};

// Remove item from cart
const removeFromCart = async (req, res, next) => {
    try {
        const itemId = req.params.itemId;
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(new AppError('Please login to modify your cart', 401));
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return next(new AppError('Cart not found', 404));
        }

        const itemIndex = cart.items.findIndex(
            (item) => item._id.toString() === itemId
        );

        if (itemIndex === -1) {
            return next(new AppError('Item not found in cart', 404));
        }

        cart.items.splice(itemIndex, 1);
        await cart.save();

        return res.status(200).json({
            success: true,
            message: 'Item removed from cart successfully',
        });
    } catch (error) {
        console.error('Error in removeFromCart:', error);
        return next(new AppError('Internal server error', 500));
    }
};

// Update quantity of cart item
const updateCartQuantity = async (req, res, next) => {
    try {
        const itemId = req.params.itemId;
        const userId = getCurrentUserId(req);
        const quantityChange = parseInt(req.body.quantityChange) || 0;

        if (!userId) {
            return next(new AppError('Please login to modify your cart', 401));
        }

        if (quantityChange === 0) {
            return next(new AppError('Invalid quantity change', 400));
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return next(new AppError('Cart not found', 404));
        }

        const cartItem = cart.items.find(
            (item) => item._id.toString() === itemId
        );

        if (!cartItem) {
            return next(new AppError('Item not found in cart', 404));
        }

        const newQuantity = cartItem.quantity + quantityChange;

        if (newQuantity < 1) {
            return next(new AppError('Quantity cannot be less than 1', 400));
        }

        if (newQuantity > 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum quantity limit is 5 items per product',
            });
        }

        const variant = await ProductVariant.findById(cartItem.variantId);
        if (!variant) {
            return next(new AppError('Product variant not found', 404));
        }

        if (newQuantity > variant.quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${variant.quantity} units available for this product`,
            });
        }

        const product = await Product.findById(cartItem.productId);
        if (!product) {
            return next(new AppError('Product not found', 404));
        }

        const price =
            product.salesPrice && Number(product.salesPrice) > 0
                ? Number(product.salesPrice)
                : Number(product.originalPrice);

        cartItem.quantity = newQuantity;
        cartItem.totalPrice = price * newQuantity;

        await cart.save();

        return res.status(200).json({
            success: true,
            message: `Quantity updated to ${newQuantity}`,
            newQuantity: newQuantity,
            newTotal: cartItem.totalPrice,
        });
    } catch (error) {
        console.error('Error in updateCartQuantity:', error);
        return next(new AppError('Internal server error', 500));
    }
};
const validateCart = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) return next(new AppError('Please login to proceed', 401));

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'isListed',
                populate: {
                    path: 'category',
                    select: 'isListed',
                },
            })
            .populate({
                path: 'items.variantId',
                select: 'quantity',
            });

        if (!cart || !cart.items.length) {
            return res
                .status(400)
                .json({ success: false, message: 'Your cart is empty' });
        }

        for (const item of cart.items) {
            const variantQty = item.variantId?.quantity || 0;
            const isUnlisted = !item.productId?.isListed;
            const isOutOfStock = item.quantity > variantQty || variantQty === 0;
            const isUnlistedCategory = !item.productId?.category?.isListed;

            if (isUnlisted || isOutOfStock || isUnlistedCategory) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Some items are unavailable or out of stock. Please review your cart.',
                });
            }
        }

        res.status(200).json({ success: true, message: 'Cart is valid' });
    } catch (error) {
        console.error('Error in validateCart:', error);
        return next(new AppError('Internal server error', 500));
    }
};

export default {
    viewCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    validateCart,
};
