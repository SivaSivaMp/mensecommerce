import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';
import Category from '../../models/categorySchema.js';
import cloudinary from '../../config/cloudinaryConfig.js';
import ProductVariant from '../../models/productVarintSchema.js';

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

const getEditProduct = async (req, res, next) => {
    if (req.session.admin) {
        cons;
    }
};
const addProduct = async (req, res) => {
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

        // 1. Validate required fields
        if (!name || !category || !originalPrice || !colorName) {
            return next(
                new AppError(
                    'Please provide name, category, original price and color name',
                    400
                )
            );
        }

        // 2. Validate images
        if (!req.files || req.files.length < 1) {
            return next(
                new AppError('Please upload at least one product image', 400)
            );
        }

        // 3. Check for duplicate product name
        const existing = await Product.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
        });
        if (existing) {
            return next(
                new AppError('A product with this name already exists', 400)
            );
        }

        // 5. Upload images sequentially to Cloudinary
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

        // 6. Process size variants
        let totalStock = 0;
        const sizeVariants = [];
        const sizeList = ['S', 'M', 'L', 'XL', 'XXL'];

        sizeList.forEach((size) => {
            const qty = parseInt(sizes[size]) || 0;
            sizeVariants.push({ size, quantity: qty });
            totalStock += qty;
        });

        // 7. Create product
        const product = await Product.create({
            name: name.trim(),
            description: description?.trim() || '',
            category,
            originalPrice: parseFloat(originalPrice),
            salesPrice: salesPrice ? parseFloat(salesPrice) : null,
            colorName: colorName.trim(),
            colorCode: colorCode || '',
            images: imageUrls,
            totalStock,
        });

        // 8. Create product variants
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
            return res.status(400).json({
                status: 'error',
                message: Object.values(err.errors)
                    .map((e) => e.message)
                    .join(', '),
            });
        }
        if (err.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Duplicate product name',
            });
        }
        if (err.http_code) {
            return res.status(400).json({
                status: 'error',
                message: 'Image upload failed, please try again',
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Something went wrong while adding product',
        });
    }
};
const listProduct = async (req, res, next) => {
    try {
        if (req.session.admin) {
            const id = req.query.id;
            await Product.updateOne({ _id: id }, { $set: { isListed: true } });
            res.redirect('/admin/product');
        }
    } catch (error) {
        console.log('error while listing the category', error);
        next(error);
    }
};

const unlistProduct = async (req, res, next) => {
    try {
        if (req.session.admin) {
            const id = req.query.id;
            await Product.updateOne({ _id: id }, { $set: { isListed: false } });
            res.redirect('/admin/product');
        }
    } catch (error) {
        console.log('error while listing the category', error);
        next(error);
    }
};

export default {
    getAddProduct,
    addProduct,
    getProductInfo,
    listProduct,
    unlistProduct,
};
