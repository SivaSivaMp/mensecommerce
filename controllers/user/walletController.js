import AppError from '../../utils/appError.js';
import { getCurrentUserId } from '../../helpers/getCurrentUserId.js';

import { HTTP_STATUS } from '../../utils/httpStatus.js';
import Wallet from '../../models/walletSchema.js';

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
                    (t.orderId && regex.test(t.orderId.toString()))
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

export default { getWalletTransactions };
