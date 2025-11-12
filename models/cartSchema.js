import mongoose, { Schema } from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    variantId: {
        type: Schema.Types.ObjectId,
        ref: 'ProductVariant',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    size: {
        type: String,
        required: true,
    },
    totalPrice: {
        type: Number,
    },
});

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        items: [cartItemSchema],
        appliedCoupon: {
            couponId: {
                type: Schema.Types.ObjectId,
                ref: 'Coupon',
                default: null,
            },
            code: {
                type: String,
                default: null,
            },
            discount: {
                type: Number,
                default: 0,
            },
            appliedAt: {
                type: Date,
                default: null,
            },
        },
    },
    { timestamps: true }
);

const Cart = mongoose.model('Cart', cartSchema);
export default Cart;
