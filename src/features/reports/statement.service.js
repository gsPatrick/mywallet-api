const { ManualTransaction, OpenFinanceTransaction, CardTransaction, CreditCard, Category, BankAccount } = require('../../models');
const { Op } = require('sequelize');

/**
 * Obtém extrato mensal completo
 * ✅ Suporta múltiplas fontes (Manual, Open Finance, Cartão)
 * ✅ Suporta filtro por conta bancária
 */
const getMonthlyStatement = async (userId, year, month, bankAccountId = null, cardIds = null) => {
    // Período do mês
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const periodFilter = { [Op.between]: [startDate, endDate] };

    // 1. Buscar transações manuais
    const manualWhere = { userId, date: periodFilter, status: { [Op.ne]: 'CANCELLED' } };
    if (bankAccountId) manualWhere.bankAccountId = bankAccountId;

    const manualTransactions = await ManualTransaction.findAll({
        where: manualWhere,
        include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'icon', 'color'] }],
        attributes: ['id', 'description', 'amount', 'type', 'status', 'date', 'source', 'createdAt']
    });

    // 2. Buscar transações Open Finance (se não houver bankAccountId ou se for o específico)
    let openFinanceTransactions = [];
    const ofWhere = { userId, date: periodFilter };
    if (bankAccountId) {
        ofWhere.relatedAccountId = bankAccountId;
    }

    openFinanceTransactions = await OpenFinanceTransaction.findAll({
        where: ofWhere,
        attributes: ['id', 'description', 'amount', 'type', 'date', 'createdAt']
    });

    // Filtro estrito: Prioridade total ao bankAccountId se fornecido
    let cardIncludeWhere = {};
    if (bankAccountId) {
        cardIncludeWhere.bankAccountId = bankAccountId;
        if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
            cardIncludeWhere.id = { [Op.in]: cardIds };
        }
    } else if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
        cardIncludeWhere.id = { [Op.in]: cardIds };
    }

    cardTransactions = await CardTransaction.findAll({
        where: cardWhere,
        include: [{
            model: CreditCard,
            as: 'card',
            attributes: ['id', 'name', 'bankAccountId', 'bankName'],
            where: Object.keys(cardIncludeWhere).length > 0 ? cardIncludeWhere : undefined,
            required: !!(bankAccountId || cardIds)
        }],
        attributes: ['id', 'description', 'amount', 'date', 'createdAt']
    });

    // Unificar e formatar
    let totalIncome = 0;
    let totalExpense = 0;

    const allFormatted = [
        ...manualTransactions.map(t => {
            const amount = parseFloat(t.amount);
            if (t.type === 'INCOME') totalIncome += amount;
            else if (t.type === 'EXPENSE') totalExpense += amount;
            return {
                id: t.id,
                date: t.date,
                description: t.description,
                type: t.type,
                amount,
                source: t.source,
                category: t.category,
                origin: 'MANUAL'
            };
        }),
        ...openFinanceTransactions.map(t => {
            const amount = parseFloat(t.amount);
            const type = t.type === 'CREDIT' ? 'INCOME' : 'EXPENSE';
            if (type === 'INCOME') totalIncome += amount;
            else totalExpense += amount;
            return {
                id: t.id,
                date: t.date,
                description: t.description,
                type,
                amount,
                source: 'OPEN_FINANCE',
                origin: 'OPEN_FINANCE'
            };
        }),
        ...cardTransactions.map(t => {
            const amount = parseFloat(t.amount);
            totalExpense += amount; // Card transactions are always expenses in this context
            return {
                id: t.id,
                date: t.date,
                description: t.description,
                type: 'EXPENSE',
                amount,
                source: 'CARD',
                origin: 'CARD'
            };
        })
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt));

    // Buscar saldo anterior
    const previousBalance = await calculatePreviousBalance(userId, startDate, bankAccountId, cardIds);

    const netChange = totalIncome - totalExpense;
    const closingBalance = previousBalance + netChange;

    return {
        period: { year, month, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] },
        summary: { openingBalance: previousBalance, totalIncome, totalExpense, netChange, closingBalance },
        transactions: allFormatted,
        transactionCount: allFormatted.length
    };
};

/**
 * Calcula saldo anterior ao período considerando todas as fontes
 */
const calculatePreviousBalance = async (userId, beforeDate, bankAccountId = null, cardIds = null) => {
    const beforeFilter = { [Op.lt]: beforeDate };
    let total = 0;

    // Manual
    const manualWhere = { userId, date: beforeFilter, status: { [Op.ne]: 'CANCELLED' } };
    if (bankAccountId) manualWhere.bankAccountId = bankAccountId;
    const manual = await ManualTransaction.findAll({ where: manualWhere, attributes: ['type', 'amount'] });
    manual.forEach(t => {
        const val = parseFloat(t.amount);
        if (t.type === 'INCOME') total += val;
        else if (t.type === 'EXPENSE') total -= val;
    });

    // Open Finance
    const ofWhere = { userId, date: beforeFilter };
    if (bankAccountId) ofWhere.relatedAccountId = bankAccountId;
    const of = await OpenFinanceTransaction.findAll({ where: ofWhere, attributes: ['type', 'amount'] });
    of.forEach(t => {
        const val = parseFloat(t.amount);
        if (t.type === 'CREDIT') total += val;
        else total -= val;
    });

    // Card (Expenses only)
    const cardWhere = { userId, date: beforeFilter };
    let cardIncludeWhere = {};
    if (bankAccountId) {
        cardIncludeWhere.bankAccountId = bankAccountId;
        if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
            cardIncludeWhere.id = { [Op.in]: cardIds };
        }
    } else if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
        cardIncludeWhere.id = { [Op.in]: cardIds };
    }

    const cards = await CardTransaction.findAll({
        where: cardWhere,
        include: [{ 
            model: CreditCard, 
            as: 'card', 
            where: Object.keys(cardIncludeWhere).length > 0 ? cardIncludeWhere : undefined, 
            required: !!(bankAccountId || cardIds)
        }]
    });
    cards.forEach(t => total -= parseFloat(t.amount));

    return total;
};

const getAvailableYears = async (userId) => {
    const manual = await ManualTransaction.findAll({ where: { userId }, attributes: ['date'] });
    const years = new Set([new Date().getFullYear()]);
    manual.forEach(t => years.add(new Date(t.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
};

module.exports = {
    getMonthlyStatement,
    getAvailableYears
};
