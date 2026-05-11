const { ManualTransaction, OpenFinanceTransaction, CardTransaction, CreditCard, Category, BankAccount } = require('../../models');
const { Op } = require('sequelize');

/**
 * Obtém extrato mensal completo
 * ✅ Suporta múltiplas fontes (Manual, Open Finance, Cartão)
 * ✅ Suporta filtro por conta bancária
 */
const getMonthlyStatement = async (userId, year, month, bankAccountId = null, cardIds = null, profileId = null) => {
    // Período do mês
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const periodFilter = { [Op.between]: [startDate, endDate] };

    // 1. Buscar transações manuais
    const manualWhere = { userId, date: periodFilter, status: { [Op.ne]: 'CANCELLED' } };
    if (bankAccountId) manualWhere.bankAccountId = bankAccountId;
    if (profileId) manualWhere.profileId = profileId;

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

    // 3. Buscar transações de cartão
    let cardTransactions = [];
    const cardWhere = { userId, date: periodFilter };
    
    // Filtro inteligente: Prioridade ao bankAccountId, mas permite cartões órfãos se IDs forem fornecidos
    let cardIncludeWhere = profileId ? { profileId } : {};
    if (bankAccountId) {
        const orConditions = [{ bankAccountId: bankAccountId }];
        if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
            orConditions.push({
                [Op.and]: [
                    { id: { [Op.in]: cardIds } },
                    { [Op.or]: [{ bankAccountId: null }, { bankAccountId: bankAccountId }] }
                ]
            });
        }
        cardIncludeWhere[Op.or] = orConditions;
    } else if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
        cardIncludeWhere.id = { [Op.in]: cardIds };
    }

    cardTransactions = await CardTransaction.findAll({
        where: cardWhere,
        include: [{
            model: CreditCard,
            as: 'card',
            attributes: ['id', 'name', 'bankAccountId', 'bankName', 'lastFourDigits'],
            where: Object.keys(cardIncludeWhere).length > 0 ? cardIncludeWhere : undefined,
            required: true // OBRIGATÓRIO para garantir isolamento de perfil
        }],
        attributes: ['id', 'description', 'amount', 'date', 'createdAt']
    });

    // Unificar e formatar
    // ✅ TRIPLE LOCK: Filtro rigoroso para garantir que nada de outro banco (ou sem banco) vaze no extrato
    let allFormatted = [
        ...manualTransactions.map(t => ({
            id: t.id,
            date: t.date,
            createdAt: t.createdAt, // Horário do lançamento
            description: t.description,
            type: t.type,
            amount: parseFloat(t.amount),
            source: t.source,
            sourceName: t.source === 'MANUAL' ? 'Saldo em Conta' : t.source,
            category: t.category, // Objeto com ícone e cor
            bankAccountId: t.bankAccountId,
            origin: 'MANUAL'
        })),
        ...openFinanceTransactions.map(t => ({
            id: t.id,
            date: t.date,
            createdAt: t.createdAt,
            description: t.description,
            type: t.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
            amount: parseFloat(t.amount),
            source: 'OPEN_FINANCE',
            sourceName: 'Conexão Bancária',
            category: null, // OF pode não ter categoria mapeada ainda
            bankAccountId: t.relatedAccountId,
            origin: 'OPEN_FINANCE'
        })),
        ...cardTransactions.map(t => ({
            id: t.id,
            date: t.date,
            createdAt: t.createdAt,
            description: t.description,
            type: 'EXPENSE',
            amount: parseFloat(t.amount),
            source: 'CARD',
            sourceName: t.card ? t.card.name : 'Cartão de Crédito',
            lastFourDigits: t.card ? t.card.lastFourDigits : null, // ✅ Adicionado aqui
            category: null,
            bankAccountId: t.card?.bankAccountId,
            origin: 'CARD'
        }))
    ];

    // Aplicar trava de banco se houver filtro
    if (bankAccountId) {
        allFormatted = allFormatted.filter(tx => String(tx.bankAccountId) === String(bankAccountId));
    }

    // Ordenar por data
    allFormatted.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calcular totais após o filtro rigoroso
    totalIncome = allFormatted.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0);
    totalExpense = allFormatted.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + tx.amount, 0);

    // Buscar saldo anterior
    const previousBalance = await calculatePreviousBalance(userId, startDate, bankAccountId, cardIds, profileId);

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
const calculatePreviousBalance = async (userId, beforeDate, bankAccountId = null, cardIds = null, profileId = null) => {
    const beforeFilter = { [Op.lt]: beforeDate };
    let total = 0;

    // Manual
    const manualWhere = { userId, date: beforeFilter, status: { [Op.ne]: 'CANCELLED' } };
    if (bankAccountId) manualWhere.bankAccountId = bankAccountId;
    if (profileId) manualWhere.profileId = profileId;
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
        const orConditions = [{ bankAccountId: bankAccountId }];
        if (cardIds && Array.isArray(cardIds) && cardIds.length > 0) {
            orConditions.push({
                [Op.and]: [
                    { id: { [Op.in]: cardIds } },
                    { [Op.or]: [{ bankAccountId: null }, { bankAccountId: bankAccountId }] }
                ]
            });
        }
        cardIncludeWhere[Op.or] = orConditions;
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

const getAvailableYears = async (userId, profileId = null) => {
    const where = { userId };
    if (profileId) where.profileId = profileId;
    const manual = await ManualTransaction.findAll({ where, attributes: ['date'] });
    const years = new Set([new Date().getFullYear()]);
    manual.forEach(t => years.add(new Date(t.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
};

module.exports = {
    getMonthlyStatement,
    getAvailableYears
};
