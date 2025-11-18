import ProductVariant from '../models/productVarintSchema.js';

export const calculatePriceDetails = async (cart) => {
    let totalPrice = 0;
    let totalDiscount = 0;
    let savings = 0;

    const cartItems = [];

    for (const item of cart.items) {
        const product = item.productId;
        if (!product) continue;

        const variant = await ProductVariant.findById(item.variantId);
        const variantQuantity = variant ? variant.quantity : 0;

        const originalPrice = Number(product.originalPrice || 0);
        const salePrice =
            product.salesPrice && Number(product.salesPrice) > 0
                ? Number(product.salesPrice)
                : originalPrice;

        const isUnlistedProduct = !product.isListed;
        const isUnlistedCategory = !product.category?.isListed;
        const isOutOfStock =
            item.quantity > variantQuantity || variantQuantity === 0;

        const itemOriginalTotal = originalPrice * item.quantity;
        const itemSaleTotal = salePrice * item.quantity;
        const itemDiscount = itemOriginalTotal - itemSaleTotal;

        cartItems.push({
            _id: item._id,
            productId: product._id,
            productName: product.name,
            productImage: product.images?.[0] || '/images/placeholder.jpg',
            originalPrice,
            salePrice,
            quantity: item.quantity,
            size: variant?.size || item.size,
            variantQuantity,
            totalPrice: salePrice * item.quantity,
            isOutOfStock,
            isUnlisted: isUnlistedProduct || isUnlistedCategory,
        });

        if (!isOutOfStock && !isUnlistedProduct && !isUnlistedCategory) {
            totalPrice += itemOriginalTotal;
            totalDiscount += itemDiscount;
        }
    }

    let totalAmount = totalPrice - totalDiscount;
    savings = totalDiscount;

    let couponCode = null;
    let couponDiscount = 0;

    if (cart.appliedCoupon && cart.appliedCoupon.couponId) {
        const coupon = cart.appliedCoupon.couponId;

        const couponValid =
            coupon &&
            coupon.isActive &&
            new Date() <= new Date(coupon.expiresAt);

        if (couponValid) {
            couponCode = cart.appliedCoupon.code;
            couponDiscount = cart.appliedCoupon.discount || 0;

            totalAmount = Math.max(totalAmount - couponDiscount, 0);
            savings += couponDiscount;
        } else {
            cart.appliedCoupon = {
                couponId: null,
                code: null,
                discount: 0,
                appliedAt: null,
            };
            await cart.save();
        }
    }

    return {
        cartItems,
        priceDetails: {
            totalPrice,
            discount: totalDiscount,
            totalAmount,
            savings,
        },
        couponCode,
        couponDiscount,
    };
};
