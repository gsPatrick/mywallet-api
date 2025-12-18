/**
 * Budgets Controller
 */

const budgetsService = require('./budgets.service');

const listBudgets = async (req, res, next) => {
    try {
        const budgets = await budgetsService.listBudgets(req.userId, req.query);
        res.json({ data: budgets });
    } catch (error) {
        next(error);
    }
};

const getCurrentBudget = async (req, res, next) => {
    try {
        const budget = await budgetsService.getCurrentBudget(req.userId);

        if (!budget) {
            return res.status(404).json({
                error: 'Nenhum orçamento definido para o mês atual',
                code: 'NO_CURRENT_BUDGET'
            });
        }

        res.json({ data: budget });
    } catch (error) {
        next(error);
    }
};

const createBudget = async (req, res, next) => {
    try {
        const budget = await budgetsService.createOrUpdateBudget(req.userId, req.body);
        res.status(budget.created ? 201 : 200).json({
            message: budget.created ? 'Orçamento criado' : 'Orçamento atualizado',
            data: budget
        });
    } catch (error) {
        next(error);
    }
};

const updateBudget = async (req, res, next) => {
    try {
        const budget = await budgetsService.updateBudget(req.userId, req.params.id, req.body);
        res.json({
            message: 'Orçamento atualizado',
            data: budget
        });
    } catch (error) {
        next(error);
    }
};

// ===========================================
// BUDGET ALLOCATIONS
// ===========================================

/**
 * Obtém alocações do mês atual
 */
const getCurrentAllocations = async (req, res, next) => {
    try {
        const allocations = await budgetsService.getCurrentAllocations(req.userId);
        res.json({ data: { allocations } });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtém alocações de um mês/ano específico
 */
const getAllocations = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const allocations = await budgetsService.getAllocations(
            req.userId,
            parseInt(month),
            parseInt(year)
        );
        res.json({ data: { allocations } });
    } catch (error) {
        next(error);
    }
};

/**
 * Cria ou atualiza alocações
 */
const createAllocations = async (req, res, next) => {
    try {
        const result = await budgetsService.createOrUpdateAllocations(req.userId, req.body);
        res.status(201).json({
            message: 'Alocações salvas com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listBudgets,
    getCurrentBudget,
    createBudget,
    updateBudget,
    // Budget Allocations
    getCurrentAllocations,
    getAllocations,
    createAllocations
};

