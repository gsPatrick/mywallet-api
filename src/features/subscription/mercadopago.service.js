/**
 * Mercado Pago Service
 * ========================================
 * INTEGRAÇÃO COM MERCADO PAGO
 * ========================================
 * 
 * - Criação de assinaturas recorrentes
 * - Criação de pagamentos únicos (Lifetime)
 * - Consulta de status
 */

const axios = require('axios');
const { MP_ACCESS_TOKEN, PLANS_CONFIG, getHeaders, BASE_URL } = require('../../config/mercadopago');

class MercadoPagoService {
    /**
     * Cria uma preferência de pagamento único (para Lifetime)
     */
    async createPreference(planType, user) {
        try {
            const plan = PLANS_CONFIG[planType];
            if (!plan) throw new Error('Plano inválido');

            const preference = {
                items: [{
                    title: plan.name,
                    description: plan.description,
                    unit_price: plan.price,
                    quantity: 1,
                    currency_id: 'BRL'
                }],
                payer: {
                    email: user.email,
                    name: user.name
                },
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/checkout/success`,
                    failure: `${process.env.FRONTEND_URL}/checkout/failure`,
                    pending: `${process.env.FRONTEND_URL}/checkout/pending`
                },
                auto_return: 'approved',
                external_reference: `${user.id}:${planType}`,
                notification_url: `${process.env.API_URL}/api/webhooks/mercadopago`
            };

            const response = await axios.post(
                `${BASE_URL}/checkout/preferences`,
                preference,
                { headers: getHeaders() }
            );

            return response.data;
        } catch (error) {
            console.error('Erro ao criar preferência:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Cria uma assinatura recorrente (Mensal/Anual)
     */
    async createPreApproval(planType, user, cardTokenId) {
        try {
            const plan = PLANS_CONFIG[planType];
            if (!plan || !plan.frequency) {
                throw new Error('Plano inválido para assinatura recorrente');
            }

            const startDate = new Date();
            startDate.setMinutes(startDate.getMinutes() + 5);

            const subscriptionData = {
                reason: plan.name,
                external_reference: user.id,
                payer_email: user.email,
                card_token_id: cardTokenId,
                auto_recurring: {
                    frequency: plan.frequency,
                    frequency_type: plan.frequencyType,
                    transaction_amount: plan.price,
                    currency_id: 'BRL',
                    start_date: startDate.toISOString()
                },
                back_url: `${process.env.FRONTEND_URL}/checkout/success`,
                status: 'authorized'
            };

            const response = await axios.post(
                `${BASE_URL}/preapproval`,
                subscriptionData,
                { headers: getHeaders() }
            );

            return response.data;
        } catch (error) {
            console.error('Erro ao criar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Consulta status de uma assinatura
     */
    async getSubscription(subscriptionId) {
        try {
            const response = await axios.get(
                `${BASE_URL}/preapproval/${subscriptionId}`,
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao consultar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Consulta detalhes de um pagamento
     */
    async getPayment(paymentId) {
        try {
            const response = await axios.get(
                `${BASE_URL}/v1/payments/${paymentId}`,
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao consultar pagamento:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Cancela uma assinatura
     */
    async cancelSubscription(subscriptionId) {
        try {
            const response = await axios.put(
                `${BASE_URL}/preapproval/${subscriptionId}`,
                { status: 'cancelled' },
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao cancelar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new MercadoPagoService();
