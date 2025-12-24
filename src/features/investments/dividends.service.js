/**
 * Dividends Service - VERSÃO CORRIGIDA
 * Sincroniza proventos e gera notificações
 * 
 * Correções aplicadas:
 * - Estratégia Híbrida: FIIs usam Brapi, Ações usam Yahoo
 * - Yahoo não tem dados confiáveis de FIIs brasileiros
 * - Brapi tem rendimentos de FIIs completos
 */

const { Investment, Dividend, Asset, Notification } = require('../../models');
const yahooClient = require('./yahoo.client');
const brapiClient = require('./brapi.client');
const { Op } = require('sequelize');
const { logger } = require('../../config/logger');

/**
 * Sincroniza dividendos para um usuário específico
 * Deve ser chamado no LOGIN (em background)
 * 
 * ESTRATÉGIA HÍBRIDA:
 * - FIIs → Brapi (dados mais confiáveis para rendimentos mensais)
 * - Ações/BDRs → Yahoo (funciona bem e é grátis)
 */
const syncUserDividends = async (userId) => {
    logger.info(`🔄 [DIVIDENDS] Iniciando sync para usuário ${userId}...`);

    // 1. Pega todos os investimentos do usuário
    const userHoldings = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
    });

    if (!userHoldings.length) {
        logger.info(`📭 [DIVIDENDS] Usuário ${userId} não possui investimentos`);
        return { newDividends: 0 };
    }

    // Lista única de assets (não apenas tickers)
    const uniqueAssetsMap = new Map();
    for (const holding of userHoldings) {
        if (holding.asset) {
            uniqueAssetsMap.set(holding.asset.ticker, holding.asset);
        }
    }
    const uniqueAssets = Array.from(uniqueAssetsMap.values());

    // Data inicial para busca
    const startDate = '2024-01-01';

    let newDividendsCount = 0;
    let fiisProcessed = 0;
    let stocksProcessed = 0;

    for (const asset of uniqueAssets) {
        try {
            let dividendsHistory = [];

            // ✅ ESTRATÉGIA HÍBRIDA: FIIs usam Brapi, Ações usam Yahoo
            if (asset.type === 'FII') {
                // FIIs: Brapi tem dados mais confiáveis
                logger.debug(`🏢 [DIVIDENDS] ${asset.ticker}: Buscando via Brapi (FII)`);
                dividendsHistory = await brapiClient.getDividendsHistory(asset.ticker, startDate);
                fiisProcessed++;
            } else {
                // Ações e BDRs: Yahoo funciona bem
                logger.debug(`📊 [DIVIDENDS] ${asset.ticker}: Buscando via Yahoo (${asset.type})`);
                dividendsHistory = await yahooClient.getDividendsHistory(asset.ticker, startDate);
                stocksProcessed++;
            }

            if (!dividendsHistory || dividendsHistory.length === 0) {
                continue;
            }

            logger.info(`💰 [DIVIDENDS] ${asset.ticker}: ${dividendsHistory.length} dividendos encontrados`);

            for (const div of dividendsHistory) {
                const paymentDate = new Date(div.date);
                const exDate = div.exDate ? new Date(div.exDate) : paymentDate;

                // 3. REGRA DE OURO: Calcula quantidade que o usuário tinha NA DATA-COM (ex-date)
                let quantityOwned = 0;

                userHoldings.forEach(inv => {
                    const tradeDate = new Date(inv.date);
                    // Se a operação foi antes da data-com (ex-date)
                    if (inv.asset.ticker === asset.ticker && tradeDate < exDate) {
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
                    const origin = asset.type === 'FII' ? 'BRAPI' : 'YAHOO';

                    await Dividend.create({
                        userId,
                        assetId: asset.id,
                        type: div.type || 'DIVIDEND',
                        amountPerUnit: div.amount,
                        quantity: quantityOwned,
                        grossAmount: totalAmount,
                        netAmount: totalAmount, // Simplificação (sem IR)
                        exDate: exDate,
                        paymentDate: paymentDate,
                        status: 'RECEIVED',
                        origin: origin
                    });

                    // B) Cria a Notificação para o Usuário
                    await Notification.create({
                        userId,
                        type: 'GENERAL',
                        title: '💰 Dividendo Recebido!',
                        message: `Você recebeu R$ ${totalAmount.toFixed(2)} de ${asset.ticker}`,
                        isRead: false,
                        isDisplayed: false,
                        scheduledFor: new Date()
                    });

                    newDividendsCount++;
                    logger.info(`✅ [DIVIDENDS] Novo: ${asset.ticker} - R$ ${totalAmount.toFixed(2)} (${origin})`);
                }
            }
        } catch (error) {
            logger.error(`❌ [DIVIDENDS] Erro sync ${asset.ticker}: ${error.message}`);
        }
    }

    const summary = {
        newDividends: newDividendsCount,
        fiisProcessed,
        stocksProcessed,
        totalAssets: uniqueAssets.length
    };

    if (newDividendsCount > 0) {
        logger.info(`🎉 [DIVIDENDS] Sync concluído: ${newDividendsCount} novos dividendos`);
    } else {
        logger.info(`📊 [DIVIDENDS] Sync concluído: nenhum novo dividendo`);
    }

    return summary;
};

/**
 * Lista dividendos do usuário
 */
const listDividends = async (userId) => {
    return await Dividend.findAll({
        where: { userId },
        include: [{
            model: Asset,
            as: 'asset',
            attributes: ['ticker', 'name', 'type', 'logoUrl']
        }],
        order: [['paymentDate', 'DESC']]
    });
};

/**
 * Força sync de dividendos para um ativo específico
 */
const syncAssetDividends = async (userId, assetId) => {
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
        throw new Error('Ativo não encontrado');
    }

    logger.info(`🔄 [DIVIDENDS] Forçando sync para ${asset.ticker}...`);

    const startDate = '2024-01-01';
    let dividendsHistory = [];

    if (asset.type === 'FII') {
        dividendsHistory = await brapiClient.getDividendsHistory(asset.ticker, startDate);
    } else {
        dividendsHistory = await yahooClient.getDividendsHistory(asset.ticker, startDate);
    }

    logger.info(`💰 [DIVIDENDS] ${asset.ticker}: ${dividendsHistory.length} dividendos encontrados`);

    return {
        ticker: asset.ticker,
        type: asset.type,
        source: asset.type === 'FII' ? 'BRAPI' : 'YAHOO',
        dividendsFound: dividendsHistory.length,
        dividends: dividendsHistory
    };
};

module.exports = {
    syncUserDividends,
    listDividends,
    syncAssetDividends
};