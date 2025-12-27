/**
 * Settings Service
 * ========================================
 * Gerencia configurações do usuário:
 * - Perfil
 * - Dispositivos/Sessões
 * - Preferências de Notificação
 * - Privacidade
 * - Planos
 * - Métodos de Pagamento
 * - Exportação LGPD
 * ========================================
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, UserSession, NotificationPreference, PaymentMethod, Profile, ManualTransaction, BankAccount, CreditCard, Goal, Budget, Category, Investment, Subscription } = require('../../models');
const { Op } = require('sequelize');

// Default notification types to initialize for new users
const DEFAULT_NOTIFICATION_TYPES = [
    'PAYMENT_REMINDERS',
    'INCOME_REMINDERS',
    'INVOICE_REMINDERS',
    'DIVIDENDS',
    'INVESTMENT_ALERTS',
    'GOALS',
    'BUDGET_ALERTS',
    'STREAK_ALERTS',
    'DAS_REMINDERS',
    'MARKETING',
    'SECURITY_ALERTS',
    'WHATSAPP_MIRROR'
];

// ========================================
// PROFILE
// ========================================

const getProfile = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');
    return user.toSafeObject();
};

const updateProfile = async (userId, data) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    const { name, email, cpf, phone, avatar } = data;

    if (name) user.name = name;
    if (email && email !== user.email) {
        // Check if email is unique
        const existing = await User.findOne({ where: { email } });
        if (existing) throw new Error('Este email já está em uso');
        user.email = email;
    }
    if (cpf !== undefined) user.cpf = cpf;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    return user.toSafeObject();
};

const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    const isValid = await user.checkPassword(currentPassword);
    if (!isValid) throw new Error('Senha atual incorreta');

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    return { message: 'Senha alterada com sucesso', passwordChangedAt: user.passwordChangedAt };
};

// ========================================
// DEVICES/SESSIONS
// ========================================

const createSession = async (userId, req, token) => {
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';

    // Parse user agent
    const deviceInfo = parseUserAgent(userAgent);

    // Create token hash for secure comparison
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await UserSession.create({
        userId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress,
        userAgent,
        token,
        tokenHash,
        lastActiveAt: new Date()
    });

    return session;
};

const parseUserAgent = (userAgent) => {
    let deviceType = 'desktop';
    let deviceName = 'Desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect OS
    if (/Windows/.test(userAgent)) os = 'Windows';
    else if (/Mac OS/.test(userAgent)) os = 'macOS';
    else if (/Linux/.test(userAgent)) os = 'Linux';
    else if (/Android/.test(userAgent)) os = 'Android';
    else if (/iPhone|iPad/.test(userAgent)) os = 'iOS';

    // Detect Browser
    if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) browser = 'Chrome';
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) browser = 'Safari';
    else if (/Firefox/.test(userAgent)) browser = 'Firefox';
    else if (/Edge/.test(userAgent)) browser = 'Edge';

    // Detect Device Type
    if (/Mobile|Android|iPhone/.test(userAgent)) {
        deviceType = 'mobile';
        if (/iPhone/.test(userAgent)) deviceName = 'iPhone';
        else if (/Android/.test(userAgent)) deviceName = 'Android';
        else deviceName = 'Mobile';
    } else if (/iPad|Tablet/.test(userAgent)) {
        deviceType = 'tablet';
        deviceName = 'Tablet';
    } else {
        deviceName = `${browser} on ${os}`;
    }

    return { deviceType, deviceName, browser, os };
};

const listDevices = async (userId, currentToken) => {
    const currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');

    const sessions = await UserSession.findAll({
        where: {
            userId,
            isRevoked: false
        },
        order: [['lastActiveAt', 'DESC']]
    });

    return sessions.map(session => ({
        id: session.id,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        browser: session.browser,
        os: session.os,
        ipAddress: session.ipAddress,
        lastActiveAt: session.lastActiveAt,
        isCurrent: session.tokenHash === currentTokenHash,
        createdAt: session.createdAt
    }));
};

const revokeDevice = async (userId, sessionId) => {
    const session = await UserSession.findOne({
        where: { id: sessionId, userId }
    });

    if (!session) throw new Error('Sessão não encontrada');

    session.isRevoked = true;
    session.revokedAt = new Date();
    await session.save();

    return { message: 'Dispositivo desconectado com sucesso' };
};

const updateSessionActivity = async (token) => {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await UserSession.update(
        { lastActiveAt: new Date() },
        { where: { tokenHash, isRevoked: false } }
    );
};

const isSessionRevoked = async (token) => {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await UserSession.findOne({
        where: { tokenHash }
    });

    return session?.isRevoked === true;
};

// ========================================
// NOTIFICATION PREFERENCES
// ========================================

const getNotificationPreferences = async (userId) => {
    let preferences = await NotificationPreference.findAll({
        where: { userId }
    });

    // Initialize default preferences if none exist
    if (preferences.length === 0) {
        preferences = await initializeNotificationPreferences(userId);
    }

    // Convert to object keyed by type
    const prefsMap = {};
    preferences.forEach(pref => {
        prefsMap[pref.notificationType] = {
            enabled: pref.enabled,
            emailEnabled: pref.emailEnabled,
            pushEnabled: pref.pushEnabled,
            whatsappEnabled: pref.whatsappEnabled
        };
    });

    return prefsMap;
};

const initializeNotificationPreferences = async (userId) => {
    const prefs = [];
    for (const type of DEFAULT_NOTIFICATION_TYPES) {
        const pref = await NotificationPreference.create({
            userId,
            notificationType: type,
            enabled: type !== 'MARKETING', // Disable marketing by default
            emailEnabled: true,
            pushEnabled: true,
            whatsappEnabled: type === 'WHATSAPP_MIRROR'
        });
        prefs.push(pref);
    }
    return prefs;
};

const updateNotificationPreference = async (userId, type, settings) => {
    let pref = await NotificationPreference.findOne({
        where: { userId, notificationType: type }
    });

    if (!pref) {
        // Create if doesn't exist
        pref = await NotificationPreference.create({
            userId,
            notificationType: type,
            ...settings
        });
    } else {
        // Update
        if (settings.enabled !== undefined) pref.enabled = settings.enabled;
        if (settings.emailEnabled !== undefined) pref.emailEnabled = settings.emailEnabled;
        if (settings.pushEnabled !== undefined) pref.pushEnabled = settings.pushEnabled;
        if (settings.whatsappEnabled !== undefined) pref.whatsappEnabled = settings.whatsappEnabled;
        await pref.save();
    }

    return pref;
};

const updateAllNotificationPreferences = async (userId, preferences) => {
    const results = [];
    for (const [type, settings] of Object.entries(preferences)) {
        const pref = await updateNotificationPreference(userId, type, settings);
        results.push(pref);
    }
    return results;
};

// ========================================
// PRIVACY
// ========================================

const getPrivacySettings = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    return {
        analytics: user.privacyAnalytics,
        cookies: user.privacyCookies
    };
};

const updatePrivacySettings = async (userId, settings) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    if (settings.analytics !== undefined) user.privacyAnalytics = settings.analytics;
    if (settings.cookies !== undefined) user.privacyCookies = settings.cookies;

    await user.save();

    return {
        analytics: user.privacyAnalytics,
        cookies: user.privacyCookies
    };
};

// ========================================
// ACCOUNT DELETION
// ========================================

const deleteAccount = async (userId, password, reason) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    // Verify password
    const isValid = await user.checkPassword(password);
    if (!isValid) throw new Error('Senha incorreta');

    // Soft delete
    user.deletedAt = new Date();
    user.deleteReason = reason;
    await user.save();

    // Revoke all sessions
    await UserSession.update(
        { isRevoked: true, revokedAt: new Date() },
        { where: { userId } }
    );

    return { message: 'Conta marcada para exclusão' };
};

// ========================================
// PLANS
// ========================================

const getPlanInfo = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    // Calculate days remaining
    let daysRemaining = null;
    if (user.subscriptionExpiresAt) {
        const now = new Date();
        const expDate = new Date(user.subscriptionExpiresAt);
        daysRemaining = Math.max(0, Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)));
    }

    // Get features based on plan
    const features = getPlanFeatures(user.plan);

    return {
        plan: user.plan,
        status: user.subscriptionStatus,
        subscriptionId: user.subscriptionId,
        expiresAt: user.subscriptionExpiresAt,
        daysRemaining,
        features,
        createdAt: user.createdAt
    };
};

const getPlanFeatures = (plan) => {
    const allFeatures = [
        { name: 'Contas ilimitadas', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Cartões ilimitados', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Investimentos', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Relatórios avançados', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'WhatsApp Bot', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Central do MEI (DAS)', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Metas financeiras', plans: ['FREE', 'MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Orçamentos inteligentes', plans: ['MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Suporte prioritário', plans: ['ANNUAL', 'LIFETIME', 'OWNER'] },
        { name: 'Acesso vitalício', plans: ['LIFETIME', 'OWNER'] },
        { name: 'Acesso total ao sistema', plans: ['OWNER'] }
    ];

    return allFeatures.map(f => ({
        name: f.name,
        included: f.plans.includes(plan)
    }));
};

// ========================================
// PAYMENT METHODS
// ========================================

const getPaymentMethods = async (userId) => {
    const methods = await PaymentMethod.findAll({
        where: { userId, isActive: true },
        order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });

    return methods.map(m => ({
        id: m.id,
        type: m.type,
        cardBrand: m.cardBrand,
        cardLastFour: m.cardLastFour,
        cardExpMonth: m.cardExpMonth,
        cardExpYear: m.cardExpYear,
        cardHolderName: m.cardHolderName,
        isDefault: m.isDefault,
        createdAt: m.createdAt
    }));
};

const addPaymentMethod = async (userId, data) => {
    // If setting as default, unset others first
    if (data.isDefault) {
        await PaymentMethod.update(
            { isDefault: false },
            { where: { userId } }
        );
    }

    const method = await PaymentMethod.create({
        userId,
        type: data.type || 'CREDIT_CARD',
        cardBrand: data.cardBrand,
        cardLastFour: data.cardLastFour,
        cardExpMonth: data.cardExpMonth,
        cardExpYear: data.cardExpYear,
        cardHolderName: data.cardHolderName,
        gatewayToken: data.gatewayToken,
        gatewayCustomerId: data.gatewayCustomerId,
        isDefault: data.isDefault || false
    });

    return method;
};

const removePaymentMethod = async (userId, methodId) => {
    const method = await PaymentMethod.findOne({
        where: { id: methodId, userId }
    });

    if (!method) throw new Error('Método de pagamento não encontrado');

    method.isActive = false;
    await method.save();

    return { message: 'Método de pagamento removido' };
};

const setDefaultPaymentMethod = async (userId, methodId) => {
    // Unset all others
    await PaymentMethod.update(
        { isDefault: false },
        { where: { userId } }
    );

    // Set new default
    const method = await PaymentMethod.findOne({
        where: { id: methodId, userId, isActive: true }
    });

    if (!method) throw new Error('Método de pagamento não encontrado');

    method.isDefault = true;
    await method.save();

    return method;
};

// ========================================
// LGPD DATA EXPORT
// ========================================

const exportUserData = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuário não encontrado');

    // Gather all user data
    const [
        profiles,
        transactions,
        bankAccounts,
        creditCards,
        goals,
        budgets,
        categories,
        investments,
        subscriptions,
        sessions,
        notificationPrefs,
        paymentMethods
    ] = await Promise.all([
        Profile.findAll({ where: { userId } }),
        ManualTransaction.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        BankAccount.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        CreditCard.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        Goal.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        Budget.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        Category.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        Investment.findAll({ where: { userId } }),
        Subscription.findAll({
            include: [{ model: Profile, as: 'profile', where: { userId } }]
        }),
        UserSession.findAll({ where: { userId }, attributes: { exclude: ['token', 'tokenHash'] } }),
        NotificationPreference.findAll({ where: { userId } }),
        PaymentMethod.findAll({ where: { userId }, attributes: { exclude: ['gatewayToken'] } })
    ]);

    return {
        exportDate: new Date().toISOString(),
        user: user.toSafeObject(),
        profiles: profiles.map(p => p.toJSON()),
        transactions: transactions.map(t => t.toJSON()),
        bankAccounts: bankAccounts.map(b => b.toJSON()),
        creditCards: creditCards.map(c => c.toJSON()),
        goals: goals.map(g => g.toJSON()),
        budgets: budgets.map(b => b.toJSON()),
        categories: categories.map(c => c.toJSON()),
        investments: investments.map(i => i.toJSON()),
        subscriptions: subscriptions.map(s => s.toJSON()),
        sessions: sessions.map(s => s.toJSON()),
        notificationPreferences: notificationPrefs.map(n => n.toJSON()),
        paymentMethods: paymentMethods.map(p => p.toJSON())
    };
};

module.exports = {
    // Profile
    getProfile,
    updateProfile,
    changePassword,
    // Devices
    createSession,
    listDevices,
    revokeDevice,
    updateSessionActivity,
    isSessionRevoked,
    // Notifications
    getNotificationPreferences,
    updateNotificationPreference,
    updateAllNotificationPreferences,
    // Privacy
    getPrivacySettings,
    updatePrivacySettings,
    // Account
    deleteAccount,
    // Plans
    getPlanInfo,
    getPlanFeatures,
    // Payment Methods
    getPaymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    // LGPD
    exportUserData
};
