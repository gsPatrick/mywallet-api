/**
 * FII Sync Cron Job
 * Agendamento para sincronização diária de FIIs
 * ==============================================
 * 
 * Executa diariamente às 06:00 e 18:00 (horário de Brasília)
 * Sincroniza todos os FIIs das carteiras dos usuários
 */

const cron = require('node-cron');
const { syncAllUserFIIs, syncAllSystemFIIs } = require('../features/investments/fiiSync.service');
const { logger } = require('../config/logger');

/**
 * Inicializa os cron jobs de sincronização de FIIs
 */
const initFIISyncCron = () => {
    // Cron diário às 06:00 BRT (09:00 UTC)
    // FIIs geralmente atualizam dados cedo pela manhã
    cron.schedule('0 9 * * *', async () => {
        logger.info('⏰ [CRON] Iniciando sync matinal de FIIs (06:00 BRT)...');
        try {
            const result = await syncAllUserFIIs();
            logger.info(`✅ [CRON] Sync matinal concluído: ${result.synced}/${result.total} FIIs`);
        } catch (error) {
            logger.error(`❌ [CRON] Erro no sync matinal: ${error.message}`);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    // Cron diário às 18:00 BRT (21:00 UTC)
    // Captura atualizações do final do dia
    cron.schedule('0 21 * * *', async () => {
        logger.info('⏰ [CRON] Iniciando sync vespertino de FIIs (18:00 BRT)...');
        try {
            const result = await syncAllUserFIIs();
            logger.info(`✅ [CRON] Sync vespertino concluído: ${result.synced}/${result.total} FIIs`);
        } catch (error) {
            logger.error(`❌ [CRON] Erro no sync vespertino: ${error.message}`);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    logger.info('📅 [CRON] FII sync jobs agendados: 06:00 e 18:00 BRT');
};

/**
 * Executa sincronização manual de FIIs das carteiras dos usuários
 */
const runManualSync = async () => {
    logger.info('🔧 [CRON] Executando sync manual de FIIs das carteiras...');
    return await syncAllUserFIIs();
};

/**
 * Executa sincronização inicial de TODOS os FIIs do sistema
 * Usado no startup para pré-popular o cache com dados de FIIs
 * @param {number} limit - Limite de FIIs para sincronizar
 */
const runInitialSystemSync = async (limit = 20) => {
    logger.info('🏦 [CRON] Executando sync inicial de todos os FIIs do sistema...');
    return await syncAllSystemFIIs(limit);
};

module.exports = {
    initFIISyncCron,
    runManualSync,
    runInitialSystemSync
};
