import { Router } from 'express';
import productController from '../../controllers/admin/productController.js';
import upload from '../../middleware/uploadMiddleware.js';
const router = Router();

router
    .route('/product-add')
    .get(productController.getAddProduct)
    .post(upload.any(), productController.addProduct);

export default router;
