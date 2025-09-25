import Product from '../../models/productSchema.js';
import AppError from '../../utils/appError.js';
import Category from '../../models/categorySchema.js';
import cloudinary from '../../config/cloudinaryConfig.js';
import mongoose from 'mongoose';
import ProductVariant from '../../models/productVarintSchema.js';
import { json } from 'express';

const getAddProduct = async (req, res, next) => {
    if (req.session.admin) {
        const category = await Category.find({ isListed: true });
        res.render('add-product', {
            category,
        });
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
            isListed,
            sizes = {},
        } = req.body;

        // 1. Validate required fields
        if (!name || !category || !originalPrice || !colorName) {
            return res.status(400).json({
                status: 'error',
                message:
                    'Please provide name, category, original price and color name',
            });
        }

        // 2. Validate images
        if (!req.files || req.files.length < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Please upload at least one product image',
            });
        }

        // 3. Check for duplicate product name
        const existing = await Product.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
        });
        if (existing) {
            return res.status(400).json({
                status: 'error',
                message: 'A product with this name already exists',
            });
        }

        // 4. Verify category
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid category selected',
            });
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
            isListed: isListed === 'true' || isListed === true,
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
            redirectUrl: '/admin/product',
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

export default { getAddProduct, addProduct };
