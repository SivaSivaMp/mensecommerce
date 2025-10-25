import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Counter from './counterSchema.js';
const orderedItemSchema = new mongoose.Schema(
    {
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        variant: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            required: true,
        },
        productName: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        size: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: [
                'Pending',
                'Processing',
                'Shipped',
                'Out for Delivery',
                'Delivered',
                'Cancelled',
                'Return Request',
                'Return Approved',
                'Return Rejected',
                'Returned',
            ],
            default: 'Pending',
        },
        cancellationReason: {
            type: String,
            default: null,
        },
        returnStatus: {
            type: String,
            enum: [
                'Not Requested',
                'Requested',
                'Approved',
                'Rejected',
                'Returned',
            ],
            default: 'Not Requested',
        },
        returnRequestDate: {
            type: Date,
            default: null,
        },
        returnReason: {
            type: String,
            default: null,
        },
        returnApprovedDate: {
            type: Date,
            default: null,
        },
        returnRejectionReason: {
            type: String,
            default: null,
        },
        returnCompletedDate: {
            type: Date,
            default: null,
        },
        deliveredDate: {
            type: Date,
            default: null,
        },
    },
    { _id: true }
);

const orderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            unique: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        orderedItems: [orderedItemSchema],

        totalPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        shipping: {
            type: Number,
            default: 0,
            min: 0,
        },
        finalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        address: {
            type: Schema.Types.ObjectId,
            ref: 'Address',
            required: true,
        },
        shippingAddress: {
            addressType: {
                type: String,
                enum: ['Home', 'Work', 'Other'],
            },
            name: String,
            building: String,
            street: String,
            landmark: String,
            city: String,
            state: String,
            pincode: String,
            phone: String,
            altPhone: String,
        },

        trackingInfo: {
            trackingNumber: String,
            courier: String,
            estimatedDelivery: Date,
        },

        status: {
            type: String,
            required: true,
            enum: [
                'Pending',
                'Processing',
                'Shipped',
                'Out for Delivery',
                'Delivered',
                'Cancelled',
                'Return Request',
                'Return Approved',
                'Return Rejected',
                'Returned',
            ],
            default: 'Pending',
        },
        paymentMethod: {
            type: String,
            required: true,
            enum: ['cod', 'online'],
        },
        paymentStatus: {
            type: String,
            enum: ['Pending', 'Completed', 'Failed'],
            default: 'Pending',
        },
        deliveredAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Index
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.pre('save', async function (next) {
    if (!this.isNew) return next();

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const dateCode = `${day}${month}${year}`;

    const name = `order-${dateCode}`;

    // Increment or create today's counter
    const counter = await Counter.findOneAndUpdate(
        { name: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    const sequence = String(counter.seq).padStart(4, '0');
    this.orderId = `ORD-${dateCode}-${sequence}`;
    next();
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
