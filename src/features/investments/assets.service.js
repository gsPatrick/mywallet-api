const { Asset } = require('../../models');
const brapiClient = require('./brapi.client');
const { logger } = require('../../config/logger');
const { Op } = require('sequelize');

// Helper para classificar o ativo
const determineType = (stock) => {
    const ticker = stock.ticker.toUpperCase();

    // ETFs costumam ter 11, mas precisamos diferenciar de FIIs
    // A Brapi às vezes manda 'fund' para FIIs e ETFs.
    // Lógica simplificada (pode ser melhorada):
    if (stock.type === 'fund') return 'FII';
    if (ticker.endsWith('31') || ticker.endsWith('33') || ticker.endsWith('34')) return 'BDR';
    if (ticker.endsWith('11')) return 'FII'; // Maioria 11 é FII ou ETF
    return 'STOCK';
};

const syncAllAssets = async () => {
    logger.info('🚀 Iniciando sincronização do catálogo de ativos...');

    const assetsList = await brapiClient.getAvailableStocksList();

    if (!assetsList.length) return { error: 'Nenhum dado recebido da API' };

    let count = 0;
    const batchSize = 100;

    // Processamento em lote para performance
    for (let i = 0; i < assetsList.length; i += batchSize) {
        const chunk = assetsList.slice(i, i + batchSize);

        const upsertData = chunk.map(item => ({
            ticker: item.ticker,
            name: item.name,
            logoUrl: item.logo, // Salva a URL da imagem
            type: determineType(item),
            sector: item.sector,
            updatedAt: new Date()
        }));

        await Asset.bulkCreate(upsertData, {
            updateOnDuplicate: ['name', 'logoUrl', 'sector', 'updatedAt']
        });

        count += chunk.length;
    }

    logger.info(`✅ Catálogo atualizado: ${count} ativos sincronizados.`);
    return { total: count };
};

// Busca otimizada para o Frontend (Autocomplete)
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
        attributes: ['ticker', 'name', 'type', 'logoUrl'] // Retorna a logo pro front
    });
};

module.exports = { syncAllAssets, searchAssets };