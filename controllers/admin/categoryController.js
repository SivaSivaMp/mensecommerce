import mongoose from 'mongoose';
import Category from '../../models/categorySchema.js';
import AppError from '../../utils/appError.js';
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
            return next(new AppError('please fill the necessary field', 400));
        }

        const existingCategory = await Category.findOne({
            categoryName: name,
        });
        if (existingCategory) {
            return next(
                new AppError(
                    'category name already exists, please change the name',
                    400
                )
            );
        }
        const newCategory = new Category({
            categoryName: name,
            description: description,
        });
        await newCategory.save();
        res.status(200).json({
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

const editCategory = async (req, res, next) => {
    try {
        const { id, name, description } = req.body;
        if (!name.trim() || !description.trim()) {
            return next(
                new AppError('name or description cannot be empty', 400)
            );
        }
        const existingCategory = await Category.findOne({ categoryName: name });
        if (existingCategory) {
            return next(
                new AppError(
                    'category with this name already exist, please change the name',
                    400
                )
            );
        }
        const data = {
            categoryName: name,
            description: description,
        };

        await Category.updateOne({ _id: id }, { $set: data });
        res.status(200).json({
            status: 'success',
            message: 'Category edited successfully',
            redirectUrl: '/admin/category',
        });
    } catch (error) {
        console.log('error while editing the category', error);
        next(error);
    }
};

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
