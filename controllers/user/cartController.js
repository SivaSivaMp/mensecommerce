import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Product from '../../models/productSchema.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Wishlist from '../../models/whishListSchema.js';
import { calculatePriceDetails } from '../../helpers/calculatePriceDetails.js';
import Cart from '../../models/cartSchema.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';

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
                select: 'name originalPrice salesPrice images isListed category',
                populate: {
                    path: 'category',
                    select: 'isListed categoryName',
                },
            })
            .populate({
                path: 'appliedCoupon.couponId',
                select: 'code discountValue discountType maxDiscountAmount minPurchaseAmount expiresAt isActive',
            });

        if (!cart || !cart.items.length) {
            return res.render('view-cart', {
                cartItems: [],
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,
                    totalAmount: 0,
                    savings: 0,
                    shipping: 0,
                    finalAmount: 0,
                },
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    hasNext: false,
                    hasPrev: false,
                },
            });
        }

        const { cartItems, priceDetails, couponCode, couponDiscount } =
            await calculatePriceDetails(cart);

        const totalItems = cart.items.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedItems = cartItems.slice(skip, skip + limit);

        return res.render('view-cart', {
            cartItems: paginatedItems,
            priceDetails,
            itemCount: totalItems,
            pagination: {
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            couponCode,
            discount: couponDiscount,
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
        if (!product.isListed) {
            return next(new AppError('Product is currenly unavailable'));
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

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'salesPrice originalPrice',
            })
            .populate({
                path: 'appliedCoupon.couponId',
                select: 'code minPurchaseAmount isActive expiresAt discountType discountValue maxDiscountAmount',
            });

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

        let couponRemoved = false;
        let couponRemovedReason = null;

        if (cart.appliedCoupon && cart.appliedCoupon.couponId) {
            if (cart.items.length === 0) {
                cart.appliedCoupon = {
                    couponId: null,
                    code: null,
                    discount: 0,
                    appliedAt: null,
                };
                couponRemoved = true;
                couponRemovedReason = 'Cart is now empty';
            } else {
                const coupon = cart.appliedCoupon.couponId;

                let newCartTotal = 0;
                for (const item of cart.items) {
                    const product = item.productId;
                    if (product) {
                        const salePrice =
                            product.salesPrice && Number(product.salesPrice) > 0
                                ? Number(product.salesPrice)
                                : Number(product.originalPrice || 0);
                        newCartTotal += salePrice * item.quantity;
                    }
                }

                const isCouponExpired =
                    coupon && new Date() > new Date(coupon.expiresAt);
                const isCouponInactive = coupon && !coupon.isActive;
                const doesNotMeetMinimum =
                    coupon && newCartTotal < coupon.minPurchaseAmount;

                if (isCouponExpired) {
                    cart.appliedCoupon = {
                        couponId: null,
                        code: null,
                        discount: 0,
                        appliedAt: null,
                    };
                    couponRemoved = true;
                    couponRemovedReason = 'Coupon has expired';
                } else if (isCouponInactive) {
                    cart.appliedCoupon = {
                        couponId: null,
                        code: null,
                        discount: 0,
                        appliedAt: null,
                    };
                    couponRemoved = true;
                    couponRemovedReason = 'Coupon is no longer active';
                } else if (doesNotMeetMinimum) {
                    const couponCode = cart.appliedCoupon.code;
                    const minAmount = coupon.minPurchaseAmount;

                    cart.appliedCoupon = {
                        couponId: null,
                        code: null,
                        discount: 0,
                        appliedAt: null,
                    };
                    couponRemoved = true;
                    couponRemovedReason = `Coupon ${couponCode} removed. Minimum purchase of ₹${minAmount} required`;
                } else {
                    let newDiscount = 0;
                    if (coupon.discountType === 'flat') {
                        newDiscount = coupon.discountValue;
                    } else if (coupon.discountType === 'percentage') {
                        newDiscount =
                            (newCartTotal * coupon.discountValue) / 100;
                        if (coupon.maxDiscountAmount) {
                            newDiscount = Math.min(
                                newDiscount,
                                coupon.maxDiscountAmount
                            );
                        }
                    }

                    cart.appliedCoupon.discount = newDiscount;
                }
            }
        }

        await cart.save();
        let message = 'Item removed from cart successfully';
        if (couponRemoved && couponRemovedReason) {
            message += `. ${couponRemovedReason}`;
        }

        return res.status(200).json({
            success: true,
            message: message,
            couponRemoved: couponRemoved,
            cartItemsCount: cart.items.length,
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
            return next(
                new AppError(
                    'Maximum quantity limit is 5 items per product',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const variant = await ProductVariant.findById(cartItem.variantId);
        if (!variant) {
            return next(new AppError('Product variant not found', 404));
        }

        if (newQuantity > variant.quantity) {
            return next(
                new AppError(
                    `Only ${variant.quantity} units available for this product`,
                    400
                )
            );
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

        const cart = await Cart.findOne({ userId });
        if (!cart || !cart.items.length) {
            return next(
                new AppError('Your cart is empty', HTTP_STATUS.BAD_REQUEST)
            );
        }

        for (const item of cart.items) {
            const product = await Product.findById(item.productId).populate(
                'category'
            );
            const variant = await ProductVariant.findById(item.variantId);

            if (!product || !variant) {
                return next(
                    new AppError(
                        'Some items are no longer available.',
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
            }

            const isUnlisted = !product.isListed;
            const isUnlistedCategory = !product.category?.isListed;
            const isOutOfStock =
                item.quantity > variant.quantity || variant.quantity === 0;

            if (isUnlisted || isUnlistedCategory || isOutOfStock) {
                return next(
                    new AppError(
                        `Some items are out of stock or unavailable: ${product.name}`,
                        HTTP_STATUS.BAD_REQUEST
                    )
                );
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
