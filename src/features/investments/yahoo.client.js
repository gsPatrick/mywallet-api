/**
 * Yahoo Finance Client - VERSÃO CORRIGIDA v3+
 * Instancia a classe manualmente para compatibilidade com versões novas
 * 
 * Correções aplicadas:
 * - Retorna NULL (não zeros) quando preço inválido
 * - Log detalhado de erros
 * - try/catch individual por ticker
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
    logger.error('❌ [YAHOO] Erro fatal ao inicializar Yahoo Finance:', error);
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
 * CORREÇÃO: Retorna NULL para erros, não zeros
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

    logger.info(`🔍 [YAHOO] Buscando preços para: ${symbolsToFetch.join(', ')}`);

    // 2. Busca Individual (Promise.all) - try/catch individual
    await Promise.all(symbolsToFetch.map(async (symbol) => {
        const originalTicker = tickerMap[symbol];

        try {
            const quote = await yahooFinance.quote(symbol);

            if (!quote) {
                logger.warn(`⚠️ [YAHOO] Ativo não encontrado: ${symbol}`);
                results[originalTicker] = null; // ✅ Retorna null, não zeros
                return;
            }

            // Tenta pegar o preço em ordem de preferência
            const price = quote.regularMarketPrice || quote.bid || quote.ask || quote.previousClose;

            // ✅ VALIDAÇÃO CRÍTICA: Não cachear se preço inválido
            if (!price || price <= 0) {
                logger.warn(`⚠️ [YAHOO] Preço inválido para ${symbol}: ${price}`);
                results[originalTicker] = null; // ✅ Retorna null para força fallback
                return;
            }

            logger.debug(`✅ [YAHOO] ${symbol} => R$ ${price}`);

            const data = {
                symbol: originalTicker,
                price: price,
                change: quote.regularMarketChange || 0,
                changePercent: quote.regularMarketChangePercent || 0,
                // Add dividend data for Magic Number calculation
                dividendYield: quote.trailingAnnualDividendYield ? quote.trailingAnnualDividendYield * 100 : 0,
                dividendRate: quote.trailingAnnualDividendRate || 0,
                updatedAt: new Date(quote.regularMarketTime || Date.now())
            };

            cache.set(`yahoo_quote_${symbol}`, data);
            results[originalTicker] = data;

        } catch (error) {
            // ✅ LOG DETALHADO
            logger.error(`❌ [YAHOO] Erro ao buscar ${symbol}:`, {
                message: error.message,
                type: error.constructor.name
            });

            // ✅ Retorna NULL ao invés de zerado (força fallback ou tratamento no frontend)
            results[originalTicker] = null;
        }
    }));

    return results;
};

/**
 * Busca histórico de dividendos
 * NOTA: Funciona bem para ações, mas não para FIIs (usar Brapi para FIIs)
 */
const getDividendsHistory = async (ticker, startDate) => {
    const symbol = normalizeTicker(ticker);

    try {
        const queryOptions = {
            period1: startDate, // Ex: '2024-01-01'
            events: 'div'       // Apenas dividendos
        };

        const result = await yahooFinance.historical(symbol, queryOptions);

        if (!result || result.length === 0) {
            logger.debug(`📭 [YAHOO] Nenhum dividendo para ${symbol}`);
            return [];
        }

        const dividends = result.map(div => ({
            date: div.date,
            amount: div.dividends,
            type: 'DIVIDEND'
        }));

        logger.info(`💰 [YAHOO] Encontrados ${dividends.length} dividendos para ${symbol}`);
        return dividends;

    } catch (error) {
        // ✅ Log de erro ao invés de silenciar
        logger.warn(`⚠️ [YAHOO] Erro ao buscar dividendos ${symbol}: ${error.message}`);
        return [];
    }
};

module.exports = {
    getQuote,
    getQuotes,
    getDividendsHistory
};