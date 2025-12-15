/**
 * Investment Dashboard Controller
 */

const investmentDashboardService = require('./investmentDashboard.service');

/**
 * GET /investment-dashboard/summary
 * Resumo completo do portfólio
 */
const getSummary = async (req, res, next) => {
    try {
        const data = await investmentDashboardService.getPortfolioSummary(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/performance/assets
 * Rentabilidade por ativo
 */
const getPerformanceByAsset = async (req, res, next) => {
    try {
        const data = await investmentDashboardService.getPerformanceByAsset(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/performance/classes
 * Rentabilidade por classe de ativo
 */
const getPerformanceByClass = async (req, res, next) => {
    try {
        const data = await investmentDashboardService.getPerformanceByClass(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/allocation
 * Análise de alocação e rebalanceamento
 */
const getAllocation = async (req, res, next) => {
    try {
        // Target allocation pode vir como query params
        let targetAllocation = null;
        if (req.query.target) {
            try {
                targetAllocation = JSON.parse(req.query.target);
            } catch (e) {
                // Ignorar erro de parse, usar padrão
            }
        }

        const data = await investmentDashboardService.getAllocationAnalysis(req.userId, targetAllocation);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/evolution
 * Evolução patrimonial
 */
const getEvolution = async (req, res, next) => {
    try {
        const months = parseInt(req.query.months) || 12;
        const data = await investmentDashboardService.getPatrimonyEvolution(req.userId, months);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/dividends
 * Proventos recebidos
 */
const getDividends = async (req, res, next) => {
    try {
        const year = req.query.year ? parseInt(req.query.year) : null;
        const data = await investmentDashboardService.getTotalDividends(req.userId, year);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/dividends/by-asset
 * Proventos por ativo
 */
const getDividendsByAsset = async (req, res, next) => {
    try {
        const data = await investmentDashboardService.getDividendsByAsset(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /investment-dashboard/alerts
 * Alertas de investimentos
 */
const getAlerts = async (req, res, next) => {
    try {
        const data = await investmentDashboardService.getInvestmentAlerts(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSummary,
    getPerformanceByAsset,
    getPerformanceByClass,
    getAllocation,
    getEvolution,
    getDividends,
    getDividendsByAsset,
    getAlerts
};
