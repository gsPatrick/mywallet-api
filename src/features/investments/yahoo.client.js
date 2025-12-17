/**
 * Yahoo Finance Client - CORRIGIDO PARA V3+
 * Instancia a classe manualmente para compatibilidade com versões novas
 */

const nodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Importação flexível para suportar diferentes versões da lib
const pkg = require('yahoo-finance2');
let yahooFinance;

try {
    // Tenta instanciar se for a versão nova (v3+) que exporta a Classe
    if (pkg.YahooFinance) {
        yahooFinance = new pkg.YahooFinance();
    }
    // Fallback: Verifica se o default é um construtor
    else if (typeof pkg.default === 'function') {
        yahooFinance = new pkg.default();
    }
    // Fallback: Versão antiga (v2) onde default já era a instância
    else {
        yahooFinance = pkg.default || pkg;
    }
} catch (error) {
    logger.error('Erro fatal ao inicializar Yahoo Finance:', error);
    // Tenta usar o que veio como fallback final
    yahooFinance = pkg.default || pkg;
}

// Cache de 15 minutos
const cache = new nodeCache({ stdTTL: 900 });

/**
 * Normaliza o ticker para o padrão Yahoo (adiciona .SA para ações brasileiras)
 */
const normalizeTicker = (ticker) => {
    if (!ticker) return '';
    let t = ticker.toUpperCase().trim();

    // Se for cripto (ex: BTC-USD), índices (ex: ^BVSP) ou já tiver .SA, mantém
    if (t.includes('-') || t.endsWith('.SA') || t.startsWith('^')) {
        return t;
    }

    // Adiciona sufixo da B3
    return `${t}.SA`;
};

/**
 * Busca cotação de um único ativo
 */
const getQuote = async (ticker) => {
    const r = await getQuotes([ticker]);
    return r[ticker] || null;
};

/**
 * Busca cotações de múltiplos ativos com tratamento de erro individual
 */
const getQuotes = async (tickers) => {
    const results = {};
    const symbolsToFetch = [];
    const tickerMap = {};

    // 1. Verifica cache
    for (const t of tickers) {
        const symbol = normalizeTicker(t);
        const cached = cache.get(`yahoo_quote_${symbol}`);

        if (cached) {
            results[t] = cached;
        } else {
            symbolsToFetch.push(symbol);
            tickerMap[symbol] = t; // Guarda a referência do nome original (sem .SA)
        }
    }

    if (symbolsToFetch.length === 0) return results;

    console.log(`🔍 [YAHOO] Buscando preços para: ${symbolsToFetch.join(', ')}`);

    // 2. Busca Individual (Promise.all)
    // Usamos busca individual para evitar que um ticker inválido quebre o lote todo
    await Promise.all(symbolsToFetch.map(async (symbol) => {
        const originalTicker = tickerMap[symbol];

        try {
            // REMOVIDO validateResult: false - não é mais aceito pela lib
            const quote = await yahooFinance.quote(symbol);

            if (!quote) {
                console.log(`⚠️ [YAHOO] Ativo não encontrado: ${symbol}`);
                throw new Error('Not found');
            }

            // Tenta pegar o preço em ordem de preferência
            const price = quote.regularMarketPrice || quote.bid || quote.ask || quote.previousClose || 0;

            if (price > 0) {
                console.log(`✅ [YAHOO] ${symbol} => R$ ${price}`);
            }

            const data = {
                symbol: originalTicker,
                price: price,
                change: quote.regularMarketChange || 0,
                changePercent: quote.regularMarketChangePercent || 0,
                updatedAt: new Date(quote.regularMarketTime || Date.now())
            };

            if (price > 0) {
                cache.set(`yahoo_quote_${symbol}`, data);
            }

            results[originalTicker] = data;

        } catch (error) {
            console.error(`❌ [YAHOO] Erro ao buscar ${symbol}: ${error.message}`);

            // Retorna zerado para não quebrar o frontend
            results[originalTicker] = {
                symbol: originalTicker,
                price: 0,
                change: 0,
                changePercent: 0,
                updatedAt: new Date()
            };
        }
    }));

    return results;
};

/**
 * Busca histórico de dividendos
 */
const getDividendsHistory = async (ticker, startDate) => {
    const symbol = normalizeTicker(ticker);

    try {
        const queryOptions = {
            period1: startDate, // Ex: '2024-01-01'
            events: 'div'       // Apenas dividendos
        };

        const result = await yahooFinance.historical(symbol, queryOptions);

        return result.map(div => ({
            date: div.date,
            amount: div.dividends,
            type: 'DIVIDEND'
        }));

    } catch (error) {
        // Silencia erros de dividendos para não poluir log, pois muitos ativos não têm
        return [];
    }
};

module.exports = {
    getQuote,
    getQuotes,
    getDividendsHistory
};