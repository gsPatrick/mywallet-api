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

        const result = await authService.register({ name, email, password, salary, salaryDay });

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
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const ipAddress = getClientIp(req);
        const userAgent = req.get('User-Agent') || 'unknown';

        const result = await authService.login({ email, password, ipAddress, userAgent });

        // --- GATILHO DE DIVIDENDOS (Fire and Forget) ---
        // Não usamos 'await' aqui propositalmente para o login ser rápido
        dividendsService.syncUserDividends(result.user.id)
            .catch(err => console.error('Erro no sync de dividendos em background:', err));
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
        const { name } = req.body;

        const user = await authService.updateUser(req.userId, { name });

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

module.exports = {
    register,
    login,
    refresh,
    getMe,
    updateMe,
    changePassword,
    completeOnboarding
};
