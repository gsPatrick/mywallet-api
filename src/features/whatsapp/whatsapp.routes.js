/**
 * WhatsApp Routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');
const whatsappController = require('./whatsapp.controller');
const internalChatController = require('./internalChat.controller');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// POST /api/whatsapp/connect - Inicia conexão e retorna QR Code
router.post('/connect', whatsappController.connect);

// GET /api/whatsapp/status - Status da conexão
router.get('/status', whatsappController.getStatus);

// POST /api/whatsapp/disconnect - Desconecta
router.post('/disconnect', whatsappController.disconnect);

// POST /api/whatsapp/process-text - Process text for internal chat (same logic as WhatsApp bot)
router.post('/process-text', internalChatController.processMessage);

module.exports = router;
