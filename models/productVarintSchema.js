import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const productVariantSchema = new mongoose.Schema(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },

        size: {
            type: String,
            enum: ['S', 'M', 'L', 'XL', 'XXL'],
            required: true,
        },
        quantity: {
            type: Number,
            default: 0,
            required: true,
        },
    },
    { timestamps: true }
);
productVariantSchema.index({ productId: 1, size: 1 }, { unique: true });
const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);
export default ProductVariant;
