import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';
import Category from '../../models/categorySchema.js';
import cloudinary from '../../config/cloudinaryConfig.js';
import ProductVariant from '../../models/productVarintSchema.js';
import validator from 'validator';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
const getProductInfo = async (req, res, next) => {
    try {
        let search = req.query.search || '';
        let page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        const productData = await Product.aggregate([
            {
                $match: {
                    name: { $regex: new RegExp('.*' + search + '.*', 'i') },
                },
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: Category.collection.name,
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            { $unwind: '$category' },
            {
                $lookup: {
                    from: ProductVariant.collection.name,
                    localField: '_id',
                    foreignField: 'productId',
                    as: 'variants',
                },
            },
            {
                $addFields: {
                    totalQuantity: { $sum: '$variants.quantity' },
                    availableSizes: {
                        $setUnion: { $setUnion: ['$variants.size', []] },
                    },
                    computedStatus: {
                        $cond: [
                            { $eq: [{ $sum: '$variants.quantity' }, 0] },
                            'out of stock',
                            'Available',
                        ],
                    },
                },
            },
        ]);
        const count = await Product.countDocuments({
            name: { $regex: new RegExp('.*' + search + '.*', 'i') },
        });
        const totalPages = Math.ceil(count / limit);
        res.render('products', {
            status: 'success',
            message: 'product list loaded successfully',
            search,
            data: productData,
            totalPages,
            currentPage: page,
            currentCount: count,
        });
    } catch (error) {
        console.log('error while loading product');
        next(error);
    }
};

const getAddProduct = async (req, res, next) => {
    if (req.session.admin) {
        const category = await Category.find({ isListed: true });
        res.render('add-product', {
            category,
        });
    }
};

const addProduct = async (req, res, next) => {
    try {
        const {
            name,
            description,
            category,
            originalPrice,
            salesPrice,
            colorName,
            colorCode,
            sizes = {},
        } = req.body;

        if (!name || !category || !originalPrice || !colorName) {
            return next(
                new AppError(
                    'Please provide name, category, original price and color name',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!validator.isLength(name, { min: 2, max: 50 })) {
            return next(
                new AppError(
                    'Name must be between 2 and 50 characters',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!validator.isLength(description, { min: 2, max: 1000 })) {
            return next(
                new AppError(
                    'Description must be between 2 and 50 characters',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (parseFloat(originalPrice) < 0 || parseFloat(salesPrice) < 0) {
            return next(
                new AppError(
                    'price should not be less than 0',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (parseFloat(originalPrice) < parseFloat(salesPrice)) {
            return next(
                new AppError(
                    'sale price should be less than original price',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const productOffer = Number(
            ((originalPrice - salesPrice) / originalPrice) * 100
        ).toFixed(2);

        if (!req.files || req.files.length < 1) {
            return next(
                new AppError(
                    'Please upload at least one product image',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const existing = await Product.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
        });
        if (existing) {
            return next(
                new AppError(
                    'A product with this name already exists',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const imageUrls = [];
        for (const file of req.files) {
            const url = await new Promise((resolve, reject) => {
                cloudinary.uploader
                    .upload_stream(
                        {
                            folder: 'products',
                            transformation: [
                                {
                                    width: 800,
                                    height: 800,
                                    crop: 'fill',
                                    quality: 'auto',
                                },
                            ],
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result.secure_url);
                        }
                    )
                    .end(file.buffer);
            });
            imageUrls.push(url);
        }

        let totalStock = 0;
        const sizeVariants = [];
        const sizeList = ['S', 'M', 'L', 'XL', 'XXL'];

        sizeList.forEach((size) => {
            const qty = parseInt(sizes[size]) || 0;
            sizeVariants.push({ size, quantity: qty });
            totalStock += qty;
        });
        if (totalStock <= 0) {
            return next(
                new AppError(
                    'Total quantity must be greater than 0',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const product = await Product.create({
            name: name.trim(),
            description: description?.trim() || '',
            category,
            originalPrice: parseFloat(originalPrice),
            salesPrice: salesPrice ? parseFloat(salesPrice) : null,
            colorName: colorName.trim(),
            colorCode: colorCode || '',
            images: imageUrls,
            productOffer,
            totalStock,
        });

        const variantDocs = sizeVariants.map((v) => ({
            productId: product._id,
            size: v.size,
            quantity: v.quantity,
        }));
        await ProductVariant.create(variantDocs);

        return res.status(201).json({
            status: 'success',
            message: 'Product added successfully!',
            data: {
                product,
                variants: variantDocs,
            },
            redirectUrl: '/admin/product/product-add',
        });
    } catch (err) {
        console.error('Error adding product:', err);

        if (err.name === 'ValidationError') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: Object.values(err.errors)
                    .map((e) => e.message)
                    .join(', '),
            });
        }
        if (err.http_code) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: 'Image upload failed, please try again',
            });
        }

        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            status: 'error',
            message: 'Something went wrong while adding product',
        });
    }
};
// const listProduct = async (req, res, next) => {
//     try {
//         if (req.session.admin) {
//             const id = req.query.id;
//             await Product.updateOne({ _id: id }, { $set: { isListed: true } });
//             res.redirect('/admin/product');
//         }
//     } catch (error) {
//         console.log('error while listing the category', error);
//         next(error);
//     }
// };
const listProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const updated = await Product.findByIdAndUpdate(
            id,
            { isListed: true },
            { new: true }
        );

        if (!updated) {
            return next(
                new AppError('Product not found', HTTP_STATUS.NOT_FOUND)
            );
        }

        return res.status(HTTP_STATUS.OK).json({
            message: 'Product listed successfully',
        });
    } catch (error) {
        console.error('List product error:', error);
        return res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json({ message: 'Server error while listing product' });
    }
};
// const unlistProduct = async (req, res, next) => {
//     try {
//         if (req.session.admin) {
//             const id = req.query.id;
//             await Product.updateOne({ _id: id }, { $set: { isListed: false } });
//             res.redirect('/admin/product');
//         }
//     } catch (error) {
//         console.log('error while listing the category', error);
//         next(error);
//     }
// };

const unlistProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const updated = await Product.findByIdAndUpdate(
            id,
            { isListed: false },
            { new: true }
        );

        if (!updated) {
            return next(
                new AppError('Product not found', HTTP_STATUS.NOT_FOUND)
            );
        }

        return res.status(HTTP_STATUS.OK).json({
            message: 'Product unlisted successfully',
        });
    } catch (error) {
        console.error('Unlist Product error:', error);
        return res
            .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
            .json({ message: 'Server error while unlisting Product' });
    }
};

const editProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const {
            name,
            description,
            category,
            originalPrice,
            salesPrice,
            colorName,
            colorCode,
            sizes = {},
            removedImages = '[]',
        } = req.body;
        if (!name || !category || !originalPrice || !colorName) {
            return next(
                new AppError(
                    'Please provide name, category, original price and color name',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return next(
                new AppError('Product not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        const duplicate = await Product.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: productId },
        });
        if (duplicate) {
            return next(
                new AppError(
                    'A product with this name already exists',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (parseFloat(originalPrice) < parseFloat(salesPrice)) {
            return next(
                new AppError(
                    'sale price should be less than original price',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const productOffer = Number(
            ((originalPrice - salesPrice) / originalPrice) * 100
        ).toFixed(2);
        if (!validator.isLength(name, { min: 2, max: 50 })) {
            return next(
                new AppError(
                    'Name must be between 2 and 50 characters',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (!validator.isLength(description, { min: 2, max: 1000 })) {
            return next(
                new AppError(
                    'Description must be between 2 and 50 characters',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        let currentImages = [...existingProduct.images];
        const imagesToRemove = JSON.parse(removedImages);

        if (imagesToRemove.length > 0) {
            for (const imageUrl of imagesToRemove) {
                try {
                    const parts = imageUrl.split('/');
                    const filename = parts[parts.length - 1];
                    const publicId = `products/${filename.split('.')[0]}`;

                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.error('Error deleting image from Cloudinary:', err);
                }
            }

            currentImages = currentImages.filter(
                (img) => !imagesToRemove.includes(img)
            );
        }

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const url = await new Promise((resolve, reject) => {
                    cloudinary.uploader
                        .upload_stream(
                            {
                                folder: 'products',
                                transformation: [
                                    {
                                        width: 800,
                                        height: 800,
                                        crop: 'fill',
                                        quality: 'auto',
                                    },
                                ],
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result.secure_url);
                            }
                        )
                        .end(file.buffer);
                });
                currentImages.push(url);
            }
        }

        if (currentImages.length < 3) {
            return next(
                new AppError(
                    'Product must have at 3 images',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        if (currentImages.length > 5) {
            return next(
                new AppError(
                    'Product should only maximum 5 images',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        let totalStock = 0;
        const sizeVariants = [];
        const sizeList = ['S', 'M', 'L', 'XL', 'XXL'];

        sizeList.forEach((size) => {
            const qty = parseInt(sizes[size]) || 0;
            sizeVariants.push({ size, quantity: qty });
            totalStock += qty;
        });

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                name: name.trim(),
                description: description?.trim() || '',
                category,
                originalPrice: parseFloat(originalPrice),
                salesPrice: salesPrice ? parseFloat(salesPrice) : null,
                colorName: colorName.trim(),
                colorCode: colorCode || '',
                images: currentImages,
                productOffer,
                totalStock,
            },
            { new: true, runValidators: true }
        );

        for (const v of sizeVariants) {
            await ProductVariant.findOneAndUpdate(
                { productId: updatedProduct._id, size: v.size },
                { $set: { quantity: v.quantity } },
                { new: true, upsert: true }
            );
        }

        return res.status(HTTP_STATUS.OK).json({
            status: 'success',
            message: 'Product updated successfully!',
            data: {
                product: updatedProduct,
                variants: sizeVariants,
            },
            redirectUrl: '/admin/product',
        });
    } catch (err) {
        console.error('Error editing product:', err);

        if (err.name === 'ValidationError') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: Object.values(err.errors)
                    .map((e) => e.message)
                    .join(', '),
            });
        }
        if (err.name === 'CastError') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: 'Invalid product ID',
            });
        }
        if (err.http_code) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                status: 'error',
                message: 'Image upload failed, please try again',
            });
        }

        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            status: 'error',
            message: 'Something went wrong while updating product',
        });
    }
};

const getEditProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return next(
                new AppError('Product not found', HTTP_STATUS.BAD_REQUEST)
            );
        }

        const category = await Category.find({ isListed: true });
        const variants = await ProductVariant.find({ productId });

        res.render('edit-product', {
            product,
            category,
            variants,
            user: req.session.user,
        });
    } catch (error) {
        console.error('Error loading edit page:', error);

        res.redirect('/admin/product');
    }
};
export default {
    getAddProduct,
    addProduct,
    getProductInfo,
    listProduct,
    unlistProduct,
    getEditProduct,
    editProduct,
};
