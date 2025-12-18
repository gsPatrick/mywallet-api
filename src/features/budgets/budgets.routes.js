/**
 * Budgets Routes
 */

const { Router } = require('express');
const budgetsController = require('./budgets.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { validate } = require('../../utils/validators');

const router = Router();

router.use(authMiddleware);

const createSchema = {
    body: {
        month: { required: true, min: 1, max: 12 },
        year: { required: true, min: 2020, max: 2100 },
        incomeExpected: { required: true, min: 0 }
    }
};

// Budget endpoints
router.get('/', budgetsController.listBudgets);
router.get('/current', budgetsController.getCurrentBudget);
router.post('/', validate(createSchema), budgetsController.createBudget);
router.put('/:id', budgetsController.updateBudget);

// Budget Allocations endpoints
router.get('/allocations/current', budgetsController.getCurrentAllocations);
router.get('/allocations', budgetsController.getAllocations);
router.post('/allocations', budgetsController.createAllocations);

module.exports = router;

