import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';
import Order from '../../models/orderSchema.js';
import { HTTP_STATUS } from '../../utils/httpStatus.js';
import Wallet from '../../models/walletSchema.js';
import razorpay from '../../config/razorpay.js';
import crypto from 'crypto';

const getWalletTransactions = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.redirect('/login');
        }

        const searchQuery = req.query.query?.trim() || '';
        const typeFilter = req.query.type || '';

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.render('wallet-list', {
                transactions: [],
                query: searchQuery,
                type: typeFilter,
                pagination: null,
                balance: 0,
            });
        }

        let filteredTxns = wallet.transactions;

        if (typeFilter) {
            filteredTxns = filteredTxns.filter((t) => t.type === typeFilter);
        }

        if (searchQuery) {
            const regex = new RegExp(searchQuery, 'i');
            filteredTxns = filteredTxns.filter(
                (t) =>
                    regex.test(t.transactionId) ||
                    (t.userOrderId && regex.test(t.userOrderId.toString()))
            );
        }

        filteredTxns.sort((a, b) => b.createdAt - a.createdAt);

        const total = filteredTxns.length;
        const totalPages = Math.ceil(total / limit);
        const transactions = filteredTxns.slice(skip, skip + limit);

        const pagination = {
            totalPages,
            currentPage: page,
            hasPrev: page > 1,
            hasNext: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
        };

        res.render('wallet-list', {
            transactions,
            query: searchQuery,
            type: typeFilter,
            pagination,
            balance: wallet.balance,
        });
    } catch (err) {
        console.error('Wallet Fetch Error:', err);
        next(err);
    }
};

const createWalletOrder = async (req, res, next) => {
    try {
        const { amount } = req.body;
        const userId = getCurrentUserId(req);
        if (!amount || amount <= 0) {
            return next(
                new AppError('Invalid amount', HTTP_STATUS.BAD_REQUEST)
            );
        }
        const shortUserId = userId.slice(-8);
        const timestamp = Date.now().toString().slice(-10);
        const receiptId = `w_${shortUserId}_${timestamp}`;
        const order = await razorpay.orders.create({
            amount: amount * 100,
            currency: 'INR',
            receipt: `wallet_${Date.now()}`,
        });
        res.status(HTTP_STATUS.OK).json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: order.amount,
            order_id: order.id,
            receipt: receiptId,
        });
    } catch (err) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to create Razorpay order',
        });
    }
};

const verifyWalletPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount,
        } = req.body;
        const userId = getCurrentUserId(req);
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return next(
                new AppError('Invalid signature', HTTP_STATUS.BAD_REQUEST)
            );
        }
        let wallet = await Wallet.findOne({ userId: userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }
        await wallet.addTransaction(
            'credit',
            amount,
            `Added : ${amount} to the Wallet`
        );

        await wallet.save();
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Payment verified and wallet updated successfully',
            currentBalance: wallet.balance,
        });
    } catch (error) {
        console.error('Error verifying wallet payment:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error processing payment',
        });
    }
};
export default {
    getWalletTransactions,
    createWalletOrder,
    verifyWalletPayment,
};
