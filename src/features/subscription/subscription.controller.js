/**
 * Subscription Controller
 * ========================================
 * ENDPOINTS DE ASSINATURA
 * ========================================
 * Usando card_token_id com preapproval_plan
 */

const mercadopagoService = require('./mercadopago.service');
const { User, PaymentHistory } = require('../../models');
const { PLANS_CONFIG } = require('../../config/mercadopago');

/**
 * GET /subscriptions/plans
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
 * POST /subscriptions/subscribe
 * Cria assinatura com card_token_id
 */
const subscribe = async (req, res) => {
    try {
        const { planType, cardTokenId } = req.body;
        const user = req.user;

        if (!planType || !PLANS_CONFIG[planType]) {
            return res.status(400).json({ error: 'Plano inválido' });
        }

        if (!cardTokenId) {
            return res.status(400).json({ error: 'Token do cartão é obrigatório' });
        }

        // Criar assinatura no MP
        const subscription = await mercadopagoService.createSubscription(planType, user, cardTokenId);

        // Atualizar usuário se assinatura autorizada
        if (subscription.status === 'authorized') {
            await User.update({
                subscriptionId: subscription.id,
                subscriptionStatus: 'ACTIVE',
                plan: planType
            }, {
                where: { id: user.id }
            });
        }

        res.json({
            success: true,
            type: 'subscription',
            id: subscription.id,
            status: subscription.status,
            message: subscription.status === 'authorized'
                ? 'Assinatura criada com sucesso!'
                : 'Assinatura pendente de aprovação'
        });

    } catch (error) {
        console.error('Erro ao criar assinatura:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Erro ao criar assinatura';
        res.status(500).json({ error: errorMessage });
    }
};

/**
 * GET /subscriptions/status
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
 * POST /subscriptions/cancel
 * Cancela assinatura do usuário
 */
const cancel = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (user.subscriptionId) {
            await mercadopagoService.cancelSubscription(user.subscriptionId);
        }

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
 * GET /subscriptions/history
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

/**
 * POST /subscriptions/activate-test
 * TESTE: Ativa assinatura manualmente (só para teste)
 */
const activateTest = async (req, res) => {
    try {
        const user = req.user;
        const { planType } = req.body;

        // Atualizar usuário para ACTIVE
        await User.update({
            subscriptionId: `TEST-${Date.now()}`,
            subscriptionStatus: 'ACTIVE',
            plan: planType || 'MONTHLY'
        }, {
            where: { id: user.id }
        });

        console.log(`✅ Assinatura TESTE ativada para ${user.email}`);

        res.json({
            success: true,
            message: 'Assinatura de teste ativada!',
            user: {
                id: user.id,
                email: user.email,
                plan: planType || 'MONTHLY',
                status: 'ACTIVE'
            }
        });
    } catch (error) {
        console.error('Erro ao ativar teste:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /subscriptions/simulate-webhook
 * TESTE: Simula webhook de pagamento aprovado
 */
const simulateWebhook = async (req, res) => {
    try {
        const { userId, planType } = req.body;

        // Buscar usuário
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Ativar assinatura
        await User.update({
            subscriptionId: `SIMULATED-${Date.now()}`,
            subscriptionStatus: 'ACTIVE',
            plan: planType || 'MONTHLY'
        }, {
            where: { id: userId }
        });

        console.log(`✅ Webhook simulado - Assinatura ativada para ${user.email}`);

        res.json({
            success: true,
            message: 'Webhook simulado com sucesso!',
            user: {
                id: userId,
                email: user.email,
                plan: planType || 'MONTHLY',
                status: 'ACTIVE'
            }
        });
    } catch (error) {
        console.error('Erro ao simular webhook:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getPlans,
    subscribe,
    getStatus,
    cancel,
    getHistory,
    activateTest,
    simulateWebhook
};
