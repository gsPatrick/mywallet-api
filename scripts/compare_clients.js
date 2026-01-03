require('dotenv').config();
const yahooClient = require('../src/features/investments/yahoo.client');
const brapiClient = require('../src/features/investments/brapi.client');

async function compareClients() {
    const tickers = ['AAGR11', 'PETR4', 'MXRF11'];

    console.log('--- TESTING YAHOO FINANCE ---');
    try {
        const yQuotes = await yahooClient.getQuotes(tickers);
        console.log(JSON.stringify(yQuotes, null, 2));
    } catch (e) { console.error(e); }

    console.log('\n--- TESTING BRAPI ---');
    try {
        const bQuotes = await brapiClient.getQuotes(tickers);
        console.log(JSON.stringify(bQuotes, null, 2));
    } catch (e) { console.error(e); }
}

compareClients();
