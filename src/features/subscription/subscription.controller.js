/**
 * Subscription Controller
 */

const subscriptionService = require('./subscription.service');

const listSubscriptions = async (req, res, next) => {
    try {
        const data = await subscriptionService.listSubscriptions(req.userId, req.query);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const createSubscription = async (req, res, next) => {
    try {
        const subscription = await subscriptionService.createSubscription(req.userId, req.body);
        res.status(201).json({
            message: 'Assinatura criada com sucesso',
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};

const updateSubscription = async (req, res, next) => {
    try {
        const subscription = await subscriptionService.updateSubscription(
            req.userId,
            req.params.id,
            req.body
        );
        res.json({
            message: 'Assinatura atualizada',
            data: subscription
        });
    } catch (error) {
        next(error);
    }
};

const cancelSubscription = async (req, res, next) => {
    try {
        const result = await subscriptionService.cancelSubscription(req.userId, req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const generateTransactions = async (req, res, next) => {
    try {
        const result = await subscriptionService.generatePendingTransactions(req.userId);
        res.json({
            message: `${result.generated} lançamentos gerados`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const getSummary = async (req, res, next) => {
    try {
        const data = await subscriptionService.getSubscriptionsSummary(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const getUpcoming = async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const data = await subscriptionService.getUpcomingCharges(req.userId, days);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const getAlerts = async (req, res, next) => {
    try {
        const data = await subscriptionService.getSubscriptionAlerts(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listSubscriptions,
    createSubscription,
    updateSubscription,
    cancelSubscription,
    generateTransactions,
    getSummary,
    getUpcoming,
    getAlerts
};
