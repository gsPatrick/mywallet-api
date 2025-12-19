/**
 * Dashboard Routes
 * ========================================
 * ✅ PROFILE ISOLATION: Now uses profileMiddleware
 * ========================================
 */

const { Router } = require('express');
const dashboardController = require('./dashboard.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { profileMiddleware } = require('../../middlewares/profileMiddleware');

const router = Router();

// ✅ Auth first, then profile isolation
router.use(authMiddleware);
router.use(profileMiddleware);

router.get('/summary', dashboardController.getSummary);
router.get('/alerts', dashboardController.getAlerts);
router.get('/categories', dashboardController.getCategoryBreakdown);
router.get('/activities', dashboardController.getActivities);
router.get('/recent-transactions', dashboardController.getRecentTransactions);

module.exports = router;
