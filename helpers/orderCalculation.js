import Product from '../models/productSchema.js';
import ProductVariant from '../models/productVarintSchema.js';
import Coupon from '../models/couponSchema.js';

/**
 * Calculate totals from cart
 */
export const calculateCartTotals = async (cart) => {
    let totalPrice = 0;
    let totalSalePrice = 0;
    let totalDiscount = 0;
    const orderedItems = [];

    for (const item of cart.items) {
        const product = await Product.findById(item.productId).populate(
            'category',
            'isListed categoryName'
        );
        const variant = await ProductVariant.findById(item.variantId);

        const originalPrice = Number(product.originalPrice);
        const salePrice =
            product.salesPrice && product.salesPrice > 0
                ? Number(product.salesPrice)
                : originalPrice;

        const itemOriginalTotal = originalPrice * item.quantity;
        const itemSaleTotal = salePrice * item.quantity;

        totalPrice += itemOriginalTotal;
        totalSalePrice += itemSaleTotal;
        totalDiscount += itemOriginalTotal - itemSaleTotal;

        orderedItems.push({
            product: product._id,
            variant: variant._id,
            productName: product.name,
            quantity: item.quantity,
            price: salePrice,
            size: item.size,
            status: 'Pending',
        });
    }

    return {
        orderedItems,
        totalPrice,
        totalSalePrice,
        totalDiscount,
        subtotal: totalPrice - totalDiscount,
    };
};

/**
 * Apply coupon discount
 */
export const calculateCouponDiscount = async (
    subtotal,
    appliedCoupon,
    userId
) => {
    if (!appliedCoupon || !appliedCoupon.couponId) {
        return { couponDiscount: 0, couponId: null, couponCode: null };
    }

    const coupon = await Coupon.findById(appliedCoupon.couponId);

    let discount = 0;

    if (coupon.discountType === 'flat') {
        discount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount) {
            discount = Math.min(discount, coupon.maxDiscountAmount);
        }
    }

    return {
        couponDiscount: Math.round(discount),
        couponId: coupon._id,
        couponCode: coupon.code,
    };
};

export const calculateShipping = (amountAfterCoupon) => {
    const shippingThreshold = 800;
    return amountAfterCoupon < shippingThreshold ? 50 : 0;
};
