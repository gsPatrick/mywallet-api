/**
 * Investment Health Service - Diagnostic System
 * ===============================================
 * 
 * Provides granular observability for investment data sources.
 * Uses the ACTUAL system functions, not replicated code.
 * 
 * Services monitored:
 * - FII_SCRAPER (Funds Explorer) - uses fiiMetrics.scraper.js
 * - BRAPI (B3 quotes) - uses brapi.client.js
 * - YAHOO (International quotes) - uses yahoo.client.js
 * - BCB_RATES (CDI/IPCA) - uses fixedIncome.service.js
 */

const { logger } = require('../../config/logger');

// Import the REAL functions from the actual system
const { getFIIMetrics } = require('./fiiMetrics.scraper');
const { getQuote: getBrapiQuote } = require('./brapi.client');
const { getQuote: getYahooQuote } = require('./yahoo.client');
const { getFees } = require('./fixedIncome.service');

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
 * Test FII Scraper - Uses the REAL getFIIMetrics function
 */
const testFIIScraper = async () => {
    const service = 'FII_SCRAPER';
    const startTime = Date.now();

    try {
        // Call the REAL scraper function
        const metrics = await getFIIMetrics(TEST_FII);

        if (!metrics) {
            return createDiagnosticResult(
                service,
                'CRITICAL_FAILURE',
                Date.now() - startTime,
                'Scraper retornou null',
                `getFIIMetrics('${TEST_FII}') retornou null`,
                'Verificar fiiMetrics.scraper.js'
            );
        }

        if (!metrics.price || metrics.price <= 0) {
            return createDiagnosticResult(
                service,
                'WARNING',
                Date.now() - startTime,
                'Preço não disponível',
                `Scraper retornou preço: ${metrics.price}`,
                'Mercado pode estar fechado ou FII sem negociação'
            );
        }

        const dividendCount = metrics.dividendHistory?.length || 0;

        return createDiagnosticResult(
            service,
            'SUCCESS',
            Date.now() - startTime,
            'Scraper operacional',
            `Ticker: ${TEST_FII}, Preço: R$ ${metrics.price.toFixed(2)}, Dividendos: ${dividendCount} registros, P/VP: ${metrics.pvp || 'N/A'}`,
            null
        );

    } catch (error) {
        const latency = Date.now() - startTime;

        // Analyze error type for better diagnosis
        const errMsg = error.message || '';

        if (errMsg.includes('Cloudflare') || errMsg.includes('cf-browser')) {
            return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
                'Cloudflare Challenge detectado',
                'Funds Explorer bloqueou o acesso via Cloudflare.',
                'Implementar bypass de Cloudflare ou usar proxy rotativo'
            );
        }

        if (errMsg.includes('403')) {
            return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
                'Acesso bloqueado (403)', errMsg,
                'IP pode estar bloqueado. Aguardar ou trocar IP.'
            );
        }

        if (errMsg.includes('não encontrado') || errMsg.includes('404')) {
            return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
                'Ticker não encontrado', errMsg,
                'Verificar se o ticker existe no Funds Explorer'
            );
        }

        if (errMsg.includes('estrutura') || errMsg.includes('alterada')) {
            return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
                'Estrutura da página mudou', errMsg,
                'Atualizar seletores CSS no fiiMetrics.scraper.js'
            );
        }

        return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
            'Erro no scraper',
            `${error.constructor.name}: ${errMsg}`,
            'Verificar logs do servidor'
        );
    }
};

/**
 * Test Brapi API - Uses the REAL getBrapiQuote function
 */
const testBrapiAPI = async () => {
    const service = 'BRAPI';
    const startTime = Date.now();

    try {
        const quote = await getBrapiQuote(TEST_STOCK);

        if (!quote) {
            return createDiagnosticResult(service, 'WARNING', Date.now() - startTime,
                'Nenhum dado retornado',
                `getBrapiQuote('${TEST_STOCK}') retornou null`,
                'API pode estar fora ou ticker inválido'
            );
        }

        const price = quote.regularMarketPrice || quote.price;

        if (!price || price <= 0) {
            return createDiagnosticResult(service, 'WARNING', Date.now() - startTime,
                'Preço zerado ou null',
                `Brapi retornou preço: ${price}. Mercado pode estar fechado.`,
                'Normal fora do horário de pregão'
            );
        }

        return createDiagnosticResult(service, 'SUCCESS', Date.now() - startTime,
            'API operacional',
            `Ticker: ${TEST_STOCK}, Preço: R$ ${price.toFixed(2)}`,
            null
        );

    } catch (error) {
        const latency = Date.now() - startTime;
        const errMsg = error.message || '';

        if (errMsg.includes('401')) {
            return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
                'Token inválido (401)', errMsg,
                'Renovar token em brapi.dev/dashboard'
            );
        }

        if (errMsg.includes('429')) {
            return createDiagnosticResult(service, 'WARNING', latency,
                'Rate limit atingido (429)', errMsg,
                'Aguardar reset do limite'
            );
        }

        return createDiagnosticResult(service, 'CRITICAL_FAILURE', latency,
            'Erro na API', errMsg,
            'Verificar conectividade com brapi.dev'
        );
    }
};

/**
 * Test Yahoo Finance API - Uses the REAL getYahooQuote function
 */
const testYahooAPI = async () => {
    const service = 'YAHOO';
    const startTime = Date.now();

    try {
        const quote = await getYahooQuote(TEST_STOCK);

        if (!quote) {
            return createDiagnosticResult(service, 'WARNING', Date.now() - startTime,
                'Nenhum dado retornado',
                `getYahooQuote('${TEST_STOCK}') retornou null`,
                'Yahoo pode estar instável'
            );
        }

        const price = quote.regularMarketPrice || quote.price;

        if (!price || price <= 0) {
            return createDiagnosticResult(service, 'WARNING', Date.now() - startTime,
                'Preço zerado',
                `Yahoo retornou preço: ${price}. Mercado pode estar fechado.`,
                'Normal fora do pregão'
            );
        }

        return createDiagnosticResult(service, 'SUCCESS', Date.now() - startTime,
            'API operacional',
            `Ticker: ${TEST_STOCK}, Preço: R$ ${price.toFixed(2)}`,
            null
        );

    } catch (error) {
        return createDiagnosticResult(service, 'CRITICAL_FAILURE', Date.now() - startTime,
            'Erro na API Yahoo',
            `${error.constructor.name}: ${error.message}`,
            'Verificar logs do servidor'
        );
    }
};

/**
 * Test BCB Rates API - Uses the REAL getFees function
 */
const testBCBRates = async () => {
    const service = 'BCB_RATES';
    const startTime = Date.now();

    try {
        const rates = await getFees();

        if (!rates) {
            return createDiagnosticResult(service, 'CRITICAL_FAILURE', Date.now() - startTime,
                'Nenhuma taxa retornada',
                'getFees() retornou null',
                'Verificar fixedIncome.service.js'
            );
        }

        const selic = rates.selic || rates.cdi;

        if (!selic || selic <= 0) {
            return createDiagnosticResult(service, 'WARNING', Date.now() - startTime,
                'Taxa Selic/CDI inválida',
                `Retornou: Selic=${rates.selic}, CDI=${rates.cdi}`,
                'API BCB pode estar instável'
            );
        }

        return createDiagnosticResult(service, 'SUCCESS', Date.now() - startTime,
            'API operacional',
            `Selic: ${selic}% a.a., CDI: ${rates.cdi || 'N/A'}%, IPCA: ${rates.ipca || 'N/A'}%`,
            null
        );

    } catch (error) {
        return createDiagnosticResult(service, 'CRITICAL_FAILURE', Date.now() - startTime,
            'Erro na API BCB',
            error.message,
            'Verificar conectividade com api.bcb.gov.br'
        );
    }
};

/**
 * Run ALL investment diagnostics in parallel
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
