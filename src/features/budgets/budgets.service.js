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
        // Fallback: Verificar se existem alocações, se sim, retornar um objeto "virtual"
        // para que o frontend não mostre "Sem orçamento"
        const existingAllocations = await BudgetAllocation.findOne({ where: { userId, month, year } });

        if (!existingAllocations) {
            return null;
        }

        // Criar um budget virtual provisório
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

// ===========================================
// BUDGET ALLOCATIONS (Orçamentos Inteligentes)
// ===========================================

const { BudgetAllocation, Category, Goal, CardTransaction } = require('../../models');

const DEFAULT_ALLOCATIONS = [
    { name: 'Gastos Essenciais', percentage: 50, color: '#ef4444', icon: 'home' },
    { name: 'Gastos Pessoais', percentage: 20, color: '#f59e0b', icon: 'user' },
    { name: 'Investimentos', percentage: 15, color: '#22c55e', icon: 'trending-up' },
    { name: 'Reserva de Emergência', percentage: 10, color: '#3b82f6', icon: 'shield' },
    { name: 'Lazer', percentage: 5, color: '#8b5cf6', icon: 'smile' }
];

/**
 * Cria alocações padrão para um usuário
 */
const createDefaultAllocations = async (userId, month, year) => {
    const created = await Promise.all(DEFAULT_ALLOCATIONS.map(async (alloc) => {
        // Calcular valor baseado em algo? Por enquanto zero, usuário ajusta depois ou baseia na renda
        // Vamos pegar a renda esperada do orçamento se existir
        const budget = await Budget.findOne({ where: { userId, month, year } });
        // Use 3000 as fallback income if 0, so bars are not empty by default
        const income = budget && parseFloat(budget.incomeExpected) > 0 ? parseFloat(budget.incomeExpected) : 3000;
        const amount = (income * alloc.percentage) / 100;

        return BudgetAllocation.create({
            userId,
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
 */
const getAllocations = async (userId, month, year) => {
    let allocations = await BudgetAllocation.findAll({
        where: { userId, month, year },
        order: [['percentage', 'DESC']]
    });

    // SE NÃO EXISTIREM ALOCAÇÕES, CRIAR AS PADRÃO
    if (allocations.length === 0) {
        // Verificar se é mês atual ou futuro para criar (evitar criar histórico antigo sem querer)
        // Mas o usuário pode querer ver old... vamos criar sempre que pedir e estiver vazio?
        // Sim, melhor garantir que tenha dados.
        await createDefaultAllocations(userId, month, year);

        // Recarregar
        allocations = await BudgetAllocation.findAll({
            where: { userId, month, year },
            order: [['percentage', 'DESC']]
        });
    }

    // Para cada alocação, calcular o gasto atual
    const result = await Promise.all(allocations.map(async (alloc) => {
        const spent = await alloc.getSpent({ ManualTransaction, CardTransaction, Category, Goal });
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
 */
const getCurrentAllocations = async (userId) => {
    const now = new Date();
    return getAllocations(userId, now.getMonth() + 1, now.getFullYear());
};

/**
 * Cria ou atualiza alocações para um mês/ano
 */
const createOrUpdateAllocations = async (userId, data) => {
    const { income, allocations, month, year } = data;

    // Usar mês/ano atual se não fornecido
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    // Validar que soma = 100%
    const totalPercent = allocations.reduce((sum, a) => sum + (parseFloat(a.percent) || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
        throw new AppError('A soma das porcentagens deve ser 100%', 400, 'INVALID_PERCENTAGES');
    }

    // Deletar alocações antigas do mês
    await BudgetAllocation.destroy({
        where: { userId, month: targetMonth, year: targetYear }
    });

    // Criar novas alocações
    const created = await Promise.all(allocations.map(async (alloc) => {
        const percentage = parseFloat(alloc.percent) || 0;
        const amount = (income * percentage) / 100;

        return BudgetAllocation.create({
            userId,
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
 * Retorna se a transação pode ser feita ou se vai estourar
 */
const checkBudgetHealth = async (userId, categoryId, amount) => {
    // Buscar categoria
    const category = await Category.findByPk(categoryId);

    // Se não tem budgetAllocationId, permitir sempre
    if (!category?.budgetAllocationId) {
        return { allowed: true, linked: false };
    }

    // Buscar alocação
    const allocation = await BudgetAllocation.findByPk(category.budgetAllocationId);
    if (!allocation) {
        return { allowed: true, linked: false };
    }

    // Calcular gasto atual
    const spent = await allocation.getSpent({ ManualTransaction, CardTransaction, Category, Goal });
    const newTotal = spent + parseFloat(amount);
    const limit = parseFloat(allocation.amount);

    // Verificar se estoura
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
    // Budget Allocations
    getAllocations,
    getCurrentAllocations,
    createOrUpdateAllocations,
    checkBudgetHealth
};

