/**
 * Auth Service
 * Lógica de negócio para autenticação
 */

const { User, AuditLog } = require('../../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../config/jwt');
const { logger } = require('../../config/logger');
const { AppError } = require('../../middlewares/errorHandler');

// Lazy import to avoid circular dependency
let settingsService = null;
const getSettingsService = () => {
    if (!settingsService) {
        settingsService = require('../settings/settings.service');
    }
    return settingsService;
};

/**
 * Registra um novo usuário
 */
const register = async ({ name, email, password, salary, salaryDay }, req = null) => {
    // Verificar se email já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        throw new AppError('Este email já está em uso', 409, 'EMAIL_IN_USE');
    }

    // Criar usuário
    const user = await User.create({
        name,
        email,
        password,
        salary: salary || null,
        salaryDay: salaryDay || null
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

    // Create session for device tracking
    if (req) {
        try {
            await getSettingsService().createSession(user.id, req, accessToken);
        } catch (error) {
            logger.warn(`Failed to create session for new user: ${error.message}`);
        }
    }

    return {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
    };
};

/**
 * Realiza login
 */
const login = async ({ email, password, ipAddress, userAgent }, req = null) => {
    // Buscar usuário
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Check if account is deleted
    if (user.deletedAt) {
        throw new AppError('Esta conta foi desativada', 401, 'ACCOUNT_DELETED');
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

    // Create session for device tracking
    if (req) {
        try {
            await getSettingsService().createSession(user.id, req, accessToken);
        } catch (error) {
            logger.warn(`Failed to create session: ${error.message}`);
        }
    }

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

/**
 * Salva configurações do onboarding (saldo inicial, salário, etc)
 * - Cria transação de saldo inicial
 * - Salário tem descrição fixa
 */
const saveOnboardingConfig = async (userId, { initialBalance, salary, salaryDay }) => {
    const { ManualTransaction } = require('../../models');

    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    // Atualizar campos do usuário
    if (initialBalance !== undefined) user.initialBalance = initialBalance;
    if (salary !== undefined) user.salary = salary;
    if (salaryDay !== undefined) user.salaryDay = salaryDay;
    user.salaryDescription = 'Salário'; // Descrição fixa

    await user.save();

    // Criar transação de saldo inicial se valor > 0
    if (initialBalance && parseFloat(initialBalance) > 0) {
        await ManualTransaction.create({
            userId,
            type: 'INCOME',
            source: 'OTHER',
            description: 'Saldo Inicial',
            amount: parseFloat(initialBalance),
            date: new Date()
        });

        logger.info(`Transação de saldo inicial criada: R$ ${initialBalance}`);
    }

    logger.info(`Onboarding config salva: ${user.email}`);

    return {
        initialBalance: user.initialBalance,
        salary: user.salary,
        salaryDay: user.salaryDay,
        salaryDescription: user.salaryDescription
    };
};

/**
 * Atualiza configuração de salário
 */
const updateSalary = async (userId, { salary, salaryDay, salaryDescription }) => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    }

    // Atualizar campos
    if (salary !== undefined) user.salary = salary;
    if (salaryDay !== undefined) user.salaryDay = salaryDay;
    if (salaryDescription !== undefined) user.salaryDescription = salaryDescription;

    await user.save();

    // Log de auditoria
    await AuditLog.log({
        userId: user.id,
        action: 'SALARY_UPDATE',
        resource: 'USER',
        resourceId: user.id,
        details: { salary, salaryDay, salaryDescription }
    });

    logger.info(`Salário atualizado: ${user.email}`);

    return {
        salary: user.salary,
        salaryDay: user.salaryDay,
        salaryDescription: user.salaryDescription
    };
};

module.exports = {
    register,
    login,
    refreshTokens,
    getMe,
    updateUser,
    changePassword,
    completeOnboarding,
    saveOnboardingConfig,
    updateSalary
};
