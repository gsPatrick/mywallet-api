/**
 * Subscription Routes
 * ========================================
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const webhookController = require('./webhook.controller');
const { authenticateToken } = require('../../middlewares/auth');

// Rotas públicas
router.get('/plans', subscriptionController.getPlans);

// Webhook do Mercado Pago (sem auth)
router.post('/webhook', webhookController.handleWebhook);

// Rotas autenticadas
router.post('/subscribe', authenticateToken, subscriptionController.subscribe);
router.get('/status', authenticateToken, subscriptionController.getStatus);
router.post('/cancel', authenticateToken, subscriptionController.cancel);
router.get('/history', authenticateToken, subscriptionController.getHistory);

module.exports = router;
