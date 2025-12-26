/**
 * FII Sync Service - VERSÃO ATUALIZADA
 * Orquestra sincronização de dados de FIIs
 * ========================================
 * 
 * Fluxo:
 * 1. Scraper coleta dados brutos
 * 2. Analysis service interpreta e enriquece
 * 3. Dados são persistidos no FIIData
 * 4. API entrega valor ao investidor
 */

const { FIIData, Asset, Investment } = require('../../models');
const fiiScraper = require('./fiiMetrics.scraper');
const fiiAnalysis = require('./fiiAnalysis.service');
const { logger } = require('../../config/logger');
const { Op } = require('sequelize');

/**
 * Sincroniza dados de um FII específico
 * @param {string} ticker - Ticker do FII
 * @returns {Promise<object>} - Dados atualizados
 */
const syncFII = async (ticker) => {
    const normalizedTicker = ticker.toUpperCase().trim();

    try {
        // 1. Scraper coleta dados brutos
        const scrapedData = await fiiScraper.getFIIMetrics(normalizedTicker);

        // 2. Analysis service interpreta e enriquece
        const enrichedData = fiiAnalysis.enrichWithAnalysis(scrapedData);

        // 3. Upsert no banco
        const [fiiData, created] = await FIIData.upsert({
            ticker: normalizedTicker,
            name: enrichedData.name,
            segment: enrichedData.segment,
            price: enrichedData.price,
            priceSource: enrichedData.priceSource,
            pvp: enrichedData.pvp,
            netWorth: enrichedData.netWorth,
            equityValue: enrichedData.equityValue,
            dailyLiquidity: enrichedData.dailyLiquidity,
            shareholders: enrichedData.shareholders,
            lastDividend: enrichedData.lastDividend,
            lastDividendDate: enrichedData.lastDividendDate,
            dividendYieldMonth: enrichedData.dividendYieldMonth,
            dividendYieldYear: enrichedData.dividendYieldYear,
            annualDividendSum: enrichedData.annualDividendSum,
            dividendCount12m: enrichedData.dividendCount12m,
            dividendHistory: enrichedData.dividendHistory,
            // Métricas derivadas
            dividendTrend: enrichedData.dividendTrend,
            paymentConsistency: enrichedData.paymentConsistency,
            riskLevel: enrichedData.riskLevel,
            pvpStatus: enrichedData.pvpStatus,
            // Controle
            lastSyncAt: new Date(),
            lastSyncStatus: 'SUCCESS',
            lastSyncError: null,
            errorCount: 0
        }, {
            returning: true
        });

        logger.info(`✅ [FII_SYNC] ${normalizedTicker} sincronizado | DY: ${enrichedData.dividendYieldYear}% | P/VP: ${enrichedData.pvp || 'N/A'} | Risco: ${enrichedData.riskLevel}`);

        return {
            success: true,
            ticker: normalizedTicker,
            data: enrichedData,
            created
        };

    } catch (error) {
        // Atualiza status de erro no banco
        try {
            await FIIData.upsert({
                ticker: normalizedTicker,
                lastSyncAt: new Date(),
                lastSyncStatus: 'ERROR',
                lastSyncError: error.message,
                errorCount: FIIData.sequelize?.literal ?
                    FIIData.sequelize.literal('COALESCE(error_count, 0) + 1') : 1
            });
        } catch (dbError) {
            logger.warn(`⚠️ [FII_SYNC] Erro ao salvar status de erro: ${dbError.message}`);
        }

        logger.error(`❌ [FII_SYNC] Erro ao sincronizar ${normalizedTicker}: ${error.message}`);

        return {
            success: false,
            ticker: normalizedTicker,
            error: error.message
        };
    }
};

/**
 * Sincroniza todos os FIIs da carteira de todos os usuários
 * @returns {Promise<object>} - Resumo da sincronização
 */
const syncAllUserFIIs = async () => {
    logger.info('🔄 [FII_SYNC] Iniciando sincronização de FIIs das carteiras...');

    // Busca todos os FIIs únicos que os usuários possuem
    const fiis = await Investment.findAll({
        include: [{
            model: Asset,
            as: 'asset',
            where: { type: 'FII' },
            attributes: ['ticker']
        }],
        attributes: [],
        group: ['asset.ticker'],
        raw: true
    });

    const uniqueTickers = [...new Set(fiis.map(f => f['asset.ticker']).filter(Boolean))];

    if (uniqueTickers.length === 0) {
        logger.info('📭 [FII_SYNC] Nenhum FII encontrado nas carteiras');
        return { synced: 0, errors: 0, tickers: [] };
    }

    logger.info(`📊 [FII_SYNC] Sincronizando ${uniqueTickers.length} FIIs: ${uniqueTickers.join(', ')}`);

    let synced = 0;
    let errors = 0;
    const results = [];

    for (const ticker of uniqueTickers) {
        const result = await syncFII(ticker);
        results.push(result);

        if (result.success) {
            synced++;
        } else {
            errors++;
        }
    }

    logger.info(`✅ [FII_SYNC] Concluído: ${synced} sucesso, ${errors} erros`);

    return {
        synced,
        errors,
        total: uniqueTickers.length,
        tickers: uniqueTickers,
        results
    };
};

/**
 * Sincroniza TODOS os FIIs do SISTEMA (tabela Asset type='FII')
 * Usado no startup para pré-popular cache com todos os FIIs disponíveis
 * @param {number} limit - Limite de FIIs para sincronizar (evitar rate limit)
 * @returns {Promise<object>} - Resumo da sincronização
 */
const syncAllSystemFIIs = async (limit = 20) => {
    logger.info('🏦 [FII_SYNC] Iniciando sincronização de TODOS os FIIs do sistema...');

    // Busca todos os FIIs cadastrados no sistema
    const fiis = await Asset.findAll({
        where: { type: 'FII' },
        attributes: ['ticker'],
        order: [['ticker', 'ASC']],
        limit
    });

    const tickers = fiis.map(f => f.ticker).filter(Boolean);

    if (tickers.length === 0) {
        logger.info('📭 [FII_SYNC] Nenhum FII cadastrado no sistema');
        return { synced: 0, errors: 0, total: 0, tickers: [] };
    }

    logger.info(`🏦 [FII_SYNC] Sincronizando ${tickers.length} FIIs do sistema: ${tickers.slice(0, 5).join(', ')}...`);

    let synced = 0;
    let errors = 0;
    const results = [];

    for (const ticker of tickers) {
        // Delay entre requests para evitar rate limit
        if (synced > 0 || errors > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos entre requests
        }

        const result = await syncFII(ticker);
        results.push(result);

        if (result.success) {
            synced++;
        } else {
            errors++;
        }
    }

    logger.info(`🏦 [FII_SYNC] Sistema: ${synced}/${tickers.length} FIIs sincronizados, ${errors} erros`);

    return {
        synced,
        errors,
        total: tickers.length,
        tickers,
        results
    };
};


/**
 * Busca dados completos de um FII (com insights)
 * @param {string} ticker - Ticker do FII
 * @param {boolean} forceRefresh - Se true, faz scrape mesmo com cache válido
 * @returns {Promise<object|null>} - Dados do FII ou null
 */
const getFIIDataComplete = async (ticker, forceRefresh = false) => {
    const normalizedTicker = ticker.toUpperCase().trim();

    // Busca do cache
    let fiiData = await FIIData.findOne({
        where: { ticker: normalizedTicker }
    });

    // Se não existe ou forceRefresh, faz sync
    if (!fiiData || forceRefresh) {
        const result = await syncFII(normalizedTicker);
        if (result.success) {
            fiiData = await FIIData.findOne({
                where: { ticker: normalizedTicker }
            });
        }
    }

    if (!fiiData) {
        return null;
    }

    // Verifica se dados estão muito antigos (> 3 dias) e faz refresh em background
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    if (fiiData.lastSyncAt && new Date(fiiData.lastSyncAt) < threeDaysAgo) {
        syncFII(normalizedTicker).catch(err => {
            logger.warn(`⚠️ [FII_SYNC] Background refresh failed for ${normalizedTicker}: ${err.message}`);
        });
    }

    // Gera insights em tempo real (podem mudar com novos critérios)
    const insights = fiiAnalysis.generateInvestorInsights({
        ...fiiData.toJSON(),
        dividendYieldYear: parseFloat(fiiData.dividendYieldYear) || 0,
        pvp: parseFloat(fiiData.pvp) || 0,
        dailyLiquidity: parseFloat(fiiData.dailyLiquidity) || 0,
        paymentConsistency: parseFloat(fiiData.paymentConsistency) || 0
    });

    return {
        // Identificação
        ticker: fiiData.ticker,
        name: fiiData.name,
        segment: fiiData.segment,

        // Preço
        price: parseFloat(fiiData.price) || 0,
        pvp: parseFloat(fiiData.pvp) || null,
        pvpStatus: fiiData.pvpStatus,
        equityValue: parseFloat(fiiData.equityValue) || null,

        // Patrimônio e Liquidez
        netWorth: parseFloat(fiiData.netWorth) || null,
        dailyLiquidity: parseFloat(fiiData.dailyLiquidity) || null,
        shareholders: fiiData.shareholders,

        // Dividendos
        lastDividend: parseFloat(fiiData.lastDividend) || 0,
        lastDividendDate: fiiData.lastDividendDate,
        dividendYieldMonth: parseFloat(fiiData.dividendYieldMonth) || null,
        dividendYieldYear: parseFloat(fiiData.dividendYieldYear) || 0,
        annualDividendSum: parseFloat(fiiData.annualDividendSum) || 0,
        dividendCount12m: fiiData.dividendCount12m,
        dividendHistory: fiiData.dividendHistory || [],

        // Análise
        dividendTrend: fiiData.dividendTrend,
        paymentConsistency: parseFloat(fiiData.paymentConsistency) || 0,
        riskLevel: fiiData.riskLevel,

        // Insights para o investidor
        investorInsights: insights,

        // Meta
        lastSyncAt: fiiData.lastSyncAt,
        lastSyncStatus: fiiData.lastSyncStatus
    };
};

/**
 * Busca dados de múltiplos FIIs
 * @param {string[]} tickers - Lista de tickers
 * @returns {Promise<object>} - Map ticker -> dados
 */
const getMultipleFIIData = async (tickers) => {
    const results = {};

    // Busca todos do cache de uma vez
    const normalizedTickers = tickers.map(t => t.toUpperCase().trim());

    const cachedData = await FIIData.findAll({
        where: {
            ticker: { [Op.in]: normalizedTickers }
        }
    });

    // Mapeia cache existente
    const cacheMap = {};
    cachedData.forEach(fd => {
        cacheMap[fd.ticker] = fd;
    });

    // Para cada ticker, usa cache ou busca
    for (const ticker of normalizedTickers) {
        if (cacheMap[ticker]) {
            const fd = cacheMap[ticker];
            results[ticker] = {
                ticker: fd.ticker,
                name: fd.name,
                segment: fd.segment,
                price: parseFloat(fd.price) || 0,
                pvp: parseFloat(fd.pvp) || null,
                pvpStatus: fd.pvpStatus,
                dailyLiquidity: parseFloat(fd.dailyLiquidity) || null,
                shareholders: fd.shareholders,
                lastDividend: parseFloat(fd.lastDividend) || 0,
                lastDividendDate: fd.lastDividendDate,
                dividendYieldMonth: parseFloat(fd.dividendYieldMonth) || null,
                dividendYieldYear: parseFloat(fd.dividendYieldYear) || 0,
                annualDividendSum: parseFloat(fd.annualDividendSum) || 0,
                dividendHistory: fd.dividendHistory || [],
                dividendTrend: fd.dividendTrend,
                paymentConsistency: parseFloat(fd.paymentConsistency) || 0,
                riskLevel: fd.riskLevel,
                lastSyncAt: fd.lastSyncAt
            };
        } else {
            // Não tem cache, tenta buscar
            const data = await getFIIDataComplete(ticker);
            results[ticker] = data;
        }
    }

    return results;
};

/**
 * Lista todos os FIIs cacheados com métricas resumidas
 * @returns {Promise<array>}
 */
const listCachedFIIs = async () => {
    const fiis = await FIIData.findAll({
        order: [['dividendYieldYear', 'DESC']]
    });

    return fiis.map(fd => ({
        ticker: fd.ticker,
        name: fd.name,
        segment: fd.segment,
        price: parseFloat(fd.price) || 0,
        pvp: parseFloat(fd.pvp) || null,
        pvpStatus: fd.pvpStatus,
        dividendYieldYear: parseFloat(fd.dividendYieldYear) || 0,
        riskLevel: fd.riskLevel,
        lastSyncAt: fd.lastSyncAt
    }));
};

/**
 * Compara dois FIIs
 * @param {string} ticker1 
 * @param {string} ticker2 
 * @returns {Promise<object>}
 */
const compareFIIs = async (ticker1, ticker2) => {
    const fii1 = await getFIIDataComplete(ticker1);
    const fii2 = await getFIIDataComplete(ticker2);

    if (!fii1 || !fii2) {
        throw new Error('Um ou ambos os FIIs não foram encontrados');
    }

    return fiiAnalysis.compareFIIs(fii1, fii2);
};

module.exports = {
    syncFII,
    syncAllUserFIIs,
    syncAllSystemFIIs,
    getFIIDataComplete,
    getMultipleFIIData,
    listCachedFIIs,
    compareFIIs
};
