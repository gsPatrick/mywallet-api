/**
 * Cards Routes
 */

const { Router } = require('express');
const cardsController = require('./cards.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

const router = Router();

router.use(authMiddleware);

router.get('/', cardsController.listCards);
router.get('/:id', cardsController.getCard);
router.get('/:id/transactions', cardsController.getCardTransactions);

module.exports = router;
