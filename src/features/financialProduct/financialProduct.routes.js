/**
 * Financial Products Routes
 */

const { Router } = require('express');
const financialProductController = require('./financialProduct.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { validate } = require('../../utils/validators');

const router = Router();

router.use(authMiddleware);

const createSchema = {
    body: {
        type: { required: true },
        name: { required: true, minLength: 1 },
        investedAmount: { required: true, min: 0.01 },
        purchaseDate: { required: true, type: 'date' }
    }
};

// CRUD
router.get('/', financialProductController.listProducts);
router.post('/', validate(createSchema), financialProductController.createProduct);
router.put('/:id', financialProductController.updateProduct);

// Atualização de valor
router.patch('/:id/value', financialProductController.updateValue);

// Resgate
router.post('/:id/redeem', financialProductController.redeemProduct);

// Resumo e alertas
router.get('/summary', financialProductController.getSummary);
router.get('/alerts', financialProductController.getAlerts);

module.exports = router;
