/**
 * Investment Health Service - Diagnostic System
 * ===============================================
 * 
 * Provides granular observability for investment data sources.
 * Each test returns EXACTLY what broke and how to fix it.
 * 
 * Services monitored:
 * - FII_SCRAPER (Funds Explorer)
 * - BRAPI (B3 quotes)
 * - YAHOO (International quotes)
 * - BCB_RATES (CDI/IPCA)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { logger } = require('../../config/logger');

// Test tickers for diagnostics
const TEST_FII = 'MXRF11';
const TEST_STOCK = 'PETR4';

/**
 * Standard diagnostic result structure
 */
const createDiagnosticResult = (service, status, latency, diagnosis, technicalDetails, recommendedAction) => ({
    service,
    status, // SUCCESS, WARNING, CRITICAL_FAILURE
    latency,
    diagnosis,
    technicalDetails,
    recommendedAction,
    timestamp: new Date().toISOString()
});

/**
 * Test FII Scraper (Funds Explorer) - CASCADE VALIDATION
 * This is the most critical test - validates each step separately
 */
const testFIIScraper = async () => {
    const service = 'FII_SCRAPER';
    const startTime = Date.now();
    const url = `https://www.fundsexplorer.com.br/funds/${TEST_FII}`;

    try {
        // ==========================================
        // STEP 1: CONNECTION TEST
        // ==========================================
        let response;
        try {
            response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'pt-BR,pt;q=0.9'
                },
                timeout: 15000,
                validateStatus: () => true // Don't throw on any status
            });
        } catch (networkError) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Conexão falhou',
                `Network Error: ${networkError.message}. Possível timeout ou DNS.`,
                'Verifique conectividade com fundsexplorer.com.br'
            );
        }

        // Check HTTP status
        if (response.status === 403) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Acesso bloqueado (403)',
                `HTTP 403 Forbidden. IP pode estar bloqueado ou rate limit atingido.`,
                'Aguarde 30 min ou troque IP. Verifique se Cloudflare está ativo.'
            );
        }

        if (response.status === 404) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Página não encontrada (404)',
                `HTTP 404 para ${TEST_FII}. Ticker pode ter sido removido.`,
                'Verifique se o ticker de teste existe no Funds Explorer'
            );
        }

        if (response.status >= 500) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                `Erro do servidor (${response.status})`,
                `Funds Explorer retornou ${response.status}. Site pode estar fora do ar.`,
                'Aguarde e tente novamente. Verifique status.fundsexplorer.com.br'
            );
        }

        // ==========================================
        // STEP 2: CONTENT VALIDATION
        // ==========================================
        const html = response.data;
        const htmlSize = html ? html.length : 0;

        if (!html || htmlSize < 1000) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'HTML vazio ou muito pequeno',
                `HTML recebido tem ${htmlSize} bytes. Esperado > 10kb.`,
                'Site pode estar bloqueando scraper ou retornando página de erro'
            );
        }

        // Check for Cloudflare challenge
        if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Cloudflare Challenge detectado',
                'HTML contém página de verificação Cloudflare. Scraper bloqueado.',
                'Implementar bypass de Cloudflare ou usar proxy rotativo'
            );
        }

        const $ = cheerio.load(html);

        // ==========================================
        // STEP 3: PRICE SELECTOR TEST
        // ==========================================
        const priceSelector = '.headerTicker__content__price p';
        const priceElement = $(priceSelector).first();
        const priceText = priceElement.text().trim();

        if (!priceText) {
            // Try fallback
            const fallbackText = $('.headerTicker__content__price').text().trim();
            if (!fallbackText) {
                return createDiagnosticResult(
                    service,
                    'CRITICAL_FAILURE',
                    Date.now() - startTime,
                    'Seletor de Preço não encontrado',
                    `Cheerio retornou null para '${priceSelector}'. HTML tem ${htmlSize} bytes. Layout do site pode ter mudado.`,
                    'Atualizar fiiMetrics.scraper.js linha 144. Inspecionar HTML do site.'
                );
            }
        }

        // ==========================================
        // STEP 4: PRICE PARSER TEST
        // ==========================================
        const priceMatch = priceText.match(/R?\$?\s?([\d\.,]+)/);
        if (!priceMatch) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Parser de preço falhou',
                `Texto do preço: "${priceText}". Não foi possível extrair valor numérico.`,
                'Verificar formato do preço no site. Atualizar regex em parseBrazilianNumber()'
            );
        }

        const priceValue = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
        if (isNaN(priceValue) || priceValue <= 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Preço zerado ou inválido',
                `Preço parseado: ${priceValue}. Texto original: "${priceText}".`,
                'Mercado pode estar fechado ou FII sem negociação'
            );
        }

        // ==========================================
        // STEP 5: DIVIDEND TABLE TEST
        // ==========================================
        const dividendTableSelector = '.yieldChart__table__body';
        const dividendTable = $(dividendTableSelector);

        if (dividendTable.length === 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Tabela de dividendos não encontrada',
                `Seletor '${dividendTableSelector}' retornou 0 elementos.`,
                'Layout da tabela de dividendos pode ter mudado. Atualizar linha 163 do scraper.'
            );
        }

        const dividendRows = dividendTable.find('.yieldChart__table__bloco');
        if (dividendRows.length === 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Tabela de dividendos vazia',
                `Tabela encontrada mas sem linhas (.yieldChart__table__bloco).`,
                'FII pode não ter histórico de dividendos ou seletor interno mudou.'
            );
        }

        // ==========================================
        // ALL TESTS PASSED
        // ==========================================
        return createDiagnosticResult(
            service,
            'SUCCESS',
            Date.now() - startTime,
            'Scraper operacional',
            `Ticker: ${TEST_FII}, Preço: R$ ${priceValue.toFixed(2)}, Dividendos: ${dividendRows.length} registros`,
            null
        );

    } catch (error) {
        return createDiagnosticResult(
            service,
            'CRITICAL_FAILURE',
            Date.now() - startTime,
            'Erro inesperado',
            `${error.constructor.name}: ${error.message}`,
            'Verificar logs do servidor para stack trace completo'
        );
    }
};

/**
 * Test Brapi API - CASCADE VALIDATION
 */
const testBrapiAPI = async () => {
    const service = 'BRAPI';
    const startTime = Date.now();
    const token = process.env.BRAPI_TOKEN;
    const baseUrl = process.env.BRAPI_BASE_URL || 'https://brapi.dev/api';

    // ==========================================
    // STEP 1: TOKEN CHECK
    // ==========================================
    if (!token) {
        return createDiagnosticResult(
            service,
            'WARNING',
            Date.now() - startTime,
            'Token não configurado',
            'Variável BRAPI_TOKEN não definida. API funcionará com rate limit reduzido.',
            'Adicionar BRAPI_TOKEN no .env para aumentar limite de requisições'
        );
    }

    try {
        // ==========================================
        // STEP 2: CONNECTION TEST
        // ==========================================
        const response = await axios.get(`${baseUrl}/quote/${TEST_STOCK}`, {
            params: { token },
            timeout: 10000,
            validateStatus: () => true
        });

        if (response.status === 401) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Token inválido (401)',
                'BRAPI retornou 401 Unauthorized. Token expirado ou incorreto.',
                'Renovar token em brapi.dev/dashboard'
            );
        }

        if (response.status === 429) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Rate limit atingido (429)',
                'Muitas requisições. Plano gratuito tem limite.',
                'Aguardar reset do limite ou fazer upgrade do plano'
            );
        }

        if (response.status >= 500) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                `Erro do servidor (${response.status})`,
                'BRAPI está com problemas. Fallback para Yahoo será usado.',
                'Aguardar recuperação da API'
            );
        }

        // ==========================================
        // STEP 3: DATA QUALITY CHECK
        // ==========================================
        const quote = response.data?.results?.[0];

        if (!quote) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Resposta sem dados',
                `API retornou 200 mas results está vazio. Ticker: ${TEST_STOCK}`,
                'Verificar se ticker de teste é válido'
            );
        }

        const price = quote.regularMarketPrice;

        if (!price || price <= 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Preço zerado ou null',
                `API online, mas regularMarketPrice = ${price}. Mercado fechado ou ticker sem dados.`,
                'Normal fora do horário de pregão. Testar com mercado aberto.'
            );
        }

        return createDiagnosticResult(
            service,
            'SUCCESS',
            Date.now() - startTime,
            'API operacional',
            `Ticker: ${TEST_STOCK}, Preço: R$ ${price.toFixed(2)}`,
            null
        );

    } catch (error) {
        return createDiagnosticResult(
            service,
            'CRITICAL_FAILURE',
            Date.now() - startTime,
            'Erro de conexão',
            `${error.message}`,
            'Verificar conectividade com brapi.dev'
        );
    }
};

/**
 * Test Yahoo Finance API - CASCADE VALIDATION
 */
const testYahooAPI = async () => {
    const service = 'YAHOO';
    const startTime = Date.now();

    try {
        // Dynamic import for yahoo-finance2
        const pkg = require('yahoo-finance2');
        const yahooFinance = pkg.default || pkg;

        const quote = await yahooFinance.quote(`${TEST_STOCK}.SA`);

        if (!quote) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Nenhum dado retornado',
                `yahoo-finance2.quote() retornou null para ${TEST_STOCK}.SA`,
                'Verificar se pacote yahoo-finance2 está instalado e atualizado'
            );
        }

        const price = quote.regularMarketPrice;

        if (!price || price <= 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Preço zerado',
                `Yahoo retornou preço: ${price}. Mercado pode estar fechado.`,
                'Normal fora do pregão'
            );
        }

        return createDiagnosticResult(
            service,
            'SUCCESS',
            Date.now() - startTime,
            'API operacional',
            `Ticker: ${TEST_STOCK}.SA, Preço: R$ ${price.toFixed(2)}`,
            null
        );

    } catch (error) {
        return createDiagnosticResult(
            service,
            'CRITICAL_FAILURE',
            Date.now() - startTime,
            'Erro na API Yahoo',
            `${error.constructor.name}: ${error.message}`,
            'Verificar se yahoo-finance2 está instalado. npm install yahoo-finance2'
        );
    }
};

/**
 * Test BCB Rates API (CDI/IPCA) - CASCADE VALIDATION
 */
const testBCBRates = async () => {
    const service = 'BCB_RATES';
    const startTime = Date.now();
    const selicUrl = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';

    try {
        const response = await axios.get(selicUrl, { timeout: 5000 });

        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Resposta vazia do BCB',
                'API BCB retornou array vazio. Série 432 (Selic) pode estar indisponível.',
                'Verificar status da API BCB'
            );
        }

        const selic = parseFloat(response.data[0]?.valor);

        if (isNaN(selic) || selic <= 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Valor Selic inválido',
                `BCB retornou valor: "${response.data[0]?.valor}". Parsing falhou.`,
                'Verificar formato da resposta da API BCB'
            );
        }

        return createDiagnosticResult(
            service,
            'SUCCESS',
            Date.now() - startTime,
            'API operacional',
            `Taxa Selic: ${selic}% a.a.`,
            null
        );

    } catch (error) {
        return createDiagnosticResult(
            service,
            'CRITICAL_FAILURE',
            Date.now() - startTime,
            'Erro de conexão BCB',
            `${error.message}`,
            'Verificar conectividade com api.bcb.gov.br'
        );
    }
};

/**
 * Run ALL investment diagnostics in parallel
 * Returns array of diagnostic results
 */
const runInvestmentDiagnostics = async () => {
    logger.info('🔬 [HEALTH] Iniciando diagnóstico de investimentos...');

    const results = await Promise.all([
        testFIIScraper(),
        testBrapiAPI(),
        testYahooAPI(),
        testBCBRates()
    ]);

    const failures = results.filter(r => r.status === 'CRITICAL_FAILURE').length;
    const warnings = results.filter(r => r.status === 'WARNING').length;

    logger.info(`🔬 [HEALTH] Diagnóstico completo: ${results.length - failures - warnings} OK, ${warnings} avisos, ${failures} falhas`);

    return {
        summary: {
            total: results.length,
            success: results.length - failures - warnings,
            warnings,
            failures,
            overallStatus: failures > 0 ? 'CRITICAL' : warnings > 0 ? 'DEGRADED' : 'HEALTHY'
        },
        diagnostics: results
    };
};

module.exports = {
    testFIIScraper,
    testBrapiAPI,
    testYahooAPI,
    testBCBRates,
    runInvestmentDiagnostics
};
