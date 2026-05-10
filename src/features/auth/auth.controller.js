/**
 * Auth Controller
 * Handlers para rotas de autenticação
 */

const authService = require('./auth.service');
const { getClientIp } = require('../../middlewares/auditLogger');
const dividendsService = require('../investments/dividends.service');

/**
 * POST /auth/register
 * Registra um novo usuário
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password, salary, salaryDay } = req.body;

        const result = await authService.register({ name, email, password, salary, salaryDay }, req);

        res.status(201).json({
            message: 'Usuário registrado com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/login
 * Realiza login
 * ========================================
 * ✅ TRIGGERS: Dividendos + Assinaturas pendentes
 * ========================================
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const ipAddress = getClientIp(req);
        const userAgent = req.get('User-Agent') || 'unknown';

        const result = await authService.login({ email, password, ipAddress, userAgent }, req);

        // --- GATILHOS EM BACKGROUND (Fire and Forget) ---
        // Não usamos 'await' para o login ser rápido

        // 1. Sync de dividendos
        dividendsService.syncUserDividends(result.user.id)
            .catch(err => console.error('❌ [LOGIN] Erro sync dividendos:', err));

        // 2. ✅ Gerar transações de assinaturas vencidas (DAS, salário, etc)
        const subscriptionService = require('../subscription/subscription.service');
        subscriptionService.generatePendingTransactions(result.user.id, null) // null = todos os perfis
            .then(res => {
                if (res.generated > 0) {
                    console.log(`📦 [LOGIN] ${res.generated} transações de assinaturas geradas`);
                }
            })
            .catch(err => console.error('❌ [LOGIN] Erro gerando assinaturas:', err));
        // ------------------------------------------------

        res.json({
            message: 'Login realizado com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/refresh
 * Atualiza tokens
 */
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token é obrigatório',
                code: 'MISSING_REFRESH_TOKEN'
            });
        }

        const tokens = await authService.refreshTokens(refreshToken);

        res.json({
            message: 'Tokens atualizados com sucesso',
            data: tokens
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /auth/me
 * Retorna dados do usuário autenticado
 */
const getMe = async (req, res, next) => {
    try {
        const user = await authService.getMe(req.userId);

        res.json({
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /auth/me
 * Atualiza dados do usuário
 */
const updateMe = async (req, res, next) => {
    try {
        const { name, avatar } = req.body;

        const user = await authService.updateUser(req.userId, { name, avatar });

        res.json({
            message: 'Dados atualizados com sucesso',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/change-password
 * Altera senha do usuário
 */
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const result = await authService.changePassword(req.userId, {
            currentPassword,
            newPassword
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /auth/onboarding-complete
 * Marca onboarding como completo
 */
const completeOnboarding = async (req, res, next) => {
    try {
        const result = await authService.completeOnboarding(req.userId);

        res.json({
            message: 'Onboarding completo',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /auth/onboarding-config
 * Salva configurações do onboarding (saldo inicial, salário, etc)
 */
const saveOnboardingConfig = async (req, res, next) => {
    try {
        const { initialBalance, salary, salaryDay, salaryDescription } = req.body;

        const result = await authService.saveOnboardingConfig(req.userId, {
            initialBalance,
            salary,
            salaryDay,
            salaryDescription
        });

        res.json({
            message: 'Configurações salvas com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /auth/salary
 * Atualiza configuração de salário
 */
const updateSalary = async (req, res, next) => {
    try {
        const { salary, salaryDay, salaryDescription } = req.body;

        const result = await authService.updateSalary(req.userId, {
            salary,
            salaryDay,
            salaryDescription
        });

        res.json({
            message: 'Salário atualizado com sucesso',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/forgot-password
 * Solicita recuperação de senha
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const result = await authService.forgotPassword(email);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/verify-otp
 * Verifica validade do código
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        const result = await authService.verifyOTP(email, otp);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/reset-password
 * Redefine senha com código
 */
const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;
        const result = await authService.resetPassword(email, otp, newPassword);
        res.json(result);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    refresh,
    getMe,
    updateMe,
    changePassword,
    completeOnboarding,
    saveOnboardingConfig,
    updateSalary,
    forgotPassword,
    verifyOTP,
    resetPassword
};
