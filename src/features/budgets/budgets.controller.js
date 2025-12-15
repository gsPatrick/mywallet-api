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

module.exports = { listBudgets, getCurrentBudget, createBudget, updateBudget };
