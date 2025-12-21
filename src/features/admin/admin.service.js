/**
 * Admin Service
 * ========================================
 * LÓGICA DO PAINEL ADMINISTRATIVO
 * ========================================
 */

const { User, PaymentHistory } = require('../../models');
const { Op, Sequelize } = require('sequelize');

/**
 * Retorna métricas do dashboard administrativo
 */
const getDashboard = async () => {
    // Total de usuários
    const totalUsers = await User.count();

    // Usuários ativos (subscription ACTIVE)
    const activeUsers = await User.count({
        where: { subscriptionStatus: 'ACTIVE' }
    });

    // Usuários por plano
    const usersByPlan = await User.findAll({
        attributes: [
            'plan',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        group: ['plan']
    });

    // Total faturado (soma de todos os pagamentos aprovados)
    const totalRevenue = await PaymentHistory.sum('amount', {
        where: { status: 'APPROVED' }
    }) || 0;

    // Faturamento do mês atual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = await PaymentHistory.sum('amount', {
        where: {
            status: 'APPROVED',
            paidAt: { [Op.gte]: startOfMonth }
        }
    }) || 0;

    // MRR (Monthly Recurring Revenue)
    // Soma dos mensais + anuais/12
    const monthlyCount = await User.count({
        where: { plan: 'MONTHLY', subscriptionStatus: 'ACTIVE' }
    });
    const annualCount = await User.count({
        where: { plan: 'ANNUAL', subscriptionStatus: 'ACTIVE' }
    });

    const mrr = (monthlyCount * 29.90) + (annualCount * 297.00 / 12);

    // Novos usuários este mês
    const newUsersThisMonth = await User.count({
        where: {
            createdAt: { [Op.gte]: startOfMonth }
        }
    });

    // Cancelamentos este mês
    const cancelledThisMonth = await User.count({
        where: {
            subscriptionStatus: 'CANCELLED',
            updatedAt: { [Op.gte]: startOfMonth }
        }
    });

    return {
        totalUsers,
        activeUsers,
        usersByPlan: usersByPlan.reduce((acc, item) => {
            acc[item.plan] = parseInt(item.dataValues.count);
            return acc;
        }, {}),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
        mrr: parseFloat(mrr.toFixed(2)),
        newUsersThisMonth,
        cancelledThisMonth,
        churnRate: activeUsers > 0 ? parseFloat(((cancelledThisMonth / activeUsers) * 100).toFixed(2)) : 0
    };
};

/**
 * Lista usuários com paginação e filtros
 */
const getUsers = async (options = {}) => {
    const {
        page = 1,
        limit = 20,
        search = '',
        plan = '',
        status = ''
    } = options;

    const where = {};

    if (search) {
        where[Op.or] = [
            { name: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } }
        ];
    }

    if (plan) {
        where.plan = plan;
    }

    if (status) {
        where.subscriptionStatus = status;
    }

    const { rows, count } = await User.findAndCountAll({
        where,
        attributes: [
            'id', 'name', 'email', 'plan', 'subscriptionStatus',
            'subscriptionExpiresAt', 'createdAt', 'avatar'
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    return {
        users: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit)
    };
};

/**
 * Concede plano a um usuário (bypass payment)
 */
const grantPlan = async (userId, planType, expiresAt = null) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new Error('Usuário não encontrado');
    }

    const validPlans = ['FREE', 'MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'];
    if (!validPlans.includes(planType)) {
        throw new Error('Plano inválido');
    }

    // Calcular expiração se não fornecida
    let calculatedExpires = expiresAt;
    if (!expiresAt && planType !== 'FREE' && planType !== 'LIFETIME' && planType !== 'OWNER') {
        const now = new Date();
        if (planType === 'MONTHLY') {
            calculatedExpires = new Date(now.setMonth(now.getMonth() + 1));
        } else if (planType === 'ANNUAL') {
            calculatedExpires = new Date(now.setFullYear(now.getFullYear() + 1));
        }
    }

    await User.update({
        plan: planType,
        subscriptionStatus: planType === 'FREE' ? 'INACTIVE' : 'ACTIVE',
        subscriptionExpiresAt: calculatedExpires
    }, {
        where: { id: userId }
    });

    // Criar registro no histórico (como admin grant)
    if (planType !== 'FREE') {
        await PaymentHistory.create({
            userId,
            amount: 0,
            status: 'APPROVED',
            method: 'admin_grant',
            planType: planType === 'OWNER' ? 'LIFETIME' : planType,
            mpPaymentId: `admin_${Date.now()}`,
            paidAt: new Date()
        });
    }

    return await User.findByPk(userId, {
        attributes: ['id', 'name', 'email', 'plan', 'subscriptionStatus', 'subscriptionExpiresAt']
    });
};

/**
 * Revoga acesso de um usuário
 */
const revokePlan = async (userId) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new Error('Usuário não encontrado');
    }

    await User.update({
        plan: 'FREE',
        subscriptionStatus: 'INACTIVE',
        subscriptionId: null,
        subscriptionExpiresAt: null
    }, {
        where: { id: userId }
    });

    return { message: 'Acesso revogado com sucesso' };
};

/**
 * Cria um novo usuário com plano (admin only)
 */
const createUser = async ({ name, email, password, plan }) => {
    // Verificar se email já existe
    const existing = await User.findOne({ where: { email } });
    if (existing) {
        throw new Error('Este email já está em uso');
    }

    const validPlans = ['MONTHLY', 'ANNUAL', 'LIFETIME'];
    if (!validPlans.includes(plan)) {
        throw new Error('Plano inválido');
    }

    // Calcular expiração
    let expiresAt = null;
    const now = new Date();
    if (plan === 'MONTHLY') {
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
    } else if (plan === 'ANNUAL') {
        expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
    }
    // LIFETIME não expira

    // Criar usuário - hook beforeCreate fará o hash da senha
    const user = await User.create({
        name,
        email,
        password, // Plain text - hook will hash
        plan,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expiresAt,
        onboardingComplete: true
    });

    // Criar registro no histórico
    await PaymentHistory.create({
        userId: user.id,
        amount: 0,
        status: 'APPROVED',
        method: 'admin_create',
        planType: plan,
        mpPaymentId: `admin_create_${Date.now()}`,
        paidAt: new Date()
    });

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
    };
};

module.exports = {
    getDashboard,
    getUsers,
    grantPlan,
    revokePlan,
    createUser
};
