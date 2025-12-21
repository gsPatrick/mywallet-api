/**
 * Webhook Controller
 * ========================================
 * RECEBE NOTIFICAÇÕES DO MERCADO PAGO
 * ========================================
 * 
 * Endpoints:
 * - POST /webhooks/mercadopago
 */

const mercadopagoService = require('./mercadopago.service');
const { User, PaymentHistory } = require('../../models');
const crypto = require('crypto');
const { MP_WEBHOOK_SECRET, PLANS_CONFIG } = require('../../config/mercadopago');

/**
 * POST /webhooks/mercadopago
 * Recebe notificações de pagamentos e assinaturas
 */
const handleWebhook = async (req, res) => {
    // Responder imediatamente para evitar timeout
    res.status(200).send('OK');

    try {
        const { type, data, action } = req.body;

        console.log('📩 Webhook Mercado Pago:', { type, action, dataId: data?.id });

        // Validar assinatura (opcional, mas recomendado em produção)
        // const isValid = validateSignature(req);
        // if (!isValid) {
        //     console.error('Webhook com assinatura inválida');
        //     return;
        // }

        switch (type) {
            case 'payment':
                await handlePaymentNotification(data.id);
                break;

            case 'subscription_preapproval':
                await handleSubscriptionNotification(data.id);
                break;

            case 'subscription_authorized_payment':
                await handleSubscriptionPayment(data.id);
                break;

            default:
                console.log('Tipo de webhook não tratado:', type);
        }

    } catch (error) {
        console.error('Erro ao processar webhook:', error);
    }
};

/**
 * Processa notificação de pagamento único (Lifetime)
 */
const handlePaymentNotification = async (paymentId) => {
    try {
        console.log('💳 Processando pagamento:', paymentId);

        const payment = await mercadopagoService.getPayment(paymentId);

        if (!payment) {
            console.error('Pagamento não encontrado:', paymentId);
            return;
        }

        // Extrair userId e planType do external_reference
        const [userId, planType] = (payment.external_reference || '').split(':');

        if (!userId) {
            console.error('external_reference inválido:', payment.external_reference);
            return;
        }

        // Verificar se pagamento já foi processado
        const existingPayment = await PaymentHistory.findOne({
            where: { mpPaymentId: paymentId.toString() }
        });

        if (existingPayment) {
            console.log('Pagamento já processado:', paymentId);
            return;
        }

        // Status aprovado = Liberar acesso
        if (payment.status === 'approved') {
            console.log('✅ Pagamento aprovado! Liberando acesso para:', userId);

            // Atualizar usuário
            await User.update({
                plan: planType || 'LIFETIME',
                subscriptionStatus: 'ACTIVE',
                // Lifetime não expira
                subscriptionExpiresAt: planType === 'LIFETIME' ? null : calculateExpiration(planType)
            }, {
                where: { id: userId }
            });

            // Criar registro no histórico
            await PaymentHistory.create({
                userId,
                amount: payment.transaction_amount,
                status: 'APPROVED',
                method: payment.payment_method_id,
                planType: planType || 'LIFETIME',
                mpPaymentId: paymentId.toString(),
                mpData: payment,
                paidAt: new Date()
            });

            console.log('🎉 Usuário ativado com sucesso:', userId);
        }

    } catch (error) {
        console.error('Erro ao processar notificação de pagamento:', error);
    }
};

/**
 * Processa notificação de assinatura
 */
const handleSubscriptionNotification = async (subscriptionId) => {
    try {
        console.log('🔄 Processando assinatura:', subscriptionId);

        const subscription = await mercadopagoService.getSubscription(subscriptionId);

        if (!subscription) {
            console.error('Assinatura não encontrada:', subscriptionId);
            return;
        }

        const userId = subscription.external_reference;

        if (!userId) {
            console.error('external_reference inválido na assinatura');
            return;
        }

        // Mapear status do MP para nosso status
        const statusMap = {
            'authorized': 'ACTIVE',
            'pending': 'INACTIVE',
            'paused': 'INACTIVE',
            'cancelled': 'CANCELLED'
        };

        const newStatus = statusMap[subscription.status] || 'INACTIVE';

        // Atualizar usuário
        await User.update({
            subscriptionStatus: newStatus,
            subscriptionId: subscriptionId.toString()
        }, {
            where: { id: userId }
        });

        console.log('📝 Status de assinatura atualizado:', { userId, status: newStatus });

    } catch (error) {
        console.error('Erro ao processar notificação de assinatura:', error);
    }
};

/**
 * Processa pagamento de assinatura recorrente
 */
const handleSubscriptionPayment = async (paymentId) => {
    try {
        console.log('💰 Processando pagamento recorrente:', paymentId);

        const payment = await mercadopagoService.getPayment(paymentId);

        if (!payment) return;

        const subscriptionId = payment.metadata?.preapproval_id;

        // Buscar usuário pela subscription
        const user = await User.findOne({
            where: { subscriptionId: subscriptionId?.toString() }
        });

        if (!user) {
            console.error('Usuário não encontrado para subscription:', subscriptionId);
            return;
        }

        // Verificar se pagamento já foi processado
        const existingPayment = await PaymentHistory.findOne({
            where: { mpPaymentId: paymentId.toString() }
        });

        if (existingPayment) {
            console.log('Pagamento recorrente já processado:', paymentId);
            return;
        }

        if (payment.status === 'approved') {
            // Criar registro no histórico
            await PaymentHistory.create({
                userId: user.id,
                amount: payment.transaction_amount,
                status: 'APPROVED',
                method: payment.payment_method_id,
                planType: user.plan,
                mpPaymentId: paymentId.toString(),
                mpSubscriptionId: subscriptionId?.toString(),
                mpData: payment,
                paidAt: new Date()
            });

            // Atualizar expiração
            await User.update({
                subscriptionStatus: 'ACTIVE',
                subscriptionExpiresAt: calculateExpiration(user.plan)
            }, {
                where: { id: user.id }
            });

            console.log('🎉 Pagamento recorrente processado:', user.id);
        }

    } catch (error) {
        console.error('Erro ao processar pagamento recorrente:', error);
    }
};

/**
 * Calcula data de expiração baseada no plano
 */
const calculateExpiration = (planType) => {
    const now = new Date();

    switch (planType) {
        case 'MONTHLY':
            return new Date(now.setMonth(now.getMonth() + 1));
        case 'ANNUAL':
            return new Date(now.setFullYear(now.getFullYear() + 1));
        case 'LIFETIME':
            return null; // Nunca expira
        default:
            return new Date(now.setMonth(now.getMonth() + 1));
    }
};

/**
 * Valida assinatura do webhook (segurança)
 */
const validateSignature = (req) => {
    try {
        const xSignature = req.headers['x-signature'];
        const xRequestId = req.headers['x-request-id'];

        if (!xSignature || !xRequestId || !MP_WEBHOOK_SECRET) {
            return false;
        }

        const parts = xSignature.split(',');
        let ts, hash;

        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (key.trim() === 'ts') ts = value;
            if (key.trim() === 'v1') hash = value;
        });

        if (!ts || !hash) return false;

        const manifest = `id:${req.body.data.id};request-id:${xRequestId};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', MP_WEBHOOK_SECRET);
        hmac.update(manifest);
        const expectedHash = hmac.digest('hex');

        return hash === expectedHash;
    } catch (error) {
        console.error('Erro ao validar assinatura:', error);
        return false;
    }
};

module.exports = {
    handleWebhook
};
