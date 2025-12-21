/**
 * MP Plans Setup - Auto-create plans on startup
 * ========================================
 * Cria planos no MP se não existirem e salva IDs no banco
 * ========================================
 */

const axios = require('axios');
const { MP_ACCESS_TOKEN, PLANS_CONFIG, getHeaders, BASE_URL } = require('../../config/mercadopago');
const { Setting } = require('../../models');
const { logger } = require('../../config/logger');

// Cache em memória para os IDs dos planos
let planIdsCache = {};

/**
 * Busca ID de um plano do banco/cache
 */
const getPlanId = async (planType) => {
    // Verificar cache primeiro
    if (planIdsCache[planType]) {
        return planIdsCache[planType];
    }

    try {
        // Buscar do banco
        const setting = await Setting.findOne({
            where: { key: `MP_PLAN_${planType}_ID` }
        });

        if (setting) {
            planIdsCache[planType] = setting.value;
            return setting.value;
        }
    } catch (error) {
        logger.warn(`Erro ao buscar plan ID do banco:`, error.message);
    }

    return null;
};

/**
 * Salva ID do plano no banco
 */
const savePlanId = async (planType, planId) => {
    try {
        await Setting.upsert({
            key: `MP_PLAN_${planType}_ID`,
            value: planId,
            category: 'mercadopago'
        });
        planIdsCache[planType] = planId;
        logger.info(`💾 Plan ID salvo: ${planType} = ${planId}`);
    } catch (error) {
        logger.error(`Erro ao salvar plan ID:`, error.message);
    }
};

/**
 * Cria um plano no Mercado Pago
 */
const createPlan = async (planType, planConfig) => {
    const planData = {
        reason: `MyWallet - ${planConfig.name}`,
        auto_recurring: {
            frequency: planConfig.frequency || 1,
            frequency_type: planConfig.frequencyType || 'months',
            transaction_amount: planConfig.price,
            currency_id: 'BRL'
        },
        back_url: 'https://mywallet.codebypatrick.dev/checkout'
    };

    logger.info(`📤 Criando plano ${planType} no MP...`);

    const response = await axios.post(
        `${BASE_URL}/preapproval_plan`,
        planData,
        { headers: getHeaders() }
    );

    const planId = response.data.id;
    logger.info(`✅ Plano ${planType} criado: ${planId}`);

    return planId;
};

/**
 * Setup automático no startup
 * Verifica se os planos existem, se não cria
 */
const setupMPPlansIfNeeded = async () => {
    if (!MP_ACCESS_TOKEN) {
        logger.warn('⚠️  MP_ACCESS_TOKEN não configurado. Planos MP não serão criados.');
        return;
    }

    logger.info('💳 Verificando planos do Mercado Pago...');

    const plansToCheck = ['MONTHLY', 'ANNUAL'];

    for (const planType of plansToCheck) {
        try {
            const planConfig = PLANS_CONFIG[planType];
            if (!planConfig || !planConfig.frequency) {
                continue; // Pular planos não recorrentes
            }

            // Verificar se já existe
            let planId = await getPlanId(planType);

            if (planId) {
                logger.info(`✅ Plano ${planType} já existe: ${planId}`);
                continue;
            }

            // Criar novo plano
            planId = await createPlan(planType, planConfig);
            await savePlanId(planType, planId);

        } catch (error) {
            logger.error(`❌ Erro ao configurar plano ${planType}:`, error.response?.data || error.message);
        }
    }

    logger.info('💳 Setup de planos MP concluído');
};

/**
 * Obtém ID do plano para uso nas assinaturas
 * Cria automaticamente se não existir
 */
const getOrCreatePlanId = async (planType) => {
    // Tentar pegar do cache/banco
    let planId = await getPlanId(planType);

    if (planId) {
        return planId;
    }

    // Criar se não existir
    const planConfig = PLANS_CONFIG[planType];
    if (!planConfig || !planConfig.frequency) {
        throw new Error(`Plano inválido ou não recorrente: ${planType}`);
    }

    planId = await createPlan(planType, planConfig);
    await savePlanId(planType, planId);

    return planId;
};

module.exports = {
    setupMPPlansIfNeeded,
    getOrCreatePlanId,
    getPlanId
};
