import Cart from '../models/cartSchema.js';
import Wishlist from '../models/whishListSchema.js';
import { getCurrentUserId } from '../helpers/getCurrentUserId.js';

export const cartCount = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (userId) {
            const cart = await Cart.findOne({ userId: userId });
            res.locals.cartCount = cart ? cart.items.length : 0;
        } else {
            res.locals.cartCount = 0;
        }
    } catch (error) {
        console.error('Error setting cart count:', err);
        res.locals.cartCount = 0;
    }
    next();
};
export const wishlistCount = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (userId) {
            const wishlist = await Wishlist.findOne({ userId: userId });
            res.locals.wishlistCount = wishlist ? wishlist.items.length : 0;
        } else {
            res.locals.wishlistCount = 0;
        }
    } catch (error) {
        console.error('Error setting wishlist count:', err);
        res.locals.wishlistCount = 0;
    }
    next();
};
