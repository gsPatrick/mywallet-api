/**
 * Auth Service
 * Lógica de negócio para autenticação
 */

const { User, AuditLog } = require('../../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../config/jwt');
const { logger } = require('../../config/logger');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Registra um novo usuário
 */
const register = async ({ name, email, password }) => {
    // Verificar se email já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        throw new AppError('Este email já está em uso', 409, 'EMAIL_IN_USE');
    }

    // Criar usuário
    const user = await User.create({
        name,
        email,
        password
    });

    // Log de auditoria
    await AuditLog.log({
        userId: user.id,
        action: AuditLog.ACTIONS.USER_REGISTER,
        resource: 'USER',
        resourceId: user.id,
        details: { email }
    });

    logger.info(`Novo usuário registrado: ${email}`);

    // Gerar tokens
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
    };
};

/**
 * Realiza login
 */
const login = async ({ email, password, ipAddress, userAgent }) => {
    // Buscar usuário
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Verificar senha
    const isValidPassword = await user.checkPassword(password);
    if (!isValidPassword) {
        throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Log de auditoria
    await AuditLog.log({
        userId: user.id,
        action: AuditLog.ACTIONS.USER_LOGIN,
        resource: 'USER',
        resourceId: user.id,
        details: { email },
        ipAddress,
        userAgent
    });

    logger.info(`Login realizado: ${email}`);

    // Gerar tokens
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
    };
};

/**
 * Atualiza tokens usando refresh token
 */
const refreshTokens = async (refreshToken) => {
    // Verificar refresh token
    let decoded;
    try {
        decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
        throw new AppError('Refresh token inválido ou expirado', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Buscar usuário
    const user = await User.findByPk(decoded.userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 401, 'USER_NOT_FOUND');
    }

    // Gerar novos tokens
    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
    };
};

/**
 * Obtém dados do usuário autenticado
 */
const getMe = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    return user.toSafeObject();
};

/**
 * Atualiza dados do usuário
 */
const updateUser = async (userId, { name }) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    if (name) {
        user.name = name;
    }

    await user.save();

    return user.toSafeObject();
};

/**
 * Altera senha do usuário
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    // Verificar senha atual
    const isValidPassword = await user.checkPassword(currentPassword);
    if (!isValidPassword) {
        throw new AppError('Senha atual incorreta', 401, 'INVALID_PASSWORD');
    }

    // Atualizar senha
    user.password = newPassword;
    await user.save();

    // Log de auditoria
    await AuditLog.log({
        userId: user.id,
        action: AuditLog.ACTIONS.PASSWORD_CHANGE,
        resource: 'USER',
        resourceId: user.id
    });

    logger.info(`Senha alterada: ${user.email}`);

    return { message: 'Senha alterada com sucesso' };
};

/**
 * Marca onboarding como completo
 */
const completeOnboarding = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    user.onboardingComplete = true;
    await user.save();

    logger.info(`Onboarding completo: ${user.email}`);

    return { onboardingComplete: true };
};

module.exports = {
    register,
    login,
    refreshTokens,
    getMe,
    updateUser,
    changePassword,
    completeOnboarding
};
