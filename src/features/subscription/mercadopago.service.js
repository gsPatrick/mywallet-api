/**
 * Mercado Pago Service - Subscriptions API
 * ========================================
 * Usa IDs de planos do banco (criados automaticamente)
 * ========================================
 */

const axios = require('axios');
const { MP_ACCESS_TOKEN, PLANS_CONFIG, getHeaders, BASE_URL } = require('../../config/mercadopago');
const { getOrCreatePlanId } = require('./mpPlansSetup');
const { logger } = require('../../config/logger');

class MercadoPagoService {
    /**
     * Cria assinatura recorrente com card_token_id
     * Endpoint: POST /preapproval
     * ALTERNATIVA: Sem preapproval_plan_id (direto)
     */
    async createSubscription(planType, user, cardTokenId) {
        try {
            logger.info('📝 Iniciando criação de assinatura:', {
                planType,
                userId: user.id,
                email: user.email
            });

            const plan = PLANS_CONFIG[planType];
            if (!plan) throw new Error('Plano inválido');

            // Validar card token
            if (!cardTokenId) {
                throw new Error('Card token não fornecido');
            }
            logger.info(`✅ Card token válido: ${cardTokenId.substring(0, 10)}...`);

            // Data de início
            const startDate = new Date();
            startDate.setHours(startDate.getHours() + 1);

            // Montar dados da assinatura DIRETO (sem preapproval_plan_id)
            const subscriptionData = {
                reason: `MyWallet - ${plan.name}`,
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
                    surname: nameParts.slice(1).join(' ') || nameParts[0],
                    email: user.email
                };
            }

            logger.info('📤 Enviando para MP:', JSON.stringify(subscriptionData, null, 2));

            const response = await axios.post(
                `${BASE_URL}/preapproval`,
                subscriptionData,
                { headers: getHeaders() }
            );

            logger.info('✅ Assinatura criada:', {
                id: response.data.id,
                status: response.data.status,
                next_payment: response.data.next_payment_date
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Erro ao criar assinatura:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });

            // Traduzir erros comuns do MP
            const mpError = error.response?.data;
            if (mpError?.message) {
                throw new Error(mpError.message);
            }
            if (mpError?.cause?.[0]?.description) {
                throw new Error(mpError.cause[0].description);
            }

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
            logger.error('Erro ao buscar assinatura:', error.response?.data || error.message);
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
            logger.error('Erro ao cancelar assinatura:', error.response?.data || error.message);
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
            logger.error('Erro ao pausar assinatura:', error.response?.data || error.message);
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
            logger.error('Erro ao retomar assinatura:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new MercadoPagoService();
