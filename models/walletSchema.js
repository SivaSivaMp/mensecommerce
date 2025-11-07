import mongoose, { Schema } from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            required: true,
            unique: true,
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            default: '',
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            default: null,
        },
        orderItemId: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { id: false }
);
const walletschema = new mongoose.Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        transactions: [walletTransactionSchema],
    },
    { timestamps: true }
);

walletschema.methods.addTransaction = async function (
    type,
    amount,
    description,
    orderId = null
) {
    const transaction = {
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        type,
        amount,
        description,
        orderId,
    };
    this.transactions.push(transaction);
    if (type === 'credit') {
        this.balance += amount;
    } else if (type === 'debit') {
        this.balance -= amount;
    }

    return this.save();
};

const Wallet = mongoose.model('Wallet', walletschema);
export default Wallet;
