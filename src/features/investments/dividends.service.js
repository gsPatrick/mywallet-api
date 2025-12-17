/**
 * Dividends Service
 * Sincroniza proventos e gera notificações
 */

const { Investment, Dividend, Asset, Notification } = require('../../models');
const yahooClient = require('./yahoo.client');
const { Op } = require('sequelize');
const { logger } = require('../../config/logger');

/**
 * Sincroniza dividendos para um usuário específico
 * Deve ser chamado no LOGIN (em background)
 */
const syncUserDividends = async (userId) => {
    logger.info(`🔄 Iniciando sync de dividendos para usuário ${userId}...`);

    // 1. Pega todos os investimentos do usuário
    const userHoldings = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
    });

    if (!userHoldings.length) return;

    // Lista única de tickers (ex: ['PETR4', 'VALE3'])
    const uniqueAssets = [...new Set(userHoldings.map(h => h.asset.ticker))];

    // Data inicial para busca (ex: Início deste ano ou do ano passado)
    const startDate = '2024-01-01';

    let newDividendsCount = 0;

    for (const ticker of uniqueAssets) {
        try {
            // 2. Busca histórico no Yahoo
            const dividendsHistory = await yahooClient.getDividendsHistory(ticker, startDate);

            if (!dividendsHistory.length) continue;

            // Pega o ID do ativo no banco
            const asset = userHoldings.find(h => h.asset.ticker === ticker).asset;

            for (const div of dividendsHistory) {
                const paymentDate = new Date(div.date);

                // 3. REGRA DE OURO: Calcula quantidade que o usuário tinha NAQUELA DATA
                // Soma compras feitas ANTES da data do dividendo
                // Subtrai vendas feitas ANTES da data do dividendo
                let quantityOwned = 0;

                userHoldings.forEach(inv => {
                    const tradeDate = new Date(inv.date);
                    // Se a operação foi antes do pagamento (simplificação da Data Com)
                    if (inv.asset.ticker === ticker && tradeDate < paymentDate) {
                        if (inv.operationType === 'BUY') {
                            quantityOwned += parseFloat(inv.quantity);
                        } else {
                            quantityOwned -= parseFloat(inv.quantity);
                        }
                    }
                });

                // Se não tinha ações na época, pula
                if (quantityOwned <= 0) continue;

                // Calcula valor total a receber
                const totalAmount = quantityOwned * div.amount;

                // 4. Verifica se já salvamos esse dividendo para não duplicar
                // Usamos Data + Valor + Asset como chave única lógica
                const existingDiv = await Dividend.findOne({
                    where: {
                        userId,
                        assetId: asset.id,
                        paymentDate: paymentDate,
                        amountPerUnit: div.amount
                    }
                });

                if (!existingDiv) {
                    // A) Salva o Dividendo
                    await Dividend.create({
                        userId,
                        assetId: asset.id,
                        type: 'DIVIDEND', // Yahoo não distingue JCP de Dividendo facilmente
                        amountPerUnit: div.amount,
                        quantity: quantityOwned,
                        grossAmount: totalAmount,
                        netAmount: totalAmount, // Simplificação (sem IR)
                        exDate: paymentDate,
                        paymentDate: paymentDate,
                        status: 'RECEIVED', // Assume recebido se está no histórico
                        origin: 'YAHOO'
                    });

                    // B) Cria a Notificação para o Usuário
                    await Notification.create({
                        userId,
                        type: 'GENERAL', // Ou crie um tipo DIVIDEND_RECEIVED no enum do model
                        title: '💰 Dividendo Recebido!',
                        message: `Você recebeu R$ ${totalAmount.toFixed(2)} de ${ticker}`,
                        isRead: false,
                        isDisplayed: false,
                        scheduledFor: new Date() // Mostrar agora
                    });

                    newDividendsCount++;
                    logger.info(`✅ Novo dividendo registrado: ${ticker} - R$ ${totalAmount}`);
                }
            }
        } catch (error) {
            logger.error(`Erro sync dividendos ${ticker}: ${error.message}`);
        }
    }

    if (newDividendsCount > 0) {
        logger.info(`🎉 Total de novos dividendos encontrados: ${newDividendsCount}`);
    }
};

const listDividends = async (userId) => {
    return await Dividend.findAll({
        where: { userId },
        include: [{
            model: Asset,
            as: 'asset',
            attributes: ['ticker', 'name', 'logoUrl']
        }],
        order: [['paymentDate', 'DESC']]
    });
};

module.exports = { syncUserDividends, listDividends };