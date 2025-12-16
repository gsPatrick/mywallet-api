/**
 * Notifications Routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middlewares/authMiddleware');
const notificationsController = require('./notifications.controller');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar notificações
router.get('/', notificationsController.list);

// Notificações pendentes (para popup)
router.get('/pending', notificationsController.getPending);

// Verificar e criar notificações
router.post('/check', notificationsController.check);

// Marcar como exibida
router.put('/:id/displayed', notificationsController.markDisplayed);

// Marcar como lida
router.put('/:id/read', notificationsController.markRead);

module.exports = router;
