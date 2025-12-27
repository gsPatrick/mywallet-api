/**
 * Morning Briefing Cron Job
 * ========================================
 * Executa às 08:00 AM (Brasília)
 * Envia resumo financeiro diário via WhatsApp
 * ========================================
 */

const cron = require('node-cron');
const { logger } = require('../config/logger');
const briefingService = require('../features/whatsapp/briefing.service');

// Sleep helper to avoid WhatsApp rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send briefings to all eligible users
 */
const sendAllBriefings = async () => {
    logger.info('🌅 ======================================');
    logger.info('🌅 MORNING BRIEFING - STARTING');
    logger.info('🌅 ======================================');

    try {
        const eligibleUsers = await briefingService.getEligibleUsers();

        logger.info(`📊 Found ${eligibleUsers.length} eligible user(s)`);

        if (eligibleUsers.length === 0) {
            logger.info('⚠️ No eligible users for briefing');
            return { success: 0, failed: 0, total: 0 };
        }

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < eligibleUsers.length; i++) {
            const user = eligibleUsers[i];

            logger.info(`📤 [${i + 1}/${eligibleUsers.length}] Sending briefing to ${user.email}`);

            try {
                const success = await briefingService.sendBriefing(user.id);

                if (success) {
                    successCount++;
                    logger.info(`✅ [${i + 1}/${eligibleUsers.length}] Sent to ${user.email}`);
                } else {
                    failedCount++;
                    logger.warn(`⚠️ [${i + 1}/${eligibleUsers.length}] Failed for ${user.email}`);
                }
            } catch (error) {
                failedCount++;
                logger.error(`❌ [${i + 1}/${eligibleUsers.length}] Error for ${user.email}:`, error.message);
            }

            // Wait 2 seconds between sends to avoid WhatsApp rate limiting
            if (i < eligibleUsers.length - 1) {
                logger.debug('⏳ Waiting 2s before next send...');
                await sleep(2000);
            }
        }

        logger.info('🌅 ======================================');
        logger.info(`🌅 MORNING BRIEFING - COMPLETE`);
        logger.info(`🌅 Success: ${successCount} | Failed: ${failedCount} | Total: ${eligibleUsers.length}`);
        logger.info('🌅 ======================================');

        return {
            success: successCount,
            failed: failedCount,
            total: eligibleUsers.length
        };
    } catch (error) {
        logger.error('❌ MORNING BRIEFING - CRITICAL ERROR:', error);
        return { success: 0, failed: 0, total: 0, error: error.message };
    }
};

/**
 * Initialize the cron job
 * Schedule: 08:00 AM Brasília time (UTC-3)
 * 
 * Note: If server runs in UTC, use '0 11 * * *' (11:00 UTC = 08:00 BRT)
 * If server runs in America/Sao_Paulo, use '0 8 * * *'
 */
const initMorningBriefingCron = () => {
    // Schedule: At 08:00 every day
    // Using timezone option for Brasília
    const cronExpression = '0 8 * * *';

    logger.info(`⏰ Initializing Morning Briefing Cron: ${cronExpression}`);

    const task = cron.schedule(cronExpression, async () => {
        logger.info('⏰ Morning Briefing Cron triggered');
        await sendAllBriefings();
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });

    logger.info('✅ Morning Briefing Cron initialized successfully');

    return task;
};

module.exports = {
    initMorningBriefingCron,
    sendAllBriefings // Export for manual triggers
};
