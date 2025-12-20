/**
 * Transactions Service
 * ========================================
 * MULTI-PROFILE ISOLATION ENABLED
 * ========================================
 * All queries now filter by profileId for data isolation
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
    Category,
    BankAccount,
    sequelize
} = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');
const budgetsService = require('../budgets/budgets.service');
const bankAccountsService = require('../bankAccounts/bankAccounts.service');
const gamificationService = require('../gamification/gamification.service');

// ===========================================
// TRANSAÇÕES MANUAIS (EDITÁVEIS)
// ===========================================

/**
 * Cria uma transação manual
 * ✅ PROFILE ISOLATION: profileId added
 */
const createManualTransaction = async (userId, profileId, data) => {
    const {
        type, source, description, amount, date, category, tags, notes,
        isRecurring, frequency, recurringDay, status, cardId, categoryId,
        forceOverbudget
    } = data;

    console.log('📝 [CREATE MANUAL TX] Received data:', JSON.stringify(data, null, 2));
    console.log('🎯 [CREATE MANUAL TX] Profile:', profileId);

    // ========================================
    // VERIFICAÇÃO DE ORÇAMENTO (para despesas)
    // ========================================
    if (type === 'EXPENSE' && categoryId) {
        const budgetCheck = await budgetsService.checkBudgetHealth(userId, profileId, categoryId, amount);

        console.log('💰 [BUDGET CHECK] Result:', JSON.stringify(budgetCheck, null, 2));

        if (!budgetCheck.allowed) {
            if (!forceOverbudget) {
                const error = new AppError(
                    `Isso vai estourar o orçamento "${budgetCheck.allocation.name}"`,
                    400,
                    'BUDGET_EXCEEDED'
                );
                error.budgetData = budgetCheck;
                throw error;
            }

            // Usuário confirmou - zerar streak (gamificação fica no User, não no Profile)
            console.log('⚠️ [BUDGET CHECK] User forced overbudget, resetting streak...');
            await UserProfile.update(
                { streak: 0 },
                { where: { userId } }
            );

            await AuditLog.log({
                userId,
                action: 'STREAK_RESET',
                resource: 'BUDGET',
                details: {
                    reason: 'Orçamento estourado',
                    profileId,
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

        let cardStatus = 'PENDING';
        if (!isRecurring) {
            cardStatus = status === 'COMPLETED' ? 'PAID' : (status || 'PENDING');
        }

        const cardTransaction = await CardTransaction.create({
            userId,
            profileId, // ✅ PROFILE ISOLATION
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
        profileId, // ✅ PROFILE ISOLATION
        type,
        source: source || 'OTHER',
        description,
        amount,
        date,
        status: status || 'COMPLETED',
        isRecurring: isRecurring || false,
        recurringFrequency: frequency || null,
        recurringDay: recurringDay || null,
        categoryId: categoryId || null,
        bankAccountId: data.bankAccountId || null // ✅ NEW: Link to bank account
    });

    console.log('✅ [CREATE MANUAL TX] ManualTransaction created:', transaction.id);

    // ✅ NEW: Update bank account balance if bankAccountId provided
    if (data.bankAccountId && (status === 'COMPLETED' || !status)) {
        const balanceChange = type === 'INCOME' ? parseFloat(amount) : -parseFloat(amount);
        await bankAccountsService.updateBalance(data.bankAccountId, balanceChange);
        console.log('💰 [BALANCE UPDATE] Updated balance for account:', data.bankAccountId, 'by', balanceChange);
    }

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

    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.TRANSACTION_CREATE,
        resource: 'MANUAL_TRANSACTION',
        resourceId: transaction.id,
        newData: { type, source, amount, description, isRecurring, status, profileId }
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
 * ✅ PROFILE ISOLATION: profileId added
 */
const updateManualTransaction = async (userId, profileId, transactionId, data) => {
    const whereClause = { id: transactionId, userId };
    if (profileId) whereClause.profileId = profileId; // ✅ PROFILE ISOLATION

    const transaction = await ManualTransaction.findOne({
        where: whereClause
    });

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    const previousData = transaction.toJSON();

    const allowedFields = ['type', 'source', 'description', 'amount', 'date', 'categoryId', 'status', 'isRecurring', 'recurringFrequency', 'recurringDay'];
    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            transaction[field] = data[field];
        }
    }

    await transaction.save();

    if (data.category !== undefined || data.tags !== undefined || data.notes !== undefined) {
        await updateTransactionMetadata(userId, profileId, 'MANUAL', transactionId, {
            category: data.category,
            tags: data.tags,
            notes: data.notes
        });
    }

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
 * ✅ PROFILE ISOLATION: profileId added
 * ⚠️ SYSTEM PROTECTION: Transações com source='SYSTEM' não podem ser excluídas
 */
const deleteManualTransaction = async (userId, profileId, transactionId) => {
    const whereClause = { id: transactionId, userId };
    if (profileId) whereClause.profileId = profileId; // ✅ PROFILE ISOLATION

    const transaction = await ManualTransaction.findOne({
        where: whereClause
    });

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

    // ⚠️ Bloquear exclusão de transações recorrentes do sistema (Salário, DAS, Pró-labore)
    // Essas transações são geradas automaticamente e só podem ser editadas
    const isSystemTransaction = transaction.isRecurring && (
        transaction.source === 'SALARY' ||
        (transaction.description && (
            transaction.description.includes('DAS') ||
            transaction.description === 'Salário' ||
            transaction.description === 'Pró-labore'
        ))
    );

    if (isSystemTransaction) {
        throw new AppError(
            'Transações recorrentes do sistema (Salário, DAS, Pró-labore) não podem ser excluídas. Você pode apenas editar o valor ou a data.',
            403,
            'SYSTEM_TRANSACTION_PROTECTED'
        );
    }

    // ✅ NEW: Revert balance if had bankAccountId
    if (transaction.bankAccountId && transaction.status === 'COMPLETED') {
        const amountToRevert = transaction.type === 'INCOME'
            ? -parseFloat(transaction.amount)
            : parseFloat(transaction.amount);
        await bankAccountsService.updateBalance(transaction.bankAccountId, amountToRevert);
        console.log('💰 [BALANCE REVERT] Reverted balance for account:', transaction.bankAccountId, 'by', amountToRevert);
    }

    await TransactionMetadata.destroy({
        where: {
            transactionType: 'MANUAL',
            transactionId
        }
    });

    await transaction.destroy();

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
 * Atualiza metadata de uma transação
 * ✅ PROFILE ISOLATION: profileId added
 */
const updateTransactionMetadata = async (userId, profileId, transactionType, transactionId, data) => {
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

    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.METADATA_UPDATE,
        resource: 'TRANSACTION_METADATA',
        resourceId: metadata.id,
        details: { transactionType, transactionId, profileId }
    });

    return metadata;
};

// ===========================================
// LISTAGEM DE TRANSAÇÕES
// ===========================================

/**
 * Lista todas as transações do usuário
 * ✅ PROFILE ISOLATION: profileId filter on all queries
 */
const listTransactions = async (userId, profileId, filters = {}) => {
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

    // ✅ PROFILE ISOLATION: Base where clause includes profileId
    const baseWhere = { userId };
    if (profileId) baseWhere.profileId = profileId;

    // Buscar transações Open Finance
    const ofWhere = { userId }; // OF não tem profileId por enquanto
    if (Object.keys(dateFilter).length) ofWhere.date = dateFilter;
    if (Object.keys(amountFilter).length) ofWhere.amount = amountFilter;
    if (type === 'CREDIT' || type === 'DEBIT') ofWhere.type = type;

    const openFinanceTransactions = await OpenFinanceTransaction.findAll({
        where: ofWhere,
        order: [['date', 'DESC']],
        limit,
        offset
    });

    // Buscar transações manuais ✅ PROFILE ISOLATION
    const manualWhere = { ...baseWhere };
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
    // ✅ PROFILE ISOLATION: CardTransaction não tem profile_id direto
    // A isolação é feita via o cartão associado (CreditCard.profileId)
    const cardWhere = { userId };
    if (Object.keys(dateFilter).length) cardWhere.date = dateFilter;
    if (Object.keys(amountFilter).length) cardWhere.amount = amountFilter;

    // Filtro para o cartão associado (para isolar por perfil)
    const cardIncludeWhere = {};
    if (profileId) cardIncludeWhere.profileId = profileId;

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
                    attributes: ['id', 'name', 'lastFourDigits', 'profileId'],
                    where: Object.keys(cardIncludeWhere).length > 0 ? cardIncludeWhere : undefined,
                    required: !!profileId // ✅ Se profileId foi passado, exigir cartão do perfil correto
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

    const allMetadata = await TransactionMetadata.findAll({
        where: {
            userId,
            [Op.or]: [
                { transactionType: 'OPEN_FINANCE', transactionId: { [Op.in]: ofIds } },
                { transactionType: 'MANUAL', transactionId: { [Op.in]: manualIds } }
            ]
        }
    });

    const metadataMap = {};
    for (const m of allMetadata) {
        metadataMap[`${m.transactionType}_${m.transactionId}`] = m;
    }

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
                editable: false,
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
                status: tx.status,
                editable: true,
                createdAt: tx.createdAt
            };
        });

    // Formatar transações de cartão
    const formattedCard = cardTransactions
        .filter(tx => {
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
                imageUrl: tx.subscription?.icon || null,
                subscriptionId: tx.subscriptionId,
                subscription: tx.subscription ? { icon: tx.subscription.icon } : null,
                isRecurring: tx.isRecurring,
                recurringFrequency: tx.recurringFrequency,
                editable: true,
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
 * ✅ PROFILE ISOLATION: profileId filter
 */
const listCategories = async (userId, profileId) => {
    // Primeiro buscar categorias do sistema de Categories
    const categoryWhere = { userId };
    if (profileId) categoryWhere.profileId = profileId;

    const userCategories = await Category.findAll({
        where: categoryWhere,
        attributes: ['id', 'name', 'icon', 'color', 'type'],
        order: [['name', 'ASC']]
    });

    // Também buscar do metadata legado
    const metadataCategories = await TransactionMetadata.findAll({
        attributes: [
            [TransactionMetadata.sequelize.fn('DISTINCT', TransactionMetadata.sequelize.col('category')), 'category']
        ],
        where: { userId, category: { [Op.not]: null } },
        order: [['category', 'ASC']]
    });

    // Combinar ambos
    const allCategories = [
        ...userCategories.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            type: c.type
        })),
        ...metadataCategories.map(c => c.category).filter(Boolean)
    ];

    return allCategories;
};

/**
 * Obtém uma transação específica
 * ✅ PROFILE ISOLATION: profileId filter
 */
const getTransaction = async (userId, profileId, transactionId, transactionType) => {
    let transaction;

    const baseWhere = { id: transactionId, userId };
    if (profileId) baseWhere.profileId = profileId;

    if (transactionType === 'OPEN_FINANCE') {
        transaction = await OpenFinanceTransaction.findOne({
            where: { id: transactionId, userId } // OF não tem profileId
        });
    } else if (transactionType === 'CARD') {
        transaction = await CardTransaction.findOne({
            where: baseWhere
        });
    } else {
        transaction = await ManualTransaction.findOne({
            where: baseWhere
        });
    }

    if (!transaction) {
        throw new AppError('Transação não encontrada', 404, 'TRANSACTION_NOT_FOUND');
    }

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

// ===========================================
// INTERNAL TRANSFERS (BETWEEN PROFILES)
// ===========================================

/**
 * Create an internal transfer between profiles/accounts
 * Uses ACID transaction to ensure atomicity
 * 
 * @param {string} userId - User ID
 * @param {object} data - Transfer data
 * @param {string} data.fromProfileId - Source profile ID
 * @param {string} data.fromBankAccountId - Source bank account ID
 * @param {string} data.toProfileId - Destination profile ID
 * @param {string} data.toBankAccountId - Destination bank account ID
 * @param {number} data.amount - Transfer amount
 * @param {string} data.date - Transfer date
 * @param {string} data.description - Optional description
 */
const createInternalTransfer = async (userId, data) => {
    const {
        fromProfileId,
        fromBankAccountId,
        toProfileId,
        toBankAccountId,
        amount,
        date,
        description
    } = data;

    // Validate required fields
    if (!fromBankAccountId || !toBankAccountId || !amount) {
        throw new AppError('Dados incompletos para transferência', 400, 'INVALID_TRANSFER_DATA');
    }

    if (fromBankAccountId === toBankAccountId) {
        throw new AppError('Conta de origem e destino não podem ser iguais', 400, 'SAME_ACCOUNT');
    }

    // Start ACID transaction
    const t = await sequelize.transaction();

    try {
        // Fetch both bank accounts to verify ownership
        const fromAccount = await BankAccount.findOne({
            where: { id: fromBankAccountId, userId },
            transaction: t
        });

        const toAccount = await BankAccount.findOne({
            where: { id: toBankAccountId, userId },
            transaction: t
        });

        if (!fromAccount || !toAccount) {
            throw new AppError('Uma ou mais contas não encontradas', 404, 'ACCOUNT_NOT_FOUND');
        }

        // Check sufficient balance
        const currentBalance = parseFloat(fromAccount.balance) || 0;
        if (currentBalance < parseFloat(amount)) {
            throw new AppError('Saldo insuficiente na conta de origem', 400, 'INSUFFICIENT_BALANCE');
        }

        const transferDesc = description || `Transferência interna`;

        // Create EXPENSE transaction in source profile
        const expenseTransaction = await ManualTransaction.create({
            userId,
            profileId: fromProfileId || fromAccount.profileId,
            bankAccountId: fromBankAccountId,
            type: 'INTERNAL_TRANSFER',
            source: 'OTHER',
            description: `${transferDesc} → ${toAccount.bankName}`,
            amount: amount,
            date: date || new Date().toISOString().split('T')[0],
            status: 'COMPLETED'
        }, { transaction: t });

        // Create INCOME transaction in destination profile
        const incomeTransaction = await ManualTransaction.create({
            userId,
            profileId: toProfileId || toAccount.profileId,
            bankAccountId: toBankAccountId,
            type: 'INTERNAL_TRANSFER',
            source: 'OTHER',
            description: `${transferDesc} ← ${fromAccount.bankName}`,
            amount: amount,
            date: date || new Date().toISOString().split('T')[0],
            status: 'COMPLETED',
            linkedTransferId: expenseTransaction.id
        }, { transaction: t });

        // Link the expense to the income
        expenseTransaction.linkedTransferId = incomeTransaction.id;
        await expenseTransaction.save({ transaction: t });

        // Update balances
        await bankAccountsService.updateBalance(fromBankAccountId, -parseFloat(amount), t);
        await bankAccountsService.updateBalance(toBankAccountId, parseFloat(amount), t);

        // Commit transaction
        await t.commit();

        // Log the transfer
        await AuditLog.log({
            userId,
            action: 'INTERNAL_TRANSFER',
            resource: 'MANUAL_TRANSACTION',
            resourceId: expenseTransaction.id,
            details: {
                fromAccount: fromAccount.bankName,
                toAccount: toAccount.bankName,
                amount,
                fromProfileId,
                toProfileId
            }
        });

        console.log('✅ [INTERNAL TRANSFER] Transfer completed:', {
            from: fromAccount.bankName,
            to: toAccount.bankName,
            amount
        });

        // Gamification: Award XP for financial organization
        try {
            await gamificationService.registerActivity(userId);
            console.log('🎮 [GAMIFICATION] XP awarded for internal transfer');
        } catch (gamifError) {
            console.error('⚠️ [GAMIFICATION] Error awarding XP (non-blocking):', gamifError.message);
        }

        return {
            success: true,
            expense: expenseTransaction.toJSON(),
            income: incomeTransaction.toJSON(),
            summary: {
                fromAccount: {
                    id: fromAccount.id,
                    bankName: fromAccount.bankName,
                    newBalance: parseFloat(fromAccount.balance) - parseFloat(amount)
                },
                toAccount: {
                    id: toAccount.id,
                    bankName: toAccount.bankName,
                    newBalance: parseFloat(toAccount.balance) + parseFloat(amount)
                }
            }
        };

    } catch (error) {
        // Rollback on any error
        await t.rollback();
        console.error('❌ [INTERNAL TRANSFER] Error:', error);
        throw error;
    }
};

module.exports = {
    createManualTransaction,
    updateManualTransaction,
    deleteManualTransaction,
    updateTransactionMetadata,
    listTransactions,
    listCategories,
    getTransaction,
    createInternalTransfer
};
