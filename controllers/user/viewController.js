import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';
import ProductVariant from '../../models/productVarintSchema.js';
import Category from '../../models/categorySchema.js';
import User from '../../models/userSchema.js';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

// load home page
const loadHomepage = async (req, res, next) => {
    try {
        const userId = req.session.user;

        let productData = await Product.aggregate([
            {
                $lookup: {
                    from: Category.collection.name,
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            { $unwind: '$category' },
            { $match: { 'category.isListed': true, isListed: true } },
            { $sort: { createdAt: -1 } },
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
                    productImage1: { $arrayElemAt: ['$images', 0] },
                    productImage2: { $arrayElemAt: ['$images', 1] },
                },
            },
            { $match: { totalQuantity: { $gt: 0 } } },
            { $limit: 12 },
        ]);

        return res.render('home-men', { data: productData });
    } catch (error) {
        console.log('error loading while home page :', error);
        next(error);
    }
};

const loadShoppingPage = async (req, res, next) => {
    try {
        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map((c) => c._id);
        const {
            query: searchQuery = '',
            category: selectedCategory = '',
            sort = 'default',
            page = 1,
            gt: minPrice,
            lt: maxPrice,
        } = req.query;

        const limit = 8;
        const skip = (parseInt(page) - 1) * limit;

        const match = {
            isListed: true,
            category: { $in: categoryIds },
        };
        if (searchQuery.trim()) {
            const matchingCategories = await Category.find({
                categoryName: { $regex: searchQuery.trim(), $options: 'i' },
                isListed: true,
            }).select('_id');
            const matchingIds = matchingCategories.map((c) => c._id);

            match.$or = [
                { name: { $regex: searchQuery.trim(), $options: 'i' } },
                { category: { $in: matchingIds } },
            ];
        }
        if (selectedCategory) {
            match.category = new mongoose.Types.ObjectId(selectedCategory);
        }
        if (minPrice || maxPrice) {
            match.salesPrice = {};
            if (minPrice) match.salesPrice.$gte = parseFloat(minPrice);
            if (maxPrice) match.salesPrice.$lte = parseFloat(maxPrice);
        }
        const sortOptions = {
            default: { createdAt: -1 },
            priceLowToHigh: { salesPrice: 1 },
            priceHighToLow: { salesPrice: -1 },
            nameAtoZ: { name: 1 },
            nameZtoA: { name: -1 },
        };
        const productsAgg = await Product.aggregate([
            { $match: match },
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
                        $setUnion: [
                            [],
                            {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: '$variants',
                                            as: 'v',
                                            cond: { $gt: ['$$v.quantity', 0] },
                                        },
                                    },
                                    as: 'v',
                                    in: '$$v.size',
                                },
                            },
                        ],
                    },
                },
            },
            {
                $facet: {
                    results: [
                        { $sort: sortOptions[sort] || { createdAt: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                    ],
                    totalCount: [{ $count: 'count' }],
                },
            },
        ]);

        const products = productsAgg[0].results;
        const totalProducts = productsAgg[0].totalCount[0]?.count || 0;
        const totalPages = Math.ceil(totalProducts / limit);
        const queryParams = new URLSearchParams();
        if (searchQuery) queryParams.set('query', searchQuery);
        if (selectedCategory) queryParams.set('category', selectedCategory);
        if (sort !== 'default') queryParams.set('sort', sort);
        if (minPrice) queryParams.set('gt', minPrice);
        if (maxPrice) queryParams.set('lt', maxPrice);

        const pagination = {
            currentPage: parseInt(page),
            totalPages,
            totalProducts,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit,
        };
        res.render('shop', {
            products,
            categories,
            pagination,
            search: searchQuery,
            selectedCategory,
            currentSort: sort,
            gt: minPrice,
            lt: maxPrice,
            queryString: queryParams.toString(),
            totalProducts,
        });
    } catch (error) {
        console.error('Error loading the shop page:', error);
        res.redirect('/page-notfound');
    }
};

const getProductDetails = async (req, res, next) => {
    try {
        const productId = req.query.id;
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return next(
                new AppError('product doest exist, please refresh', 404)
            );
        }
        const productAgg = await Product.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(productId),
                    isListed: true,
                },
            },
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
                        $map: {
                            input: ['S', 'M', 'L', 'XL', 'XXL'],
                            as: 'size',
                            in: {
                                label: '$$size',
                                stock: {
                                    $reduce: {
                                        input: {
                                            $filter: {
                                                input: '$variants',
                                                as: 'v',
                                                cond: {
                                                    $eq: ['$$v.size', '$$size'],
                                                },
                                            },
                                        },
                                        initialValue: 0,
                                        in: {
                                            $add: [
                                                '$$value',
                                                '$$this.quantity',
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ]);
        if (!productAgg.length) {
            res.redirect('/page-notfound');
        }
        const product = productAgg[0];
        product.availableSizes = product.availableSizes.map((size) => ({
            ...size,
            isLowStock: size.stock > 0 && size.stock <= 2,
        }));
        const similarProducts = await Product.aggregate([
            {
                $match: {
                    category: product.category._id,
                    _id: { $ne: new mongoose.Types.ObjectId(productId) },
                    isListed: true,
                },
            },
            { $sample: { size: 6 } },
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
                        $setUnion: [
                            [],
                            {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: '$variants',
                                            as: 'v',
                                            cond: { $gt: ['$$v.quantity', 0] },
                                        },
                                    },
                                    as: 'v',
                                    in: '$$v.size',
                                },
                            },
                        ],
                    },
                },
            },
            { $match: { totalQuantity: { $gt: 0 } } },
        ]);

        res.render('product-details', {
            product,
            similarProducts,
            availableSizes: product.availableSizes,

            messages: 'product details rendered successfullt',
            status: 200,
        });
    } catch (error) {
        console.log('error while loading product deatails page', error);
        next(error);
    }
};

export default { loadHomepage, loadShoppingPage, getProductDetails };
