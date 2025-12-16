/**
 * Brapi Client
 * Cliente para API Brapi (Dados da B3 em Tempo Real e Diferido)
 * 
 * Funcionalidades:
 * - Cotações de Ações, FIIs, ETFs e BDRs
 * - Lista completa de ativos (para popular o banco)
 * - Logos e dados fundamentais
 * - Cache em memória para economizar requisições
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const { logger } = require('../../config/logger');

// Cache com TTL padrão de 15 minutos (900s) para cotações
// Para lista de ativos, usamos um TTL maior dentro da função
const cache = new NodeCache({
    stdTTL: parseInt(process.env.BRAPI_CACHE_TTL) || 900
});

const BRAPI_BASE_URL = process.env.BRAPI_BASE_URL || 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

// Cria instância do Axios com configurações padrão
const api = axios.create({
    baseURL: BRAPI_BASE_URL,
    timeout: 15000, // 15 segundos de timeout
    params: {
        token: BRAPI_TOKEN // Injeta o token em todas as requisições
    }
});

/**
 * Busca a lista completa de ativos disponíveis na B3
 * Traz: Ticker, Nome, Logo, Setor, Tipo
 * 
 * @returns {Promise<Array>} Array de objetos com dados dos ativos
 */
const getAvailableStocksList = async () => {
    // Tenta pegar do cache primeiro (cache de 24 horas para a lista completa)
    const cacheKey = 'brapi_full_asset_list';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        logger.info('📦 Retornando lista de ativos do cache');
        return cachedData;
    }

    try {
        logger.info('🔄 Buscando lista completa de ativos na Brapi...');

        const response = await api.get('/quote/list', {
            params: {
                limit: 3000,       // Limite alto para pegar quase tudo
                sortBy: 'volume',  // Prioriza ativos com liquidez
                sortOrder: 'desc'
            }
        });

        if (response.data && response.data.stocks) {
            const stocks = response.data.stocks.map(stock => ({
                ticker: stock.stock,
                name: stock.name,
                logo: stock.logo,     // URL da imagem
                sector: stock.sector, // Setor de atuação
                type: stock.type,     // 'stock' ou 'fund'
                close: stock.close    // Preço de fechamento (referência)
            }));

            // Salva no cache por 24 horas (86400 segundos)
            cache.set(cacheKey, stocks, 86400);

            logger.info(`✅ Lista de ativos obtida: ${stocks.length} itens encontrados.`);
            return stocks;
        }

        return [];
    } catch (error) {
        logger.error('❌ Erro ao buscar lista de ativos na Brapi:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        // Em caso de erro, retorna array vazio para não quebrar a aplicação
        return [];
    }
};

/**
 * Busca cotação atual de um único ativo
 */
const getQuote = async (ticker) => {
    const cacheKey = `quote_${ticker.toUpperCase()}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const response = await api.get(`/quote/${ticker}`, {
            params: {
                fundamental: false, // Não precisamos de dados fundamentalistas agora
                dividends: false    // Dividendos pegamos em outra rota se precisar
            }
        });

        if (response.data?.results?.[0]) {
            const quote = response.data.results[0];

            const data = {
                symbol: quote.symbol,
                shortName: quote.shortName,
                longName: quote.longName,
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                logo: quote.logourl, // Garante URL da logo atualizada
                updatedAt: new Date(quote.regularMarketTime)
            };

            cache.set(cacheKey, data);
            return data;
        }
        return null;
    } catch (error) {
        // Não logar erro 404 (ativo não encontrado), apenas avisos
        if (error.response?.status !== 404) {
            logger.error(`Erro ao buscar cotação ${ticker}:`, error.message);
        }
        return null;
    }
};

/**
 * Busca cotações de múltiplos ativos em uma única requisição
 * Ideal para o Dashboard
 */
const getQuotes = async (tickers) => {
    if (!tickers || tickers.length === 0) return {};

    const results = {};
    const tickersToFetch = [];

    // 1. Verifica Cache
    for (const ticker of tickers) {
        const cached = cache.get(`quote_${ticker.toUpperCase()}`);
        if (cached) {
            results[ticker.toUpperCase()] = cached;
        } else {
            tickersToFetch.push(ticker);
        }
    }

    // 2. Busca o que faltou
    if (tickersToFetch.length > 0) {
        try {
            // A API aceita virgula: PETR4,VALE3,MXRF11
            const tickersString = tickersToFetch.join(',');

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
        } catch (error) {
            logger.error('Erro ao buscar lote de cotações:', error.message);
        }
    }

    return results;
};

/**
 * Limpa o cache manualmente (útil para botão de "Atualizar Agora")
 */
const clearCache = () => {
    cache.flushAll();
    logger.info('🧹 Cache da Brapi limpo manualmente');
};

module.exports = {
    getAvailableStocksList,
    getQuote,
    getQuotes,
    clearCache
};