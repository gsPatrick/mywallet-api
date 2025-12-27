/**
 * Test International Stocks Response
 * =================================
 * Script para verificar suporte a ações internacionais e conversão de moeda
 * 
 * Uso: node tests/testInternationalStocks.js
 */

const fs = require('fs');
const path = require('path');
const yahooClient = require('../src/features/investments/yahoo.client');

// Tickers para testar (Ações US e BDRs misturados)
const TICKERS = [
    'NVDA',      // Nasdaq (US)
    'AAPL',      // Nasdaq (US)
    'TSLA',      // Nasdaq (US)
    'AAPL34',    // BDR (BR)
    'PAGS'       // NYSE (PagSeguro, US)
];

const runTest = async () => {
    console.log('🌎 Testando Ações Internacionais...\n');

    const outputDir = path.join(__dirname, 'intl_responses');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Busca cotações
    const results = await yahooClient.getQuotes(TICKERS);

    for (const ticker of TICKERS) {
        const data = results[ticker];

        console.log(`\n📊 Ativo: ${ticker}`);

        if (!data) {
            console.log('   ❌ Não encontrado ou falha.');
            continue;
        }

        console.log(`   Simbolo Yahoo: ${data.symbol}`);
        console.log(`   Preço Final (BRL): R$ ${data.price}`);
        console.log(`   Preço Original: ${data.originalPrice} ${data.originalCurrency}`);

        if (data.exchangeRateUsed > 1) {
            console.log(`   Taxa Câmbio Usada: ${data.exchangeRateUsed}`);
        }

        console.log(`   P/L (Trailing): ${data.trailingPE}`);
        console.log(`   Market Cap: ${data.marketCap ? (data.marketCap / 1e9).toFixed(2) + 'B (BRL)' : 'N/A'}`);
        console.log(`   Setor: ${data.sector}`);
        console.log(`   Indústria: ${data.industry}`);

        // Salva response completo
        const outputFile = path.join(outputDir, `response_${ticker}.txt`);
        fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
        console.log(`   ✅ Response salvo em: ${outputFile}`);
    }

    console.log('\n✅ Teste Concluído!');
};

runTest().catch(console.error);
