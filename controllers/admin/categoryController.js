import mongoose from 'mongoose';
import Category from '../../models/categorySchema.js';
import AppError from '../../utils/appError.js';
import validator from 'validator';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
// get category info for listing
const categoryInfo = async (req, res, next) => {
    try {
        let search = req.query.search || '';
        let page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        const filter = {
            $or: [
                { categoryName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ],
        };
        const categoryCount = await Category.countDocuments(filter);
        const categoryData = await Category.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .exec();

        const totalPages = Math.ceil(categoryCount / limit);
        if (req.session.admin) {
            res.render('category', {
                title: 'Category List',
                status: 'success',
                message: 'category info loaded successfully',
                data: categoryData,
                currentCount: categoryCount,
                search: search,
                totalPages: totalPages,
                currentPage: page,
            });
        }
    } catch (error) {
        console.log('error while loading user info', error);
        next(error);
    }
};
// get add category
const getAddCategory = async (req, res, next) => {
    try {
        if (req.session?.admin) {
            res.render('add-category', { title: 'Add Category', error: null });
        }
    } catch (error) {
        console.log('Error in loading add category', error);
        next(error);
    }
};
// add category
const addCategory = async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name.trim() || !description.trim()) {
            return next(
                new AppError(
                    'please fill the necessary field',
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
        const namePattern = /^[A-Za-z0-9-]+$/;
        if (!namePattern.test(name)) {
            return next(
                new AppError(
                    'Invalid category name. Only letters, numbers, and hyphens (-) are allowed.',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }

        const existingCategory = await Category.findOne({
            categoryName: { $regex: name.trim(), $options: 'i' },
        });

        if (existingCategory) {
            return next(
                new AppError(
                    'category name already exists, please change the name',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const newCategory = new Category({
            categoryName: name,
            description: description,
        });
        await newCategory.save();
        res.status(HTTP_STATUS.OK).json({
            status: 'success',
            message: 'Category added successfully',
            redirectUrl: '/admin/category/category-add',
        });
    } catch (error) {
        console.log('error while adding category', error);
        next(error);
    }
};
// get edit category
const getEditCategory = async (req, res, next) => {
    try {
        const id = req.query.id;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.redirect('/admin/category');
        }
        if (req.session.admin) {
            const category = await Category.findOne({ _id: id });
            res.render('category-edit', {
                status: 'success',
                category: category,
            });
        }
    } catch (error) {
        console.log('error occured while loading edit category', error);
        next(error);
    }
};
// edit category
const editCategory = async (req, res, next) => {
    try {
        const { id, name, description } = req.body;
        if (!name.trim() || !description.trim()) {
            return next(
                new AppError(
                    'name or description cannot be empty',
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
        const namePattern = /^[A-Za-z0-9-]+$/;
        if (!namePattern.test(name)) {
            return next(
                new AppError(
                    'Invalid category name. Only letters, numbers, and hyphens (-) are allowed.',
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
        const existingCategory = await Category.findOne({
            categoryName: { $regex: name.trim(), $options: 'i' },
        });
        if (existingCategory) {
            return next(
                new AppError(
                    'category with this name already exist, please change the name',
                    HTTP_STATUS.BAD_REQUEST
                )
            );
        }
        const data = {
            categoryName: name,
            description: description,
        };

        await Category.updateOne({ _id: id }, { $set: data });
        res.status(HTTP_STATUS.OK).json({
            status: 'success',
            message: 'Category edited successfully',
            redirectUrl: '/admin/category',
        });
    } catch (error) {
        console.log('error while editing the category', error);
        next(error);
    }
};
// list category
const listCategory = async (req, res, next) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect('/admin/category');
    } catch (error) {
        console.log('error while listing the category', error);
        next(error);
    }
};
// unlist category
const unlistCategory = async (req, res, next) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect('/admin/category');
    } catch (error) {
        console.log('error while unlisting the category', error);
        next(error);
    }
};
export default {
    getAddCategory,
    addCategory,
    categoryInfo,
    getEditCategory,
    editCategory,
    listCategory,
    unlistCategory,
};
