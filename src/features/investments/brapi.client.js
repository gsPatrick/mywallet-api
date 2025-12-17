/**
 * Brapi Client
 * Cliente para API Brapi (cotações B3)
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Cache de cotações (TTL em segundos)
const cache = new NodeCache({
    stdTTL: parseInt(process.env.BRAPI_CACHE_TTL) || 900 // 15 minutos
});

const BRAPI_BASE_URL = process.env.BRAPI_BASE_URL || 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

/**
 * Busca cotação de um ativo
 */
const getQuote = async (ticker) => {
    const cacheKey = `quote_${ticker}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return cached;
    }

    try {
        const url = `${BRAPI_BASE_URL}/quote/${ticker}`;
        const params = BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {};

        const response = await axios.get(url, { params, timeout: 10000 });

        if (response.data?.results?.[0]) {
            const quote = response.data.results[0];
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

            cache.set(cacheKey, data);
            return data;
        }

        return null;
    } catch (error) {
        logger.error(`Erro ao buscar cotação ${ticker}:`, error.message);
        return null;
    }
};

/**
 * Busca cotações de múltiplos ativos
 */
const getQuotes = async (tickers) => {
    // Verificar cache primeiro
    const results = {};
    const tickersToFetch = [];

    for (const ticker of tickers) {
        const cached = cache.get(`quote_${ticker}`);
        if (cached) {
            results[ticker] = cached;
        } else {
            tickersToFetch.push(ticker);
        }
    }

    // Buscar restantes
    if (tickersToFetch.length > 0) {
        try {
            const url = `${BRAPI_BASE_URL}/quote/${tickersToFetch.join(',')}`;
            const params = BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {};

            const response = await axios.get(url, { params, timeout: 15000 });

            for (const quote of response.data?.results || []) {
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

                cache.set(`quote_${quote.symbol}`, data);
                results[quote.symbol] = data;
            }
        } catch (error) {
            logger.error('Erro ao buscar cotações:', error.message);
        }
    }

    return results;
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
const clearCache = () => {
    cache.flushAll();
};

module.exports = {
    getQuote,
    getQuotes,
    getAssetInfo,
    clearCache
};
