/**
 * Funds Explorer Client
 * Scraper para extrair dados de FIIs do Funds Explorer
 * =====================================================
 * 
 * Adaptado do scraper fornecido pelo usuário.
 * Extrai: preço, DY, último dividendo, histórico de dividendos
 * 
 * Uso:
 *   const data = await fundsExplorerClient.getFIIData('MXRF11');
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../../config/logger');

// Rate limiting: delay entre requisições
const REQUEST_DELAY_MS = 1000;
let lastRequestTime = 0;

/**
 * Aguarda o delay mínimo entre requisições
 */
const waitForRateLimit = async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - elapsed));
    }
    lastRequestTime = Date.now();
};

/**
 * Converte data no formato brasileiro (DD/MM/YYYY) para ISO (YYYY-MM-DD)
 * @param {string} dateStr 
 * @returns {string|null}
 */
const parseBRDateToISO = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) {
        // Verifica se já está em formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
        return null;
    }
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/**
 * Limpa e converte string monetária brasileira para float
 * @param {string} val 
 * @returns {number}
 */
const parseBRFloat = (val) => {
    if (!val) return 0;
    const cleaned = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Scraper para extrair dividendos de FIIs do Funds Explorer
 * @param {string} ticker - O ticker do FII (ex: MXRF11)
 * @param {number} retries - Número de tentativas restantes
 * @returns {Promise<object>} - Dados extraídos em JSON
 */
const getFIIData = async (ticker, retries = 3) => {
    const url = `https://www.fundsexplorer.com.br/funds/${ticker.toUpperCase()}`;

    try {
        await waitForRateLimit();

        logger.info(`🔍 [FUNDS_EXPLORER] Scraping ${ticker}...`);

        const { data } = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const $ = cheerio.load(data);

        // 1. Preço atual (Seletores resilientes)
        let price = 0;
        const priceSelectors = [
            '.headerTicker__content__price p',
            '.headerTicker__price',
            '.price',
            'span:contains("R$")'
        ];

        for (const selector of priceSelectors) {
            const text = $(selector).first().text().trim();
            if (text && text.includes('R$')) {
                const match = text.match(/R\$\s?(\d+[\d.,]*)/);
                if (match) {
                    price = parseBRFloat(match[0]);
                    if (price > 0) break;
                }
            }
        }

        // 2. Histórico de dividendos
        let rawHistory = [];

        // Estrutura moderna (divs que simulam tabela)
        $('.yieldChart__table__body .yieldChart__table__bloco').each((i, el) => {
            const lines = $(el).find('.table__linha').map((_, line) => $(line).text().trim()).get();

            if (lines.length >= 6) {
                const type = lines[0].toUpperCase();
                const dateCom = parseBRDateToISO(lines[1]);
                const paymentDate = parseBRDateToISO(lines[2]);
                const amount = parseBRFloat(lines[4]);

                if (paymentDate && !isNaN(amount)) {
                    rawHistory.push({
                        date: paymentDate,
                        amount: amount,
                        type: type.includes('RENDIMENTO') ? 'RENDIMENTO' : type
                    });
                }
            }
        });

        // Fallback para tabelas HTML tradicionais
        if (rawHistory.length === 0) {
            $('table tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length >= 4) {
                    const type = $(tds[0]).text().trim().toUpperCase();
                    const dateCom = parseBRDateToISO($(tds[1]).text().trim());
                    const paymentDate = parseBRDateToISO($(tds[2]).text().trim());
                    const amount = parseBRFloat($(tds[3]).text().trim());

                    if (paymentDate && !isNaN(amount) && (type.includes('RENDIMENTO') || type.includes('DIVIDENDO'))) {
                        rawHistory.push({
                            date: paymentDate,
                            amount: amount,
                            type: 'RENDIMENTO'
                        });
                    }
                }
            });
        }

        // 3. Ordenação: Do mais recente para o mais antigo
        rawHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 4. Limitação: Máximo 24 registros (2 anos)
        const dividendHistory = rawHistory.slice(0, 24);

        // 5. Cálculo do Dividend Yield (DY) nos últimos 12 meses móveis
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

        const last12MonthsDividends = rawHistory.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= twelveMonthsAgo && itemDate <= now;
        });

        const annualDividendSum = last12MonthsDividends.reduce((acc, curr) => acc + curr.amount, 0);
        const dividendYield = price > 0 ? (annualDividendSum / price) * 100 : 0;

        // 6. Último dividendo (mais recente)
        const lastDividend = dividendHistory.length > 0 ? dividendHistory[0].amount : 0;
        const lastDividendDate = dividendHistory.length > 0 ? dividendHistory[0].date : null;

        // Validação básica de ticker inexistente
        if (price === 0 && dividendHistory.length === 0) {
            throw new Error(`Ticker ${ticker} não encontrado ou página sem dados.`);
        }

        logger.info(`✅ [FUNDS_EXPLORER] ${ticker}: R$ ${price.toFixed(2)} | DY: ${dividendYield.toFixed(2)}% | ${dividendHistory.length} dividendos`);

        return {
            ticker: ticker.toUpperCase(),
            price: price,
            dividendYield: parseFloat(dividendYield.toFixed(4)),
            lastDividend: lastDividend,
            lastDividendDate: lastDividendDate,
            annualDividendSum: parseFloat(annualDividendSum.toFixed(6)),
            dividendHistory: dividendHistory,
            scrapedAt: new Date()
        };

    } catch (error) {
        // Retry com backoff exponencial
        if (retries > 0 && !error.message.includes('não encontrado')) {
            const delay = (4 - retries) * 2000; // 2s, 4s, 6s
            logger.warn(`⚠️ [FUNDS_EXPLORER] Retry ${ticker} em ${delay}ms... (${retries} restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return getFIIData(ticker, retries - 1);
        }

        if (error.response && error.response.status === 404) {
            throw new Error(`FII ${ticker} não encontrado (404).`);
        }

        logger.error(`❌ [FUNDS_EXPLORER] Erro ${ticker}: ${error.message}`);
        throw new Error(`Erro ao processar ${ticker}: ${error.message}`);
    }
};

/**
 * Busca dados de múltiplos FIIs
 * @param {string[]} tickers - Lista de tickers
 * @returns {Promise<object>} - Map ticker -> dados
 */
const getMultipleFIIData = async (tickers) => {
    const results = {};
    const errors = [];

    for (const ticker of tickers) {
        try {
            results[ticker] = await getFIIData(ticker);
        } catch (error) {
            errors.push({ ticker, error: error.message });
            results[ticker] = null;
        }
    }

    if (errors.length > 0) {
        logger.warn(`⚠️ [FUNDS_EXPLORER] ${errors.length} erros:`, errors);
    }

    return { results, errors };
};

module.exports = {
    getFIIData,
    getMultipleFIIData,
    parseBRDateToISO,
    parseBRFloat
};
