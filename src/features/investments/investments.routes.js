/**
 * Investments Routes
 * ========================================
 * ✅ PROFILE ISOLATION: Now uses profileMiddleware
 * ========================================
 */

const { Router } = require('express');
const investmentsController = require('./investments.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { profileMiddleware } = require('../../middlewares/profileMiddleware');
const { validate } = require('../../utils/validators');

const router = Router();

// ✅ Auth first, then profile isolation
router.use(authMiddleware);
router.use(profileMiddleware);

const createSchema = {
    body: {
        ticker: { required: true },
        operationType: { required: true, enum: ['BUY', 'SELL'] },
        quantity: { required: true, min: 0.00000001 },
        price: { required: true, min: 0.01 },
        date: { required: true, type: 'date' }
    }
};

router.get('/', investmentsController.listInvestments);
router.post('/', validate(createSchema), investmentsController.createInvestment);
router.get('/portfolio', investmentsController.getPortfolio);
router.get('/assets', investmentsController.listAssets);
router.get('/dividends', investmentsController.listDividends);
router.get('/evolution', investmentsController.getPortfolioEvolution);

module.exports = router;
