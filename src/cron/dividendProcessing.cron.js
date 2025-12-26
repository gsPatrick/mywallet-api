/**
 * Dividend Processing Cron Job - ARQUITETURA CORRETA
 * ===================================================
 * 
 * Regras B3/Corretoras:
 * - Dividendos são eventos CONTÁBEIS, NÃO tempo real
 * - Processados 1x/dia (18:00 BRT - após fechamento do pregão)
 * - Idempotente: não duplica dividendos
 * - Separado do scraper de mercado
 * 
 * O cron:
 * - Verifica FIIs com payment_date <= hoje
 * - Verifica se usuário tinha posição
 * - Registra dividendos automaticamente (se não existir)
 * - Atualiza status PENDING → RECEIVED
 */

const cron = require('node-cron');
const { Dividend, Investment, Asset, FIIData } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

/**
 * Processa dividendos de FIIs - IDEMPOTENTE
 * Não duplica dividendos já registrados
 */
const processDividends = async () => {
    logger.info('💰 [DIVIDEND_CRON] Iniciando processamento de dividendos em batch...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // Busca FIIs com dividendo nos últimos 30 dias
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

            // Busca investimentos e calcula posição por usuário
            const userPositions = {};
            const allUserInvestments = await Investment.findAll({
                where: { assetId: asset.id },
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

                // IDEMPOTÊNCIA: Verifica se já existe esse dividendo
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
                    withholdingTax: 0,
                    netAmount: grossAmount,
                    exDate: paymentDate,
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
 */
const updatePendingDividends = async () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const updated = await Dividend.update(
        { status: 'RECEIVED' },
        {
            where: {
                status: 'PENDING',
                paymentDate: { [Op.lte]: today }
            }
        }
    );

    if (updated[0] > 0) {
        logger.info(`💰 [DIVIDEND_CRON] ${updated[0]} dividendos: PENDING → RECEIVED`);
    }

    return updated[0];
};

/**
 * Inicializa cron de dividendos - 1x/DIA às 18:00 BRT
 */
const initDividendProcessingCron = () => {
    // Apenas 1x/dia às 18:00 BRT (21:00 UTC) - após fechamento do pregão
    cron.schedule('0 21 * * *', async () => {
        logger.info('⏰ [DIVIDEND_CRON] Processamento diário (18:00 BRT)...');
        try {
            await processDividends();
            await updatePendingDividends();
        } catch (error) {
            logger.error(`❌ [DIVIDEND_CRON] Erro: ${error.message}`);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    logger.info('📅 [DIVIDEND_CRON] Agendado: 1x/dia às 18:00 BRT');
};

/**
 * Execução manual para admin/testes
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
