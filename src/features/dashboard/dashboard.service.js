/**
 * Dashboard Service
 * Resumo financeiro completo
 */

const {
    OpenFinanceTransaction,
    ManualTransaction,
    Investment,
    Budget,
    Goal,
    CreditCard,
    Asset
} = require('../../models');
const investmentsService = require('../investments/investments.service');
const { Op } = require('sequelize');

/**
 * Obtém resumo financeiro do mês atual
 */
const getSummary = async (userId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Buscar orçamento atual
    const budget = await Budget.findOne({
        where: { userId, month, year }
    });

    // Buscar transações do mês
    const dateFilter = { [Op.between]: [startDate, endDate] };

    // Open Finance
    const [ofCredits, ofDebits] = await Promise.all([
        OpenFinanceTransaction.sum('amount', {
            where: { userId, type: 'CREDIT', date: dateFilter }
        }),
        OpenFinanceTransaction.sum('amount', {
            where: { userId, type: 'DEBIT', date: dateFilter }
        })
    ]);

    // Transações de cartão
    const cardExpenses = await OpenFinanceTransaction.sum('amount', {
        where: {
            userId,
            type: 'DEBIT',
            sourceType: 'CREDIT_CARD',
            date: dateFilter
        }
    });

    // Manuais
    const [manualIncome, manualExpenses, manualInvestments] = await Promise.all([
        ManualTransaction.sum('amount', {
            where: { userId, type: 'INCOME', date: dateFilter }
        }),
        ManualTransaction.sum('amount', {
            where: { userId, type: 'EXPENSE', date: dateFilter }
        }),
        Investment.sum('quantity', {
            where: {
                userId,
                operationType: 'BUY',
                date: dateFilter
            },
            include: [{ model: Asset, as: 'asset' }]
        })
    ]);

    // Calcular totais de investimentos do mês
    const investmentsThisMonth = await Investment.findAll({
        where: {
            userId,
            operationType: 'BUY',
            date: dateFilter
        }
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

    return {
        period: {
            month,
            year,
            startDate,
            endDate
        },
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
        hasBudget: !!budget,
        alerts
    };
};

/**
 * Gera alertas financeiros
 */
const generateAlerts = (data) => {
    const alerts = [];

    // Alerta de gastos acima do limite
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

    // Alerta de investimento abaixo do recomendado
    if (data.investedThisMonth < data.recommendedInvestment * 0.5) {
        alerts.push({
            type: 'LOW_INVESTMENT',
            severity: 'MEDIUM',
            message: `Investimentos abaixo de 50% do recomendado (R$ ${data.recommendedInvestment.toFixed(2)})`
        });
    }

    // Alerta de orçamento não configurado
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
 */
const getAlerts = async (userId) => {
    const summary = await getSummary(userId);
    return summary.alerts;
};

/**
 * Obtém visão geral por categoria
 */
const getCategoryBreakdown = async (userId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Buscar transações com metadata
    const { TransactionMetadata } = require('../../models');

    const metadata = await TransactionMetadata.findAll({
        where: { userId, category: { [Op.not]: null } },
        attributes: ['category', 'transactionType', 'transactionId']
    });

    // Agregar por categoria
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
            const tx = await ManualTransaction.findOne({
                where: {
                    id: m.transactionId,
                    date: { [Op.between]: [startDate, endDate] }
                }
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

module.exports = {
    getSummary,
    getAlerts,
    getCategoryBreakdown
};
