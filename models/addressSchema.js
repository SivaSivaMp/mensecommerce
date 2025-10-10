import mongoose, { Schema } from 'mongoose';

const addressSchema = new mongoose.Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        addressType: {
            type: String,
            enum: ['Home', 'Work', 'Other'],
            required: true,
        },
        name: {
            type: String,
            maxlength: 100,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'phone is required'],
            trim: true,
        },
        altPhone: {
            type: String,
            trim: true,
        },
        pincode: {
            type: String,
            required: [true, 'pincode is required'],
            trim: true,
        },
        city: {
            type: String,
            required: [true, 'city is required'],
            maxlength: 200,
            trim: true,
        },
        street: {
            type: String,
            required: [true, 'provide street name or area'],
            trim: true,
        },
        building: {
            type: String,
            required: [true, 'house name or building number is required'],
            trim: true,
        },
        landmark: {
            type: String,
        },
        state: {
            type: String,
            required: [true, 'state is required'],
            trim: true,
        },
    },
    { timestamps: true }
);

const Address = mongoose.model('Address', addressSchema);

export default Address;
