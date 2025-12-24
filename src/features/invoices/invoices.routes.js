/**
 * Invoices Routes
 * ========================================
 * Rotas para gestão de faturas de cartão
 */

const express = require('express');
const router = express.Router();
const invoicesController = require('./invoices.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar faturas de um cartão
router.get('/card/:cardId', invoicesController.listInvoices);

// Obter fatura atual de um cartão
router.get('/card/:cardId/current', invoicesController.getCurrentInvoice);

// Antecipar pagamento de fatura
router.post('/card/:cardId/advance', invoicesController.advanceInvoice);

// Obter detalhes de uma fatura específica
router.get('/:invoiceId', invoicesController.getInvoice);

// Gerar fatura manualmente
router.post('/generate', invoicesController.generateInvoice);

// Pagar fatura
router.post('/:invoiceId/pay', invoicesController.payInvoice);

// Admin/Cron: Atualizar status de faturas
router.post('/update-statuses', invoicesController.updateStatuses);

// Admin/Cron: Gerar notificações de vencimento
router.post('/generate-notifications', invoicesController.generateNotifications);

module.exports = router;
