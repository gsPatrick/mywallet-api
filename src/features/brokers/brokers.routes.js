/**
 * Brokers Routes
 * ========================================
 * Rotas para gestão de corretoras
 */

const express = require('express');
const router = express.Router();
const brokersController = require('./brokers.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Rota pública - lista dicionário de corretoras disponíveis (usado no onboarding)
router.get('/available', brokersController.getAvailable);

// Rotas protegidas requerem autenticação
router.use(authMiddleware);

// CRUD (protegidas)
router.get('/', brokersController.list);
router.get('/:id', brokersController.getById);
router.post('/', brokersController.create);
router.post('/from-dictionary', brokersController.createFromDictionary);
router.put('/:id', brokersController.update);
router.delete('/:id', brokersController.remove);

module.exports = router;
