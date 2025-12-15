/**
 * Investment Dashboard Routes
 * Dashboard EXCLUSIVO para investimentos
 */

const { Router } = require('express');
const investmentDashboardController = require('./investmentDashboard.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Resumo e métricas principais
router.get('/summary', investmentDashboardController.getSummary);

// Performance
router.get('/performance/assets', investmentDashboardController.getPerformanceByAsset);
router.get('/performance/classes', investmentDashboardController.getPerformanceByClass);

// Alocação e rebalanceamento
router.get('/allocation', investmentDashboardController.getAllocation);

// Evolução histórica
router.get('/evolution', investmentDashboardController.getEvolution);

// Proventos
router.get('/dividends', investmentDashboardController.getDividends);
router.get('/dividends/by-asset', investmentDashboardController.getDividendsByAsset);

// Alertas
router.get('/alerts', investmentDashboardController.getAlerts);

module.exports = router;
