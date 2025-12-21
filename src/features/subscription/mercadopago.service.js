/**
 * Mercado Pago Service - Subscriptions API
 * ========================================
 * Fix: Planos criados UMA VEZ e IDs salvos
 * ========================================
 */

const axios = require('axios');
const { MP_ACCESS_TOKEN, PLANS_CONFIG, getHeaders, BASE_URL } = require('../../config/mercadopago');

// IDs dos planos FIXOS (criados uma vez no MP)
// Execute setupPlans() uma vez para gerar esses IDs
const PLAN_IDS = {
    MONTHLY: process.env.MP_PLAN_MONTHLY_ID || null,
    ANNUAL: process.env.MP_PLAN_ANNUAL_ID || null,
    LIFETIME: null // Não é assinatura
};

class MercadoPagoService {
    /**
     * Setup: Cria planos no MP (executar UMA VEZ)
     * Execute: node -e "require('./src/features/subscription/mercadopago.service').setupPlans()"
     */
    async setupPlans() {
        console.log('📋 Criando planos no Mercado Pago...\n');

        const plansToCreate = [
            {
                key: 'MONTHLY',
                reason: 'MyWallet - Plano Mensal',
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 29.90
            },
            {
                key: 'ANNUAL',
                reason: 'MyWallet - Plano Anual',
                frequency: 12,
                frequency_type: 'months',
                transaction_amount: 297.00
            }
        ];

        for (const plan of plansToCreate) {
            try {
                const planData = {
                    reason: plan.reason,
                    auto_recurring: {
                        frequency: plan.frequency,
                        frequency_type: plan.frequency_type,
                        transaction_amount: plan.transaction_amount,
                        currency_id: 'BRL'
                    },
                    back_url: 'https://mywallet.codebypatrick.dev/checkout'
                };

                console.log(`Criando plano ${plan.key}...`);

                const response = await axios.post(
                    `${BASE_URL}/preapproval_plan`,
                    planData,
                    { headers: getHeaders() }
                );

                console.log(`✅ Plano ${plan.key} criado: ${response.data.id}`);
                console.log(`   Adicione ao .env: MP_PLAN_${plan.key}_ID=${response.data.id}\n`);

            } catch (error) {
                console.error(`❌ Erro ao criar plano ${plan.key}:`, error.response?.data || error.message);
            }
        }

        console.log('\n📝 Copie os IDs acima e adicione ao seu arquivo .env');
        console.log('   Depois reinicie o servidor.');
    }

    /**
     * Busca ID do plano (fixo ou cria se não existir)
     */
    async getPlanId(planType) {
        // Se temos ID fixo, usar ele
        if (PLAN_IDS[planType]) {
            console.log(`📋 Usando plano existente: ${planType} = ${PLAN_IDS[planType]}`);
            return PLAN_IDS[planType];
        }

        // Se não tem ID, criar plano dinamicamente (não ideal, mas funciona)
        console.log(`⚠️ Plano ${planType} não configurado. Criando dinamicamente...`);

        const plan = PLANS_CONFIG[planType];
        if (!plan || !plan.frequency) {
            throw new Error(`Plano inválido ou não é recorrente: ${planType}`);
        }

        const planData = {
            reason: `MyWallet - ${plan.name}`,
            auto_recurring: {
                frequency: plan.frequency,
                frequency_type: plan.frequencyType,
                transaction_amount: plan.price,
                currency_id: 'BRL'
            },
            back_url: 'https://mywallet.codebypatrick.dev/checkout'
        };

        const response = await axios.post(
            `${BASE_URL}/preapproval_plan`,
            planData,
            { headers: getHeaders() }
        );

        console.log(`✅ Plano criado: ${response.data.id}`);
        console.log(`   Adicione ao .env: MP_PLAN_${planType}_ID=${response.data.id}`);

        // Salvar em memória para essa sessão
        PLAN_IDS[planType] = response.data.id;

        return response.data.id;
    }

    /**
     * Cria assinatura recorrente com card_token_id
     * Endpoint: POST /preapproval
     */
    async createSubscription(planType, user, cardTokenId) {
        try {
            console.log('📝 Iniciando criação de assinatura:', {
                planType,
                userId: user.id,
                email: user.email
            });

            const plan = PLANS_CONFIG[planType];
            if (!plan) throw new Error('Plano inválido');

            // 1. Obter ID do plano
            const preapprovalPlanId = await this.getPlanId(planType);
            console.log(`✅ Plano encontrado: ${preapprovalPlanId}`);

            // 2. Validar card token
            if (!cardTokenId) {
                throw new Error('Card token não fornecido');
            }
            console.log(`✅ Card token válido: ${cardTokenId.substring(0, 10)}...`);

            // 3. Data de início
            const startDate = new Date();
            startDate.setHours(startDate.getHours() + 1);

            // 4. Montar dados da assinatura
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
                    surname: nameParts.slice(1).join(' ') || nameParts[0],
                    email: user.email
                };
            }

            console.log('📤 Enviando para MP:', JSON.stringify(subscriptionData, null, 2));

            const response = await axios.post(
                `${BASE_URL}/preapproval`,
                subscriptionData,
                { headers: getHeaders() }
            );

            console.log('✅ Assinatura criada:', {
                id: response.data.id,
                status: response.data.status,
                next_payment: response.data.next_payment_date
            });

            return response.data;

        } catch (error) {
            console.error('❌ Erro ao criar assinatura:', {
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
}

module.exports = new MercadoPagoService();
