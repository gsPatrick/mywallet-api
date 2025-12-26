/**
 * Dividend Processing Cron Job
 * Processa dividendos em BATCH - igual corretoras fazem
 * =====================================================
 * 
 * Regras B3/Corretoras:
 * 1. Dividendos são eventos contábeis, NÃO tempo real
 * 2. Usuário só tem direito se tiver ativo até data-com (ex-date)
 * 3. Crédito ocorre na data de pagamento
 * 4. Corretoras processam em lote: manhã (07h) e fim do dia (18h)
 * 
 * Este cron roda 2x/dia e:
 * - Busca dividendos com payment_date <= hoje
 * - Verifica se usuário tinha posição na ex-date
 * - Registra dividendos automaticamente
 * - Atualiza status PENDING → RECEIVED
 */

const cron = require('node-cron');
const { Dividend, Investment, Asset, FIIData, User } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

/**
 * Processa dividendos de FIIs para todos os usuários
 * Chamado pelo cron 2x/dia
 */
const processDividends = async () => {
    logger.info('💰 [DIVIDEND_CRON] Iniciando processamento de dividendos em batch...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // 1. Busca todos os FIIs que pagaram dividendo nos últimos 30 dias
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const fiisWithDividends = await FIIData.findAll({
            where: {
                lastDividendDate: {
                    [Op.between]: [thirtyDaysAgo, today]
                },
                lastDividend: {
                    [Op.gt]: 0
                }
            }
        });

        if (fiisWithDividends.length === 0) {
            logger.info('💰 [DIVIDEND_CRON] Nenhum FII com dividendo nos últimos 30 dias');
            return { processed: 0, created: 0, skipped: 0 };
        }

        logger.info(`💰 [DIVIDEND_CRON] ${fiisWithDividends.length} FIIs com dividendos a processar`);

        // 2. Para cada FII, busca usuários que tinham posição
        let created = 0;
        let skipped = 0;

        for (const fii of fiisWithDividends) {
            const ticker = fii.ticker;
            const paymentDate = fii.lastDividendDate;
            const amountPerUnit = parseFloat(fii.lastDividend);

            // Busca o Asset correspondente
            const asset = await Asset.findOne({
                where: { ticker, type: 'FII' }
            });

            if (!asset) continue;

            // Busca todos os usuários que têm investimentos nesse ativo
            // Simplificação: considera posição atual (idealmente seria na data-com)
            const investments = await Investment.findAll({
                where: {
                    assetId: asset.id,
                    operationType: 'BUY'
                },
                attributes: ['userId', 'quantity', 'assetId'],
                group: ['userId', 'assetId'],
                raw: true
            });

            // Agrupa por usuário para calcular quantidade total
            const userPositions = {};
            const allUserInvestments = await Investment.findAll({
                where: {
                    assetId: asset.id
                },
                order: [['date', 'ASC']]
            });

            allUserInvestments.forEach(inv => {
                if (!userPositions[inv.userId]) {
                    userPositions[inv.userId] = { quantity: 0, assetId: inv.assetId };
                }
                if (inv.operationType === 'BUY') {
                    userPositions[inv.userId].quantity += parseFloat(inv.quantity);
                } else if (inv.operationType === 'SELL') {
                    userPositions[inv.userId].quantity -= parseFloat(inv.quantity);
                }
            });

            // Para cada usuário com posição positiva
            for (const [userId, position] of Object.entries(userPositions)) {
                if (position.quantity <= 0) continue;

                // Verifica se já existe esse dividendo registrado
                const existingDividend = await Dividend.findOne({
                    where: {
                        userId,
                        assetId: asset.id,
                        paymentDate,
                        origin: 'AUTO_SCRAPER'
                    }
                });

                if (existingDividend) {
                    skipped++;
                    continue;
                }

                // Registra o dividendo
                const grossAmount = position.quantity * amountPerUnit;

                await Dividend.create({
                    userId,
                    assetId: asset.id,
                    type: 'RENDIMENTO',
                    amountPerUnit,
                    quantity: position.quantity,
                    grossAmount,
                    withholdingTax: 0, // FIIs isentos de IR para PF
                    netAmount: grossAmount,
                    exDate: paymentDate, // Simplificado
                    paymentDate,
                    status: 'RECEIVED',
                    origin: 'AUTO_SCRAPER',
                    notes: `Processado automaticamente em ${new Date().toISOString().split('T')[0]}`
                });

                created++;
                logger.info(`💰 [DIVIDEND_CRON] Registrado: ${ticker} | User: ${userId.substring(0, 8)}... | R$${grossAmount.toFixed(2)}`);
            }
        }

        logger.info(`💰 [DIVIDEND_CRON] Concluído: ${created} criados, ${skipped} já existentes`);

        return { processed: fiisWithDividends.length, created, skipped };

    } catch (error) {
        logger.error(`❌ [DIVIDEND_CRON] Erro: ${error.message}`);
        throw error;
    }
};

/**
 * Atualiza status de dividendos PENDING → RECEIVED
 * Para dividendos manuais ou importados
 */
const updatePendingDividends = async () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const updated = await Dividend.update(
        { status: 'RECEIVED' },
        {
            where: {
                status: 'PENDING',
                paymentDate: {
                    [Op.lte]: today
                }
            }
        }
    );

    if (updated[0] > 0) {
        logger.info(`💰 [DIVIDEND_CRON] ${updated[0]} dividendos atualizados: PENDING → RECEIVED`);
    }

    return updated[0];
};

/**
 * Inicializa os cron jobs de processamento de dividendos
 */
const initDividendProcessingCron = () => {
    // Cron às 07:00 BRT (10:00 UTC) - Processamento matinal
    cron.schedule('0 10 * * *', async () => {
        logger.info('⏰ [DIVIDEND_CRON] Processamento matinal (07:00 BRT)...');
        try {
            await processDividends();
            await updatePendingDividends();
        } catch (error) {
            logger.error(`❌ [DIVIDEND_CRON] Erro no processamento matinal: ${error.message}`);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    // Cron às 18:00 BRT (21:00 UTC) - Processamento vespertino
    cron.schedule('0 21 * * *', async () => {
        logger.info('⏰ [DIVIDEND_CRON] Processamento vespertino (18:00 BRT)...');
        try {
            await processDividends();
            await updatePendingDividends();
        } catch (error) {
            logger.error(`❌ [DIVIDEND_CRON] Erro no processamento vespertino: ${error.message}`);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    logger.info('📅 [DIVIDEND_CRON] Jobs agendados: 07:00 e 18:00 BRT');
};

/**
 * Executa processamento manual (para testes ou admin)
 */
const runManualDividendProcessing = async () => {
    logger.info('🔧 [DIVIDEND_CRON] Executando processamento manual...');
    const result = await processDividends();
    await updatePendingDividends();
    return result;
};

module.exports = {
    initDividendProcessingCron,
    runManualDividendProcessing,
    processDividends,
    updatePendingDividends
};
