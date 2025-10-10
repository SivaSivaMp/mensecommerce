import { Router } from 'express';
import profileController from '../../controllers/user/profileController.js';
import addressController from '../../controllers/user/addressController.js';
const router = Router();

router.route('/').get(profileController.getProfile);
router.route('/address').get(addressController.getAddressInfo);
router.route('/orders').get(addressController.getMyOrderInfo);
router.route('/change-password').post(profileController.profileChangePassword);
router
    .route('/profile-edit')
    .get(profileController.getEditProfile)
    .patch(profileController.editPersonalInformation);

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

export default router;
