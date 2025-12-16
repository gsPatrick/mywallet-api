/**
 * Yahoo Finance Client
 * Alternativa Gratuita para Cotações e Dividendos
 */

const yahooFinance = require('yahoo-finance2').default;
const NodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Cache de 15 minutos para não bloquear o IP
const cache = new NodeCache({ stdTTL: 900 });

// Configurações para suprimir avisos do console da lib
// Configurações para suprimir avisos do console da lib
// yahooFinance.suppressNotices(['yahooSurvey']); // Removed as it causes TypeError

/**
 * Normaliza o ticker para o padrão Yahoo (adiciona .SA para ações brasileiras)
 * Ex: PETR4 -> PETR4.SA
 */
const normalizeTicker = (ticker) => {
    if (!ticker) return '';
    const t = ticker.toUpperCase().trim();
    // Se já tem .SA ou é cripto (ex: BTC-USD), mantém. Senão, adiciona .SA
    if (t.includes('.') || t.includes('-')) return t;
    return `${t}.SA`;
};

/**
 * Busca cotação atual (Preço e Variação)
 */
const getQuote = async (ticker) => {
    const symbol = normalizeTicker(ticker);
    const cacheKey = `yahoo_quote_${symbol}`;

    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
        const quote = await yahooFinance.quote(symbol);

        if (!quote) return null;

        const data = {
            symbol: ticker,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            updatedAt: new Date(quote.regularMarketTime)
        };

        cache.set(cacheKey, data);
        return data;
    } catch (error) {
        // Yahoo falha se o ativo não existir ou mudar de nome
        logger.warn(`Yahoo Finance: Falha ao buscar ${symbol}: ${error.message}`);
        return null;
    }
};

/**
 * Busca cotações em lote (vários ativos)
 */
/**
 * Busca cotações em lote (vários ativos) com proteção de falhas
 */
const getQuotes = async (tickers) => {
    const results = {};
    const symbolsToFetch = [];

    // 1. Verifica cache primeiro
    for (const t of tickers) {
        const symbol = normalizeTicker(t);
        const cached = cache.get(`yahoo_quote_${symbol}`);
        if (cached) {
            results[t] = cached; // Usa a chave original (ex: PETR4)
        } else {
            symbolsToFetch.push(symbol);
        }
    }

    if (symbolsToFetch.length === 0) return results;

    try {
        // Tenta buscar todos de uma vez
        const quotes = await yahooFinance.quote(symbolsToFetch, { validateResult: false });

        // Garante que seja array
        const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

        for (const q of quotesArray) {
            if (!q || !q.symbol) continue;

            // Remove o .SA para salvar no resultado com a chave que o sistema usa
            const cleanTicker = q.symbol.replace('.SA', '');

            const data = {
                symbol: cleanTicker,
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
                updatedAt: new Date(q.regularMarketTime || Date.now())
            };

            // Salva no cache
            cache.set(`yahoo_quote_${q.symbol}`, data);

            // Salva no resultado
            results[cleanTicker] = data;
        }
    } catch (error) {
        // Se falhar o lote, não faz nada, retorna o que tem (os zeros serão tratados no service)
        // Em produção, poderíamos tentar buscar um por um em caso de falha do lote
        console.warn('Yahoo Batch Warning:', error.message);
    }

    return results;
};

/**
 * Busca histórico de dividendos
 */
const getDividendsHistory = async (ticker, startDate) => {
    const symbol = normalizeTicker(ticker);

    try {
        // Busca dados históricos filtrando por eventos 'div' (dividendos)
        const queryOptions = {
            period1: startDate, // Data inicial (ex: '2024-01-01')
            events: 'div'       // Apenas dividendos
        };

        const result = await yahooFinance.historical(symbol, queryOptions);

        // O Yahoo retorna array de objetos { date, dividends }
        return result.map(div => ({
            date: div.date, // Objeto Date
            amount: div.dividends,
            type: 'DIVIDEND' // Yahoo não diferencia JCP de Dividendo facilmente
        }));

    } catch (error) {
        logger.warn(`Yahoo: Erro ao buscar dividendos de ${symbol}: ${error.message}`);
        return [];
    }
};

module.exports = {
    getQuote,
    getQuotes,
    getDividendsHistory
};