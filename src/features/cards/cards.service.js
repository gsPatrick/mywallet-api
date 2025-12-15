/**
 * Cards Service
 */

const { CreditCard, OpenFinanceTransaction } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista cartões do usuário
 */
const listCards = async (userId) => {
    const cards = await CreditCard.findAll({
        where: { userId, isActive: true },
        order: [['createdAt', 'DESC']]
    });

    return cards.map(card => ({
        id: card.id,
        bankName: card.bankName,
        brand: card.brand,
        lastFourDigits: card.lastFourDigits,
        name: card.name,
        creditLimit: parseFloat(card.creditLimit),
        availableLimit: parseFloat(card.availableLimit),
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        lastSyncAt: card.lastSyncAt
    }));
};

/**
 * Obtém detalhes de um cartão
 */
const getCard = async (userId, cardId) => {
    const card = await CreditCard.findOne({
        where: { id: cardId, userId }
    });

    if (!card) {
        throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
    }

    return card;
};

/**
 * Lista transações de um cartão
 */
const getCardTransactions = async (userId, cardId, filters = {}) => {
    const { startDate, endDate, page = 1, limit = 50 } = filters;

    // Verificar se cartão pertence ao usuário
    const card = await CreditCard.findOne({
        where: { id: cardId, userId }
    });

    if (!card) {
        throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
    }

    // Buscar transações
    const where = {
        userId,
        relatedCardId: cardId,
        sourceType: 'CREDIT_CARD'
    };

    if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date[Op.gte] = startDate;
        if (endDate) where.date[Op.lte] = endDate;
    }

    const transactions = await OpenFinanceTransaction.findAll({
        where,
        order: [['date', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    // Calcular totais
    const totals = await OpenFinanceTransaction.findAll({
        where,
        attributes: [
            [OpenFinanceTransaction.sequelize.fn('SUM', OpenFinanceTransaction.sequelize.col('amount')), 'total'],
            [OpenFinanceTransaction.sequelize.fn('COUNT', OpenFinanceTransaction.sequelize.col('id')), 'count']
        ],
        raw: true
    });

    return {
        card: {
            id: card.id,
            bankName: card.bankName,
            brand: card.brand,
            lastFourDigits: card.lastFourDigits
        },
        transactions: transactions.map(tx => ({
            id: tx.id,
            type: tx.type,
            description: tx.description,
            amount: parseFloat(tx.amount),
            date: tx.date
        })),
        summary: {
            total: parseFloat(totals[0]?.total || 0),
            count: parseInt(totals[0]?.count || 0)
        },
        pagination: { page, limit }
    };
};

module.exports = {
    listCards,
    getCard,
    getCardTransactions
};
