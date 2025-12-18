/**
 * Manual Card Service
 * Gestão completa de cartões manuais (não Open Finance)
 */

const { CreditCard, CardTransaction, Subscription, AuditLog } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// ===========================================
// GESTÃO DE CARTÕES MANUAIS
// ===========================================

/**
 * Lista cartões do usuário (todos ou filtrados por source)
 */
const listCards = async (userId, filters = {}) => {
    const { source, isActive = true } = filters;

    const where = { userId };
    if (source) where.source = source;
    if (isActive !== undefined) where.isActive = isActive;

    const cards = await CreditCard.findAll({
        where,
        order: [['createdAt', 'DESC']]
    });

    return cards.map(c => ({
        id: c.id,
        name: c.name,
        bankName: c.bankName,
        brand: c.brand,
        lastFourDigits: c.lastFourDigits,
        creditLimit: parseFloat(c.creditLimit) || 0,
        availableLimit: parseFloat(c.availableLimit) || 0,
        closingDay: c.closingDay,
        dueDay: c.dueDay,
        source: c.source,
        isVirtual: c.isVirtual,
        color: c.color,
        isActive: c.isActive
    }));
};

/**
 * Cria um cartão manual
 */
const createManualCard = async (userId, data) => {
    const {
        name, bankName, brand, lastFourDigits,
        creditLimit, closingDay, dueDay, isVirtual, color
    } = data;

    const card = await CreditCard.create({
        userId,
        source: 'MANUAL',
        name,
        bankName,
        brand: brand || 'OTHER',
        lastFourDigits,
        creditLimit: creditLimit || 0,
        availableLimit: creditLimit || 0,
        closingDay,
        dueDay,
        isVirtual: isVirtual || false,
        color: color || '#1E40AF',
        isActive: true
    });

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: 'CARD_CREATE',
        resource: 'CREDIT_CARD',
        resourceId: card.id,
        newData: { name, bankName, brand }
    });

    return card;
};

/**
 * Atualiza um cartão manual
 */
const updateManualCard = async (userId, cardId, data) => {
    const card = await CreditCard.findOne({
        where: { id: cardId, userId, source: 'MANUAL' }
    });

    if (!card) {
        throw new AppError('Cartão não encontrado ou não é manual', 404, 'CARD_NOT_FOUND');
    }

    const previousData = card.toJSON();

    // Campos atualizáveis
    const updateableFields = [
        'name', 'bankName', 'brand', 'lastFourDigits',
        'creditLimit', 'availableLimit', 'closingDay', 'dueDay',
        'isVirtual', 'color', 'isActive'
    ];

    for (const field of updateableFields) {
        if (data[field] !== undefined) {
            card[field] = data[field];
        }
    }

    await card.save();

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: 'CARD_UPDATE',
        resource: 'CREDIT_CARD',
        resourceId: card.id,
        previousData,
        newData: data
    });

    return card;
};

/**
 * Desativa um cartão manual
 */
const deactivateCard = async (userId, cardId) => {
    const card = await CreditCard.findOne({
        where: { id: cardId, userId, source: 'MANUAL' }
    });

    if (!card) {
        throw new AppError('Cartão não encontrado ou não é manual', 404, 'CARD_NOT_FOUND');
    }

    card.isActive = false;
    await card.save();

    return { message: 'Cartão desativado com sucesso' };
};

// ===========================================
// TRANSAÇÕES DE CARTÃO MANUAL
// ===========================================

/**
 * Lista transações de um cartão
 */
const listCardTransactions = async (userId, cardId, filters = {}) => {
    const { startDate, endDate, category, status, page = 1, limit = 50 } = filters;

    // Verificar se cartão pertence ao usuário
    const card = await CreditCard.findOne({ where: { id: cardId, userId } });
    if (!card) {
        throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
    }

    const where = { userId, cardId };
    if (category) where.category = category;
    if (status) where.status = status;
    if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date[Op.gte] = startDate;
        if (endDate) where.date[Op.lte] = endDate;
    }

    const transactions = await CardTransaction.findAll({
        where,
        include: [{
            model: Subscription,
            as: 'subscription',
            attributes: ['id', 'name', 'icon']
        }],
        order: [['date', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    return {
        card: {
            id: card.id,
            name: card.name,
            brand: card.brand,
            lastFourDigits: card.lastFourDigits
        },
        transactions: transactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: parseFloat(t.amount),
            date: t.date,
            category: t.category,
            subcategory: t.subcategory,
            isInstallment: t.isInstallment,
            installmentNumber: t.installmentNumber,
            totalInstallments: t.totalInstallments,
            isRecurring: t.isRecurring,
            status: t.status,
            subscription: t.subscription ? {
                id: t.subscription.id,
                name: t.subscription.name,
                icon: t.subscription.icon
            } : null,
            tags: t.tags
        }))
    };
};

/**
 * Cria uma transação no cartão
 */
const createCardTransaction = async (userId, cardId, data) => {
    const {
        description, amount, date, category, subcategory,
        isInstallment, totalInstallments, isRecurring, recurringFrequency,
        notes, tags
    } = data;

    // Verificar se cartão pertence ao usuário
    const card = await CreditCard.findOne({ where: { id: cardId, userId } });
    if (!card) {
        throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
    }

    const transactions = [];

    // Se for parcelado, criar múltiplas transações
    if (isInstallment && totalInstallments > 1) {
        const installmentAmount = parseFloat(amount) / totalInstallments;
        const groupId = uuidv4();

        for (let i = 1; i <= totalInstallments; i++) {
            const installmentDate = new Date(date);
            installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

            const transaction = await CardTransaction.create({
                userId,
                cardId,
                description: `${description} (${i}/${totalInstallments})`,
                amount: installmentAmount.toFixed(2),
                date: installmentDate.toISOString().split('T')[0],
                category,
                subcategory,
                isInstallment: true,
                installmentNumber: i,
                totalInstallments,
                totalAmount: amount,
                installmentGroupId: groupId,
                status: i === 1 ? 'PENDING' : 'PENDING',
                notes: i === 1 ? notes : null,
                tags: tags || []
            });

            transactions.push(transaction);
        }
    } else {
        // Transação única
        const transaction = await CardTransaction.create({
            userId,
            cardId,
            description,
            amount,
            date,
            category,
            subcategory,
            isInstallment: false,
            isRecurring: isRecurring || false,
            recurringFrequency: isRecurring ? recurringFrequency : null,
            status: 'PENDING',
            notes,
            tags: tags || []
        });

        transactions.push(transaction);
    }

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: 'CARD_TRANSACTION_CREATE',
        resource: 'CARD_TRANSACTION',
        resourceId: transactions[0].id,
        newData: { description, amount, isInstallment, totalInstallments }
    });

    return {
        created: transactions.length,
        transactions: transactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: parseFloat(t.amount),
            date: t.date
        }))
    };
};

/**
 * Atualiza uma transação
 */
const updateCardTransaction = async (userId, transactionId, data) => {
    const transaction = await CardTransaction.findOne({
        where: { id: transactionId, userId }
    });

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    const previousData = transaction.toJSON();

    // Campos atualizáveis
    const updateableFields = [
        'description', 'amount', 'date', 'category', 'subcategory',
        'status', 'notes', 'tags'
    ];

    for (const field of updateableFields) {
        if (data[field] !== undefined) {
            transaction[field] = data[field];
        }
    }

    await transaction.save();

    return transaction;
};

/**
 * Exclui uma transação
 */
const deleteCardTransaction = async (userId, transactionId) => {
    const transaction = await CardTransaction.findOne({
        where: { id: transactionId, userId }
    });

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    // Se for parcelamento, perguntar se quer excluir todas
    const groupId = transaction.installmentGroupId;

    await transaction.destroy();

    return {
        message: 'Transação excluída',
        installmentGroupId: groupId // Para frontend perguntar se quer excluir outras parcelas
    };
};

/**
 * Exclui todas as parcelas de um parcelamento
 */
const deleteInstallmentGroup = async (userId, groupId) => {
    const deleted = await CardTransaction.destroy({
        where: { userId, installmentGroupId: groupId }
    });

    return {
        message: `${deleted} parcelas excluídas`
    };
};

// ===========================================
// RESUMO DA FATURA
// ===========================================

/**
 * Obtém resumo da fatura de um cartão
 */
const getCardStatement = async (userId, cardId, month, year) => {
    const card = await CreditCard.findOne({ where: { id: cardId, userId } });
    if (!card) {
        throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
    }

    // Calcular período da fatura baseado no dia de fechamento
    const closingDay = card.closingDay || 25;

    // Data de início: dia de fechamento do mês anterior + 1
    const startDate = new Date(year, month - 2, closingDay + 1);
    // Data de fim: dia de fechamento do mês atual
    const endDate = new Date(year, month - 1, closingDay);

    const transactions = await CardTransaction.findAll({
        where: {
            cardId,
            date: {
                [Op.between]: [
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0]
                ]
            }
        },
        include: [{
            model: Subscription,
            as: 'subscription',
            attributes: ['id', 'name', 'icon']
        }],
        order: [['date', 'ASC']]
    });

    const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Agrupar por categoria
    const byCategory = {};
    for (const t of transactions) {
        const cat = t.category || 'Outros';
        if (!byCategory[cat]) byCategory[cat] = 0;
        byCategory[cat] += parseFloat(t.amount);
    }

    return {
        card: {
            id: card.id,
            name: card.name,
            brand: card.brand,
            dueDay: card.dueDay
        },
        period: {
            month,
            year,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            dueDate: new Date(year, month - 1, card.dueDay).toISOString().split('T')[0]
        },
        total,
        transactionsCount: transactions.length,
        byCategory: Object.entries(byCategory).map(([category, amount]) => ({
            category,
            amount
        })).sort((a, b) => b.amount - a.amount),
        transactions: transactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: parseFloat(t.amount),
            date: t.date,
            category: t.category,
            date: t.date,
            category: t.category,
            isInstallment: t.isInstallment,
            subscription: t.subscription ? {
                icon: t.subscription.icon
            } : null
        }))
    };
};

module.exports = {
    listCards,
    createManualCard,
    updateManualCard,
    deactivateCard,
    listCardTransactions,
    createCardTransaction,
    updateCardTransaction,
    deleteCardTransaction,
    deleteInstallmentGroup,
    getCardStatement
};
