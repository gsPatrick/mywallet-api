/**
 * FII Sync Cron Job - ARQUITETURA CORRETA
 * =========================================
 * 
 * Práticas de mercado (XP, NuInvest, StatusInvest):
 * 
 * 1. BOOTSTRAP: Manual via admin (uma única vez)
 * 2. SYNC POR EVENTO: Ao comprar FII
 * 3. CRON DE MERCADO: 30 min, apenas FIIs com usuários posicionados
 * 
 * Dividendos são tratados em dividendProcessing.cron.js (separação contábil)
 */

const cron = require('node-cron');
const { syncFII, syncAllUserFIIs, syncAllSystemFIIs } = require('../features/investments/fiiSync.service');
const { logger } = require('../config/logger');

/**
 * Cron de MERCADO: Atualiza dados de FIIs com usuários posicionados
 * - Frequência: a cada 30 minutos durante horário comercial
 * - Apenas FIIs que usuários possuem (não todos do sistema)
 */
const initFIIMarketCron = () => {
    // Cron a cada 30 minutos, das 10h às 18h BRT (horário de pregão)
    // Minutos: 0 e 30 | Horas: 10 às 18 | Dias: seg-sex
    cron.schedule('0,30 10-18 * * 1-5', async () => {
        logger.info('📊 [FII_MARKET_CRON] Atualizando dados de mercado de FIIs com posições...');
        try {
            const result = await syncAllUserFIIs();
            logger.info(`📊 [FII_MARKET_CRON] ${result.synced}/${result.total} FIIs atualizados`);
        } catch (error) {
            logger.error(`❌ [FII_MARKET_CRON] Erro: ${error.message}`);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    logger.info('📅 [FII_MARKET_CRON] Agendado: a cada 30 min (10h-18h BRT, seg-sex)');
};

/**
 * BOOTSTRAP INICIAL: Sincroniza todos os FIIs do sistema
 * - Deve ser chamado MANUALMENTE via admin
 * - Não é executado automaticamente no startup
 * - Uso: /api/admin/fii/bootstrap
 * 
 * @param {number} limit - Limite de FIIs (padrão: 100)
 */
const runBootstrap = async (limit = 100) => {
    logger.info(`🏦 [FII_BOOTSTRAP] Iniciando bootstrap manual de ${limit} FIIs...`);
    const result = await syncAllSystemFIIs(limit);
    logger.info(`🏦 [FII_BOOTSTRAP] Concluído: ${result.synced}/${result.total} FIIs`);
    return result;
};

/**
 * SYNC POR EVENTO: Sincroniza um FII específico após compra
 * - Chamado quando usuário compra um FII
 * - Atualiza apenas o ticker comprado
 * 
 * @param {string} ticker - Ticker do FII comprado
 */
const syncOnPurchase = async (ticker) => {
    logger.info(`🛒 [FII_SYNC_PURCHASE] Sincronizando ${ticker} após compra...`);
    try {
        const result = await syncFII(ticker);
        if (result.success) {
            logger.info(`✅ [FII_SYNC_PURCHASE] ${ticker} sincronizado | DY: ${result.data?.dividendYieldYear}%`);
        } else {
            logger.warn(`⚠️ [FII_SYNC_PURCHASE] ${ticker} falhou: ${result.error}`);
        }
        return result;
    } catch (error) {
        logger.error(`❌ [FII_SYNC_PURCHASE] Erro ao sincronizar ${ticker}: ${error.message}`);
        return { success: false, ticker, error: error.message };
    }
};

/**
 * Sync manual para admin/testes
 */
const runManualSync = async () => {
    logger.info('🔧 [FII_SYNC] Executando sync manual de FIIs das carteiras...');
    return await syncAllUserFIIs();
};

module.exports = {
    initFIIMarketCron,
    runBootstrap,
    syncOnPurchase,
    runManualSync
};
