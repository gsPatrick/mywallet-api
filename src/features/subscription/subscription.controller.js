/**
 * Subscription Controller
 * ========================================
 * ENDPOINTS DE ASSINATURA
 * ========================================
 */

const mercadopagoService = require('./mercadopago.service');
const { User, PaymentHistory } = require('../../models');
const { PLANS_CONFIG } = require('../../config/mercadopago');

/**
 * GET /subscription/plans
 * Lista planos disponíveis
 */
const getPlans = async (req, res) => {
    try {
        const plans = Object.entries(PLANS_CONFIG).map(([key, plan]) => ({
            id: key,
            name: plan.name,
            price: plan.price,
            description: plan.description,
            isRecurring: !!plan.frequency,
            frequency: plan.frequency,
            frequencyType: plan.frequencyType
        }));

        res.json({ plans });
    } catch (error) {
        console.error('Erro ao listar planos:', error);
        res.status(500).json({ error: 'Erro ao listar planos' });
    }
};

/**
 * POST /subscription/subscribe
 * Cria uma nova assinatura
 */
const subscribe = async (req, res) => {
    try {
        const { planType, cardTokenId } = req.body;
        const user = req.user;

        if (!planType || !PLANS_CONFIG[planType]) {
            return res.status(400).json({ error: 'Plano inválido' });
        }

        let result;

        // Lifetime = Pagamento único
        if (planType === 'LIFETIME') {
            result = await mercadopagoService.createPreference(planType, user);

            return res.json({
                type: 'preference',
                id: result.id,
                initPoint: result.init_point,
                sandboxInitPoint: result.sandbox_init_point
            });
        }

        // Mensal/Anual = Assinatura recorrente
        if (!cardTokenId) {
            return res.status(400).json({ error: 'Token do cartão é obrigatório para assinaturas' });
        }

        result = await mercadopagoService.createPreApproval(planType, user, cardTokenId);

        // Atualizar usuário com subscription ID
        await User.update({
            subscriptionId: result.id,
            subscriptionStatus: result.status === 'authorized' ? 'ACTIVE' : 'INACTIVE',
            plan: planType
        }, {
            where: { id: user.id }
        });

        res.json({
            type: 'subscription',
            id: result.id,
            status: result.status,
            message: 'Assinatura criada com sucesso!'
        });

    } catch (error) {
        console.error('Erro ao criar assinatura:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar assinatura' });
    }
};

/**
 * GET /subscription/status
 * Retorna status da assinatura do usuário
 */
const getStatus = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        res.json({
            plan: user.plan,
            status: user.subscriptionStatus,
            subscriptionId: user.subscriptionId,
            expiresAt: user.subscriptionExpiresAt,
            isActive: user.subscriptionStatus === 'ACTIVE' || user.plan === 'OWNER'
        });
    } catch (error) {
        console.error('Erro ao buscar status:', error);
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
};

/**
 * POST /subscription/cancel
 * Cancela assinatura do usuário
 */
const cancel = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user.subscriptionId) {
            return res.status(400).json({ error: 'Nenhuma assinatura ativa' });
        }

        await mercadopagoService.cancelSubscription(user.subscriptionId);

        await User.update({
            subscriptionStatus: 'CANCELLED'
        }, {
            where: { id: user.id }
        });

        res.json({ message: 'Assinatura cancelada com sucesso' });
    } catch (error) {
        console.error('Erro ao cancelar:', error);
        res.status(500).json({ error: error.message || 'Erro ao cancelar assinatura' });
    }
};

/**
 * GET /subscription/history
 * Histórico de pagamentos do usuário
 */
const getHistory = async (req, res) => {
    try {
        const payments = await PaymentHistory.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        res.json({ payments });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
};

module.exports = {
    getPlans,
    subscribe,
    getStatus,
    cancel,
    getHistory
};
