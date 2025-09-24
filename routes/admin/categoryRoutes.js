import { Router } from 'express';
import categoryController from '../../controllers/admin/categoryController.js';

const router = Router();

router.route('/').get(categoryController.categoryInfo);

router
    .route('/category-add')
    .get(categoryController.getAddCategory)
    .post(categoryController.addCategory);
router
    .route('/category-edit')
    .get(categoryController.getEditCategory)
    .patch(categoryController.editCategory);
router.route('/listCategory').get(categoryController.listCategory);
router.route('/unlistCategory').get(categoryController.unlistCategory);
export default router;
