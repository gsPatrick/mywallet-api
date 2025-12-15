/**
 * Budgets Service
 */

const { Budget, OpenFinanceTransaction, ManualTransaction } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista orçamentos do usuário
 */
const listBudgets = async (userId, filters = {}) => {
    const { year, page = 1, limit = 12 } = filters;

    const where = { userId };
    if (year) where.year = parseInt(year);

    const budgets = await Budget.findAll({
        where,
        order: [['year', 'DESC'], ['month', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    return budgets.map(b => ({
        id: b.id,
        month: b.month,
        year: b.year,
        incomeExpected: parseFloat(b.incomeExpected),
        investPercent: parseFloat(b.investPercent),
        emergencyPercent: parseFloat(b.emergencyPercent),
        recommendedInvestment: b.getRecommendedInvestment(),
        recommendedEmergencyFund: b.getRecommendedEmergencyFund(),
        spendingLimit: b.getSpendingLimit()
    }));
};

/**
 * Obtém orçamento do mês atual
 */
const getCurrentBudget = async (userId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    let budget = await Budget.findOne({
        where: { userId, month, year }
    });

    if (!budget) {
        return null;
    }

    // Buscar gastos reais do mês
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const [ofExpenses, manualExpenses, manualIncome] = await Promise.all([
        OpenFinanceTransaction.sum('amount', {
            where: { userId, type: 'DEBIT', date: { [Op.between]: [startDate, endDate] } }
        }),
        ManualTransaction.sum('amount', {
            where: { userId, type: 'EXPENSE', date: { [Op.between]: [startDate, endDate] } }
        }),
        ManualTransaction.sum('amount', {
            where: { userId, type: 'INCOME', date: { [Op.between]: [startDate, endDate] } }
        })
    ]);

    const totalExpenses = (parseFloat(ofExpenses) || 0) + (parseFloat(manualExpenses) || 0);
    const totalIncome = parseFloat(manualIncome) || 0;

    return {
        id: budget.id,
        month: budget.month,
        year: budget.year,
        incomeExpected: parseFloat(budget.incomeExpected),
        incomeActual: totalIncome,
        investPercent: parseFloat(budget.investPercent),
        emergencyPercent: parseFloat(budget.emergencyPercent),
        recommendedInvestment: budget.getRecommendedInvestment(),
        recommendedEmergencyFund: budget.getRecommendedEmergencyFund(),
        spendingLimit: budget.getSpendingLimit(),
        actualExpenses: totalExpenses,
        remainingBudget: budget.getSpendingLimit() - totalExpenses,
        budgetStatus: totalExpenses <= budget.getSpendingLimit() ? 'ON_TRACK' : 'OVER_BUDGET'
    };
};

/**
 * Cria ou atualiza um orçamento
 */
const createOrUpdateBudget = async (userId, data) => {
    const { month, year, incomeExpected, investPercent, emergencyPercent, notes } = data;

    // Validar percentuais
    const invest = parseFloat(investPercent) || 30;
    const emergency = parseFloat(emergencyPercent) || 10;

    if (invest + emergency > 100) {
        throw new AppError('Soma dos percentuais não pode exceder 100%', 400, 'INVALID_PERCENTAGES');
    }

    const [budget, created] = await Budget.findOrCreate({
        where: { userId, month, year },
        defaults: {
            userId,
            month,
            year,
            incomeExpected,
            investPercent: invest,
            emergencyPercent: emergency,
            notes
        }
    });

    if (!created) {
        if (incomeExpected !== undefined) budget.incomeExpected = incomeExpected;
        if (investPercent !== undefined) budget.investPercent = invest;
        if (emergencyPercent !== undefined) budget.emergencyPercent = emergency;
        if (notes !== undefined) budget.notes = notes;
        await budget.save();
    }

    return {
        id: budget.id,
        month: budget.month,
        year: budget.year,
        incomeExpected: parseFloat(budget.incomeExpected),
        investPercent: parseFloat(budget.investPercent),
        emergencyPercent: parseFloat(budget.emergencyPercent),
        recommendedInvestment: budget.getRecommendedInvestment(),
        recommendedEmergencyFund: budget.getRecommendedEmergencyFund(),
        spendingLimit: budget.getSpendingLimit(),
        created
    };
};

/**
 * Atualiza um orçamento existente
 */
const updateBudget = async (userId, budgetId, data) => {
    const budget = await Budget.findOne({
        where: { id: budgetId, userId }
    });

    if (!budget) {
        throw new AppError('Orçamento não encontrado', 404, 'BUDGET_NOT_FOUND');
    }

    const { incomeExpected, investPercent, emergencyPercent, notes } = data;

    if (incomeExpected !== undefined) budget.incomeExpected = incomeExpected;
    if (investPercent !== undefined) budget.investPercent = investPercent;
    if (emergencyPercent !== undefined) budget.emergencyPercent = emergencyPercent;
    if (notes !== undefined) budget.notes = notes;

    await budget.save();

    return budget;
};

module.exports = {
    listBudgets,
    getCurrentBudget,
    createOrUpdateBudget,
    updateBudget
};
