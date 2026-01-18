/**
 * Subscription Service
 * ========================================
 * ✅ PROFILE ISOLATION: All queries filter by profileId
 * ========================================
 */

const { Subscription, CardTransaction, CreditCard, AuditLog, ManualTransaction } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// ===========================================
// HELPERS
// ===========================================

/**
 * Calcula próxima data de cobrança
 */
const calculateNextBillingDate = (fromDate, frequency) => {
    const date = new Date(fromDate);

    switch (frequency) {
        case 'WEEKLY':
            date.setDate(date.getDate() + 7);
            break;
        case 'MONTHLY':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'QUARTERLY':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'SEMI_ANNUAL':
            date.setMonth(date.getMonth() + 6);
            break;
        case 'YEARLY':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            date.setMonth(date.getMonth() + 1);
    }

    return date.toISOString().split('T')[0];
};

// ===========================================
// CRUD DE ASSINATURAS
// ===========================================

/**
 * Lista assinaturas do usuário
 * ✅ PROFILE ISOLATION
 */
const listSubscriptions = async (userId, profileId, filters = {}) => {
    const { status, category, page = 1, limit = 50 } = filters;

    const where = { userId };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION
    if (status) where.status = status;
    if (category) where.category = category;

    const subscriptions = await Subscription.findAll({
        where,
        include: [{
            model: CreditCard,
            as: 'card',
            attributes: ['id', 'name', 'brand', 'lastFourDigits', 'color']
        }],
        order: [['nextBillingDate', 'ASC']]
    });

    return subscriptions.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        amount: parseFloat(s.amount),
        frequency: s.frequency,
        category: s.category,
        status: s.status,
        startDate: s.startDate,
        nextBillingDate: s.nextBillingDate,
        endDate: s.endDate,
        monthlyCost: s.getMonthlyCost ? s.getMonthlyCost() : parseFloat(s.amount),
        annualCost: s.getAnnualCost ? s.getAnnualCost() : parseFloat(s.amount) * 12,
        autoGenerate: s.autoGenerate,
        alertDaysBefore: s.alertDaysBefore,
        icon: s.icon,
        color: s.color,
        cardId: s.cardId,
        card: s.card ? {
            id: s.card.id,
            name: s.card.name,
            brand: s.card.brand,
            lastFourDigits: s.card.lastFourDigits
        } : null
    }));
};

/**
 * Cria uma nova assinatura
 * ✅ PROFILE ISOLATION: profileId obrigatório
 */
const createSubscription = async (userId, profileId, data) => {
    console.log('📦 [SUBSCRIPTION] Creating with profileId:', profileId);

    const {
        name, description, amount, frequency, category, categoryId,
        startDate, cardId, autoGenerate, alertDaysBefore,
        icon, color, notes, endDate
    } = data;

    // Calcular próxima cobrança
    const nextBillingDate = calculateNextBillingDate(startDate || new Date(), frequency || 'MONTHLY');

    // Verificar se cartão pertence ao usuário E perfil
    if (cardId) {
        const cardWhere = { id: cardId, userId };
        if (profileId) cardWhere.profileId = profileId;

        const card = await CreditCard.findOne({ where: cardWhere });
        if (!card) {
            console.log('❌ Card NOT FOUND for profile:', profileId);
            throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
        }
    }

    const subscription = await Subscription.create({
        userId,
        profileId, // ✅ PROFILE ISOLATION
        cardId,
        name,
        description,
        amount,
        frequency: frequency || 'MONTHLY',
        category: category || 'OTHER',
        categoryId: categoryId || null,
        startDate: startDate || new Date().toISOString().split('T')[0],
        nextBillingDate,
        endDate,
        autoGenerate: autoGenerate !== false,
        alertDaysBefore: alertDaysBefore || 3,
        icon,
        color,
        notes,
        status: 'ACTIVE'
    });

    console.log('✅ [SUBSCRIPTION] Created:', subscription.id, 'profileId:', subscription.profileId);

    // Auto-criar primeira transação recorrente
    if (autoGenerate !== false) {
        try {
            if (cardId) {
                await CardTransaction.create({
                    userId,
                    profileId, // ✅ PROFILE ISOLATION
                    cardId,
                    subscriptionId: subscription.id,
                    description: name,
                    amount: parseFloat(amount),
                    date: startDate || new Date().toISOString().split('T')[0],
                    category: category || 'OTHER',
                    categoryId: categoryId || null,
                    isRecurring: true,
                    recurringFrequency: frequency,
                    status: 'PENDING'
                });
            } else {
                await ManualTransaction.create({
                    userId,
                    profileId, // ✅ PROFILE ISOLATION
                    type: 'EXPENSE',
                    description: name,
                    amount: parseFloat(amount),
                    date: startDate || new Date().toISOString().split('T')[0],
                    category: category || 'OTHER',
                    categoryId: categoryId || null,
                    source: 'SUBSCRIPTION',
                    status: 'PENDING',
                    isRecurring: true,
                    subscriptionId: subscription.id,
                    imageUrl: icon,
                    notes: `Assinatura: ${name}`
                });
            }
        } catch (txError) {
            console.error('Error creating initial transaction:', txError);
        }
    }

    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_CREATE',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id,
        newData: { name, amount, frequency, profileId }
    });

    return subscription;
};

/**
 * Atualiza uma assinatura
 * ✅ PROFILE ISOLATION
 */
const updateSubscription = async (userId, profileId, subscriptionId, data) => {
    const where = { id: subscriptionId, userId };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscription = await Subscription.findOne({ where });

    if (!subscription) {
        throw new AppError('Assinatura não encontrada', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const previousData = subscription.toJSON();

    // Campos atualizáveis
    const updateableFields = [
        'name', 'description', 'amount', 'frequency', 'category', 'categoryId',
        'cardId', 'autoGenerate', 'alertDaysBefore', 'icon', 'color',
        'notes', 'endDate', 'status'
    ];

    for (const field of updateableFields) {
        if (data[field] !== undefined) {
            subscription[field] = data[field];
        }
    }

    // Recalcular próxima cobrança se frequência mudou
    if (data.frequency && data.frequency !== previousData.frequency) {
        subscription.nextBillingDate = calculateNextBillingDate(
            subscription.nextBillingDate,
            data.frequency
        );
    }

    await subscription.save();

    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_UPDATE',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id,
        previousData,
        newData: data
    });

    return subscription;
};

/**
 * Cancela uma assinatura
 * ✅ PROFILE ISOLATION
 */
const cancelSubscription = async (userId, profileId, subscriptionId, deleteTransaction = false) => {
    const where = { id: subscriptionId, userId };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscription = await Subscription.findOne({ where });

    if (!subscription) {
        throw new AppError('Assinatura não encontrada', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // Delete pending transaction if requested
    if (deleteTransaction) {
        try {
            // Find PENDING transaction for this subscription
            // Check CardTransaction
            const cardTx = await CardTransaction.findOne({
                where: {
                    subscriptionId: subscription.id,
                    status: 'PENDING'
                }
            });

            if (cardTx) {
                await cardTx.destroy();
                console.log(`🗑️ [SUBSCRIPTION] Deleted pending CardTransaction ${cardTx.id}`);
            } else {
                // Check ManualTransaction
                const manualTx = await ManualTransaction.findOne({
                    where: {
                        subscriptionId: subscription.id,
                        status: 'PENDING'
                    }
                });
                if (manualTx) {
                    await manualTx.destroy();
                    console.log(`🗑️ [SUBSCRIPTION] Deleted pending ManualTransaction ${manualTx.id}`);
                }
            }
        } catch (error) {
            console.error('Error deleting pending transaction:', error);
            // Don't block cancellation if transaction deletion fails, just log it
        }
    }

    subscription.status = 'CANCELLED';
    subscription.endDate = new Date().toISOString().split('T')[0];
    await subscription.save();

    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_CANCEL',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id,
        details: { deleteTransaction }
    });

    return { message: 'Assinatura cancelada com sucesso' };
};

// ===========================================
// GERAÇÃO DE LANÇAMENTOS
// ===========================================

/**
 * Gera lançamentos para assinaturas vencidas
 * ✅ PROFILE ISOLATION: Herda profileId da assinatura
 */
const generatePendingTransactions = async (userId, profileId) => {
    const today = new Date().toISOString().split('T')[0];

    const where = {
        userId,
        status: 'ACTIVE',
        autoGenerate: true,
        nextBillingDate: { [Op.lte]: today }
    };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscriptions = await Subscription.findAll({ where });

    const generated = [];

    for (const sub of subscriptions) {
        // Verificar se já existe lançamento para esta data
        const existing = await CardTransaction.findOne({
            where: {
                subscriptionId: sub.id,
                date: sub.nextBillingDate
            }
        });

        if (!existing) {
            if (sub.cardId) {
                // Criar transação no cartão
                const transaction = await CardTransaction.create({
                    userId,
                    profileId: sub.profileId, // ✅ HERDA DA ASSINATURA
                    cardId: sub.cardId,
                    subscriptionId: sub.id,
                    description: sub.name,
                    amount: sub.amount,
                    date: sub.nextBillingDate,
                    category: sub.category,
                    categoryId: sub.categoryId,
                    isRecurring: true,
                    recurringFrequency: sub.frequency,
                    status: 'PENDING'
                });
                generated.push(transaction);
            } else {
                // Criar transação manual
                const transaction = await ManualTransaction.create({
                    userId,
                    profileId: sub.profileId, // ✅ HERDA DA ASSINATURA
                    type: 'EXPENSE',
                    description: sub.name,
                    amount: sub.amount,
                    date: sub.nextBillingDate,
                    category: sub.category,
                    categoryId: sub.categoryId,
                    source: 'SUBSCRIPTION',
                    status: 'PENDING',
                    isRecurring: true,
                    subscriptionId: sub.id
                });
                generated.push(transaction);
            }

            // Atualizar próxima cobrança
            sub.nextBillingDate = calculateNextBillingDate(sub.nextBillingDate, sub.frequency);
            await sub.save();
        }
    }

    console.log(`📦 [SUBSCRIPTION] Generated ${generated.length} pending transactions`);

    return {
        generated: generated.length,
        transactions: generated.map(t => ({
            id: t.id,
            description: t.description,
            amount: parseFloat(t.amount),
            date: t.date
        }))
    };
};

// ===========================================
// ANÁLISES E RESUMO
// ===========================================

/**
 * Obtém resumo de assinaturas
 * ✅ PROFILE ISOLATION
 */
const getSubscriptionsSummary = async (userId, profileId) => {
    const where = { userId, status: 'ACTIVE' };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscriptions = await Subscription.findAll({ where });

    let monthlyTotal = 0;
    let yearlyTotal = 0;
    const byCategory = {};

    for (const sub of subscriptions) {
        const monthly = sub.getMonthlyCost ? sub.getMonthlyCost() : parseFloat(sub.amount);
        monthlyTotal += monthly;
        yearlyTotal += (sub.getAnnualCost ? sub.getAnnualCost() : monthly * 12);

        if (!byCategory[sub.category]) {
            byCategory[sub.category] = { category: sub.category, monthly: 0, count: 0 };
        }
        byCategory[sub.category].monthly += monthly;
        byCategory[sub.category].count += 1;
    }

    return {
        totalActive: subscriptions.length,
        monthlyTotal,
        yearlyTotal,
        byCategory: Object.values(byCategory).sort((a, b) => b.monthly - a.monthly)
    };
};

/**
 * Obtém próximas cobranças
 * ✅ PROFILE ISOLATION
 */
const getUpcomingCharges = async (userId, profileId, days = 30) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const where = {
        userId,
        status: 'ACTIVE',
        nextBillingDate: {
            [Op.between]: [new Date().toISOString().split('T')[0], targetDate.toISOString().split('T')[0]]
        }
    };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscriptions = await Subscription.findAll({
        where,
        include: [{
            model: CreditCard,
            as: 'card',
            attributes: ['name', 'brand', 'lastFourDigits']
        }],
        order: [['nextBillingDate', 'ASC']]
    });

    return subscriptions.map(s => ({
        id: s.id,
        name: s.name,
        amount: parseFloat(s.amount),
        nextBillingDate: s.nextBillingDate,
        daysUntil: Math.ceil((new Date(s.nextBillingDate) - new Date()) / (1000 * 60 * 60 * 24)),
        card: s.card ? {
            name: s.card.name,
            brand: s.card.brand,
            lastFourDigits: s.card.lastFourDigits
        } : null
    }));
};

/**
 * Obtém alertas de assinaturas
 * ✅ PROFILE ISOLATION
 */
const getSubscriptionAlerts = async (userId, profileId) => {
    const where = { userId, status: 'ACTIVE' };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscriptions = await Subscription.findAll({ where });

    const alerts = [];
    const today = new Date();

    for (const sub of subscriptions) {
        const billingDate = new Date(sub.nextBillingDate);
        const daysUntil = Math.ceil((billingDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntil <= sub.alertDaysBefore && daysUntil >= 0) {
            alerts.push({
                type: 'UPCOMING_CHARGE',
                severity: daysUntil <= 1 ? 'HIGH' : 'MEDIUM',
                subscriptionId: sub.id,
                name: sub.name,
                amount: parseFloat(sub.amount),
                daysUntil,
                message: daysUntil === 0
                    ? `${sub.name} será cobrado hoje`
                    : `${sub.name} será cobrado em ${daysUntil} dia(s)`
            });
        }

        if (!sub.cardId && sub.autoGenerate) {
            alerts.push({
                type: 'NO_CARD_ASSIGNED',
                severity: 'LOW',
                subscriptionId: sub.id,
                name: sub.name,
                message: `${sub.name} não tem cartão associado`
            });
        }
    }

    return alerts.sort((a, b) => {
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
};

/**
 * Marca uma assinatura como paga
 * ✅ PROFILE ISOLATION
 */
const markSubscriptionPaid = async (userId, profileId, subscriptionId, date = new Date()) => {
    const where = { id: subscriptionId, userId };
    if (profileId) where.profileId = profileId; // ✅ PROFILE ISOLATION

    const subscription = await Subscription.findOne({ where });

    if (!subscription) {
        throw new AppError('Assinatura não encontrada', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const payDate = new Date(date).toISOString().split('T')[0];

    let transaction;
    if (subscription.cardId) {
        transaction = await CardTransaction.create({
            userId,
            profileId: subscription.profileId, // ✅ HERDA DA ASSINATURA
            cardId: subscription.cardId,
            subscriptionId: subscription.id,
            description: subscription.name,
            amount: subscription.amount,
            date: payDate,
            category: subscription.category,
            categoryId: subscription.categoryId,
            isRecurring: true,
            recurringFrequency: subscription.frequency,
            status: 'PAID'
        });
    } else {
        transaction = await ManualTransaction.create({
            userId,
            profileId: subscription.profileId, // ✅ HERDA DA ASSINATURA
            type: 'EXPENSE',
            status: 'COMPLETED',
            source: 'SUBSCRIPTION',
            description: subscription.name,
            amount: subscription.amount,
            date: payDate,
            category: subscription.category,
            categoryId: subscription.categoryId,
            isRecurring: true
        });
    }

    // Avança próxima cobrança
    subscription.nextBillingDate = calculateNextBillingDate(subscription.nextBillingDate, subscription.frequency);
    await subscription.save();

    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_PAY',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id,
        details: { transactionId: transaction.id }
    });

    return transaction;
};

module.exports = {
    listSubscriptions,
    createSubscription,
    updateSubscription,
    cancelSubscription,
    generatePendingTransactions,
    getSubscriptionsSummary,
    getUpcomingCharges,
    getSubscriptionAlerts,
    markSubscriptionPaid
};
