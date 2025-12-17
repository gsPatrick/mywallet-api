/**
 * Brapi Client - VERSÃO COMPLETA
 * Cobre 100% dos ativos negociados na B3:
 * - Ações (~450)
 * - FIIs (~450) 
 * - BDRs (~900)
 * - ETFs (~180)
 * - Fiagros (~50)
 * - FI-Infra (~40)
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const { logger } = require('../../config/logger');

const cache = new NodeCache({
    stdTTL: parseInt(process.env.BRAPI_CACHE_TTL) || 900
});

const BRAPI_BASE_URL = process.env.BRAPI_BASE_URL || 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

const api = axios.create({
    baseURL: BRAPI_BASE_URL,
    timeout: 15000,
    params: BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {}
});

/**
 * Busca LISTA COMPLETA de ativos da B3
 * Retorna array com ~2.170 ativos
 */
const getAvailableStocksList = async () => {
    const cacheKey = 'brapi_full_asset_list';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        logger.info('📦 Lista de ativos do cache');
        return cachedData;
    }

    try {
        logger.info('🔄 Buscando TODOS os ativos da B3 via Brapi...');

        // Endpoint que retorna TODOS os tickers disponíveis
        const response = await api.get('/available');

        if (response.data?.stocks) {
            const tickers = response.data.stocks; // Array de strings: ['PETR4', 'VALE3', ...]

            logger.info(`✅ ${tickers.length} ativos encontrados na B3`);

            // Cache por 24h (86400s)
            cache.set(cacheKey, tickers, 86400);

            return tickers;
        }

        return [];
    } catch (error) {
        logger.error('❌ Erro ao buscar lista de ativos:', error.message);
        return [];
    }
};

/**
 * Busca detalhes COMPLETOS de múltiplos ativos
 * Usa para popular o banco com nome, setor, logo, etc
 */
const getStocksDetails = async (tickers) => {
    if (!tickers || tickers.length === 0) return [];

    try {
        // Limite de 20 tickers por request (plano pago)
        const tickersString = tickers.slice(0, 20).join(',');

        const response = await api.get(`/quote/${tickersString}`, {
            params: {
                fundamental: false,
                dividends: false
            }
        });

        return (response.data?.results || []).map(stock => ({
            ticker: stock.symbol,
            name: stock.shortName || stock.longName,
            logo: stock.logourl,
            sector: stock.sector || 'N/A',
            type: stock.type || 'stock',
            price: stock.regularMarketPrice
        }));

    } catch (error) {
        logger.error('❌ Erro ao buscar detalhes:', error.message);
        return [];
    }
};

/**
 * Busca cotação de UM único ativo
 */
const getQuote = async (ticker) => {
    const cacheKey = `quote_${ticker.toUpperCase()}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const response = await api.get(`/quote/${ticker}`);

        if (response.data?.results?.[0]) {
            const quote = response.data.results[0];

            const data = {
                symbol: quote.symbol,
                shortName: quote.shortName,
                longName: quote.longName,
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                logo: quote.logourl,
                updatedAt: new Date(quote.regularMarketTime)
            };

            cache.set(cacheKey, data);
            return data;
        }
        return null;
    } catch (error) {
        if (error.response?.status !== 404) {
            logger.error(`Erro ao buscar ${ticker}:`, error.message);
        }
        return null;
    }
};

/**
 * Busca cotações de MÚLTIPLOS ativos (até 20 por vez)
 */
const getQuotes = async (tickers) => {
    if (!tickers || tickers.length === 0) return {};

    const results = {};
    const tickersToFetch = [];

    // 1. Verifica cache
    for (const ticker of tickers) {
        const cached = cache.get(`quote_${ticker.toUpperCase()}`);
        if (cached) {
            results[ticker.toUpperCase()] = cached;
        } else {
            tickersToFetch.push(ticker);
        }
    }

    // 2. Busca em lotes de 20
    if (tickersToFetch.length > 0) {
        for (let i = 0; i < tickersToFetch.length; i += 20) {
            const batch = tickersToFetch.slice(i, i + 20);

            try {
                const tickersString = batch.join(',');
                const response = await api.get(`/quote/${tickersString}`);

                for (const quote of response.data?.results || []) {
                    const data = {
                        symbol: quote.symbol,
                        shortName: quote.shortName,
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        logo: quote.logourl,
                        updatedAt: new Date(quote.regularMarketTime)
                    };

                    cache.set(`quote_${quote.symbol}`, data);
                    results[quote.symbol] = data;
                }

                // Rate limit: aguarda 1s entre lotes
                if (i + 20 < tickersToFetch.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error) {
                logger.error('Erro ao buscar lote de cotações:', error.message);
            }
        }
    }

    return results;
};

/**
 * Limpa cache manualmente
 */
const clearCache = () => {
    cache.flushAll();
    logger.info('🧹 Cache limpo');
};

module.exports = {
    getAvailableStocksList,
    getStocksDetails,
    getQuote,
    getQuotes,
    clearCache
};