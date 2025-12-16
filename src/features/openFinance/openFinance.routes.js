/**
 * Open Finance Routes
 * Rotas para integração Open Finance Brasil
 */

const { Router } = require('express');
const openFinanceController = require('./openFinance.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { openFinanceAudit } = require('../../middlewares/auditLogger');

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Middleware de auditoria para Open Finance
router.use(openFinanceAudit);

// Gerenciamento de Consentimento
router.post('/consents', openFinanceController.createConsent);
router.get('/consents', openFinanceController.listConsents);
router.delete('/consents/:id', openFinanceController.revokeConsent);

// Listagem de Dados
router.get('/accounts', openFinanceController.listAccounts);

// OAuth Callback
router.get('/callback', openFinanceController.handleCallback);

// Importação de Dados
router.post('/import/accounts', openFinanceController.importAccounts);
router.post('/import/cards', openFinanceController.importCards);
router.post('/import/transactions', openFinanceController.importTransactions);

module.exports = router;
