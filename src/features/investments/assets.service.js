/**
 * Assets Service - VERSÃO CORRIGIDA
 * Sincroniza ativos do mercado B3 usando Brapi
 * 
 * Correções aplicadas:
 * - syncAllAssets busca AÇÕES E FIIs separadamente
 * - determineAssetType usa campo 'type' da API como fonte da verdade
 * - Fallback com regex para casos onde type não existe
 */
const { Asset } = require('../../models');
const brapiClient = require('./brapi.client');
const { logger } = require('../../config/logger');
const { Op } = require('sequelize');

/**
 * Helper para descobrir o tipo do ativo baseado nos dados da API
 * PRIORIDADE: 
 * 1. Campo 'type' da Brapi (mais confiável)
 * 2. Fallback: análise do ticker
 */
const determineAssetType = (stockData) => {
    const ticker = stockData.stock || stockData.ticker || '';
    const type = stockData.type; // Brapi retorna: 'stock', 'fund', 'bdr', etc

    // 1. ✅ Usar campo 'type' da API como fonte da verdade
    if (type) {
        if (type === 'fund') return 'FII';
        if (type === 'bdr') return 'BDR';
        if (type === 'stock') return 'STOCK';
        if (type === 'etf') return 'ETF';
    }

    // 2. Fallback: análise do ticker (padrão B3)
    const lastTwo = ticker.match(/\d{2}$/)?.[0]; // Pega os 2 últimos dígitos

    if (lastTwo === '11') {
        // 11 pode ser FII ou ETF - se não temos type, assume FII
        return 'FII';
    }

    if (['31', '32', '33', '34', '35'].includes(lastTwo)) {
        return 'BDR';
    }

    // Padrão: ações (3, 4, 5, 6, etc)
    return 'STOCK';
};

/**
 * Sincroniza o banco de dados com todos os ativos da B3
 * Busca AÇÕES e FIIs separadamente para garantir cobertura completa
 * Deve ser rodado via CRON JOB (ex: 1x por semana) ou manualmente pelo Admin
 */
const syncAllAssets = async () => {
    logger.info('🔄 Iniciando sincronização completa de ativos...');

    try {
        // 1. Busca ações (stocks)
        const stocksList = await brapiClient.getAvailableStocksList();
        logger.info(`📊 Ações encontradas: ${stocksList.length}`);

        // 2. Busca FIIs separadamente (type=fund)
        const fiisList = await brapiClient.getAvailableFIIs();
        logger.info(`🏢 FIIs encontrados: ${fiisList.length}`);

        // 3. Consolidar listas (remove duplicatas por ticker)
        const allAssetsMap = new Map();

        // Adiciona ações primeiro
        for (const stock of stocksList) {
            const ticker = stock.stock || stock.ticker;
            if (ticker) {
                allAssetsMap.set(ticker, { ...stock, sourceList: 'stocks' });
            }
        }

        // Adiciona FIIs (sobrescreve se já existir para usar dados do endpoint de FIIs)
        for (const fii of fiisList) {
            const ticker = fii.stock || fii.ticker;
            if (ticker) {
                allAssetsMap.set(ticker, { ...fii, sourceList: 'fiis' });
            }
        }

        const consolidatedList = Array.from(allAssetsMap.values());
        logger.info(`📈 Total consolidado (sem duplicatas): ${consolidatedList.length} ativos`);

        if (consolidatedList.length === 0) {
            throw new Error('Nenhum ativo encontrado nas fontes externas.');
        }

        let count = 0;
        const batchSize = 100;

        // Processar em lotes
        for (let i = 0; i < consolidatedList.length; i += batchSize) {
            const batch = consolidatedList.slice(i, i + batchSize);

            const assetsToUpsert = batch.map(stock => ({
                ticker: stock.stock || stock.ticker,
                name: stock.name || stock.stock || stock.ticker,
                type: determineAssetType(stock),
                logoUrl: stock.logo,
                isActive: true,
                updatedAt: new Date()
            }));

            // Upsert: Cria se não existe, Atualiza se existe
            await Asset.bulkCreate(assetsToUpsert, {
                updateOnDuplicate: ['name', 'type', 'logoUrl', 'updatedAt']
            });

            count += batch.length;

            // Log a cada 500 para não poluir
            if (count % 500 === 0 || count === consolidatedList.length) {
                logger.info(`📦 Processados ${count} de ${consolidatedList.length} ativos...`);
            }
        }

        logger.info('✅ Sincronização de ativos concluída com sucesso!');
        return {
            totalSynced: count,
            stocks: stocksList.length,
            fiis: fiisList.length
        };

    } catch (error) {
        logger.error('❌ Erro na sincronização de ativos:', error.message);
        throw error;
    }
};

/**
 * Busca ativos para o Autocomplete (Dropdown)
 */
const searchAssets = async (query) => {
    if (!query || query.length < 2) return [];

    return await Asset.findAll({
        where: {
            [Op.or]: [
                { ticker: { [Op.iLike]: `%${query}%` } },
                { name: { [Op.iLike]: `%${query}%` } }
            ],
            isActive: true
        },
        limit: 15, // Aumentado de 10 para 15
        attributes: ['id', 'ticker', 'name', 'type', 'logoUrl'],
        order: [['ticker', 'ASC']]
    });
};

/**
 * Busca ativo por ticker
 */
const getAssetByTicker = async (ticker) => {
    return await Asset.findOne({
        where: {
            ticker: ticker.toUpperCase(),
            isActive: true
        }
    });
};

module.exports = {
    syncAllAssets,
    searchAssets,
    getAssetByTicker,
    determineAssetType // Exportar para testes
};