/**
 * Budgets Service
 * ========================================
 * MULTI-PROFILE ISOLATION ENABLED
 * ========================================
 * All queries now filter by profileId
 */

const { Budget, OpenFinanceTransaction, ManualTransaction } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista orçamentos do usuário
 * ✅ PROFILE ISOLATION
 */
const listBudgets = async (userId, profileId, filters = {}) => {
    const { year, page = 1, limit = 12 } = filters;

    const where = { userId };
    if (profileId) where.profileId = profileId;
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
 * ✅ PROFILE ISOLATION
 */
const getCurrentBudget = async (userId, profileId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const budgetWhere = { userId, month, year };
    if (profileId) budgetWhere.profileId = profileId;

    let budget = await Budget.findOne({
        where: budgetWhere
    });

    if (!budget) {
        const allocWhere = { userId, month, year };
        if (profileId) allocWhere.profileId = profileId;
        const existingAllocations = await BudgetAllocation.findOne({ where: allocWhere });

        if (!existingAllocations) {
            return null;
        }

        budget = {
            id: 'virtual',
            month,
            year,
            incomeExpected: 0,
            investPercent: 30,
            emergencyPercent: 10,
            getRecommendedInvestment: () => 0,
            getRecommendedEmergencyFund: () => 0,
            getSpendingLimit: () => 0
        };
    }

    // ✅ PROFILE ISOLATION: Filter expenses by profile
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const baseWhere = { userId };
    if (profileId) baseWhere.profileId = profileId;

    const [ofExpenses, manualExpenses, manualIncome] = await Promise.all([
        OpenFinanceTransaction.sum('amount', {
            where: { userId, type: 'DEBIT', date: { [Op.between]: [startDate, endDate] } }
        }),
        ManualTransaction.sum('amount', {
            where: { ...baseWhere, type: 'EXPENSE', date: { [Op.between]: [startDate, endDate] } }
        }),
        ManualTransaction.sum('amount', {
            where: { ...baseWhere, type: 'INCOME', date: { [Op.between]: [startDate, endDate] } }
        })
    ]);

    const totalExpenses = (parseFloat(ofExpenses) || 0) + (parseFloat(manualExpenses) || 0);
    const totalIncome = parseFloat(manualIncome) || 0;

    return {
        id: budget.id,
        month: budget.month,
        year: budget.year,
        profileId,
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
 * ✅ PROFILE ISOLATION
 */
const createOrUpdateBudget = async (userId, profileId, data) => {
    const { month, year, incomeExpected, investPercent, emergencyPercent, notes } = data;

    const invest = parseFloat(investPercent) || 30;
    const emergency = parseFloat(emergencyPercent) || 10;

    if (invest + emergency > 100) {
        throw new AppError('Soma dos percentuais não pode exceder 100%', 400, 'INVALID_PERCENTAGES');
    }

    const whereClause = { userId, month, year };
    if (profileId) whereClause.profileId = profileId;

    const [budget, created] = await Budget.findOrCreate({
        where: whereClause,
        defaults: {
            userId,
            profileId, // ✅ PROFILE ISOLATION
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
        profileId: budget.profileId,
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
 * ✅ PROFILE ISOLATION
 */
const updateBudget = async (userId, profileId, budgetId, data) => {
    const whereClause = { id: budgetId, userId };
    if (profileId) whereClause.profileId = profileId;

    const budget = await Budget.findOne({
        where: whereClause
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

// ===========================================
// BUDGET ALLOCATIONS
// ===========================================

const { BudgetAllocation, Category, Goal, CardTransaction, GoalHistory } = require('../../models');

const DEFAULT_ALLOCATIONS = [
    { name: 'Gastos Essenciais', percentage: 50, color: '#ef4444', icon: 'home' },
    { name: 'Gastos Pessoais', percentage: 20, color: '#f59e0b', icon: 'user' },
    { name: 'Investimentos', percentage: 15, color: '#22c55e', icon: 'trending-up' },
    { name: 'Reserva de Emergência', percentage: 10, color: '#3b82f6', icon: 'shield' },
    { name: 'Lazer', percentage: 5, color: '#8b5cf6', icon: 'smile' }
];

/**
 * Cria alocações padrão para um usuário
 * ✅ PROFILE ISOLATION
 */
const createDefaultAllocations = async (userId, profileId, month, year) => {
    const budgetWhere = { userId, month, year };
    if (profileId) budgetWhere.profileId = profileId;

    const budget = await Budget.findOne({ where: budgetWhere });
    const income = budget && parseFloat(budget.incomeExpected) > 0 ? parseFloat(budget.incomeExpected) : 3000;

    const created = await Promise.all(DEFAULT_ALLOCATIONS.map(async (alloc) => {
        const amount = (income * alloc.percentage) / 100;

        return BudgetAllocation.create({
            userId,
            profileId, // ✅ PROFILE ISOLATION
            name: alloc.name,
            percentage: alloc.percentage,
            amount,
            color: alloc.color,
            icon: alloc.icon,
            month,
            year
        });
    }));
    return created;
};

/**
 * Lista alocações do mês/ano específico
 * ✅ PROFILE ISOLATION
 */
const getAllocations = async (userId, profileId, month, year) => {
    const whereClause = { userId, month, year };
    if (profileId) whereClause.profileId = profileId;

    let allocations = await BudgetAllocation.findAll({
        where: whereClause,
        order: [['percentage', 'DESC']]
    });

    if (allocations.length === 0) {
        await createDefaultAllocations(userId, profileId, month, year);
        allocations = await BudgetAllocation.findAll({
            where: whereClause,
            order: [['percentage', 'DESC']]
        });
    }

    const result = await Promise.all(allocations.map(async (alloc) => {
        const spent = await alloc.getSpent({ ManualTransaction, CardTransaction, Category, Goal, GoalHistory });
        return {
            id: alloc.id,
            name: alloc.name,
            percentage: parseFloat(alloc.percentage),
            amount: parseFloat(alloc.amount),
            color: alloc.color,
            icon: alloc.icon,
            spent,
            remaining: parseFloat(alloc.amount) - spent,
            progress: alloc.amount > 0 ? Math.min(100, (spent / parseFloat(alloc.amount)) * 100) : 0
        };
    }));

    return result;
};

/**
 * Obtém alocações do mês atual
 * ✅ PROFILE ISOLATION
 */
const getCurrentAllocations = async (userId, profileId) => {
    const now = new Date();
    return getAllocations(userId, profileId, now.getMonth() + 1, now.getFullYear());
};

/**
 * Cria ou atualiza alocações para um mês/ano
 * ✅ PROFILE ISOLATION
 */
const createOrUpdateAllocations = async (userId, profileId, data) => {
    const { income, allocations, month, year } = data;

    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const totalPercent = allocations.reduce((sum, a) => sum + (parseFloat(a.percent) || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
        throw new AppError('A soma das porcentagens deve ser 100%', 400, 'INVALID_PERCENTAGES');
    }

    const deleteWhere = { userId, month: targetMonth, year: targetYear };
    if (profileId) deleteWhere.profileId = profileId;

    await BudgetAllocation.destroy({
        where: deleteWhere
    });

    const created = await Promise.all(allocations.map(async (alloc) => {
        const percentage = parseFloat(alloc.percent) || 0;
        const amount = (income * percentage) / 100;

        return BudgetAllocation.create({
            userId,
            profileId, // ✅ PROFILE ISOLATION
            name: alloc.name,
            percentage,
            amount,
            color: alloc.color || '#3b82f6',
            icon: alloc.icon || 'dollar',
            month: targetMonth,
            year: targetYear
        });
    }));

    return {
        month: targetMonth,
        year: targetYear,
        profileId,
        allocations: created.map(a => ({
            id: a.id,
            name: a.name,
            percentage: parseFloat(a.percentage),
            amount: parseFloat(a.amount),
            color: a.color,
            icon: a.icon
        }))
    };
};

/**
 * Verifica saúde do orçamento para uma categoria
 * ✅ PROFILE ISOLATION
 */
const checkBudgetHealth = async (userId, profileId, categoryId, amount) => {
    const category = await Category.findByPk(categoryId);

    if (!category?.budgetAllocationId) {
        return { allowed: true, linked: false };
    }

    const allocation = await BudgetAllocation.findByPk(category.budgetAllocationId);
    if (!allocation) {
        return { allowed: true, linked: false };
    }

    // Verify allocation belongs to correct profile
    if (profileId && allocation.profileId && allocation.profileId !== profileId) {
        return { allowed: true, linked: false };
    }

    const spent = await allocation.getSpent({ ManualTransaction, CardTransaction, Category, Goal, GoalHistory });
    const newTotal = spent + parseFloat(amount);
    const limit = parseFloat(allocation.amount);

    if (newTotal > limit) {
        return {
            allowed: false,
            linked: true,
            warning: 'BUDGET_EXCEEDED',
            allocation: {
                id: allocation.id,
                name: allocation.name,
                limit,
                color: allocation.color
            },
            spent,
            newTotal,
            overAmount: newTotal - limit
        };
    }

    return { allowed: true, linked: true };
};

module.exports = {
    listBudgets,
    getCurrentBudget,
    createOrUpdateBudget,
    updateBudget,
    getAllocations,
    getCurrentAllocations,
    createOrUpdateAllocations,
    checkBudgetHealth
};
