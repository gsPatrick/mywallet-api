/**
 * Dashboard Routes
 */

const { Router } = require('express');
const dashboardController = require('./dashboard.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

const router = Router();

router.use(authMiddleware);

router.get('/summary', dashboardController.getSummary);
router.get('/alerts', dashboardController.getAlerts);
router.get('/categories', dashboardController.getCategoryBreakdown);

module.exports = router;
