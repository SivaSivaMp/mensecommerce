import Product from '../models/productSchema.js';
import ProductVariant from '../models/productVarintSchema.js';
import Coupon from '../models/couponSchema.js';

/**
 * Validate cart items, check stock, and calculate totals
 */
export const validateAndCalculateCart = async (cart) => {
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

        if (!product || !variant) {
            throw new Error(`Product or variant not found`);
        }

        if (!product.isListed) {
            throw new Error(
                `The item ${product.name} is currently unavailable`
            );
        }

        if (!product.category?.isListed) {
            throw new Error(
                `Category ${product.category.categoryName} is unavailable`
            );
        }

        if (variant.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}`);
        }

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
 * Apply coupon (validation + discount calculation)
 */
export const applyCouponToSubtotal = async (
    subtotal,
    appliedCoupon,
    userId
) => {
    if (!appliedCoupon || !appliedCoupon.couponId) {
        return { couponDiscount: 0, couponId: null, couponCode: null };
    }

    const coupon = await Coupon.findById(appliedCoupon.couponId);
    if (!coupon || !coupon.isActive) {
        throw new Error('Invalid or inactive coupon');
    }

    const now = new Date();
    if (now > coupon.expiresAt) throw new Error('Coupon expired');
    if (now < coupon.startsAt) throw new Error('Coupon not started');
    if (subtotal < coupon.minPurchaseAmount)
        throw new Error(
            `Minimum purchase of ₹${coupon.minPurchaseAmount} required`
        );

    if (coupon.usedUsers.includes(userId))
        throw new Error('You have already used this coupon');

    // Calculate discount
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

/**
 * Shipping charge logic
 */
export const calculateShipping = (amountAfterCoupon) => {
    const shippingThreshold = 800;
    return amountAfterCoupon < shippingThreshold ? 50 : 0;
};
