/**
 * Manual Card Routes
 * ========================================
 * ✅ PROFILE ISOLATION: Now uses profileMiddleware
 * ========================================
 */

const { Router } = require('express');
const manualCardController = require('./manualCard.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { profileMiddleware } = require('../../middlewares/profileMiddleware');
const { validate } = require('../../utils/validators');

const router = Router();

// ✅ Auth first, then profile isolation
router.use(authMiddleware);
router.use(profileMiddleware);

// Schemas de validação
const createCardSchema = {
    body: {
        name: { required: true, minLength: 1 },
        bankName: { required: true, minLength: 1 }
    }
};

const createTransactionSchema = {
    body: {
        description: { required: true, minLength: 1 },
        amount: { required: true, min: 0.01 },
        date: { required: true, type: 'date' }
    }
};

// ===========================================
// ROTAS DE CARTÕES
// ===========================================
router.get('/', manualCardController.listCards);
router.post('/', validate(createCardSchema), manualCardController.createCard);
router.put('/:id', manualCardController.updateCard);
router.delete('/:id', manualCardController.deactivateCard);

// ===========================================
// ROTAS DE TRANSAÇÕES
// ===========================================
router.get('/:cardId/transactions', manualCardController.listTransactions);
router.post('/:cardId/transactions', validate(createTransactionSchema), manualCardController.createTransaction);
router.put('/transactions/:transactionId', manualCardController.updateTransaction);
router.delete('/transactions/:transactionId', manualCardController.deleteTransaction);
router.delete('/installments/:groupId', manualCardController.deleteInstallmentGroup);

// ===========================================
// FATURA
// ===========================================
router.get('/:cardId/statement', manualCardController.getStatement);

module.exports = router;
