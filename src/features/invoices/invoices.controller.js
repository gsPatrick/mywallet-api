/**
 * Invoices Controller
 * ========================================
 * Endpoints para gestão de faturas de cartão
 */

const invoicesService = require('./invoices.service');
const { getActiveProfile } = require('../../utils/profileUtils');

/**
 * Lista faturas de um cartão
 * GET /api/invoices/card/:cardId
 */
const listInvoices = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { cardId } = req.params;
        const { limit, page } = req.query;
        const profileId = getActiveProfile(req);

        const result = await invoicesService.listInvoices(userId, profileId, cardId, {
            limit: parseInt(limit) || 12,
            page: parseInt(page) || 1
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Obtém detalhes de uma fatura
 * GET /api/invoices/:invoiceId
 */
const getInvoice = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { invoiceId } = req.params;
        const profileId = getActiveProfile(req);

        const invoice = await invoicesService.getInvoice(userId, profileId, invoiceId);

        res.json(invoice);
    } catch (error) {
        next(error);
    }
};

/**
 * Obtém fatura atual de um cartão
 * GET /api/invoices/card/:cardId/current
 */
const getCurrentInvoice = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { cardId } = req.params;
        const profileId = getActiveProfile(req);

        const invoice = await invoicesService.getCurrentInvoice(userId, profileId, cardId);

        res.json(invoice);
    } catch (error) {
        next(error);
    }
};

/**
 * Gera fatura para um mês específico
 * POST /api/invoices/generate
 */
const generateInvoice = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { cardId, month, year } = req.body;
        const profileId = getActiveProfile(req);

        const invoice = await invoicesService.generateInvoice(userId, profileId, cardId, month, year);

        res.status(201).json(invoice);
    } catch (error) {
        next(error);
    }
};

/**
 * Registra pagamento de fatura
 * POST /api/invoices/:invoiceId/pay
 */
const payInvoice = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { invoiceId } = req.params;
        const { amount, paymentType, paymentMethod, bankAccountId, notes } = req.body;
        const profileId = getActiveProfile(req);

        const result = await invoicesService.payInvoice(userId, profileId, invoiceId, {
            amount: parseFloat(amount) || 0,
            paymentType,
            paymentMethod,
            bankAccountId,
            notes
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Antecipa pagamento de fatura
 * POST /api/invoices/card/:cardId/advance
 */
const advanceInvoice = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { cardId } = req.params;
        const { amount, bankAccountId } = req.body;
        const profileId = getActiveProfile(req);

        const result = await invoicesService.advanceInvoice(
            userId,
            profileId,
            cardId,
            parseFloat(amount) || 0,
            bankAccountId
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Atualiza status de faturas (para cron/admin)
 * POST /api/invoices/update-statuses
 */
const updateStatuses = async (req, res, next) => {
    try {
        const result = await invoicesService.updateInvoiceStatuses();
        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Gera notificações de vencimento (para cron/admin)
 * POST /api/invoices/generate-notifications
 */
const generateNotifications = async (req, res, next) => {
    try {
        const result = await invoicesService.generateInvoiceNotifications();
        res.json(result);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listInvoices,
    getInvoice,
    getCurrentInvoice,
    generateInvoice,
    payInvoice,
    advanceInvoice,
    updateStatuses,
    generateNotifications
};
