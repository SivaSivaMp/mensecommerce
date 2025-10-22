import AppError from '../../utils/appError.js';
import Address from '../../models/addressSchema.js';
import validator from 'validator';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';

const getAddressInfo = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);

        const page = parseInt(req.query.page, 10) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;

        const userAddressCount = await Address.countDocuments({ userId });

        const userAddresses = await Address.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const totalPages = Math.ceil(userAddressCount / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            userAddressCount,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            limit,
        };

        res.render('address', {
            userAddress: userAddresses,
            pagination,
            userAddressCount,
        });
    } catch (error) {
        console.error('Error while loading address info:', error);
        next(error);
    }
};

const getAddAddress = async (req, res, next) => {
    try {
        res.render('add-address');
    } catch (error) {
        console.log('error while loading add address', error);
        next(error);
    }
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
            building: building.trim(),
            pincode: pincode.trim(),
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

const deleteAddress = async (req, res, next) => {
    try {
        const { id } = req.params;

        const deleted = await Address.findOneAndDelete({ _id: id });
        if (!deleted) {
            return next(new AppError('address not found', 400));
        }
        return res.status(200).json({
            status: 'success',
            message: 'address deleted successfully',
        });
    } catch (error) {
        console.log('error while deleting the address', 400);
        next(error);
    }
};
const getEditAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userAddress = await Address.findById(id);
        if (!userAddress) {
            return next(new AppError('address not found', 400));
        }
        res.render('edit-address', {
            address: userAddress,
        });
    } catch (error) {
        console.log('error while geting edit address');
        next(error);
    }
};

const editAddress = async (req, res, next) => {
    try {
        const { id } = req.params;
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
        const duplicateAddress = await Address.findOne({
            userId,
            building: building.trim(),
            pincode: pincode.trim(),
        });

        if (duplicateAddress) {
            return next(new AppError('This address already exists', 400));
        }

        const existingAddress = await Address.findById(id);
        existingAddress.building = building.trim();
        existingAddress.street = street.trim();
        existingAddress.landmark = landmark?.trim() || '';
        existingAddress.pincode = pincode.trim();
        existingAddress.city = city.trim();
        existingAddress.state = state.trim();
        existingAddress.name = name?.trim() || '';
        existingAddress.phone = phone.trim();
        existingAddress.altPhone = altPhone?.trim() || '';
        existingAddress.addressType = addressType;
        await existingAddress.save();
        return res.status(200).json({
            status: 'success',
            message: 'Address edited successfully',
            redirectUrl: '/profile/address',
        });
    } catch (error) {
        console.log('error while updating address', 400);
        next(error);
    }
};

export default {
    getAddressInfo,
    getAddAddress,
    addAddress,
    deleteAddress,
    getEditAddress,
    editAddress,
};
