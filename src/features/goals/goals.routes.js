const express = require('express');
const router = express.Router();
const goalsController = require('./goals.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', goalsController.list);
router.post('/', goalsController.create);
router.put('/:id', goalsController.update);
router.delete('/:id', goalsController.delete);
router.post('/:id/transaction', goalsController.transaction);
router.get('/:id/history', goalsController.getHistory);

module.exports = router;
