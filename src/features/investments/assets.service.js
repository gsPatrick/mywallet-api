/**
 * --- FILE: src/features/investments/assets.service.js ---
 */
const { Asset } = require('../../models');
const brapiClient = require('./brapi.client');
const { logger } = require('../../config/logger');
const { Op } = require('sequelize');

/**
 * Helper para descobrir o tipo do ativo baseado no ticker e dados
 */
const determineAssetType = (stockData) => {
    const ticker = stockData.stock;
    const type = stockData.type; // A Brapi as vezes manda 'stock' ou 'fund'

    // Lógica baseada no final do ticker (Padrão B3)
    const end = ticker.match(/\d+$/)?.[0];

    if (type === 'fund' || end === '11') {
        // Se tem 11 no final, geralmente é FII ou ETF
        // Para simplificar, se não tivermos certeza, marcamos como FII
        // Num sistema perfeito, precisaria de uma lista de ETFs separada
        return 'FII';
    }

    if (end === '31' || end === '32' || end === '33' || end === '34' || end === '35') {
        return 'BDR';
    }

    return 'STOCK'; // Padrão (3, 4, etc)
};

/**
 * Sincroniza o banco de dados com todos os ativos da B3
 * Deve ser rodado via CRON JOB (ex: 1x por semana) ou manualmente pelo Admin
 */
const syncAllAssets = async () => {
    logger.info('Iniciando sincronização de ativos...');

    const stocksList = await brapiClient.getAvailableStocksList();

    if (!stocksList || stocksList.length === 0) {
        throw new Error('Nenhum ativo encontrado na fonte externa.');
    }

    let count = 0;
    const batchSize = 100; // Salvar em lotes para não travar o banco

    // Processar em lotes
    for (let i = 0; i < stocksList.length; i += batchSize) {
        const batch = stocksList.slice(i, i + batchSize);

        const assetsToUpsert = batch.map(stock => ({
            ticker: stock.stock,
            name: stock.name || stock.stock, // Usa o ticker se não tiver nome
            type: determineAssetType(stock),
            logoUrl: stock.logo, // Se a API fornecer logo
            isActive: true,
            updatedAt: new Date()
        }));

        // Upsert: Cria se não existe, Atualiza se existe
        await Asset.bulkCreate(assetsToUpsert, {
            updateOnDuplicate: ['name', 'type', 'logoUrl', 'updatedAt']
        });

        count += batch.length;
        logger.info(`Processados ${count} de ${stocksList.length} ativos...`);
    }

    logger.info('✅ Sincronização de ativos concluída com sucesso!');
    return { totalSynced: count };
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
        limit: 10, // Retorna apenas os 10 melhores resultados
        attributes: ['id', 'ticker', 'name', 'type', 'logoUrl']
    });
};

module.exports = {
    syncAllAssets,
    searchAssets
};