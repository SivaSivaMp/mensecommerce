import { Router } from 'express';
import profileController from '../../controllers/user/profileController.js';
import addressController from '../../controllers/user/addressController.js';
import orderController from '../../controllers/user/orderController.js';
import upload from '../../middleware/uploadMiddleware.js';
const router = Router();

router.route('/').get(profileController.getProfile);
router.route('/address').get(addressController.getAddressInfo);

router.route('/change-password').post(profileController.profileChangePassword);
router
    .route('/profile-edit')
    .get(profileController.getEditProfile)
    .patch(profileController.editPersonalInformation);
router
    .route('/upload-image')
    .post(upload.single('profileImage'), profileController.uploadProfileImage);

router.route('/email-edit').patch(profileController.editEmail);
router
    .route('/email-change-otp')
    .get(profileController.getEmailChangeotp)
    .post(profileController.resetEmailOtpVerification);

router
    .route('/address-add')
    .get(addressController.getAddAddress)
    .post(addressController.addAddress);
router.route('/address-delete/:id').delete(addressController.deleteAddress);
router
    .route('/address-edit/:id')
    .get(addressController.getEditAddress)
    .put(addressController.editAddress);

// order management
router.route('/orders').get(orderController.getOrders);
router.get('/order-details/:orderId/:itemId', orderController.getOrderDetails);
router.get('/:orderId/item/:itemId/invoice', orderController.renderItemInvoice);

export default router;
