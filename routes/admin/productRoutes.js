import { Router } from 'express';
import productController from '../../controllers/admin/productController.js';
import upload from '../../middleware/uploadMiddleware.js';
import offerController from '../../controllers/admin/offerController.js';
const router = Router();

router.route('/').get(productController.getProductInfo);

router
    .route('/product-add')
    .get(productController.getAddProduct)
    .post(upload.any(), productController.addProduct);

router.route('/:id/unlist').put(productController.unlistProduct);
router.route('/:id/list').put(productController.listProduct);

router
    .route('/edit-product/:id')
    .get(productController.getEditProduct)
    .post(upload.array('images[]', 10), productController.editProduct);
router.route('/add-offer/:id').post(offerController.addProductOffer);
router.route('/remove-offer/:id').post(offerController.removeProductOffer);
export default router;
