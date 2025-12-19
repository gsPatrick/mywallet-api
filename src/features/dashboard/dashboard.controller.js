/**
 * Dashboard Controller
 * ========================================
 * MULTI-PROFILE ISOLATION ENABLED
 * ========================================
 */

const dashboardService = require('./dashboard.service');

const getSummary = async (req, res, next) => {
    try {
        // ✅ PROFILE ISOLATION: Pass profileId
        const summary = await dashboardService.getSummary(req.userId, req.profileId);
        res.json({ data: summary });
    } catch (error) {
        next(error);
    }
};

const getAlerts = async (req, res, next) => {
    try {
        // ✅ PROFILE ISOLATION: Pass profileId
        const alerts = await dashboardService.getAlerts(req.userId, req.profileId);
        res.json({ data: alerts });
    } catch (error) {
        next(error);
    }
};

const getCategoryBreakdown = async (req, res, next) => {
    try {
        // ✅ PROFILE ISOLATION: Pass profileId
        const categories = await dashboardService.getCategoryBreakdown(req.userId, req.profileId);
        res.json({ data: categories });
    } catch (error) {
        next(error);
    }
};

const getActivities = async (req, res, next) => {
    try {
        // ✅ PROFILE ISOLATION: Pass profileId
        const activities = await dashboardService.getActivities(req.userId, req.profileId);
        res.json({ data: activities });
    } catch (error) {
        next(error);
    }
};

const getRecentTransactions = async (req, res, next) => {
    try {
        // ✅ PROFILE ISOLATION: Pass profileId
        const transactions = await dashboardService.getRecentTransactions(req.userId, req.profileId);
        res.json({ data: transactions });
    } catch (error) {
        next(error);
    }
};

module.exports = { getSummary, getAlerts, getCategoryBreakdown, getActivities, getRecentTransactions };
