/**
 * Investments Controller
 */

const investmentsService = require('./investments.service');

const listInvestments = async (req, res, next) => {
    try {
        const investments = await investmentsService.listInvestments(req.userId, req.query);
        res.json({ data: investments });
    } catch (error) {
        next(error);
    }
};

const createInvestment = async (req, res, next) => {
    try {
        const investment = await investmentsService.createInvestment(req.userId, req.body);
        res.status(201).json({
            message: 'Investimento registrado com sucesso',
            data: investment
        });
    } catch (error) {
        next(error);
    }
};

const getPortfolio = async (req, res, next) => {
    try {
        const portfolio = await investmentsService.getPortfolio(req.userId);
        res.json({ data: portfolio });
    } catch (error) {
        next(error);
    }
};

const listAssets = async (req, res, next) => {
    try {
        const assets = await investmentsService.listAssets(req.query);
        res.json({ data: assets });
    } catch (error) {
        next(error);
    }
};

module.exports = { listInvestments, createInvestment, getPortfolio, listAssets };
