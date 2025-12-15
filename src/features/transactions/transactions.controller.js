/**
 * Transactions Controller
 */

const transactionsService = require('./transactions.service');

/**
 * GET /transactions
 */
const listTransactions = async (req, res, next) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            type: req.query.type,
            source: req.query.source,
            category: req.query.category,
            minAmount: req.query.minAmount,
            maxAmount: req.query.maxAmount,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50
        };

        const result = await transactionsService.listTransactions(req.userId, filters);

        res.json({ data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /transactions/manual
 */
const createManualTransaction = async (req, res, next) => {
    try {
        const transaction = await transactionsService.createManualTransaction(req.userId, req.body);

        res.status(201).json({
            message: 'Transação criada com sucesso',
            data: transaction
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /transactions/:id
 */
const updateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { transactionType } = req.body;

        // Se for Open Finance, só pode atualizar metadata
        if (transactionType === 'OPEN_FINANCE') {
            const metadata = await transactionsService.updateTransactionMetadata(
                req.userId,
                'OPEN_FINANCE',
                id,
                req.body
            );

            return res.json({
                message: 'Metadata atualizada com sucesso',
                data: metadata
            });
        }

        // Se for manual, pode atualizar tudo
        const transaction = await transactionsService.updateManualTransaction(
            req.userId,
            id,
            req.body
        );

        res.json({
            message: 'Transação atualizada com sucesso',
            data: transaction
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /transactions/:id
 */
const deleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await transactionsService.deleteManualTransaction(req.userId, id);

        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /transactions/:id/metadata
 */
const updateMetadata = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { transactionType } = req.body;

        const metadata = await transactionsService.updateTransactionMetadata(
            req.userId,
            transactionType || 'MANUAL',
            id,
            req.body
        );

        res.json({
            message: 'Metadata atualizada',
            data: metadata
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listTransactions,
    createManualTransaction,
    updateTransaction,
    deleteTransaction,
    updateMetadata
};
