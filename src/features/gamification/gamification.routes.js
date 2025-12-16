/**
 * Gamification Routes
 */

const express = require('express');
const router = express.Router();
const controller = require('./gamification.controller');
const authMiddleware = require('../../middlewares/auth');

// All routes require authentication
router.use(authMiddleware);

// Profile
router.get('/profile', controller.getProfile);
router.put('/profile', controller.updateProfile);
router.put('/password', controller.changePassword);

// Stats
router.get('/stats', controller.getStats);

// Medals
router.get('/medals', controller.getMedals);
router.post('/medals/check', controller.checkMedals);
router.get('/medals/new', controller.getNewMedals);
router.post('/medals/:medalId/notify', controller.markMedalNotified);

// Activity
router.post('/activity', controller.registerActivity);

module.exports = router;
