/**
 * Transactions Service
 * Lógica de negócio para transações (Open Finance + Manual)
 */

const {
    OpenFinanceTransaction,
    ManualTransaction,
    CardTransaction,
    Subscription,
    TransactionMetadata,
    AuditLog,
    CreditCard,
    UserProfile,
    Category
} = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');
const budgetsService = require('../budgets/budgets.service');

// ===========================================
// TRANSAÇÕES MANUAIS (EDITÁVEIS)
// ===========================================

/**
 * Cria uma transação manual
 */
const createManualTransaction = async (userId, data) => {
    const {
        type, source, description, amount, date, category, tags, notes,
        isRecurring, frequency, recurringDay, status, cardId, categoryId,
        forceOverbudget
    } = data;

    console.log('📝 [CREATE MANUAL TX] Received data:', JSON.stringify(data, null, 2));

    // ========================================
    // VERIFICAÇÃO DE ORÇAMENTO (para despesas)
    // ========================================
    if (type === 'EXPENSE' && categoryId) {
        const budgetCheck = await budgetsService.checkBudgetHealth(userId, categoryId, amount);

        console.log('💰 [BUDGET CHECK] Result:', JSON.stringify(budgetCheck, null, 2));

        if (!budgetCheck.allowed) {
            if (!forceOverbudget) {
                // Retornar erro com detalhes para o frontend abrir o modal
                const error = new AppError(
                    `Isso vai estourar o orçamento "${budgetCheck.allocation.name}"`,
                    400,
                    'BUDGET_EXCEEDED'
                );
                error.budgetData = budgetCheck;
                throw error;
            }

            // Usuário confirmou - zerar streak
            console.log('⚠️ [BUDGET CHECK] User forced overbudget, resetting streak...');
            await UserProfile.update(
                { streak: 0 },
                { where: { userId } }
            );

            // Log de auditoria
            await AuditLog.log({
                userId,
                action: 'STREAK_RESET',
                resource: 'BUDGET',
                details: {
                    reason: 'Orçamento estourado',
                    allocation: budgetCheck.allocation.name,
                    limit: budgetCheck.allocation.limit,
                    newTotal: budgetCheck.newTotal
                }
            });
        }
    }

    // Se tem cardId, criar como CardTransaction
    if (cardId) {
        console.log('💳 [CREATE MANUAL TX] Creating CardTransaction for cardId:', cardId);

        // For recurring transactions, default to PENDING to show as "Agendado"
        // Otherwise map COMPLETED to PAID
        let cardStatus = 'PENDING';
        if (!isRecurring) {
            cardStatus = status === 'COMPLETED' ? 'PAID' : (status || 'PENDING');
        }

        const cardTransaction = await CardTransaction.create({
            userId,
            cardId,
            description,
            amount,
            date,
            category: category || 'OTHER',
            isRecurring: isRecurring || false,
            recurringFrequency: frequency || null,
            status: cardStatus
        });

        console.log('✅ [CREATE MANUAL TX] CardTransaction created:', cardTransaction.id);

        return {
            ...cardTransaction.toJSON(),
            source: 'CARD',
            category,
            tags,
            notes
        };
    }

    // Criar transação manual normal
    console.log('📋 [CREATE MANUAL TX] Creating ManualTransaction');

    const transaction = await ManualTransaction.create({
        userId,
        type,
        source: source || 'OTHER',
        description,
        amount,
        date,
        status: status || 'COMPLETED',
        isRecurring: isRecurring || false,
        isRecurring: isRecurring || false,
        recurringFrequency: frequency || null,
        recurringDay: recurringDay || null,
        categoryId: categoryId || null // Ensure categoryId is saved for budget tracking
    });

    console.log('✅ [CREATE MANUAL TX] ManualTransaction created:', transaction.id);

    // Criar metadata se categoria/tags fornecidos
    if (category || tags || notes) {
        await TransactionMetadata.create({
            userId,
            transactionType: 'MANUAL',
            transactionId: transaction.id,
            category,
            tags: tags || [],
            notes
        });
    }

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.TRANSACTION_CREATE,
        resource: 'MANUAL_TRANSACTION',
        resourceId: transaction.id,
        newData: { type, source, amount, description, isRecurring, status }
    });

    return {
        ...transaction.toJSON(),
        category,
        tags,
        notes
    };
};

/**
 * Atualiza uma transação manual
 */
const updateManualTransaction = async (userId, transactionId, data) => {
    const transaction = await ManualTransaction.findOne({
        where: { id: transactionId, userId }
    });

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    const previousData = transaction.toJSON();

    // Atualizar campos permitidos
    const allowedFields = ['type', 'source', 'description', 'amount', 'date', 'categoryId', 'status', 'isRecurring', 'recurringFrequency', 'recurringDay'];
    for (const field of allowedFields) {
        transaction[field] = data[field];
    }
}
await transaction.save();

// Atualizar metadata
if (data.category !== undefined || data.tags !== undefined || data.notes !== undefined) {
    await updateTransactionMetadata(userId, 'MANUAL', transactionId, {
        category: data.category,
        tags: data.tags,
        notes: data.notes
    });
}

// Log de auditoria
await AuditLog.log({
    userId,
    action: AuditLog.ACTIONS.TRANSACTION_UPDATE,
    resource: 'MANUAL_TRANSACTION',
    resourceId: transaction.id,
    previousData,
    newData: data
});

return transaction;
    };

/**
 * Exclui uma transação manual
 */
const deleteManualTransaction = async (userId, transactionId) => {
    const transaction = await ManualTransaction.findOne({
        where: { id: transactionId, userId }
    });

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    // Excluir metadata associada
    await TransactionMetadata.destroy({
        where: {
            transactionType: 'MANUAL',
            transactionId
        }
    });

    // Excluir transação
    await transaction.destroy();

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.TRANSACTION_DELETE,
        resource: 'MANUAL_TRANSACTION',
        resourceId: transactionId
    });

    return { message: 'Transação excluída com sucesso' };
};

// ===========================================
// METADATA (CATEGORIZAÇÃO)
// ===========================================

/**
 * Atualiza metadata de uma transação (Open Finance ou Manual)
 * NOTA: Única forma de "editar" transações Open Finance
 */
const updateTransactionMetadata = async (userId, transactionType, transactionId, data) => {
    const { metadata } = await TransactionMetadata.findOrCreateForTransaction(
        userId,
        transactionType,
        transactionId
    );

    if (data.category !== undefined) metadata.category = data.category;
    if (data.tags !== undefined) metadata.tags = data.tags;
    if (data.notes !== undefined) metadata.notes = data.notes;
    if (data.isIgnored !== undefined) metadata.isIgnored = data.isIgnored;
    if (data.isImportant !== undefined) metadata.isImportant = data.isImportant;

    await metadata.save();

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.METADATA_UPDATE,
        resource: 'TRANSACTION_METADATA',
        resourceId: metadata.id,
        details: { transactionType, transactionId }
    });

    return metadata;
};

// ===========================================
// LISTAGEM DE TRANSAÇÕES
// ===========================================

/**
 * Lista todas as transações do usuário (Open Finance + Manual)
 */
const listTransactions = async (userId, filters = {}) => {
    const {
        startDate,
        endDate,
        type,
        source,
        category,
        minAmount,
        maxAmount,
        page = 1,
        limit = 50
    } = filters;

    const offset = (page - 1) * limit;

    // Construir filtros base
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = startDate;
    if (endDate) dateFilter[Op.lte] = endDate;

    const amountFilter = {};
    if (minAmount) amountFilter[Op.gte] = minAmount;
    if (maxAmount) amountFilter[Op.lte] = maxAmount;

    // Buscar transações Open Finance
    const ofWhere = { userId };
    if (Object.keys(dateFilter).length) ofWhere.date = dateFilter;
    if (Object.keys(amountFilter).length) ofWhere.amount = amountFilter;
    if (type === 'CREDIT' || type === 'DEBIT') ofWhere.type = type;

    const openFinanceTransactions = await OpenFinanceTransaction.findAll({
        where: ofWhere,
        order: [['date', 'DESC']],
        limit,
        offset
    });

    // Buscar transações manuais
    const manualWhere = { userId };
    if (Object.keys(dateFilter).length) manualWhere.date = dateFilter;
    if (Object.keys(amountFilter).length) manualWhere.amount = amountFilter;
    if (type === 'INCOME' || type === 'EXPENSE' || type === 'TRANSFER') {
        manualWhere.type = type;
    }
    if (source) manualWhere.source = source;

    const manualTransactions = await ManualTransaction.findAll({
        where: manualWhere,
        include: [{
            model: Subscription,
            as: 'subscription',
            attributes: ['id', 'name', 'icon']
        }],
        order: [['date', 'DESC']],
        limit,
        offset
    });

    // Buscar transações de cartão
    const cardWhere = { userId };
    if (Object.keys(dateFilter).length) cardWhere.date = dateFilter;
    if (Object.keys(amountFilter).length) cardWhere.amount = amountFilter;
    // Card transactions are usually EXPENSE
    if (type && type !== 'EXPENSE') {
        // If filtering for INCOME or TRANSFER, CardTransactions shouldn't appear unless we treat refunds as INCOME?
        // For now, assume CardTransactions are EXPENSE only or check status.
        // If type is EXPENSE or undefined, we include.
    }

    // Simplification: Fetch if type is undefined or EXPENSE
    let cardTransactions = [];
    if (!type || type === 'EXPENSE') {
        cardTransactions = await CardTransaction.findAll({
            where: cardWhere,
            include: [
                {
                    model: Subscription,
                    as: 'subscription',
                    attributes: ['id', 'name', 'icon']
                },
                {
                    model: CreditCard,
                    as: 'card',
                    attributes: ['id', 'name', 'lastFourDigits']
                }
            ],
            order: [['date', 'DESC']],
            limit,
            offset
        });
    }

    // Buscar metadata para todas as transações
    const ofIds = openFinanceTransactions.map(t => t.id);
    const manualIds = manualTransactions.map(t => t.id);

    // Note: CardTransactions don't use TransactionMetadata (enum doesn't support 'CARD')
    // They store category directly in the CardTransaction model
    const allMetadata = await TransactionMetadata.findAll({
        where: {
            userId,
            [Op.or]: [
                { transactionType: 'OPEN_FINANCE', transactionId: { [Op.in]: ofIds } },
                { transactionType: 'MANUAL', transactionId: { [Op.in]: manualIds } }
            ]
        }
    });

    // Mapear metadata
    const metadataMap = {};
    for (const m of allMetadata) {
        metadataMap[`${m.transactionType}_${m.transactionId}`] = m;
    }

    // Filtrar por categoria se especificado
    const filterByCategory = (tx, txType) => {
        if (!category) return true;
        const meta = metadataMap[`${txType}_${tx.id}`];
        return meta?.category === category;
    };

    // Formatar transações Open Finance
    const formattedOF = openFinanceTransactions
        .filter(tx => filterByCategory(tx, 'OPEN_FINANCE'))
        .map(tx => {
            const meta = metadataMap[`OPEN_FINANCE_${tx.id}`];
            return {
                id: tx.id,
                source: 'OPEN_FINANCE',
                sourceType: tx.sourceType,
                type: tx.type,
                description: tx.description,
                amount: parseFloat(tx.amount),
                date: tx.date,
                category: meta?.category || null,
                tags: meta?.tags || [],
                notes: meta?.notes || null,
                isIgnored: meta?.isIgnored || false,
                isImportant: meta?.isImportant || false,
                editable: false, // Transações OF são imutáveis
                createdAt: tx.createdAt
            };
        });

    // Formatar transações manuais
    const formattedManual = manualTransactions
        .filter(tx => filterByCategory(tx, 'MANUAL'))
        .map(tx => {
            const meta = metadataMap[`MANUAL_${tx.id}`];
            return {
                id: tx.id,
                source: 'MANUAL',
                sourceType: tx.source,
                type: tx.type,
                description: tx.description,
                amount: parseFloat(tx.amount),
                date: tx.date,
                category: meta?.category || tx.category || null,
                tags: meta?.tags || [],
                notes: meta?.notes || null,
                isIgnored: meta?.isIgnored || false,
                isImportant: meta?.isImportant || false,
                imageUrl: tx.imageUrl,
                subscriptionId: tx.subscriptionId,
                subscription: tx.subscription ? { icon: tx.subscription.icon } : null,
                isRecurring: tx.isRecurring,
                recurringFrequency: tx.recurringFrequency,
                status: tx.status, // PENDING, COMPLETED, CANCELLED
                editable: true, // Transações manuais são editáveis
                createdAt: tx.createdAt
            };
        });

    // Formatar transações de cartão
    // Note: CardTransactions don't use metadata, they store category/notes directly
    const formattedCard = cardTransactions
        .filter(tx => {
            // Filter by category if specified - use tx.category directly
            if (!category) return true;
            return tx.category === category;
        })
        .map(tx => {
            return {
                id: tx.id,
                source: 'CARD',
                sourceType: tx.card ? `${tx.card.name} (${tx.card.lastFourDigits})` : 'Credit Card',
                type: 'EXPENSE',
                description: tx.description,
                amount: parseFloat(tx.amount),
                date: tx.date,
                category: tx.category || null,
                tags: tx.tags || [],
                notes: tx.notes || null,
                isIgnored: false,
                isImportant: false,
                imageUrl: tx.subscription?.icon || null, // Use subscription icon if available
                subscriptionId: tx.subscriptionId,
                subscription: tx.subscription ? { icon: tx.subscription.icon } : null,
                isRecurring: tx.isRecurring,
                recurringFrequency: tx.recurringFrequency,
                editable: true, // Card transactions are editable
                createdAt: tx.createdAt,
                cardId: tx.cardId,
                status: tx.status
            };
        });

    // Combinar e ordenar por data
    const allTransactions = [...formattedOF, ...formattedManual, ...formattedCard]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        transactions: allTransactions,
        pagination: {
            page,
            limit,
            total: allTransactions.length
        }
    };
};

/**
 * Lista todas as categorias utilizadas pelo usuário
 */
const listCategories = async (userId) => {
    const categories = await TransactionMetadata.findAll({
        attributes: [
            [TransactionMetadata.sequelize.fn('DISTINCT', TransactionMetadata.sequelize.col('category')), 'category']
        ],
        where: { userId, category: { [Op.not]: null } },
        order: [['category', 'ASC']]
    });

    return categories.map(c => c.category);
};

/**
 * Obtém uma transação específica
 */
const getTransaction = async (userId, transactionId, transactionType) => {
    let transaction;

    if (transactionType === 'OPEN_FINANCE') {
        transaction = await OpenFinanceTransaction.findOne({
            where: { id: transactionId, userId }
        });
    } else if (transactionType === 'CARD') {
        transaction = await CardTransaction.findOne({
            where: { id: transactionId, userId }
        });
    } else {
        transaction = await ManualTransaction.findOne({
            where: { id: transactionId, userId }
        });
    }

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    // Buscar metadata
    const metadata = await TransactionMetadata.findOne({
        where: {
            transactionType,
            transactionId,
            userId
        }
    });

    return {
        ...transaction.toJSON(),
        category: metadata?.category || null,
        tags: metadata?.tags || [],
        notes: metadata?.notes || null,
        isIgnored: metadata?.isIgnored || false,
        editable: transactionType === 'MANUAL'
    };
};

module.exports = {
    createManualTransaction,
    updateManualTransaction,
    deleteManualTransaction,
    updateTransactionMetadata,
    listTransactions,
    listCategories,
    getTransaction
};
