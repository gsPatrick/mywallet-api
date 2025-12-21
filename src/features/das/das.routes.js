/**
 * DAS Routes
 * ========================================
 * CENTRAL DO DAS - Rotas
 * ========================================
 */

const express = require('express');
const router = express.Router();
const dasController = require('./das.controller');
const { authenticateToken } = require('../../middlewares/auth');

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Gerar guias do ano
router.post('/generate', dasController.generateGuides);

// Listar guias de um ano
router.get('/guides/:year', dasController.listGuides);

// Pagar uma guia
router.post('/pay/:guideId', dasController.payGuide);

// Resumo para dashboard
router.get('/summary', dasController.getSummary);

// Garantir guias do ano atual
router.post('/ensure', dasController.ensureGuides);

module.exports = router;
