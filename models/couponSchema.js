import mongoose, { Schema } from 'mongoose';

const couponSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        description: {
            type: String,
            default: '',
            trim: true,
        },

        discountType: {
            type: String,
            enum: ['flat', 'percentage'],
            default: 'flat',
            required: true,
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },
        maxDiscountAmount: {
            type: Number,
            default: null,
        },

        minPurchaseAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        startsAt: {
            type: Date,
            default: Date.now,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        usageLimit: {
            type: Number,
            default: 100,
        },

        usageLimitPerUser: {
            type: Number,
            default: 1,
        },

        usedUsers: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
    },
    { timestamps: true }
);

couponSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

couponSchema.methods.isStarted = function () {
    return new Date() >= this.startsAt;
};

couponSchema.methods.isUserEligible = function (userId) {
    const usedCount = this.usedUsers.filter(
        (id) => id.toString() === userId.toString()
    ).length;
    return (
        usedCount < this.usageLimitPerUser &&
        !this.isExpired() &&
        this.isActive &&
        this.isStarted()
    );
};

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
