/**
 * Mercado Pago Service
 * ========================================
 * INTEGRAÇÃO COM MERCADO PAGO
 * ========================================
 * 
 * Usando Checkout Pro (redirect) para todos os planos
 * Mais simples e funciona com sandbox
 */

const axios = require('axios');
const { MP_ACCESS_TOKEN, PLANS_CONFIG, getHeaders, BASE_URL } = require('../../config/mercadopago');

class MercadoPagoService {
    /**
     * Cria uma preferência de pagamento (Checkout Pro)
     * Funciona para todos os planos - redirect para MP
     */
    async createPreference(planType, user) {
        try {
            const plan = PLANS_CONFIG[planType];
            if (!plan) throw new Error('Plano inválido');

            const frontendUrl = 'https://mywallet.codebypatrick.dev';
            const apiUrl = 'https://geral-mywallet-api.r954jc.easypanel.host';

            // Check if using localhost (MP doesn't accept localhost for auto_return)
            const isLocalhost = frontendUrl.includes('localhost');

            const preference = {
                items: [{
                    id: planType,
                    title: `MyWallet - ${plan.name}`,
                    description: plan.description,
                    unit_price: plan.price,
                    quantity: 1,
                    currency_id: 'BRL'
                }],
                payer: {
                    email: user.email,
                    name: user.name || 'Cliente'
                },
                external_reference: `${user.id}:${planType}`,
                statement_descriptor: 'MYWALLET',
                metadata: {
                    user_id: user.id,
                    plan_type: planType,
                    is_subscription: plan.frequency ? true : false
                }
            };

            // Only add back_urls and auto_return for non-localhost
            if (!isLocalhost) {
                preference.back_urls = {
                    success: `${frontendUrl}/checkout?status=success&plan=${planType}`,
                    failure: `${frontendUrl}/checkout?status=failure&plan=${planType}`,
                    pending: `${frontendUrl}/checkout?status=pending&plan=${planType}`
                };
                preference.auto_return = 'approved';
                preference.notification_url = `${apiUrl}/api/webhooks/mercadopago`;
            }

            console.log('Criando preferência MP:', JSON.stringify(preference, null, 2));

            const response = await axios.post(
                `${BASE_URL}/checkout/preferences`,
                preference,
                { headers: getHeaders() }
            );

            console.log('Preferência criada:', response.data.id);
            return response.data;
        } catch (error) {
            console.error('Erro ao criar preferência:', error.response?.data || error.message);
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
     * Busca pagamentos por external_reference
     */
    async getPaymentsByReference(externalReference) {
        try {
            const response = await axios.get(
                `${BASE_URL}/v1/payments/search?external_reference=${externalReference}`,
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar pagamentos:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new MercadoPagoService();
