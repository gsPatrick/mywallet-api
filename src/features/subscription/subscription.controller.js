/**
 * Subscription Controller
 * ========================================
 * ENDPOINTS DE ASSINATURA
 * ========================================
 * Usando Checkout Pro (redirect) para todos os planos
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
 * Cria preferência de pagamento (Checkout Pro)
 * Retorna URL para redirect ao Mercado Pago
 */
const subscribe = async (req, res) => {
    try {
        const { planType } = req.body;
        const user = req.user;

        if (!planType || !PLANS_CONFIG[planType]) {
            return res.status(400).json({ error: 'Plano inválido' });
        }

        // Criar preferência de pagamento (Checkout Pro)
        const preference = await mercadopagoService.createPreference(planType, user);

        return res.json({
            type: 'preference',
            id: preference.id,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point
        });

    } catch (error) {
        console.error('Erro ao criar assinatura:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar assinatura' });
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

        // Apenas atualizar status local (sem MP preapproval)
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

module.exports = {
    getPlans,
    subscribe,
    getStatus,
    cancel,
    getHistory
};
