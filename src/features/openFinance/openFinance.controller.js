/**
 * Open Finance Controller
 * Handlers para rotas Open Finance
 */

const openFinanceService = require('./openFinance.service');

/**
 * POST /open-finance/consents
 * Cria um novo consentimento
 */
const createConsent = async (req, res, next) => {
    try {
        const { transmitterName, authServerUrl, resourceServerUrl, permissions } = req.body;

        const result = await openFinanceService.createConsent(req.userId, {
            transmitterName,
            authServerUrl,
            resourceServerUrl,
            permissions
        });

        res.status(201).json({
            message: 'Consentimento criado',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /open-finance/callback
 * Processa callback OAuth
 */
const handleCallback = async (req, res, next) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            return res.status(400).json({
                error: error_description || 'Autorização negada',
                code: error
            });
        }

        if (!code || !state) {
            return res.status(400).json({
                error: 'Parâmetros code e state são obrigatórios',
                code: 'MISSING_PARAMS'
            });
        }

        const result = await openFinanceService.handleCallback(req.userId, { code, state });

        // Em produção, redirecionar para frontend
        res.json({
            message: 'Autorização processada com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /open-finance/consents
 * Lista consentimentos do usuário
 */
const listConsents = async (req, res, next) => {
    try {
        const consents = await openFinanceService.listConsents(req.userId);

        res.json({
            data: consents
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /open-finance/accounts
 * Lista contas importadas
 */
const listAccounts = async (req, res, next) => {
    try {
        const accounts = await openFinanceService.listAccounts(req.userId);
        res.json({
            data: accounts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /open-finance/consents/:id
 * Revoga um consentimento
 */
const revokeConsent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await openFinanceService.revokeConsent(req.userId, id, reason);

        res.json({
            message: 'Consentimento revogado',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /open-finance/import/accounts
 * Importa contas bancárias
 */
const importAccounts = async (req, res, next) => {
    try {
        const { consentId } = req.body;

        if (!consentId) {
            return res.status(400).json({
                error: 'consentId é obrigatório',
                code: 'MISSING_CONSENT_ID'
            });
        }

        const result = await openFinanceService.importAccounts(req.userId, consentId);

        res.json({
            message: 'Contas importadas com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /open-finance/import/cards
 * Importa cartões de crédito
 */
const importCards = async (req, res, next) => {
    try {
        const { consentId } = req.body;

        if (!consentId) {
            return res.status(400).json({
                error: 'consentId é obrigatório',
                code: 'MISSING_CONSENT_ID'
            });
        }

        const result = await openFinanceService.importCards(req.userId, consentId);

        res.json({
            message: 'Cartões importados com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /open-finance/import/transactions
 * Importa transações
 */
const importTransactions = async (req, res, next) => {
    try {
        const { consentId, startDate, endDate } = req.body;

        if (!consentId) {
            return res.status(400).json({
                error: 'consentId é obrigatório',
                code: 'MISSING_CONSENT_ID'
            });
        }

        const result = await openFinanceService.importTransactions(req.userId, consentId, {
            startDate,
            endDate
        });

        res.json({
            message: 'Transações importadas com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};/**
 * GET /open-finance/cards
 * Lista cartões do usuário (proxy para cards service)
 */
const listCards = async (req, res, next) => {
    try {
        const { CreditCard } = require('../../models');
        const cards = await CreditCard.findAll({
            where: { userId: req.userId },
            attributes: ['id', 'name', 'brand', 'lastFourDigits', 'color', 'closingDay', 'dueDay', 'limit', 'status']
        });
        res.json({ data: cards });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createConsent,
    handleCallback,
    listConsents,
    listAccounts,
    listCards,
    revokeConsent,
    importAccounts,
    importCards,
    importTransactions
};
