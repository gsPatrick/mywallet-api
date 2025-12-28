/**
 * Brapi Client - VERSÃO CORRIGIDA
 * Cliente para API Brapi (cotações B3)
 * 
 * Correções aplicadas:
 * - getAvailableFIIs: Lista FIIs usando type=fund
 * - getDividendsHistory: Busca proventos de FIIs
 * - Validação: NÃO cachear preços zerados/null
 * - REDIS: Cache compartilhado entre usuários
 */

const axios = require('axios');
const cacheService = require('../../services/cache.service');
const { logger } = require('../../config/logger');

const BRAPI_BASE_URL = process.env.BRAPI_BASE_URL || 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

/**
 * Busca cotação de um ativo
 * VALIDAÇÃO CRÍTICA: Não cacheia se preço for 0 ou null
 */
const getQuote = async (ticker) => {
    const cacheKey = cacheService.KEYS.BRAPI_QUOTE(ticker);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        const url = `${BRAPI_BASE_URL}/quote/${ticker}`;
        const params = BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {};

        const response = await axios.get(url, { params, timeout: 10000 });

        if (response.data?.results?.[0]) {
            const quote = response.data.results[0];

            // ✅ VALIDAÇÃO CRÍTICA: Não cachear se preço zerado ou inválido
            if (!quote.regularMarketPrice || quote.regularMarketPrice <= 0) {
                logger.warn(`⚠️ [BRAPI] Preço zerado/inválido para ${ticker}: ${quote.regularMarketPrice}`);
                return null; // Força fallback para Yahoo
            }

            const data = {
                symbol: quote.symbol,
                shortName: quote.shortName,
                longName: quote.longName,
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                previousClose: quote.regularMarketPreviousClose,
                updatedAt: new Date(quote.regularMarketTime * 1000)
            };

            await cacheService.set(cacheKey, data, cacheService.TTL.QUOTES);
            return data;
        }

        return null;
    } catch (error) {
        logger.error(`❌ [BRAPI] Erro ao buscar cotação ${ticker}:`, error.message);
        return null;
    }
};

/**
 * Busca cotações de múltiplos ativos
 * Com validação de preços zerados
 */
const getQuotes = async (tickers) => {
    const results = {};
    const tickersToFetch = [];

    // Check cache for each ticker
    const cacheKeys = tickers.map(t => cacheService.KEYS.BRAPI_QUOTE(t));
    const cachedResults = await cacheService.getMultiple(cacheKeys);

    for (const ticker of tickers) {
        const cacheKey = cacheService.KEYS.BRAPI_QUOTE(ticker);
        if (cachedResults[cacheKey]) {
            results[ticker] = cachedResults[cacheKey];
        } else {
            tickersToFetch.push(ticker);
        }
    }

    if (tickersToFetch.length > 0) {
        try {
            const url = `${BRAPI_BASE_URL}/quote/${tickersToFetch.join(',')}`;
            const params = BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {};

            const response = await axios.get(url, { params, timeout: 15000 });

            for (const quote of response.data?.results || []) {
                // ✅ VALIDAÇÃO: Ignora preços zerados
                if (!quote.regularMarketPrice || quote.regularMarketPrice <= 0) {
                    logger.warn(`⚠️ [BRAPI] Preço zerado para ${quote.symbol}, não cacheando`);
                    continue;
                }

                const data = {
                    symbol: quote.symbol,
                    shortName: quote.shortName,
                    longName: quote.longName,
                    price: quote.regularMarketPrice,
                    change: quote.regularMarketChange,
                    changePercent: quote.regularMarketChangePercent,
                    previousClose: quote.regularMarketPreviousClose,
                    updatedAt: new Date(quote.regularMarketTime * 1000)
                };

                await cacheService.set(cacheService.KEYS.BRAPI_QUOTE(quote.symbol), data, cacheService.TTL.QUOTES);
                results[quote.symbol] = data;
            }
        } catch (error) {
            logger.error('❌ [BRAPI] Erro ao buscar cotações:', error.message);
        }
    }

    return results;
};

/**
 * Busca lista completa de ações disponíveis
 */
const getAvailableStocksList = async () => {
    try {
        const url = `${BRAPI_BASE_URL}/quote/list`;
        const params = {
            sortBy: 'name',
            sortOrder: 'asc',
            limit: 2000
        };
        if (BRAPI_TOKEN) params.token = BRAPI_TOKEN;

        logger.info('📊 [BRAPI] Buscando lista de ações...');
        const response = await axios.get(url, { params, timeout: 30000 });

        const stocks = response.data?.stocks || [];
        logger.info(`📊 [BRAPI] Encontradas ${stocks.length} ações`);
        return stocks;
    } catch (error) {
        logger.error('❌ [BRAPI] Erro ao buscar lista de ações:', error.message);
        return [];
    }
};

/**
 * Busca lista de FIIs (Fundos Imobiliários) usando type=fund
 */
const getAvailableFIIs = async () => {
    try {
        const url = `${BRAPI_BASE_URL}/quote/list`;
        const params = {
            type: 'fund', // ✅ CRÍTICO: Filtra apenas FIIs
            sortBy: 'name',
            sortOrder: 'asc',
            limit: 1000
        };
        if (BRAPI_TOKEN) params.token = BRAPI_TOKEN;

        logger.info('🏢 [BRAPI] Buscando lista de FIIs (type=fund)...');
        const response = await axios.get(url, { params, timeout: 25000 });

        const fiis = response.data?.stocks || [];
        logger.info(`🏢 [BRAPI] Encontrados ${fiis.length} FIIs`);
        return fiis;
    } catch (error) {
        logger.error('❌ [BRAPI] Erro ao buscar FIIs:', error.message);
        return [];
    }
};

/**
 * Busca histórico de dividendos/proventos de um ativo
 * Útil especialmente para FIIs (Yahoo não tem esses dados)
 * NOTA: Requer plano pago da Brapi para dados completos
 */
const getDividendsHistory = async (ticker, startDate) => {
    try {
        const url = `${BRAPI_BASE_URL}/quote/${ticker}`;
        const params = {
            dividends: true, // ✅ Requisita dados de dividendos
            fundamental: false, // Não precisa dos fundamentalistas
            modules: 'dividendsData'
        };
        if (BRAPI_TOKEN) params.token = BRAPI_TOKEN;

        const response = await axios.get(url, { params, timeout: 15000 });

        const cashDividends = response.data?.results?.[0]?.dividendsData?.cashDividends || [];

        if (cashDividends.length === 0) {
            logger.debug(`📭 [BRAPI] Nenhum dividendo encontrado para ${ticker}`);
            return [];
        }

        // Filtra por data se fornecida
        const startDateObj = startDate ? new Date(startDate) : null;

        const dividends = cashDividends
            .filter(div => {
                if (!startDateObj) return true;
                const payDate = new Date(div.paymentDate);
                return payDate >= startDateObj;
            })
            .map(div => ({
                date: div.paymentDate,
                exDate: div.exDividendDate || div.paymentDate,
                amount: div.rate,
                type: div.type || 'DIVIDEND', // DIVIDEND, JCP, etc
                relatedTo: div.relatedTo
            }));

        logger.info(`💰 [BRAPI] Encontrados ${dividends.length} dividendos para ${ticker}`);
        return dividends;

    } catch (error) {
        logger.error(`❌ [BRAPI] Erro ao buscar dividendos ${ticker}:`, error.message);
        return [];
    }
};

/**
 * Busca informações de um ativo
 */
const getAssetInfo = async (ticker) => {
    return await getQuote(ticker);
};

/**
 * Limpa cache de cotações
 */
const clearCache = async () => {
    await cacheService.flushAll();
    logger.info('🗑️ [BRAPI] Cache limpo');
};

module.exports = {
    getQuote,
    getQuotes,
    getAssetInfo,
    clearCache,
    getAvailableStocksList,
    getAvailableFIIs,
    getDividendsHistory
};
