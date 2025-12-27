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
        const options = {};
        if (req.query.brokerId) {
            options.brokerId = parseInt(req.query.brokerId);
        }
        const portfolio = await investmentsService.getPortfolio(req.userId, options);
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

const syncAssetsDatabase = async (req, res, next) => {
    try {
        // Idealmente, verifique se o usuário é ADMIN aqui
        const result = await assetsService.syncAllAssets();
        res.json({
            message: 'Banco de dados de ativos atualizado com sucesso.',
            details: result
        });
    } catch (error) {
        next(error);
    }
};

const listDividends = async (req, res, next) => {
    try {
        const dividendsService = require('./dividends.service');
        const dividends = await dividendsService.listDividends(req.userId);
        res.json({ data: dividends });
    } catch (error) {
        next(error);
    }
};

const getPortfolioEvolution = async (req, res, next) => {
    try {
        const months = parseInt(req.query.months) || 12;
        const evolution = await investmentsService.getPortfolioEvolution(req.userId, months);
        res.json({ data: evolution });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listInvestments,
    createInvestment,
    getPortfolio,
    listAssets,
    syncAssetsDatabase,
    listDividends,
    getPortfolioEvolution
};
