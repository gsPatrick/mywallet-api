/**
 * FII Sync Cron Job
 * Agendamento para sincronização diária de FIIs
 * ==============================================
 * 
 * Executa diariamente às 06:00 e 18:00 (horário de Brasília)
 * Sincroniza todos os FIIs das carteiras dos usuários
 */

const cron = require('node-cron');
const { syncAllUserFIIs } = require('../features/investments/fiiSync.service');
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
 * Executa sincronização manual (para testes ou admin)
 */
const runManualSync = async () => {
    logger.info('🔧 [CRON] Executando sync manual de FIIs...');
    return await syncAllUserFIIs();
};

module.exports = {
    initFIISyncCron,
    runManualSync
};
