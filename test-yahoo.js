/**
 * Test Script - Yahoo Finance Dividend Data
 * Run: node test-yahoo.js
 */

const pkg = require('yahoo-finance2');
let yahooFinance;

// Initialize Yahoo Finance (same logic as yahoo.client.js)
try {
    if (pkg.YahooFinance) {
        yahooFinance = new pkg.YahooFinance();
    } else if (typeof pkg.default === 'function') {
        yahooFinance = new pkg.default();
    } else {
        yahooFinance = pkg.default || pkg;
    }
} catch (error) {
    console.error('Error initializing Yahoo Finance:', error);
    yahooFinance = pkg.default || pkg;
}

// Test tickers - replace with actual tickers from user's portfolio
const testTickers = ['AAZQ11.SA', 'PETR4.SA', 'ITUB4.SA', 'HGLG11.SA'];

async function testQuote(ticker) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${ticker}`);
    console.log('='.repeat(60));

    try {
        const quote = await yahooFinance.quote(ticker);

        if (!quote) {
            console.log('❌ Quote is NULL');
            return;
        }

        // Log all relevant fields
        console.log('\n📊 Price Data:');
        console.log(`  - regularMarketPrice: ${quote.regularMarketPrice}`);
        console.log(`  - previousClose: ${quote.previousClose}`);
        console.log(`  - regularMarketChange: ${quote.regularMarketChange}`);
        console.log(`  - regularMarketChangePercent: ${quote.regularMarketChangePercent}`);

        console.log('\n💰 Dividend Data:');
        console.log(`  - trailingAnnualDividendRate: ${quote.trailingAnnualDividendRate}`);
        console.log(`  - trailingAnnualDividendYield: ${quote.trailingAnnualDividendYield}`);
        console.log(`  - dividendRate: ${quote.dividendRate}`);
        console.log(`  - dividendYield: ${quote.dividendYield}`);
        console.log(`  - forwardPE: ${quote.forwardPE}`);
        console.log(`  - earningsTimestamp: ${quote.earningsTimestamp}`);

        console.log('\n📋 Asset Info:');
        console.log(`  - shortName: ${quote.shortName}`);
        console.log(`  - longName: ${quote.longName}`);
        console.log(`  - quoteType: ${quote.quoteType}`);
        console.log(`  - exchange: ${quote.exchange}`);

        // Log full quote object to file for inspection
        return {
            ticker,
            price: quote.regularMarketPrice,
            dividendYield: quote.trailingAnnualDividendYield,
            dividendRate: quote.trailingAnnualDividendRate,
            rawQuoteKeys: Object.keys(quote)
        };

    } catch (error) {
        console.error(`❌ Error fetching ${ticker}:`, error.message);
        return { ticker, error: error.message };
    }
}

async function runTests() {
    console.log('🚀 Starting Yahoo Finance Tests...\n');
    console.log(`Testing ${testTickers.length} tickers...\n`);

    const results = [];

    for (const ticker of testTickers) {
        const result = await testQuote(ticker);
        if (result) results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));

    results.forEach(r => {
        if (r.error) {
            console.log(`❌ ${r.ticker}: ERROR - ${r.error}`);
        } else {
            const dyPercent = r.dividendYield ? (r.dividendYield * 100).toFixed(2) : 'N/A';
            console.log(`✅ ${r.ticker}: R$ ${r.price?.toFixed(2) || 'N/A'} | DY: ${dyPercent}%`);
        }
    });

    // Write full results to file
    const fs = require('fs');
    fs.writeFileSync(
        './test-yahoo-results.txt',
        '=== YAHOO FINANCE TEST RESULTS ===\n' +
        `Date: ${new Date().toISOString()}\n\n` +
        JSON.stringify(results, null, 2) +
        '\n\n=== RAW QUOTE KEYS ===\n' +
        (results[0]?.rawQuoteKeys?.join('\n') || 'No data')
    );

    console.log('\n📄 Full results saved to: test-yahoo-results.txt');
}

runTests().catch(console.error);
