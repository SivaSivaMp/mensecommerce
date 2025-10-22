import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Product from '../../models/productSchema.js';
import Address from '../../models/addressSchema.js';
import Cart from '../../models/cartSchema.js';

const getCheckout = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 2;
        const skip = (page - 1) * itemsPerPage;

        if (!userId) {
            return next(
                new AppError('Please login to proceed to checkout', 401)
            );
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name originalPrice salesPrice images',
            })
            .populate({
                path: 'items.variantId',
                select: 'size quantity',
            });

        if (!cart || cart.items.length === 0) {
            return res.render('checkout', {
                cartItems: [],
                cartEmpty: true,
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,
                    totalAmount: 0,
                    savings: 0,
                },
                addresses: [],
                currentPage: 1,
                totalPages: 0,
                pagination: {
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: null,
                    prevPage: null,
                },
            });
        }

        let totalPrice = 0;
        let totalDiscount = 0;

        const cartItems = cart.items.map((item) => {
            const originalPrice = item.productId.originalPrice
                ? Number(item.productId.originalPrice)
                : 0;
            const salePrice =
                item.productId.salesPrice &&
                Number(item.productId.salesPrice) > 0
                    ? Number(item.productId.salesPrice)
                    : originalPrice;

            const itemOriginalTotal = originalPrice * item.quantity;
            const itemSaleTotal = salePrice * item.quantity;
            const itemDiscount = itemOriginalTotal - itemSaleTotal;

            totalPrice += itemOriginalTotal;
            totalDiscount += itemDiscount;

            return {
                _id: item._id,
                productId: item.productId._id,
                productName: item.productId.name,
                productImage:
                    item.productId.images && item.productId.images[0]
                        ? item.productId.images[0]
                        : '/images/placeholder.jpg',
                originalPrice: originalPrice,
                salePrice: salePrice,
                quantity: item.quantity,
                size: item.size,
                totalPrice: salePrice * item.quantity,
            };
        });

        const totalAmount = totalPrice - totalDiscount;
        const savings = totalDiscount;

        const priceDetails = {
            totalPrice: totalPrice,
            discount: totalDiscount,
            totalAmount: totalAmount,
            savings: savings,
        };

        const totalAddresses = await Address.countDocuments({ userId });
        const totalPages = Math.ceil(totalAddresses / itemsPerPage);

        const validPage = Math.min(Math.max(page, 1), totalPages || 1);

        const addresses = await Address.find({ userId })
            .sort({ createdAt: -1 })
            .skip((validPage - 1) * itemsPerPage)
            .limit(itemsPerPage);

        const formattedAddresses = addresses.map((addr) => ({
            _id: addr._id,
            addressType: addr.addressType,
            name: addr.name,
            phone: addr.phone,
            altPhone: addr.altPhone,
            pincode: addr.pincode,
            city: addr.city,
            street: addr.street,
            building: addr.building,
            landmark: addr.landmark,
            state: addr.state,
            fullAddress: `${addr.building}, ${addr.street}${
                addr.landmark ? ', ' + addr.landmark : ''
            }, ${addr.city}, ${addr.state} - ${addr.pincode}`,
        }));

        const pagination = {
            hasNextPage: validPage < totalPages,
            hasPrevPage: validPage > 1,
            nextPage: validPage < totalPages ? validPage + 1 : null,
            prevPage: validPage > 1 ? validPage - 1 : null,
        };

        return res.render('checkout', {
            cartItems: cartItems,
            cartEmpty: false,
            priceDetails: priceDetails,
            itemCount: cartItems.length,
            addresses: formattedAddresses,
            currentPage: validPage,
            totalPages: totalPages,
            pagination: pagination,
        });
    } catch (error) {
        console.error('Error in getCheckout:', error);
        return next(new AppError('Internal server error', 500));
    }
};
const getCheckoutAddAddress = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(new AppError('Please login to view cart', 401));
        }
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'originalPrice salesPrice',
        });

        if (!cart || cart.items.length === 0) {
            return res.render('cart', {
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,

                    totalAmount: 0,
                    savings: 0,
                },
                itemCount: 0,
            });
        }
        let totalPrice = 0;
        let totalDiscount = 0;

        cart.items.forEach((item) => {
            const originalPrice = Number(item.productId.originalPrice) || 0;
            const salePrice =
                item.productId.salesPrice &&
                Number(item.productId.salesPrice) > 0
                    ? Number(item.productId.salesPrice)
                    : originalPrice;

            const itemOriginalTotal = originalPrice * item.quantity;
            const itemSaleTotal = salePrice * item.quantity;
            const itemDiscount = itemOriginalTotal - itemSaleTotal;

            totalPrice += itemOriginalTotal;
            totalDiscount += itemDiscount;
        });

        const totalAmount = totalPrice - totalDiscount;
        const savings = totalDiscount;

        const priceDetails = {
            totalPrice: totalPrice,
            discount: totalDiscount,

            totalAmount: totalAmount,
            savings: savings,
        };
        return res.render('checkout-addaddress', {
            priceDetails: priceDetails,
            itemCount: cart.items.length,
        });
    } catch (error) {}
};
const getCheckoutEditAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userAddress = await Address.findById(id);

        if (!userAddress) {
            return next(new AppError('address not found', 400));
        }
        const userId = getCurrentUserId(req);

        if (!userId) {
            return next(new AppError('Please login to view cart', 401));
        }
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'originalPrice salesPrice',
        });

        if (!cart || cart.items.length === 0) {
            return res.render('cart', {
                priceDetails: {
                    totalPrice: 0,
                    discount: 0,

                    totalAmount: 0,
                    savings: 0,
                },
                itemCount: 0,
            });
        }
        let totalPrice = 0;
        let totalDiscount = 0;

        cart.items.forEach((item) => {
            const originalPrice = Number(item.productId.originalPrice) || 0;
            const salePrice =
                item.productId.salesPrice &&
                Number(item.productId.salesPrice) > 0
                    ? Number(item.productId.salesPrice)
                    : originalPrice;

            const itemOriginalTotal = originalPrice * item.quantity;
            const itemSaleTotal = salePrice * item.quantity;
            const itemDiscount = itemOriginalTotal - itemSaleTotal;

            totalPrice += itemOriginalTotal;
            totalDiscount += itemDiscount;
        });

        const totalAmount = totalPrice - totalDiscount;
        const savings = totalDiscount;

        const priceDetails = {
            totalPrice: totalPrice,
            discount: totalDiscount,

            totalAmount: totalAmount,
            savings: savings,
        };
        res.render('checkout-editaddress', {
            address: userAddress,
            priceDetails: priceDetails,
            itemCount: cart.items.length,
        });
    } catch (error) {
        console.log('error while geting edit address');
        next(error);
    }
};
export default {
    getCheckout,

    getCheckoutAddAddress,
    getCheckoutEditAddress,
};
