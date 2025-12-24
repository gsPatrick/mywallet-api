/**
 * Brokers Routes
 * ========================================
 * Rotas para gestão de corretoras
 */

const express = require('express');
const router = express.Router();
const brokersController = require('./brokers.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar corretoras disponíveis no dicionário (antes das rotas com :id)
router.get('/available', brokersController.getAvailable);

// CRUD
router.get('/', brokersController.list);
router.get('/:id', brokersController.getById);
router.post('/', brokersController.create);
router.post('/from-dictionary', brokersController.createFromDictionary);
router.put('/:id', brokersController.update);
router.delete('/:id', brokersController.remove);

module.exports = router;
