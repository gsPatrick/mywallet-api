/**
 * Transactions Service
 * Lógica de negócio para transações (Open Finance + Manual)
 */

const {
    OpenFinanceTransaction,
    ManualTransaction,
    TransactionMetadata,
    AuditLog
} = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

// ===========================================
// TRANSAÇÕES MANUAIS (EDITÁVEIS)
// ===========================================

/**
 * Cria uma transação manual
 */
const createManualTransaction = async (userId, data) => {
    const { type, source, description, amount, date, category, tags, notes } = data;

    // Criar transação
    const transaction = await ManualTransaction.create({
        userId,
        type,
        source: source || 'OTHER',
        description,
        amount,
        date
    });

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
        newData: { type, source, amount, description }
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
    const allowedFields = ['type', 'source', 'description', 'amount', 'date'];
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
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
        order: [['date', 'DESC']],
        limit,
        offset
    });

    // Buscar metadata para todas as transações
    const ofIds = openFinanceTransactions.map(t => t.id);
    const manualIds = manualTransactions.map(t => t.id);

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
                category: meta?.category || null,
                tags: meta?.tags || [],
                notes: meta?.notes || null,
                isIgnored: meta?.isIgnored || false,
                isImportant: meta?.isImportant || false,
                editable: true, // Transações manuais são editáveis
                createdAt: tx.createdAt
            };
        });

    // Combinar e ordenar por data
    const allTransactions = [...formattedOF, ...formattedManual]
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
