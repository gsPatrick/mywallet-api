/**
 * Subscription Routes
 */

const { Router } = require('express');
const subscriptionController = require('./subscription.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { validate } = require('../../utils/validators');

const router = Router();

router.use(authMiddleware);

const createSchema = {
    body: {
        name: { required: true, minLength: 1 },
        amount: { required: true, min: 0.01 },
        startDate: { required: true, type: 'date' }
    }
};

// CRUD
router.get('/', subscriptionController.listSubscriptions);
router.post('/', validate(createSchema), subscriptionController.createSubscription);
router.put('/:id', subscriptionController.updateSubscription);
router.delete('/:id', subscriptionController.cancelSubscription);

// Análises
router.get('/summary', subscriptionController.getSummary);
router.get('/upcoming', subscriptionController.getUpcoming);
router.get('/alerts', subscriptionController.getAlerts);

// Geração automática
router.post('/generate', subscriptionController.generateTransactions);

module.exports = router;
