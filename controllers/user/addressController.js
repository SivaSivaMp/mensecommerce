import AppError from '../../utils/appError.js';
import Address from '../../models/addressSchema.js';
import validator from 'validator';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';

const getAddressInfo = async (req, res) => {
    console.log('GET /profile/address hit');
    res.render('address');
};
const getMyOrderInfo = async (req, res) => {
    res.render('my-wallet');
};
const getAddAddress = async (req, res, next) => {
    try {
        res.render('add-address');
    } catch (error) {}
};
const addAddress = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const {
            building,
            street,
            landmark,
            pincode,
            city,
            state,
            name,
            phone,
            altPhone,
            addressType,
        } = req.body;
        if (!building || !street || !pincode || !city || !state || !phone) {
            return next(new AppError('please fill the required fields', 400));
        }
        if (
            building.length > 1000 ||
            street.length > 1000 ||
            city.length > 1000 ||
            state.length > 1000 ||
            landmark.length > 1000
        ) {
            return next(
                new AppError(
                    'some fields contain too much letter please check',
                    400
                )
            );
        }
        if (!validator.isPostalCode(pincode, 'IN')) {
            return next(new AppError('invalid postal code, try again', 400));
        }
        if (!validator.isMobilePhone(phone, 'en-IN')) {
            return next(new AppError('Invalid phone number', 400));
        }
        if (altPhone) {
            if (!validator.isMobilePhone(altPhone, 'en-IN')) {
                return next(
                    new AppError('invalid alternate phone number', 400)
                );
            }
        }
        if (phone.trim() === altPhone.trim()) {
            return next(
                new AppError('please change the alternate phone number', 400)
            );
        }

        const namepattern = /^[A-Za-z\s]+$/;
        if (name) {
            if (!namepattern.test(name)) {
                return next(
                    new AppError(
                        'name must contain only letter and spaces',
                        400
                    )
                );
            }
        }

        if (!namepattern.test(state)) {
            return next(
                new AppError('State should have only letter and spaces', 400)
            );
        }
        const existing = await Address.findOne({
            userId,
            'addresses.building': building.trim(),
            'addresses.pincode': pincode.trim(),
        });

        if (existing) {
            return next(new AppError('This address already exists', 400));
        }
        const newAddress = await Address.create({
            userId,
            building: building.trim(),
            street: street.trim(),
            landmark: landmark?.trim() || '',
            pincode: pincode.trim(),
            city: city.trim(),
            state: state.trim(),
            name: name.trim(),
            phone: phone.trim(),
            altPhone: altPhone?.trim() || '',
            addressType: addressType || 'Home',
        });
        return res.status(200).json({
            status: 'success',
            message: 'New address created successfully',
            redirectUrl: '/profile/address',
        });
    } catch (error) {
        console.error('Error adding address:', error);
        next(error);
    }
};
export default { getAddressInfo, getMyOrderInfo, getAddAddress, addAddress };
