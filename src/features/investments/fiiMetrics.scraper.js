/**
 * FII Metrics Scraper - VERSÃO OFICIAL
 * =====================================
 * 
 * Fonte: Funds Explorer (https://www.fundsexplorer.com.br)
 * 
 * Este scraper é a FONTE ÚNICA DE VERDADE para dados de FIIs.
 * Substitui integralmente qualquer versão anterior.
 * 
 * Dados extraídos:
 * - Preço atual (com validação)
 * - P/VP (Preço sobre Valor Patrimonial)
 * - Patrimônio Líquido
 * - Liquidez Média Diária
 * - Número de Cotistas
 * - Segmento do FII
 * - DY Mensal e DY Anual (12 meses móveis)
 * - Histórico completo de dividendos
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../../config/logger');

// Rate limiting
const REQUEST_DELAY_MS = 1000;
let lastRequestTime = 0;

const waitForRateLimit = async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - elapsed));
    }
    lastRequestTime = Date.now();
};

/**
 * Normaliza valores monetários e numéricos do formato brasileiro para Number.
 * @param {string} value - O valor em string (ex: "R$ 9,54", "1.339.326", "15,7 M").
 * @returns {number|null} - O valor convertido para número.
 */
const parseBrazilianNumber = (value) => {
    if (!value || typeof value !== 'string') return null;

    // Remove quebras de linha, tabs e espaços múltiplos
    let cleanValue = value.replace(/\s+/g, ' ').trim();

    if (cleanValue === '-' || cleanValue === 'N/A' || cleanValue === '') return null;

    // Se houver "R$", isola o número
    if (cleanValue.includes('R$')) {
        const match = cleanValue.match(/R\$\s?([\d\.,]+)/);
        if (match) {
            cleanValue = match[1];
        }
    }

    // Limpeza de símbolos
    cleanValue = cleanValue.replace(/R\$\s?/, '').replace('%', '').trim();

    let multiplier = 1;
    const upperValue = cleanValue.toUpperCase();
    if (upperValue.endsWith('M')) {
        multiplier = 1000000;
        cleanValue = cleanValue.substring(0, cleanValue.length - 1).trim();
    } else if (upperValue.endsWith('B')) {
        multiplier = 1000000000;
        cleanValue = cleanValue.substring(0, cleanValue.length - 1).trim();
    }

    // Converte formato BR (1.234,56) para US (1234.56)
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parseFloat((parsed * multiplier).toFixed(2));
};

/**
 * Normaliza datas do formato DD/MM/YYYY ou MM/YY para ISO (YYYY-MM-DD).
 * @param {string} dateStr - A data em string.
 * @returns {string|null} - A data no formato ISO.
 */
const normalizeDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const cleanDate = dateStr.trim();

    // Formato YYYY-MM-DD (já ISO)
    const isoMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return cleanDate;

    // Formato DD/MM/YYYY
    const dmyMatch = cleanDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }

    // Formato MM/YY
    const myMatch = cleanDate.match(/^(\d{2})\/(\d{2})$/);
    if (myMatch) {
        const year = parseInt(myMatch[2]) + 2000;
        return `${year}-${myMatch[1]}-01`;
    }

    return null;
};

/**
 * Obtém as métricas completas de um FII a partir do Funds Explorer.
 * @param {string} ticker - O ticker do FII (ex: "MXRF11").
 * @param {number} retries - Número de tentativas restantes
 * @returns {Promise<Object>} - JSON com as métricas do FII.
 */
const getFIIMetrics = async (ticker, retries = 3) => {
    if (!ticker) throw new Error('Ticker é obrigatório');

    const url = `https://www.fundsexplorer.com.br/funds/${ticker.toUpperCase()}`;

    try {
        await waitForRateLimit();

        logger.info(`🔍 [FII_SCRAPER] Buscando métricas para ${ticker}...`);

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);

        // Nome do FII
        const name = $('h1').first().text().trim() || ticker.toUpperCase();

        // Extração de Preço com Hardening
        let price = null;
        let priceSource = "none";

        // 1. Seletor Primário (Estrutura 2025)
        const primaryPriceText = $('.headerTicker__content__price p').first().text().trim();
        if (primaryPriceText) {
            price = parseBrazilianNumber(primaryPriceText);
            if (price !== null) priceSource = "selector";
        }

        // 2. Fallback Controlado
        if (price === null) {
            const headerText = $('.headerTicker__content__price').text().trim();
            price = parseBrazilianNumber(headerText);
            if (price !== null) priceSource = "fallback";
        }

        if (price === null) {
            throw new Error(`Ticker ${ticker} não encontrado ou estrutura da página alterada`);
        }

        // Histórico de dividendos
        const dividendHistory = [];
        $('.yieldChart__table__body .yieldChart__table__bloco').each((_, el) => {
            const cells = $(el).find('.table__linha').map((_, cell) => $(cell).text().trim()).get();
            if (cells.length >= 5) {
                const dateValue = normalizeDate(cells[1]);
                if (dateValue) {
                    dividendHistory.push({
                        date: dateValue,
                        amount: parseBrazilianNumber(cells[4]),
                        type: cells[0].toUpperCase()
                    });
                }
            }
        });

        // Ordenação (Mais recente primeiro)
        dividendHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Inicializa métricas
        const metrics = {
            ticker: ticker.toUpperCase(),
            name: name,
            segment: null,
            price: price,
            priceSource: priceSource,
            pvp: null,
            netWorth: null,
            equityValue: null,
            dailyLiquidity: null,
            shareholders: null,
            lastDividend: dividendHistory.length > 0 ? dividendHistory[0].amount : null,
            lastDividendDate: dividendHistory.length > 0 ? dividendHistory[0].date : null,
            dividendYieldMonth: null,
            dividendYieldYear: null,
            dividendHistory: dividendHistory.slice(0, 24), // Últimos 24 meses
            scrapedAt: new Date()
        };

        // Extração de Indicadores (Boxes superiores)
        $('.indicators__box').each((_, el) => {
            const title = $(el).find('p').first().text().trim();
            const value = $(el).find('b').text().trim() || $(el).find('span').text().trim();

            switch (title) {
                case 'P/VP':
                    metrics.pvp = parseBrazilianNumber(value);
                    break;
                case 'Patrimônio Líquido':
                    metrics.netWorth = parseBrazilianNumber(value);
                    break;
                case 'Valor Patrimonial':
                    metrics.equityValue = parseBrazilianNumber(value);
                    break;
                case 'Liquidez Média Diária':
                    metrics.dailyLiquidity = parseBrazilianNumber(value);
                    break;
                case 'DY Últ. Dividendo':
                    metrics.dividendYieldMonth = parseBrazilianNumber(value);
                    break;
            }
        });

        // Extração de Informações Básicas (Grid inferior)
        $('.basicInformation__grid__box').each((_, el) => {
            const title = $(el).find('p').first().text().trim();
            const value = $(el).find('b').text().trim() || $(el).find('span').text().trim();

            switch (title) {
                case 'Segmento':
                    metrics.segment = value || null;
                    break;
                case 'Número de cotistas':
                    metrics.shareholders = parseBrazilianNumber(value);
                    break;
            }
        });

        // Cálculo do Dividend Yield Anual (12 meses móveis)
        if (dividendHistory.length > 0 && metrics.price > 0) {
            const today = new Date();
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setFullYear(today.getFullYear() - 1);

            const last12MonthsDividends = dividendHistory.filter(d => {
                const dDate = new Date(d.date);
                return dDate >= twelveMonthsAgo && dDate <= today;
            });

            const sumDividends = last12MonthsDividends.reduce((acc, curr) => acc + (curr.amount || 0), 0);
            metrics.dividendYieldYear = parseFloat(((sumDividends / metrics.price) * 100).toFixed(2));
            metrics.annualDividendSum = parseFloat(sumDividends.toFixed(4));
            metrics.dividendCount12m = last12MonthsDividends.length;
        }

        logger.info(`✅ [FII_SCRAPER] ${ticker}: R$ ${price.toFixed(2)} | DY: ${metrics.dividendYieldYear || 0}% | P/VP: ${metrics.pvp || 'N/A'}`);

        return metrics;

    } catch (error) {
        // Retry com backoff exponencial
        if (retries > 0 && !error.message.includes('não encontrado')) {
            const delay = (4 - retries) * 2000;
            logger.warn(`⚠️ [FII_SCRAPER] Retry ${ticker} em ${delay}ms... (${retries} restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return getFIIMetrics(ticker, retries - 1);
        }

        if (error.response && error.response.status === 404) {
            throw new Error(`Ticker ${ticker} não encontrado (404)`);
        }

        logger.error(`❌ [FII_SCRAPER] Erro ${ticker}: ${error.message}`);
        throw error;
    }
};

/**
 * Busca métricas de múltiplos FIIs
 * @param {string[]} tickers - Lista de tickers
 * @returns {Promise<object>} - Map ticker -> metrics
 */
const getMultipleFIIMetrics = async (tickers) => {
    const results = {};
    const errors = [];

    for (const ticker of tickers) {
        try {
            results[ticker] = await getFIIMetrics(ticker);
        } catch (error) {
            errors.push({ ticker, error: error.message });
            results[ticker] = null;
        }
    }

    if (errors.length > 0) {
        logger.warn(`⚠️ [FII_SCRAPER] ${errors.length} erros:`, errors);
    }

    return { results, errors };
};

module.exports = {
    getFIIMetrics,
    getMultipleFIIMetrics,
    parseBrazilianNumber,
    normalizeDate
};
