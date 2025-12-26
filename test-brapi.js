/**
 * Test Script - Brapi Dividend Data for FIIs
 * Run: node test-brapi.js
 */

const axios = require('axios');

const BRAPI_BASE_URL = process.env.BRAPI_BASE_URL || 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

// Test FII ticker
const testTicker = 'AAZQ11';

async function testBrapiQuote() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Brapi Quote for: ${testTicker}`);
    console.log('='.repeat(60));

    try {
        // 1. Basic Quote
        console.log('\n📊 1. Basic Quote:');
        const basicUrl = `${BRAPI_BASE_URL}/quote/${testTicker}`;
        const basicParams = BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {};
        const basicRes = await axios.get(basicUrl, { params: basicParams });
        const basicQuote = basicRes.data?.results?.[0];

        if (basicQuote) {
            console.log(`  - Price: R$ ${basicQuote.regularMarketPrice}`);
            console.log(`  - Symbol: ${basicQuote.symbol}`);
            console.log(`  - Available keys:`, Object.keys(basicQuote).join(', '));
        } else {
            console.log('  ❌ No basic quote data');
        }

        // 2. Quote with Dividends
        console.log('\n💰 2. Quote with Dividends:');
        const divUrl = `${BRAPI_BASE_URL}/quote/${testTicker}`;
        const divParams = {
            dividends: true,
            ...(BRAPI_TOKEN ? { token: BRAPI_TOKEN } : {})
        };
        const divRes = await axios.get(divUrl, { params: divParams });
        const divQuote = divRes.data?.results?.[0];

        if (divQuote) {
            console.log(`  - Price: R$ ${divQuote.regularMarketPrice}`);

            // Check for dividend data
            if (divQuote.dividendsData) {
                const cashDivs = divQuote.dividendsData.cashDividends || [];
                console.log(`  - Cash Dividends Found: ${cashDivs.length}`);

                if (cashDivs.length > 0) {
                    console.log('  - Last 5 dividends:');
                    cashDivs.slice(0, 5).forEach(d => {
                        console.log(`    * ${d.paymentDate}: R$ ${d.rate} (${d.type || 'DIVIDEND'})`);
                    });

                    // Calculate Annual DY from last 12 months
                    const now = new Date();
                    const twelveMonthsAgo = new Date();
                    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

                    const last12Months = cashDivs.filter(d => {
                        const payDate = new Date(d.paymentDate);
                        return payDate >= twelveMonthsAgo;
                    });

                    const totalDividends = last12Months.reduce((sum, d) => sum + parseFloat(d.rate || 0), 0);
                    const annualDY = divQuote.regularMarketPrice > 0
                        ? (totalDividends / divQuote.regularMarketPrice) * 100
                        : 0;

                    console.log(`\n  📈 Calculated Annual DY:`);
                    console.log(`    - Dividends in last 12 months: ${last12Months.length}`);
                    console.log(`    - Total dividends: R$ ${totalDividends.toFixed(4)}`);
                    console.log(`    - Current price: R$ ${divQuote.regularMarketPrice}`);
                    console.log(`    - Annual DY: ${annualDY.toFixed(2)}%`);
                }
            } else {
                console.log('  - No dividendsData in response');
                console.log('  - Note: Brapi requires paid plan for dividends data');
            }
        } else {
            console.log('  ❌ No dividend quote data');
        }

        // Write raw response to file
        const fs = require('fs');
        fs.writeFileSync(
            './test-brapi-results.txt',
            '=== BRAPI TEST RESULTS ===\n' +
            `Date: ${new Date().toISOString()}\n` +
            `Ticker: ${testTicker}\n\n` +
            '=== Basic Quote ===\n' +
            JSON.stringify(basicQuote, null, 2) +
            '\n\n=== Quote with Dividends ===\n' +
            JSON.stringify(divQuote, null, 2)
        );

        console.log('\n📄 Full results saved to: test-brapi-results.txt');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('  Status:', error.response.status);
            console.error('  Data:', error.response.data);
        }
    }
}

testBrapiQuote().catch(console.error);
