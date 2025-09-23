import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
    {
        categoryName: {
            type: String,
            require: [true, 'please provide category name'],
            unique: [true, 'category name should be unique'],
            minlength: 2,
            maxlength: 50,
        },
        description: {
            type: String,
            required: [true, 'please provide description for category'],
            minlength: 3,
            maxlength: 1000,
        },
        isListed: {
            type: Boolean,
            required: [true, 'confirm if the category is listed'],
            default: true,
        },
        categoryOffer: {
            type: Number,
            defualt: null,
        },
    },
    { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);

export default Category;
