/**
 * Yahoo Finance Client - VERSÃO COMPLETA v4
 * ==========================================
 * Captura TODOS os campos relevantes para ações brasileiras e internacionais:
 * - Preço, variação
 * - P/L, P/VP, Market Cap
 * - Dividend Yield, Dividend Rate
 * - EPS, Book Value
 * - 52 Week High/Low
 * - Volume médio, Setor, Indústria
 * 
 * Funcionalidades Extras:
 * - Detecta ativos BR vs Internacionais
 * - Converte automaticamente de USD para BRL se necessário
 */

const nodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Importação flexível para suportar diferentes versões
const pkg = require('yahoo-finance2');
let yahooFinance;

try {
    // Tenta instanciar se for a versão nova (v3+)
    if (pkg.YahooFinance) {
        yahooFinance = new pkg.YahooFinance({ suppressNotices: ['yahooSurvey'] });
    } else if (typeof pkg.default === 'function') {
        yahooFinance = new pkg.default({ suppressNotices: ['yahooSurvey'] });
    } else {
        yahooFinance = pkg.default || pkg;
    }
} catch (error) {
    logger.error('❌ [YAHOO] Erro ao inicializar:', error);
    yahooFinance = pkg.default || pkg;
}

// Cache de 15 minutos
const cache = new nodeCache({ stdTTL: 900 });

/**
 * Normaliza ticker para Yahoo (Tenta adivinhar se é BR ou US)
 * - 5 ou 6 chars terminando em número (PETR4, ALPA4, BOVA11, KRPT33) => BR (.SA)
 * - Caso contrário, se não tiver ponto nem traço => Pode ser US (AAPL, NVDA), tenta sem sufixo
 */
const normalizeTicker = (ticker) => {
    if (!ticker) return '';
    let t = ticker.toUpperCase().trim();

    // Se já tem sufixo (.SA) ou caracteres especiais, respeita e retorna
    if (t.includes('.') || t.includes('-') || t.startsWith('^')) return t;

    // Lógica para detectar ativos BR via padrão de ticker B3 (XXXX3, XXXX4, XXXXX11)
    // Regex: 4 letras + 1 ou 2 números (ex: PETR4, VALE3, BOVA11)
    if (/^[A-Z]{4}\d{1,2}$/.test(t)) {
        return `${t}.SA`;
    }

    // Se passou, assume que é ticker internacional (ex: AAPL, TSLA, NVDA) ou Crypto crua
    // O sistema buscará exatamente como digitado.
    return t;
};

/**
 * Busca cotação de um único ativo
 */
const getQuote = async (ticker) => {
    const r = await getQuotes([ticker]);
    return r[ticker] || null;
};

/**
 * Busca cotações com TODOS os campos relevantes
 * Suporte a ações Internacionais com conversão de moeda
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
            tickerMap[symbol] = t;
        }
    }

    if (symbolsToFetch.length === 0) return results;

    // Pré-carrega taxa de câmbio USD/BRL caso precisemos converter
    let usdRate = null;
    try {
        const rateQuote = await yahooFinance.quote('BRL=X');
        if (rateQuote && rateQuote.regularMarketPrice) {
            usdRate = rateQuote.regularMarketPrice;
        }
    } catch (e) {
        logger.warn('⚠️ [YAHOO] Falha ao obter taxa USD/BRL');
    }

    logger.info(`🔍 [YAHOO] Buscando ${symbolsToFetch.length} ativos: ${symbolsToFetch.slice(0, 5).join(', ')}${symbolsToFetch.length > 5 ? '...' : ''}`);

    // 2. Busca Individual com try/catch
    await Promise.all(symbolsToFetch.map(async (symbol) => {
        const originalTicker = tickerMap[symbol];

        try {
            // Tenta buscar o ticker normalizado
            let quote = await yahooFinance.quote(symbol);

            // Retry logic: Se falhar e não tinha .SA, tenta adicionar .SA (caso seja um BDR que escapou da regex)
            if (!quote && !symbol.includes('.SA')) {
                try {
                    const retrySymbol = `${symbol}.SA`;
                    const retryQuote = await yahooFinance.quote(retrySymbol);
                    if (retryQuote) {
                        quote = retryQuote;
                        logger.info(`🔄 [YAHOO] Encontrado com sufixo .SA: ${retrySymbol}`);
                    }
                } catch (e) { }
            }

            if (!quote) {
                logger.warn(`⚠️ [YAHOO] Ativo não encontrado: ${symbol}`);
                results[originalTicker] = null;
                return;
            }

            const price = quote.regularMarketPrice || quote.bid || quote.ask || quote.previousClose;

            if (!price || price <= 0) {
                logger.warn(`⚠️ [YAHOO] Preço inválido para ${symbol}: ${price}`);
                results[originalTicker] = null;
                return;
            }

            // DETECÇÃO DE MOEDA E CONVERSÃO
            const currency = quote.currency || 'BRL';
            const isUSD = currency === 'USD';
            const conversionRate = isUSD && usdRate ? usdRate : 1;

            // Helper para converter valores monetários
            const convert = (val) => val ? val * conversionRate : null;

            // =====================================================
            // CAPTURA COMPLETA DE DADOS
            // =====================================================
            const data = {
                symbol: originalTicker,

                // === PREÇO E VARIAÇÃO ===
                price: parseFloat((price * conversionRate).toFixed(2)), // Converte para BRL e arredonda
                originalPrice: price, // Mantém original
                currency: isUSD ? 'BRL (Convertido)' : currency,
                originalCurrency: currency,
                exchangeRateUsed: isUSD ? usdRate : 1,

                change: convert(quote.regularMarketChange) || 0,
                changePercent: quote.regularMarketChangePercent || 0,
                previousClose: convert(quote.regularMarketPreviousClose) || null,

                // === INDICADORES FUNDAMENTALISTAS ===
                trailingPE: quote.trailingPE || null,
                forwardPE: quote.forwardPE || null,
                priceToBook: quote.priceToBook || null,
                marketCap: convert(quote.marketCap) || null,

                // === LUCRO POR AÇÃO ===
                epsTrailingTwelveMonths: convert(quote.epsTrailingTwelveMonths) || null,
                epsForward: convert(quote.epsForward) || null,
                bookValue: convert(quote.bookValue) || null,

                // === DIVIDENDOS ===
                dividendYield: quote.trailingAnnualDividendYield
                    ? quote.trailingAnnualDividendYield * 100
                    : null,
                dividendRate: convert(quote.trailingAnnualDividendRate) || null,
                dividendYieldForward: quote.dividendYield || null,

                // === LIQUIDEZ E VOLUME ===
                averageDailyVolume3Month: quote.averageDailyVolume3Month || null,
                averageDailyVolume10Day: quote.averageDailyVolume10Day || null,
                regularMarketVolume: quote.regularMarketVolume || null,

                // === HISTÓRICO 52 SEMANAS ===
                fiftyTwoWeekHigh: convert(quote.fiftyTwoWeekHigh) || null,
                fiftyTwoWeekLow: convert(quote.fiftyTwoWeekLow) || null,
                fiftyTwoWeekChange: quote.fiftyTwoWeekChangePercent || null,
                fiftyDayAverage: convert(quote.fiftyDayAverage) || null,
                twoHundredDayAverage: convert(quote.twoHundredDayAverage) || null,

                // === INFORMAÇÕES DA EMPRESA ===
                shortName: quote.shortName || null,
                longName: quote.longName || null,
                sector: quote.sector || null,
                industry: quote.industry || null,

                // === OUTROS ===
                exchange: quote.exchange || null,
                quoteType: quote.quoteType || null,
                averageAnalystRating: quote.averageAnalystRating || null,

                // === METADATA ===
                updatedAt: new Date(quote.regularMarketTime || Date.now())
            };

            // Log campos faltantes (apenas debug)
            if (!data.trailingPE && !data.sector) {
                logger.debug(`📝 [YAHOO] ${originalTicker}: dados fundamentais incompletos`);
            }

            cache.set(`yahoo_quote_${symbol}`, data);
            results[originalTicker] = data;

        } catch (error) {
            logger.error(`❌ [YAHOO] Erro ao buscar ${symbol}:`, {
                message: error.message,
                type: error.constructor.name
            });
            results[originalTicker] = null;
        }
    }));

    return results;
};

/**
 * Busca dados adicionais via quoteSummary (setor, indústria, etc)
 */
const getQuoteSummary = async (ticker) => {
    const symbol = normalizeTicker(ticker);

    try {
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['summaryProfile', 'summaryDetail', 'price', 'defaultKeyStatistics']
        });

        if (!result) return null;

        return {
            sector: result.summaryProfile?.sector || null,
            industry: result.summaryProfile?.industry || null,
            website: result.summaryProfile?.website || null,
            longBusinessSummary: result.summaryProfile?.longBusinessSummary || null,
            fullTimeEmployees: result.summaryProfile?.fullTimeEmployees || null,

            // Dados adicionais do summaryDetail
            beta: result.summaryDetail?.beta || null,
            payoutRatio: result.summaryDetail?.payoutRatio || null,

            // DefaultKeyStatistics
            enterpriseValue: result.defaultKeyStatistics?.enterpriseValue || null,
            floatShares: result.defaultKeyStatistics?.floatShares || null,
            sharesOutstanding: result.defaultKeyStatistics?.sharesOutstanding || null
        };
    } catch (error) {
        logger.warn(`⚠️ [YAHOO] Erro quoteSummary ${symbol}: ${error.message}`);
        return null;
    }
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

        if (!result || result.length === 0) {
            return [];
        }

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
    getQuoteSummary,
    getDividendsHistory
};