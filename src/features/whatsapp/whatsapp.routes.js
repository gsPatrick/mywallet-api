/**
 * WhatsApp Routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');
const whatsappController = require('./whatsapp.controller');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// POST /api/whatsapp/connect - Inicia conexão e retorna QR Code
router.post('/connect', whatsappController.connect);

// GET /api/whatsapp/status - Status da conexão
router.get('/status', whatsappController.getStatus);

// POST /api/whatsapp/disconnect - Desconecta
router.post('/disconnect', whatsappController.disconnect);

module.exports = router;
