import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';


const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'username is required'],
            maxlength: 100,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            validate: [validator.isEmail, 'Please provide valid email'],
        },
        profileImage: {
            type: String,
        },
        password: {
            type: String,
            required: [false, 'Please provide password'],
            minlength: 8,
            select: false,
            validate: [
                validator.isStrongPassword,
                'please provide a strong password',
            ],
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        phone: {
            type: String,
            validate: [
                validator.isMobilePhone,
                'please provide valid phonenumber',
            ],
        },
        googleId: {
            type: String,
            unique: true,
        },
    },
    { timestamps: true }
);

// hashing the password befor saving

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

const User = mongoose.model('user', userSchema);
export default User;
