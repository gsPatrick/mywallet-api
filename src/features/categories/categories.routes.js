/**
 * Categories Routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');
const categoriesController = require('./categories.controller');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// CRUD
router.get('/', categoriesController.list);
router.post('/', categoriesController.create);
router.put('/:id', categoriesController.update);
router.delete('/:id', categoriesController.remove);

module.exports = router;
