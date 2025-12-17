const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/portfolio', reportsController.getPortfolio);
router.get('/evolution', reportsController.getEvolution);
router.get('/dividends', reportsController.getDividends);

// Statement (Extrato Financeiro)
router.get('/statement', reportsController.getStatement);
router.get('/statement/years', reportsController.getStatementYears);

module.exports = router;

