import { Router } from 'express';
import profileController from '../../controllers/user/profileController.js';
import addressController from '../../controllers/user/addressController.js';
import orderController from '../../controllers/user/orderController.js';
import upload from '../../middleware/uploadMiddleware.js';
import walletController from '../../controllers/user/walletController.js';
import reviewController from '../../controllers/user/reviewController.js';
import orderFetchController from '../../controllers/user/orderFetchController.js';
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
router.route('/orders').get(orderFetchController.getOrders);
router.route('/orders-summary').get(orderFetchController.listOrdersOnly);
router.get(
    '/allorder-details/:orderId',
    orderFetchController.getOrderDetailsAllItems
);
router.get(
    '/order-details/:orderId/:itemId',
    orderFetchController.getOrderDetails
);
router.get(
    '/:orderId/item/:itemId/invoice',
    orderFetchController.renderItemInvoice
);

// wallet routes

router.route('/wallet').get(walletController.getWalletTransactions);

router.route('/feedback/:orderId').post(reviewController.submitReview);
export default router;
