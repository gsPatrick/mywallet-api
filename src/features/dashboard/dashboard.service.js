/**
 * Dashboard Service
 * ========================================
 * MULTI-PROFILE ISOLATION ENABLED
 * ========================================
 * All financial queries now filter by profileId
 */

const {
    OpenFinanceTransaction,
    ManualTransaction,
    Investment,
    Budget,
    Goal,
    CreditCard,
    Asset,
    AuditLog,
    Category
} = require('../../models');
const investmentsService = require('../investments/investments.service');
const { Op } = require('sequelize');

/**
 * Obtém resumo financeiro do mês atual
 * ✅ PROFILE ISOLATION: Filter by profileId
 */
const getSummary = async (userId, profileId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // ✅ PROFILE ISOLATION: Base where clause
    const baseWhere = { userId };
    if (profileId) baseWhere.profileId = profileId;

    // Buscar orçamento atual (filtrado por perfil)
    const budgetWhere = { userId, month, year };
    if (profileId) budgetWhere.profileId = profileId;
    const budget = await Budget.findOne({
        where: budgetWhere
    });

    const dateFilter = { [Op.between]: [startDate, endDate] };

    // Open Finance (não tem profileId por enquanto)
    const [ofCredits, ofDebits] = await Promise.all([
        OpenFinanceTransaction.sum('amount', {
            where: { userId, type: 'CREDIT', date: dateFilter }
        }),
        OpenFinanceTransaction.sum('amount', {
            where: { userId, type: 'DEBIT', date: dateFilter }
        })
    ]);

    const cardExpenses = await OpenFinanceTransaction.sum('amount', {
        where: {
            userId,
            type: 'DEBIT',
            sourceType: 'CREDIT_CARD',
            date: dateFilter
        }
    });

    // ✅ PROFILE ISOLATION: Manuais e Investimentos filtrados por perfil
    const manualIncomeWhere = { ...baseWhere, type: 'INCOME', date: dateFilter };
    const manualExpenseWhere = { ...baseWhere, type: 'EXPENSE', date: dateFilter };
    const investmentWhere = { ...baseWhere, operationType: 'BUY', date: dateFilter };

    const [manualIncome, manualExpenses, manualInvestments] = await Promise.all([
        ManualTransaction.sum('amount', { where: manualIncomeWhere }),
        ManualTransaction.sum('amount', { where: manualExpenseWhere }),
        Investment.sum('quantity', { where: investmentWhere })
    ]);

    // Calcular totais de investimentos do mês ✅ PROFILE ISOLATION
    const investmentsThisMonth = await Investment.findAll({
        where: investmentWhere
    });

    let investedThisMonth = 0;
    for (const inv of investmentsThisMonth) {
        investedThisMonth += (parseFloat(inv.quantity) * parseFloat(inv.price)) +
            parseFloat(inv.brokerageFee) + parseFloat(inv.otherFees);
    }

    // Calcular valores
    const income = (parseFloat(ofCredits) || 0) + (parseFloat(manualIncome) || 0);
    const ofExpensesTotal = parseFloat(ofDebits) || 0;
    const manualExpensesTotal = parseFloat(manualExpenses) || 0;
    const expenses = ofExpensesTotal + manualExpensesTotal;
    const cardExpensesTotal = parseFloat(cardExpenses) || 0;

    // Recomendações do orçamento
    const recommendedInvestment = budget ? budget.getRecommendedInvestment() : income * 0.3;
    const recommendedEmergency = budget ? budget.getRecommendedEmergencyFund() : income * 0.1;
    const spendingLimit = budget ? budget.getSpendingLimit() : income * 0.6;

    // Gerar alertas
    const alerts = generateAlerts({
        income,
        expenses,
        spendingLimit,
        investedThisMonth,
        recommendedInvestment,
        budget
    });

    // ✅ PROFILE ISOLATION: Calculate All-Time Manual Balance for this profile
    const allManualIncomeWhere = { ...baseWhere, type: 'INCOME' };
    const allManualExpenseWhere = { ...baseWhere, type: 'EXPENSE' };

    const [allManualIncome, allManualExpenses] = await Promise.all([
        ManualTransaction.sum('amount', { where: allManualIncomeWhere }),
        ManualTransaction.sum('amount', { where: allManualExpenseWhere })
    ]);
    const manualTotalBalance = (parseFloat(allManualIncome) || 0) - (parseFloat(allManualExpenses) || 0);

    return {
        period: {
            month,
            year,
            startDate,
            endDate
        },
        profileId, // Include for frontend reference
        income,
        expenses,
        cardExpenses: cardExpensesTotal,
        manualExpenses: manualExpensesTotal,
        openFinanceExpenses: ofExpensesTotal,
        invested: investedThisMonth,
        recommendedInvestment,
        emergencyFund: recommendedEmergency,
        spendingLimit,
        remainingBudget: spendingLimit - expenses,
        balance: income - expenses - investedThisMonth,
        manualTotalBalance,
        hasBudget: !!budget,
        alerts
    };
};

/**
 * Gera alertas financeiros
 */
const generateAlerts = (data) => {
    const alerts = [];

    if (data.expenses > data.spendingLimit) {
        alerts.push({
            type: 'OVER_BUDGET',
            severity: 'HIGH',
            message: `Gastos excedem o limite em R$ ${(data.expenses - data.spendingLimit).toFixed(2)}`
        });
    } else if (data.expenses > data.spendingLimit * 0.9) {
        alerts.push({
            type: 'NEAR_LIMIT',
            severity: 'MEDIUM',
            message: 'Gastos próximos de 90% do limite mensal'
        });
    }

    if (data.investedThisMonth < data.recommendedInvestment * 0.5) {
        alerts.push({
            type: 'LOW_INVESTMENT',
            severity: 'MEDIUM',
            message: `Investimentos abaixo de 50% do recomendado (R$ ${data.recommendedInvestment.toFixed(2)})`
        });
    }

    if (!data.budget) {
        alerts.push({
            type: 'NO_BUDGET',
            severity: 'LOW',
            message: 'Configure um orçamento para o mês atual'
        });
    }

    return alerts;
};

/**
 * Obtém alertas financeiros
 * ✅ PROFILE ISOLATION
 */
const getAlerts = async (userId, profileId) => {
    const summary = await getSummary(userId, profileId);
    return summary.alerts;
};

/**
 * Obtém visão geral por categoria
 * ✅ PROFILE ISOLATION
 */
const getCategoryBreakdown = async (userId, profileId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { TransactionMetadata } = require('../../models');

    // ✅ PROFILE ISOLATION: Filter manual transactions by profile
    const baseWhere = { userId };
    if (profileId) baseWhere.profileId = profileId;

    const metadata = await TransactionMetadata.findAll({
        where: { userId, category: { [Op.not]: null } },
        attributes: ['category', 'transactionType', 'transactionId']
    });

    const categories = {};

    for (const m of metadata) {
        let amount = 0;

        if (m.transactionType === 'OPEN_FINANCE') {
            const tx = await OpenFinanceTransaction.findOne({
                where: {
                    id: m.transactionId,
                    date: { [Op.between]: [startDate, endDate] }
                }
            });
            if (tx) amount = parseFloat(tx.amount);
        } else {
            const manualWhere = {
                id: m.transactionId,
                date: { [Op.between]: [startDate, endDate] }
            };
            if (profileId) manualWhere.profileId = profileId;

            const tx = await ManualTransaction.findOne({
                where: manualWhere
            });
            if (tx) amount = parseFloat(tx.amount);
        }

        if (amount > 0) {
            if (!categories[m.category]) {
                categories[m.category] = { category: m.category, total: 0, count: 0 };
            }
            categories[m.category].total += amount;
            categories[m.category].count += 1;
        }
    }

    return Object.values(categories).sort((a, b) => b.total - a.total);
};

/**
 * Obtém atividades recentes do usuário
 * Activities are user-level (not profile-specific)
 */
const getActivities = async (userId, profileId) => {
    const allowedActions = [
        'TRANSACTION_CREATE',
        'TRANSACTION_UPDATE',
        'TRANSACTION_DELETE',
        'MANUAL_TRANSACTION_CREATE',
        'MANUAL_TRANSACTION_UPDATE',
        'MANUAL_TRANSACTION_DELETE',
        'SUBSCRIPTION_CREATE',
        'SUBSCRIPTION_UPDATE',
        'SUBSCRIPTION_CANCEL',
        'SUBSCRIPTION_PAY',
        'INVESTMENT_CREATE',
        'INVESTMENT_UPDATE',
        'INVESTMENT_DELETE',
        'GOAL_CREATE',
        'GOAL_UPDATE',
        'GOAL_DELETE',
        'BUDGET_CREATE',
        'BUDGET_UPDATE',
        'CATEGORY_CREATE',
        'CATEGORY_UPDATE',
        'CATEGORY_DELETE',
        'CARD_CREATE',
        'CARD_UPDATE',
        'CARD_DELETE'
    ];

    // Note: Activities could optionally filter by profileId in details
    // For now, show all user activities
    const logs = await AuditLog.findAll({
        where: {
            userId,
            action: { [Op.in]: allowedActions }
        },
        order: [['createdAt', 'DESC']],
        limit: 20,
        attributes: ['id', 'action', 'resource', 'details', 'createdAt']
    });

    return logs.map(log => ({
        id: log.id,
        action: translateAction(log.action),
        resource: translateResource(log.resource),
        details: log.details,
        date: log.createdAt,
        rawAction: log.action
    }));
};

const translateAction = (action) => {
    const map = {
        'USER_LOGIN': 'Fez login',
        'USER_REGISTER': 'Criou conta',
        'TRANSACTION_CREATE': 'Adicionou transação',
        'TRANSACTION_UPDATE': 'Atualizou transação',
        'TRANSACTION_DELETE': 'Removeu transação',
        'MANUAL_TRANSACTION_CREATE': 'Adicionou lançamento manual',
        'MANUAL_TRANSACTION_UPDATE': 'Atualizou lançamento manual',
        'MANUAL_TRANSACTION_DELETE': 'Removeu lançamento manual',
        'SUBSCRIPTION_CREATE': 'Criou recorrência',
        'SUBSCRIPTION_UPDATE': 'Atualizou recorrência',
        'SUBSCRIPTION_CANCEL': 'Cancelou recorrência',
        'SUBSCRIPTION_PAY': 'Pagou recorrência',
        'INVESTMENT_CREATE': 'Registrou operação',
        'INVESTMENT_UPDATE': 'Atualizou investimento',
        'INVESTMENT_DELETE': 'Removeu investimento',
        'GOAL_CREATE': 'Criou meta',
        'GOAL_UPDATE': 'Atualizou meta',
        'GOAL_DELETE': 'Removeu meta',
        'BUDGET_CREATE': 'Criou orçamento',
        'BUDGET_UPDATE': 'Atualizou orçamento',
        'CONSENT_CREATE': 'Vinculou Open Finance',
        'CONSENT_REVOKE': 'Revogou Open Finance',
        'DATA_IMPORT': 'Sincronizou dados',
        'CATEGORY_CREATE': 'Criou categoria',
        'CATEGORY_UPDATE': 'Atualizou categoria',
        'CATEGORY_DELETE': 'Removeu categoria'
    };
    return map[action] || action.replace(/_/g, ' ').toLowerCase();
};

const translateResource = (resource) => {
    const map = {
        'TRANSACTION': 'Transação',
        'MANUAL_TRANSACTION': 'Lançamento',
        'OPEN_FINANCE': 'Open Finance',
        'USER': 'Conta',
        'INVESTMENT': 'Investimento',
        'GOAL': 'Meta',
        'BUDGET': 'Orçamento',
        'SUBSCRIPTION': 'Recorrência',
        'CATEGORY': 'Categoria',
        'CARD': 'Cartão'
    };
    return map[resource] || resource;
};

/**
 * Obtém transações recentes com detalhes completos
 * ✅ PROFILE ISOLATION
 */
const getRecentTransactions = async (userId, profileId) => {
    const whereClause = { userId };
    if (profileId) whereClause.profileId = profileId;

    const transactions = await ManualTransaction.findAll({
        where: whereClause,
        include: [{
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon', 'color']
        }],
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        limit: 20,
        attributes: ['id', 'description', 'amount', 'type', 'status', 'date', 'source', 'createdAt']
    });

    return transactions.map(t => ({
        id: t.id,
        description: t.description || 'Sem descrição',
        amount: parseFloat(t.amount),
        type: t.type,
        status: t.status,
        date: t.date,
        source: t.source,
        category: t.category ? {
            id: t.category.id,
            name: t.category.name,
            icon: t.category.icon,
            color: t.category.color
        } : null,
        createdAt: t.createdAt
    }));
};

module.exports = {
    getSummary,
    getAlerts,
    getCategoryBreakdown,
    getActivities,
    getRecentTransactions
};
