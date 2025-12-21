/**
 * Subscription Routes
 * ========================================
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const webhookController = require('./webhook.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Rotas públicas
router.get('/plans', subscriptionController.getPlans);

// Webhook do Mercado Pago (sem auth)
router.post('/webhook', webhookController.handleWebhook);

// Rotas autenticadas
router.post('/subscribe', authMiddleware, subscriptionController.subscribe);
router.get('/status', authMiddleware, subscriptionController.getStatus);
router.post('/cancel', authMiddleware, subscriptionController.cancel);
router.get('/history', authMiddleware, subscriptionController.getHistory);

// ⚠️ TESTE: Rotas para ativar assinatura manualmente
router.post('/activate-test', authMiddleware, subscriptionController.activateTest);
router.post('/simulate-webhook', subscriptionController.simulateWebhook);

module.exports = router;

