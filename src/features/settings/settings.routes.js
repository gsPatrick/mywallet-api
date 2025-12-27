/**
 * Settings Routes
 * ========================================
 * API routes for user settings
 * ========================================
 */

const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// ========================================
// PROFILE
// ========================================

// GET /api/settings/profile - Get user profile
router.get('/profile', settingsController.getProfile);

// PUT /api/settings/profile - Update user profile
router.put('/profile', settingsController.updateProfile);

// PUT /api/settings/password - Change password
router.put('/password', settingsController.changePassword);

// ========================================
// DEVICES
// ========================================

// GET /api/settings/devices - List connected devices
router.get('/devices', settingsController.listDevices);

// DELETE /api/settings/devices/:id - Revoke device
router.delete('/devices/:id', settingsController.revokeDevice);

// ========================================
// NOTIFICATION PREFERENCES
// ========================================

// GET /api/settings/notifications - Get notification preferences
router.get('/notifications', settingsController.getNotificationPreferences);

// PUT /api/settings/notifications - Update notification preferences
router.put('/notifications', settingsController.updateNotificationPreferences);

// ========================================
// PRIVACY
// ========================================

// GET /api/settings/privacy - Get privacy settings
router.get('/privacy', settingsController.getPrivacySettings);

// PUT /api/settings/privacy - Update privacy settings
router.put('/privacy', settingsController.updatePrivacySettings);

// ========================================
// ACCOUNT DELETION
// ========================================

// DELETE /api/settings/account - Delete account (soft delete)
router.delete('/account', settingsController.deleteAccount);

// ========================================
// PLANS
// ========================================

// GET /api/settings/plan - Get plan info
router.get('/plan', settingsController.getPlanInfo);

// ========================================
// PAYMENT METHODS
// ========================================

// GET /api/settings/payment-methods - List payment methods
router.get('/payment-methods', settingsController.getPaymentMethods);

// POST /api/settings/payment-methods - Add payment method
router.post('/payment-methods', settingsController.addPaymentMethod);

// DELETE /api/settings/payment-methods/:id - Remove payment method
router.delete('/payment-methods/:id', settingsController.removePaymentMethod);

// PUT /api/settings/payment-methods/:id/default - Set default payment method
router.put('/payment-methods/:id/default', settingsController.setDefaultPaymentMethod);

// ========================================
// LGPD DATA EXPORT
// ========================================

// GET /api/settings/export-data - Export all user data
router.get('/export-data', settingsController.exportData);

module.exports = router;
