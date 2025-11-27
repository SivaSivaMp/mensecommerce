import { Router } from 'express';
import categoryController from '../../controllers/admin/categoryController.js';
import offerController from '../../controllers/admin/offerController.js';
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
router.route('/:id/list').put(categoryController.listCategory);
router.route('/:id/unlist').put(categoryController.unlistCategory);
router.route('/add-offer/:id').post(offerController.addCategoryOffer);
router.route('/remove-offer/:id').post(offerController.removeCategoryOffer);
export default router;
