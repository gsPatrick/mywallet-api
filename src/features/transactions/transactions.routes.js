/**
 * Transactions Routes
 * ========================================
 * ✅ PROFILE ISOLATION: Now uses profileMiddleware
 * ========================================
 */

const { Router } = require('express');
const transactionsController = require('./transactions.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { profileMiddleware } = require('../../middlewares/profileMiddleware');
const { auditLogger } = require('../../middlewares/auditLogger');
const { validate } = require('../../utils/validators');

const router = Router();

// ✅ Auth first, then profile isolation
router.use(authMiddleware);
router.use(profileMiddleware);

// Schemas de validação
const createTransactionSchema = {
    body: {
        type: { required: true, enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
        description: { required: true, minLength: 1 },
        amount: { required: true, min: 0.01 },
        date: { required: true, type: 'date' }
    }
};

// Rotas - all now have profileId via middleware
router.get('/categories', transactionsController.listCategories);
router.get('/', transactionsController.listTransactions);
router.post('/manual', validate(createTransactionSchema), auditLogger('TRANSACTION'), transactionsController.createManualTransaction);
router.put('/:id', auditLogger('TRANSACTION'), transactionsController.updateTransaction);
router.delete('/:id', auditLogger('TRANSACTION'), transactionsController.deleteTransaction);
router.put('/:id/metadata', auditLogger('TRANSACTION_METADATA'), transactionsController.updateMetadata);

module.exports = router;
