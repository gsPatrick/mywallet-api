/**
 * Test Yahoo Finance Response
 * ============================
 * Script para verificar todos os campos disponíveis no Yahoo Finance
 * 
 * Uso: node tests/testYahooResponse.js
 */

const fs = require('fs');
const path = require('path');

// Importa a lib yahoo-finance2 diretamente
const pkg = require('yahoo-finance2');
let yahooFinance;

try {
    if (pkg.YahooFinance) {
        yahooFinance = new pkg.YahooFinance();
    } else if (typeof pkg.default === 'function') {
        yahooFinance = new pkg.default();
    } else {
        yahooFinance = pkg.default || pkg;
    }
} catch (error) {
    console.error('❌ Erro ao inicializar Yahoo Finance:', error);
    yahooFinance = pkg.default || pkg;
}

// Tickers para testar
const TICKERS = ['BTC-USD', 'ETH-USD', 'BTC-BRL'];

const testYahooResponse = async () => {
    console.log('🔍 Testando retorno do Yahoo Finance...\n');

    const outputDir = path.join(__dirname, 'yahoo_responses');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const ticker of TICKERS) {
        const symbol = `${ticker}.SA`;
        console.log(`📊 Buscando dados de ${symbol}...`);

        try {
            // Busca a cotação completa
            const quote = await yahooFinance.quote(symbol);

            if (!quote) {
                console.log(`❌ Nenhum dado para ${symbol}`);
                continue;
            }

            // Salva resposta completa em arquivo
            const outputFile = path.join(outputDir, `yahooResponse_${ticker}.txt`);
            const content = JSON.stringify(quote, null, 2);
            fs.writeFileSync(outputFile, content);

            console.log(`✅ ${ticker} salvo em: ${outputFile}`);

            // Log dos campos principais encontrados
            console.log(`   📈 Preço: R$ ${quote.regularMarketPrice}`);
            console.log(`   📊 P/L: ${quote.trailingPE || quote.forwardPE || 'N/A'}`);
            console.log(`   📘 P/VP: ${quote.priceToBook || 'N/A'}`);
            console.log(`   💰 Market Cap: ${quote.marketCap || 'N/A'}`);
            console.log(`   💵 Dividend Yield: ${quote.trailingAnnualDividendYield ? (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%' : 'N/A'}`);
            console.log(`   🏭 Setor: ${quote.sector || 'N/A'}`);
            console.log(`   🏢 Indústria: ${quote.industry || 'N/A'}`);
            console.log('');

        } catch (error) {
            console.error(`❌ Erro ao buscar ${symbol}:`, error.message);
        }
    }

    console.log('\n📁 Respostas salvas em:', outputDir);
    console.log('✅ Teste concluído!');
};

// Executa
testYahooResponse().catch(console.error);
