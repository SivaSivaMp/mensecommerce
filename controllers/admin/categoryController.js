import Category from '../../models/categorySchema.js';
import AppError from '../../utils/appError.js';

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

const addCategory = async (req, res, next) => {};

export default { getAddCategory, addCategory };
