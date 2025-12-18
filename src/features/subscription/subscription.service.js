const { Subscription, CardTransaction, CreditCard, AuditLog, ManualTransaction } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// ... (rest of imports)

// ... (existing code)

/**
 * Marca uma assinatura como paga (cria ou atualiza transação)
 */
const markSubscriptionPaid = async (userId, subscriptionId, date = new Date()) => {
    const subscription = await Subscription.findOne({
        where: { id: subscriptionId, userId }
    });

    if (!subscription) {
        throw new AppError('Assinatura não encontrada', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const payDate = new Date(date).toISOString().split('T')[0];

    // 1. Tenta encontrar transação pendente para a data próxima (mesmo mês/ano)
    const startOfMonth = new Date(date);
    startOfMonth.setDate(1);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);

    const dateFilter = {
        [Op.between]: [startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]]
    };

    let transaction;

    if (subscription.cardId) {
        // Busca em CardTransaction
        transaction = await CardTransaction.findOne({
            where: {
                subscriptionId: subscriptionId,
                date: dateFilter
            }
        });

        if (transaction) {
            transaction.status = 'PAID'; // Assume PAID for card transaction manually confirmed
            await transaction.save();
        } else {
            // Cria nova
            transaction = await CardTransaction.create({
                userId,
                cardId: subscription.cardId,
                subscriptionId: subscription.id,
                description: subscription.name,
                amount: subscription.amount,
                date: payDate,
                category: subscription.category,
                isRecurring: true,
                recurringFrequency: subscription.frequency,
                status: 'PAID'
            });
        }
    } else {
        // É ManualTransaction
        // (Nota: ManualTransaction não tem subscriptionId nativo no modelo mostrado,
        // mas podemos deduzir pelo nome/data ou adicionar metadata se necessário.
        // Simplificação: Cria uma nova COMPLETED)

        transaction = await ManualTransaction.create({
            userId,
            type: 'EXPENSE',
            status: 'COMPLETED',
            source: 'OTHER', // Ou 'CASH', 'PIX' se viesse do input
            description: subscription.name,
            amount: subscription.amount,
            date: payDate,
            category: subscription.category,
            isRecurring: true,
            recurringFrequency: subscription.frequency
        });
    }

    // Avança a data da próxima cobrança se for a atual
    const nextBill = new Date(subscription.nextBillingDate);
    const paidDate = new Date(payDate);

    // Se a data paga for próxima da data de cobrança prevista (margem de 5 dias), avança
    const diffTime = Math.abs(paidDate - nextBill);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 5 || paidDate >= nextBill) {
        subscription.nextBillingDate = calculateNextBillingDate(subscription.nextBillingDate, subscription.frequency);
        await subscription.save();
    }

    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_PAY',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id,
        details: { transactionId: transaction.id }
    });

    return transaction;
};


// ===========================================
// CRUD DE ASSINATURAS
// ===========================================

/**
 * Lista assinaturas do usuário
 */
const listSubscriptions = async (userId, filters = {}) => {
    const { status, category, page = 1, limit = 50 } = filters;

    const where = { userId };
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
        monthlyCost: s.getMonthlyCost(),
        annualCost: s.getAnnualCost(),
        autoGenerate: s.autoGenerate,
        alertDaysBefore: s.alertDaysBefore,
        icon: s.icon,
        color: s.color,
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
 */
const createSubscription = async (userId, data) => {
    const {
        name, description, amount, frequency, category,
        startDate, cardId, autoGenerate, alertDaysBefore,
        icon, color, notes, endDate
    } = data;

    // Calcular próxima cobrança
    const nextBillingDate = calculateNextBillingDate(startDate, frequency);

    // Verificar se cartão pertence ao usuário
    if (cardId) {
        const card = await CreditCard.findOne({ where: { id: cardId, userId } });
        if (!card) {
            throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
        }
    }

    const subscription = await Subscription.create({
        userId,
        cardId,
        name,
        description,
        amount,
        frequency: frequency || 'MONTHLY',
        category: category || 'OTHER',
        startDate,
        nextBillingDate,
        endDate,
        autoGenerate: autoGenerate !== false,
        alertDaysBefore: alertDaysBefore || 3,
        icon,
        color,
        notes,
        status: 'ACTIVE'
    });

    // Auto-criar primeira transação recorrente
    if (autoGenerate !== false) {
        try {
            await ManualTransaction.create({
                userId,
                type: 'EXPENSE',
                description: name,
                amount: parseFloat(amount),
                date: startDate || new Date().toISOString().split('T')[0],
                category: category || 'OTHER',
                source: 'SUBSCRIPTION',
                status: 'PENDING',
                isRecurring: true,
                subscriptionId: subscription.id,
                imageUrl: icon, // Icon from subscription
                notes: `Assinatura: ${name}`
            });
        } catch (txError) {
            console.error('Error creating initial subscription transaction:', txError);
            // Don't fail subscription creation if transaction fails
        }
    }

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_CREATE',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id,
        newData: { name, amount, frequency }
    });

    return subscription;
};

/**
 * Atualiza uma assinatura
 */
const updateSubscription = async (userId, subscriptionId, data) => {
    const subscription = await Subscription.findOne({
        where: { id: subscriptionId, userId }
    });

    if (!subscription) {
        throw new AppError('Assinatura não encontrada', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    const previousData = subscription.toJSON();

    // Campos atualizáveis
    const updateableFields = [
        'name', 'description', 'amount', 'frequency', 'category',
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

    // Log de auditoria
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
 */
const cancelSubscription = async (userId, subscriptionId) => {
    const subscription = await Subscription.findOne({
        where: { id: subscriptionId, userId }
    });

    if (!subscription) {
        throw new AppError('Assinatura não encontrada', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    subscription.status = 'CANCELLED';
    subscription.endDate = new Date().toISOString().split('T')[0];
    await subscription.save();

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: 'SUBSCRIPTION_CANCEL',
        resource: 'SUBSCRIPTION',
        resourceId: subscription.id
    });

    return { message: 'Assinatura cancelada com sucesso' };
};

// ===========================================
// GERAÇÃO DE LANÇAMENTOS
// ===========================================

/**
 * Gera lançamentos para assinaturas vencidas
 */
const generatePendingTransactions = async (userId) => {
    const today = new Date().toISOString().split('T')[0];

    // Buscar assinaturas ativas com cobrança pendente
    const subscriptions = await Subscription.findAll({
        where: {
            userId,
            status: 'ACTIVE',
            autoGenerate: true,
            nextBillingDate: { [Op.lte]: today }
        }
    });

    const generated = [];

    for (const sub of subscriptions) {
        // Verificar se já existe lançamento para esta data
        const existing = await CardTransaction.findOne({
            where: {
                subscriptionId: sub.id,
                date: sub.nextBillingDate
            }
        });

        if (!existing && sub.cardId) {
            // Criar lançamento
            const transaction = await CardTransaction.create({
                userId,
                cardId: sub.cardId,
                subscriptionId: sub.id,
                description: sub.name,
                amount: sub.amount,
                date: sub.nextBillingDate,
                category: sub.category,
                isRecurring: true,
                recurringFrequency: sub.frequency,
                status: 'PENDING'
            });

            generated.push(transaction);

            // Atualizar próxima cobrança
            sub.nextBillingDate = sub.calculateNextBillingDate();
            await sub.save();
        }
    }

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
 */
const getSubscriptionsSummary = async (userId) => {
    const subscriptions = await Subscription.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    let monthlyTotal = 0;
    let yearlyTotal = 0;
    const byCategory = {};

    for (const sub of subscriptions) {
        const monthly = sub.getMonthlyCost();
        monthlyTotal += monthly;
        yearlyTotal += sub.getAnnualCost();

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
 */
const getUpcomingCharges = async (userId, days = 30) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const subscriptions = await Subscription.findAll({
        where: {
            userId,
            status: 'ACTIVE',
            nextBillingDate: {
                [Op.between]: [new Date().toISOString().split('T')[0], targetDate.toISOString().split('T')[0]]
            }
        },
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
 */
const getSubscriptionAlerts = async (userId) => {
    const subscriptions = await Subscription.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    const alerts = [];
    const today = new Date();

    for (const sub of subscriptions) {
        const billingDate = new Date(sub.nextBillingDate);
        const daysUntil = Math.ceil((billingDate - today) / (1000 * 60 * 60 * 24));

        // Alerta de cobrança próxima
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

        // Alerta de assinatura sem cartão
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
