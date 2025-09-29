import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const ProductSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            milength: 2,
            maxlength: 500,
            unique: [true, 'all product should have unique name'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
        },
        originalPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        salesPrice: {
            type: Number,
            min: 0,
        },
        colorName: {
            type: String,
            required: true,
        },
        colorCode: {
            type: String,
        },
        images: {
            type: [String],
            required: true,
        },
        isListed: {
            type: Boolean,
            default: true,
        },
        totalStock: {
            type: Number,
        },
    },
    { timestamps: true }
);
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ originalPrice: 1, salePrice: 1 });
ProductSchema.virtual('discountPercentage').get(function () {
    if (!this.salePrice || this.salePrice >= this.originalPrice) {
        return 0;
    }
    return Math.round(
        ((this.originalPrice - this.salePrice) / this.originalPrice) * 100
    );
});
ProductSchema.virtual('totalQuantity').get(function () {
    return this._totalQuantity || 0;
});
const Product = mongoose.model('Product', ProductSchema);
export default Product;
