/**
 * Yahoo Finance Client
 * Cliente robusto para cotações B3 e Dividendos
 */

const yahooFinance = require('yahoo-finance2').default;
const NodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Cache de 15 minutos para evitar bloqueio de IP e acelerar respostas
const cache = new NodeCache({ stdTTL: 900 });

/**
 * Normaliza o ticker para o padrão Yahoo (adiciona .SA para ações brasileiras)
 * Ex: PETR4 -> PETR4.SA
 */
const normalizeTicker = (ticker) => {
    if (!ticker) return '';
    let t = ticker.toUpperCase().trim();

    // Se for cripto (ex: BTC-USD) ou já tiver .SA, mantém
    if (t.includes('-') || t.endsWith('.SA')) {
        return t;
    }

    // Adiciona sufixo da B3
    return `${t}.SA`;
};

/**
 * Busca cotação de um único ativo (Wrapper para getQuotes)
 */
const getQuote = async (ticker) => {
    const results = await getQuotes([ticker]);
    return results[ticker] || null;
};

/**
 * Busca cotações de múltiplos ativos
 * Usa estratégia de busca individual em paralelo para garantir que
 * um ativo inválido não quebre a requisição dos outros.
 */
const getQuotes = async (tickers) => {
    const results = {};
    const symbolsToFetch = [];
    const tickerMap = {}; // Mapeia PETR4.SA -> PETR4

    // 1. Verifica Cache
    for (const t of tickers) {
        const symbol = normalizeTicker(t);
        const cached = cache.get(`yahoo_quote_${symbol}`);

        if (cached) {
            results[t] = cached;
        } else {
            symbolsToFetch.push(symbol);
            tickerMap[symbol] = t; // Guarda a referência do nome original
        }
    }

    // Se tudo estava em cache, retorna
    if (symbolsToFetch.length === 0) return results;

    // 2. Busca Online (Em paralelo para performance)
    // Usamos Promise.all com map individual para isolar erros
    await Promise.all(symbolsToFetch.map(async (symbol) => {
        const originalTicker = tickerMap[symbol];

        try {
            // validateResult: false evita erros de validação da lib se faltar algum campo não essencial
            const quote = await yahooFinance.quote(symbol, { validateResult: false });

            if (!quote) throw new Error('Cotação vazia');

            // Tenta pegar o preço em ordem de preferência: 
            // Preço Atual -> Bid (Oferta) -> Ask (Venda) -> Fechamento Anterior
            const price = quote.regularMarketPrice || quote.bid || quote.ask || quote.regularMarketPreviousClose || 0;

            const data = {
                symbol: originalTicker,
                price: price,
                change: quote.regularMarketChange || 0,
                changePercent: quote.regularMarketChangePercent || 0,
                updatedAt: new Date(quote.regularMarketTime || Date.now())
            };

            // Só salva no cache se tiver preço válido
            if (price > 0) {
                cache.set(`yahoo_quote_${symbol}`, data);
            }

            results[originalTicker] = data;

        } catch (error) {
            // Log discreto para não poluir o terminal, pois BDRs obscuros falham com frequência
            // console.warn(`Yahoo falhou para ${symbol}`);

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
 * Retorna lista de proventos pagos
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
        logger.warn(`Erro ao buscar dividendos para ${symbol}: ${error.message}`);
        return [];
    }
};

module.exports = {
    getQuote,
    getQuotes,
    getDividendsHistory
};