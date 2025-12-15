/**
 * Dashboard Controller
 */

const dashboardService = require('./dashboard.service');

const getSummary = async (req, res, next) => {
    try {
        const summary = await dashboardService.getSummary(req.userId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
};

const getAlerts = async (req, res, next) => {
    try {
        const alerts = await dashboardService.getAlerts(req.userId);
        res.json({ data: alerts });
    } catch (error) {
        next(error);
    }
};

const getCategoryBreakdown = async (req, res, next) => {
    try {
        const categories = await dashboardService.getCategoryBreakdown(req.userId);
        res.json({ data: categories });
    } catch (error) {
        next(error);
    }
};

module.exports = { getSummary, getAlerts, getCategoryBreakdown };
