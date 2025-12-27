/**
 * Test ETF API Response (No DB Version)
 * ============================
 * Script para verificar campos disponíveis para ETFs no Yahoo Finance
 * Bypass DB connection to avoid environment issues
 */

const fs = require('fs');
const path = require('path');

// Mock Logger para o client não quebrar
const mockLogger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: () => { }
};

// Importa clientes (precisamos garantir que eles não dependam do DB na inicialização)
// Como o yahoo.client.js faz require do logger, e o logger pode ter deps,
// vamos importar o pkg diretamente aqui para isolamento total se necessário.
// Mas vamos tentar usar o client existente primeiro, assumindo que ele é stateless.

const yahooClient = require('../src/features/investments/yahoo.client');
const fundsExplorerClient = require('../src/features/investments/fundsExplorer.client');

// Lista de ETFs para teste
const ETFS = [
    'BOVA11',  // Índice Bovespa
    'IVVB11',  // S&P 500
    'SMAL11',  // Small Caps
    'XINA11',  // China
    'HASH11'   // Crypto
];

const testETFResponse = async () => {
    console.log('🔍 Iniciando análise de dados de ETFs (Modo Offline/Sem BD)...\n');

    const outputDir = path.join(__dirname, 'etf_responses');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const ticker of ETFS) {
        console.log(`\n📊 Analisando ETF: ${ticker}...`);

        // 1. Busca no Yahoo Finance (Cotação + Summary)
        console.log(`   Attempting Yahoo Finance...`);
        let yahooQuote = null;
        let yahooSummary = null;

        try {
            yahooQuote = await yahooClient.getQuote(ticker);
            yahooSummary = await yahooClient.getQuoteSummary(ticker);
        } catch (e) {
            console.error(`   ❌ Yahoo Error: ${e.message}`);
        }

        // 2. Tenta Funds Explorer
        console.log(`   Attempting Funds Explorer...`);
        let feData = null;
        try {
            feData = await fundsExplorerClient.fetchFiiData(ticker);
        } catch (e) {
            // Ignora erro
        }

        // Consolida
        const apiResponse = {
            ticker,
            yahooQuote,
            yahooSummary,
            fundsExplorer: feData
        };

        // Salva arquivo
        const outputFile = path.join(outputDir, `response_${ticker}.txt`);
        fs.writeFileSync(outputFile, JSON.stringify(apiResponse, null, 2));
        console.log(`   ✅ Resposta salva em: ${outputFile}`);

        // Log resumo
        console.log('   --- Resumo dos Dados ---');

        if (yahooQuote) {
            console.log(`   [Yahoo] Preço: R$ ${yahooQuote.price.toFixed(2)}`);
            // Tenta achar campos específicos de ETF no objeto retornado
            console.log(`   [Yahoo] Net Assets: ${yahooQuote.netAssets || 'N/A'}`);
            console.log(`   [Yahoo] Yield (Ref): ${yahooQuote.dividendYield || 'N/A'}`);
        } else {
            console.log(`   [Yahoo] ❌ Sem dados de cotação`);
        }

        if (yahooSummary) {
            // Campos que costumam vir em quoteSummary.summaryProfile ou defaultKeyStatistics
            console.log(`   [Summary] Sector: ${yahooSummary.sector || 'N/A'}`);
            console.log(`   [Summary] Industry: ${yahooSummary.industry || 'N/A'}`);
            console.log(`   [Summary] Employees: ${yahooSummary.fullTimeEmployees || 'N/A'}`);
        }

        if (feData) {
            console.log(`   [FE] Encontrado! Preço: R$ ${feData.price}`);
        } else {
            console.log(`   [FE] Não encontrado`);
        }
    }

    console.log('\n✅ Teste concluído!');
};

testETFResponse();
