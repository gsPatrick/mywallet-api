/**
 * Admin Routes
 * ========================================
 */

const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { requireOwner } = require('../../middlewares/subscriptionMiddleware');

// Todas as rotas admin requerem autenticação + OWNER
router.use(authMiddleware);
router.use(requireOwner);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Gestão de usuários
router.get('/users', adminController.getUsers);
router.post('/users/create', adminController.createUser);
router.post('/users/:id/grant', adminController.grantPlan);
router.post('/users/:id/revoke', adminController.revokePlan);

module.exports = router;

