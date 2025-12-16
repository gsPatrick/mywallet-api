const { Investment, Dividend, Asset } = require('../../models');
const yahooClient = require('./yahoo.client'); // Usa o Yahoo agora
const { logger } = require('../../config/logger');

const syncUserDividends = async (userId) => {
    const userHoldings = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
    });

    const uniqueAssets = [...new Set(userHoldings.map(h => h.asset.ticker))];

    // Data inicial para busca (ex: começo do ano passado)
    const startDate = '2024-01-01';

    for (const ticker of uniqueAssets) {
        try {
            // Busca no Yahoo
            const dividendsData = await yahooClient.getDividendsHistory(ticker, startDate);

            if (!dividendsData.length) continue;

            const asset = userHoldings.find(h => h.asset.ticker === ticker).asset;

            for (const div of dividendsData) {
                // No Yahoo, a data do evento geralmente é a Data Com ou Pagamento
                // Vamos simplificar e considerar como Data de Pagamento para o registro
                const paymentDate = new Date(div.date);

                // Verifica quantidade que o usuário tinha ANTES dessa data
                let quantityOwned = 0;
                userHoldings.forEach(inv => {
                    if (inv.asset.ticker === ticker && new Date(inv.date) < paymentDate) {
                        quantityOwned += parseFloat(inv.quantity);
                    }
                });

                if (quantityOwned <= 0) continue;

                const totalAmount = quantityOwned * div.amount;

                // Verifica duplicidade
                const existingDiv = await Dividend.findOne({
                    where: {
                        userId,
                        assetId: asset.id,
                        paymentDate: paymentDate,
                        amountPerUnit: div.amount // Usa o valor como chave composta para evitar duplicata
                    }
                });

                if (!existingDiv) {
                    await Dividend.create({
                        userId,
                        assetId: asset.id,
                        type: 'DIVIDEND', // Yahoo não especifica se é JCP
                        amountPerUnit: div.amount,
                        quantity: quantityOwned,
                        grossAmount: totalAmount,
                        netAmount: totalAmount,
                        exDate: paymentDate, // Yahoo simplifica as datas
                        paymentDate: paymentDate,
                        status: 'RECEIVED',
                        origin: 'YAHOO'
                    });
                    logger.info(`💰 Dividendo Yahoo: ${ticker} - R$ ${totalAmount}`);
                }
            }
        } catch (error) {
            logger.error(`Erro sync dividendos ${ticker}: ${error.message}`);
        }
    }
};

module.exports = { syncUserDividends };