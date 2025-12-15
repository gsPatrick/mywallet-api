/**
 * Manual Card Controller
 */

const manualCardService = require('./manualCard.service');

// ===========================================
// CARTÕES
// ===========================================

const listCards = async (req, res, next) => {
    try {
        const data = await manualCardService.listCards(req.userId, req.query);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const createCard = async (req, res, next) => {
    try {
        const card = await manualCardService.createManualCard(req.userId, req.body);
        res.status(201).json({
            message: 'Cartão criado com sucesso',
            data: card
        });
    } catch (error) {
        next(error);
    }
};

const updateCard = async (req, res, next) => {
    try {
        const card = await manualCardService.updateManualCard(req.userId, req.params.id, req.body);
        res.json({
            message: 'Cartão atualizado',
            data: card
        });
    } catch (error) {
        next(error);
    }
};

const deactivateCard = async (req, res, next) => {
    try {
        const result = await manualCardService.deactivateCard(req.userId, req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ===========================================
// TRANSAÇÕES
// ===========================================

const listTransactions = async (req, res, next) => {
    try {
        const data = await manualCardService.listCardTransactions(
            req.userId,
            req.params.cardId,
            req.query
        );
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const createTransaction = async (req, res, next) => {
    try {
        const result = await manualCardService.createCardTransaction(
            req.userId,
            req.params.cardId,
            req.body
        );
        res.status(201).json({
            message: `${result.created} transação(ões) criada(s)`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const updateTransaction = async (req, res, next) => {
    try {
        const transaction = await manualCardService.updateCardTransaction(
            req.userId,
            req.params.transactionId,
            req.body
        );
        res.json({
            message: 'Transação atualizada',
            data: transaction
        });
    } catch (error) {
        next(error);
    }
};

const deleteTransaction = async (req, res, next) => {
    try {
        const result = await manualCardService.deleteCardTransaction(
            req.userId,
            req.params.transactionId
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const deleteInstallmentGroup = async (req, res, next) => {
    try {
        const result = await manualCardService.deleteInstallmentGroup(
            req.userId,
            req.params.groupId
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ===========================================
// FATURA
// ===========================================

const getStatement = async (req, res, next) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const data = await manualCardService.getCardStatement(
            req.userId,
            req.params.cardId,
            month,
            year
        );
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listCards,
    createCard,
    updateCard,
    deactivateCard,
    listTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    deleteInstallmentGroup,
    getStatement
};
