/**
 * Bank Accounts Routes
 * ========================================
 * API routes for bank account management
 * ========================================
 */

const express = require('express');
const router = express.Router();
const bankAccountsController = require('./bankAccounts.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Balance endpoints (must come before :id routes)
router.get('/balance/total', bankAccountsController.getTotalBalance);
router.get('/balance/breakdown', bankAccountsController.getBalanceBreakdown);

// Default account endpoints
router.get('/default', bankAccountsController.getDefault);
router.post('/ensure-wallet', bankAccountsController.ensureWallet);

// CRUD endpoints
router.post('/', bankAccountsController.create);
router.get('/', bankAccountsController.list);
router.get('/:id', bankAccountsController.get);
router.put('/:id', bankAccountsController.update);
router.put('/:id/set-default', bankAccountsController.setDefault);
router.delete('/:id', bankAccountsController.remove);

module.exports = router;

