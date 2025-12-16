/**
 * Yahoo Finance Client
 * Alternativa Gratuita para Cotações e Dividendos
 */

const yahooFinance = require('yahoo-finance2').default;
const NodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Cache de 15 minutos
const cache = new NodeCache({ stdTTL: 900 });

/**
 * Normaliza o ticker para o padrão Yahoo (adiciona .SA para ações brasileiras)
 */
const normalizeTicker = (ticker) => {
    if (!ticker) return '';
    const t = ticker.toUpperCase().trim();
    // Se já tem .SA, ponto (BDR/ETF as vezes) ou é cripto (BTC-USD), mantém.
    if (t.endsWith('.SA') || t.includes('-')) return t;
    return `${t}.SA`;
};

/**
 * Busca cotação atual de um único ativo
 */
const getQuote = async (ticker) => {
    const symbol = normalizeTicker(ticker);
    const cacheKey = `yahoo_quote_${symbol}`;

    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const quote = await yahooFinance.quote(symbol, { validateResult: false });

        if (!quote) return null;

        const data = {
            symbol: ticker, // Retorna o ticker original (sem .SA)
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            updatedAt: new Date()
        };

        cache.set(cacheKey, data);
        return data;
    } catch (error) {
        // Log apenas em debug para não poluir, pois é normal falhar alguns
        // logger.debug(`Yahoo falhou para ${symbol}: ${error.message}`);
        return null;
    }
};

/**
 * Busca cotações em lote com FALLBACK para individual
 * Essa é a função que resolve o problema dos zeros
 */
const getQuotes = async (tickers) => {
    const results = {};
    const symbolsToFetch = [];
    const tickerMap = {}; // Mapa de Ticker.SA -> Ticker

    // 1. Verifica cache e prepara lista
    for (const t of tickers) {
        const symbol = normalizeTicker(t);
        const cached = cache.get(`yahoo_quote_${symbol}`);

        if (cached) {
            results[t] = cached;
        } else {
            symbolsToFetch.push(symbol);
            tickerMap[symbol] = t; // Guarda referência do original
        }
    }

    if (symbolsToFetch.length === 0) return results;

    try {
        // 2. Tenta buscar em LOTE (Rápido)
        const quotes = await yahooFinance.quote(symbolsToFetch, { validateResult: false });

        const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

        for (const q of quotesArray) {
            if (!q || !q.symbol) continue;

            const cleanTicker = tickerMap[q.symbol] || q.symbol.replace('.SA', '');

            const data = {
                symbol: cleanTicker,
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
                updatedAt: new Date()
            };

            cache.set(`yahoo_quote_${q.symbol}`, data);
            results[cleanTicker] = data;
        }

    } catch (error) {
        // 3. SE O LOTE FALHAR (Erro 404 em um item cancela o lote todo), 
        // BUSCA UM POR UM (Lento mas Garantido)
        logger.warn(`Yahoo Batch falhou (${error.message}). Tentando individualmente para ${symbolsToFetch.length} ativos...`);

        await Promise.all(symbolsToFetch.map(async (symbol) => {
            try {
                const q = await yahooFinance.quote(symbol, { validateResult: false });
                if (q) {
                    const cleanTicker = tickerMap[symbol];
                    const data = {
                        symbol: cleanTicker,
                        price: q.regularMarketPrice || 0,
                        change: q.regularMarketChange || 0,
                        changePercent: q.regularMarketChangePercent || 0,
                        updatedAt: new Date()
                    };
                    cache.set(`yahoo_quote_${symbol}`, data);
                    results[cleanTicker] = data;
                }
            } catch (innerErr) {
                // Se falhar individualmente, é porque o ativo realmente não existe no Yahoo
                // Apenas ignora e deixa como 0
            }
        }));
    }

    return results;
};

/**
 * Busca histórico de dividendos
 */
const getDividendsHistory = async (ticker, startDate) => {
    const symbol = normalizeTicker(ticker);

    try {
        const queryOptions = {
            period1: startDate,
            events: 'div'
        };

        const result = await yahooFinance.historical(symbol, queryOptions);

        return result.map(div => ({
            date: div.date,
            amount: div.dividends,
            type: 'DIVIDEND'
        }));

    } catch (error) {
        return [];
    }
};

module.exports = {
    getQuote,
    getQuotes,
    getDividendsHistory
};