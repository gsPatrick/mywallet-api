/**
 * Assets Service - Sincronização COMPLETA B3
 * Popula banco com TODOS os ~2.170 ativos
 */

const { Asset } = require('../../models');
const brapiClient = require('./brapi.client');
const { logger } = require('../../config/logger');
const { Op } = require('sequelize');

/**
 * Classifica tipo do ativo pelo ticker
 */
const determineType = (ticker) => {
    const t = ticker.toUpperCase();

    // Criptos (Yahoo usa -USD)
    if (t.includes('-USD')) return 'CRYPTO';

    // FIIs terminam com 11
    if (t.endsWith('11')) return 'FII';

    // BDRs terminam com 32, 33, 34, 35
    if (t.match(/\d{2}(32|33|34|35)$/)) return 'BDR';

    // Ações terminam com 3, 4, 5, 6, etc
    if (t.match(/\d{1}$/)) return 'STOCK';

    return 'OTHER';
};

/**
 * Sincroniza TODOS os ativos da B3
 * Roda em background no login ou via cron
 */
const syncAllAssets = async () => {
    logger.info('🚀 Sincronizando catálogo completo da B3...');

    try {
        // 1. Busca lista completa de tickers (~2.170)
        const allTickers = await brapiClient.getAvailableStocksList();

        if (!allTickers.length) {
            return { error: 'Nenhum ativo retornado' };
        }

        logger.info(`📊 Total de ativos a processar: ${allTickers.length}`);

        let processed = 0;
        let created = 0;
        let updated = 0;

        // 2. Processa em lotes de 20 (limite da API)
        for (let i = 0; i < allTickers.length; i += 20) {
            const batch = allTickers.slice(i, i + 20);

            try {
                // 3. Busca detalhes do lote
                const details = await brapiClient.getStocksDetails(batch);

                // 4. Salva/Atualiza no banco
                for (const detail of details) {
                    try {
                        const [asset, wasCreated] = await Asset.upsert({
                            ticker: detail.ticker,
                            name: detail.name,
                            logoUrl: detail.logo,
                            type: determineType(detail.ticker),
                            sector: detail.sector,
                            isActive: true,
                            updatedAt: new Date()
                        }, {
                            conflictFields: ['ticker']
                        });

                        if (wasCreated) created++;
                        else updated++;

                        processed++;

                    } catch (dbError) {
                        logger.error(`Erro ao salvar ${detail.ticker}:`, dbError.message);
                    }
                }

                // 5. Log de progresso
                const progress = Math.round((i / allTickers.length) * 100);
                if (progress % 10 === 0) {
                    logger.info(`⏳ Progresso: ${progress}% (${processed}/${allTickers.length})`);
                }

                // 6. Rate limit: aguarda 1s entre lotes
                if (i + 20 < allTickers.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (batchError) {
                logger.error(`Erro no lote ${i}-${i + 20}:`, batchError.message);
            }
        }

        logger.info('✅ Sincronização concluída!');
        logger.info(`📈 Processados: ${processed} | Criados: ${created} | Atualizados: ${updated}`);

        return {
            total: processed,
            created,
            updated
        };

    } catch (error) {
        logger.error('❌ Erro fatal na sincronização:', error);
        throw error;
    }
};

/**
 * Busca otimizada para autocomplete (Frontend)
 */
const searchAssets = async (query) => {
    if (!query) return [];

    return await Asset.findAll({
        where: {
            [Op.or]: [
                { ticker: { [Op.iLike]: `%${query}%` } },
                { name: { [Op.iLike]: `%${query}%` } }
            ],
            isActive: true
        },
        limit: 10,
        attributes: ['ticker', 'name', 'type', 'logoUrl'],
        order: [['ticker', 'ASC']]
    });
};

/**
 * Estatísticas do catálogo
 */
const getAssetStats = async () => {
    const total = await Asset.count({ where: { isActive: true } });

    const byType = await Asset.findAll({
        attributes: [
            'type',
            [Asset.sequelize.fn('COUNT', Asset.sequelize.col('type')), 'count']
        ],
        where: { isActive: true },
        group: ['type'],
        raw: true
    });

    return {
        total,
        byType: byType.reduce((acc, item) => {
            acc[item.type] = parseInt(item.count);
            return acc;
        }, {})
    };
};

module.exports = {
    syncAllAssets,
    searchAssets,
    getAssetStats
};