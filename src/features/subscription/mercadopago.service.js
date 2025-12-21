/**
 * Mercado Pago Service - Subscriptions API
 * ========================================
 * Usando endpoint /preapproval com card_token_id
 * ========================================
 */

const axios = require('axios');
const { MP_ACCESS_TOKEN, PLANS_CONFIG, getHeaders, BASE_URL } = require('../../config/mercadopago');

class MercadoPagoService {
    /**
     * Cria ou busca plano de assinatura no MP
     * Endpoint: POST /preapproval_plan
     */
    async getOrCreatePlan(planType) {
        try {
            const plan = PLANS_CONFIG[planType];
            if (!plan) throw new Error('Plano inválido');

            // Se já temos o ID do plano salvo, usar ele
            if (plan.mpPlanId) {
                return plan.mpPlanId;
            }

            // Criar novo plano no MP
            const planData = {
                reason: plan.name,
                auto_recurring: {
                    frequency: plan.frequency || 1,
                    frequency_type: plan.frequencyType || 'months',
                    transaction_amount: plan.price,
                    currency_id: 'BRL'
                },
                back_url: 'https://mywallet.codebypatrick.dev/checkout'
            };

            console.log('Criando plano MP:', JSON.stringify(planData, null, 2));

            const response = await axios.post(
                `${BASE_URL}/preapproval_plan`,
                planData,
                { headers: getHeaders() }
            );

            console.log('Plano criado:', response.data.id);

            // Salvar ID do plano (em produção, salvar no banco)
            PLANS_CONFIG[planType].mpPlanId = response.data.id;

            return response.data.id;
        } catch (error) {
            console.error('Erro ao criar/buscar plano:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Cria assinatura recorrente com card_token_id
     * Endpoint: POST /preapproval
     */
    async createSubscription(planType, user, cardTokenId) {
        try {
            const plan = PLANS_CONFIG[planType];
            if (!plan) throw new Error('Plano inválido');

            // 1. Obter ou criar plano no MP
            const preapprovalPlanId = await this.getOrCreatePlan(planType);

            // 2. Data de início (1 hora à frente)
            const startDate = new Date();
            startDate.setHours(startDate.getHours() + 1);

            // 3. Criar assinatura
            const subscriptionData = {
                preapproval_plan_id: preapprovalPlanId,
                payer_email: user.email,
                card_token_id: cardTokenId,
                auto_recurring: {
                    frequency: plan.frequency || 1,
                    frequency_type: plan.frequencyType || 'months',
                    start_date: startDate.toISOString(),
                    transaction_amount: plan.price,
                    currency_id: 'BRL'
                },
                back_url: 'https://mywallet.codebypatrick.dev/checkout?status=success',
                status: 'authorized'
            };

            // Adicionar dados do pagador
            if (user.name) {
                const nameParts = user.name.split(' ');
                subscriptionData.payer = {
                    name: nameParts[0],
                    surname: nameParts.slice(1).join(' ') || nameParts[0]
                };
            }

            console.log('Criando assinatura MP:', JSON.stringify(subscriptionData, null, 2));

            const response = await axios.post(
                `${BASE_URL}/preapproval`,
                subscriptionData,
                { headers: getHeaders() }
            );

            console.log('Assinatura criada:', response.data.id, 'Status:', response.data.status);
            return response.data;
        } catch (error) {
            console.error('Erro ao criar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Busca detalhes de uma assinatura
     */
    async getSubscription(subscriptionId) {
        try {
            const response = await axios.get(
                `${BASE_URL}/preapproval/${subscriptionId}`,
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Cancela assinatura
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

    /**
     * Pausa assinatura
     */
    async pauseSubscription(subscriptionId) {
        try {
            const response = await axios.put(
                `${BASE_URL}/preapproval/${subscriptionId}`,
                { status: 'paused' },
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao pausar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Retoma assinatura
     */
    async resumeSubscription(subscriptionId) {
        try {
            const response = await axios.put(
                `${BASE_URL}/preapproval/${subscriptionId}`,
                { status: 'authorized' },
                { headers: getHeaders() }
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao retomar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Consulta pagamentos de uma assinatura
     */
    async getSubscriptionPayments(subscriptionId) {
        try {
            const response = await axios.get(
                `${BASE_URL}/authorized_payments?preapproval_id=${subscriptionId}`,
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
