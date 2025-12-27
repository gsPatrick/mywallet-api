/**
 * Settings Controller
 * ========================================
 * HTTP handlers for settings endpoints
 * ========================================
 */

const settingsService = require('./settings.service');

// ========================================
// PROFILE
// ========================================

const getProfile = async (req, res, next) => {
    try {
        const profile = await settingsService.getProfile(req.userId);
        res.json({ data: profile });
    } catch (error) {
        next(error);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const profile = await settingsService.updateProfile(req.userId, req.body);
        res.json({
            message: 'Perfil atualizado com sucesso',
            data: profile
        });
    } catch (error) {
        next(error);
    }
};

const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
        }

        const result = await settingsService.changePassword(req.userId, currentPassword, newPassword);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ========================================
// DEVICES
// ========================================

const listDevices = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const devices = await settingsService.listDevices(req.userId, token);
        res.json({ data: devices });
    } catch (error) {
        next(error);
    }
};

const revokeDevice = async (req, res, next) => {
    try {
        const result = await settingsService.revokeDevice(req.userId, req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ========================================
// NOTIFICATION PREFERENCES
// ========================================

const getNotificationPreferences = async (req, res, next) => {
    try {
        const prefs = await settingsService.getNotificationPreferences(req.userId);
        res.json({ data: prefs });
    } catch (error) {
        next(error);
    }
};

const updateNotificationPreferences = async (req, res, next) => {
    try {
        const result = await settingsService.updateAllNotificationPreferences(req.userId, req.body);
        res.json({
            message: 'Preferências atualizadas',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

// ========================================
// PRIVACY
// ========================================

const getPrivacySettings = async (req, res, next) => {
    try {
        const settings = await settingsService.getPrivacySettings(req.userId);
        res.json({ data: settings });
    } catch (error) {
        next(error);
    }
};

const updatePrivacySettings = async (req, res, next) => {
    try {
        const settings = await settingsService.updatePrivacySettings(req.userId, req.body);
        res.json({
            message: 'Preferências de privacidade atualizadas',
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

// ========================================
// ACCOUNT DELETION
// ========================================

const deleteAccount = async (req, res, next) => {
    try {
        const { password, reason } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Senha é obrigatória para confirmar exclusão' });
        }

        const result = await settingsService.deleteAccount(req.userId, password, reason);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

// ========================================
// PLANS
// ========================================

const getPlanInfo = async (req, res, next) => {
    try {
        const planInfo = await settingsService.getPlanInfo(req.userId);
        res.json({ data: planInfo });
    } catch (error) {
        next(error);
    }
};

// ========================================
// PAYMENT METHODS
// ========================================

const getPaymentMethods = async (req, res, next) => {
    try {
        const methods = await settingsService.getPaymentMethods(req.userId);
        res.json({ data: methods });
    } catch (error) {
        next(error);
    }
};

const addPaymentMethod = async (req, res, next) => {
    try {
        const method = await settingsService.addPaymentMethod(req.userId, req.body);
        res.status(201).json({
            message: 'Método de pagamento adicionado',
            data: method
        });
    } catch (error) {
        next(error);
    }
};

const removePaymentMethod = async (req, res, next) => {
    try {
        const result = await settingsService.removePaymentMethod(req.userId, req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const setDefaultPaymentMethod = async (req, res, next) => {
    try {
        const method = await settingsService.setDefaultPaymentMethod(req.userId, req.params.id);
        res.json({
            message: 'Método de pagamento padrão definido',
            data: method
        });
    } catch (error) {
        next(error);
    }
};

// ========================================
// LGPD DATA EXPORT
// ========================================

const exportData = async (req, res, next) => {
    try {
        const data = await settingsService.exportUserData(req.userId);

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="mywallet-data-export-${Date.now()}.json"`);

        res.json(data);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    // Profile
    getProfile,
    updateProfile,
    changePassword,
    // Devices
    listDevices,
    revokeDevice,
    // Notifications
    getNotificationPreferences,
    updateNotificationPreferences,
    // Privacy
    getPrivacySettings,
    updatePrivacySettings,
    // Account
    deleteAccount,
    // Plans
    getPlanInfo,
    // Payment Methods
    getPaymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    // LGPD
    exportData
};
