/**
 * Test Fixed Income Calculation
 * ============================
 * Script to verify the calculation logic in fixedIncome.service.js
 * 
 * Usage: node tests/testFixedIncome.js
 */

const fixedIncomeService = require('../src/features/investments/fixedIncome.service');

const runTest = async () => {
    console.log('🏦 Testing Fixed Income Calculations...\n');

    // 1. Fetch Rates (Mock or Real)
    const rates = await fixedIncomeService.getFees();
    console.log('📊 Current Market Rates:', rates);

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    // 2. Test Cases
    const products = [
        {
            id: 'TEST-PRE',
            investedAmount: 1000,
            purchaseDate: oneYearAgo,
            returnType: 'PREFIXADO',
            expectedReturn: 12, // 12% a.a.
            indexerBonus: 0
        },
        {
            id: 'TEST-CDI',
            investedAmount: 1000,
            purchaseDate: oneYearAgo,
            returnType: 'CDI',
            expectedReturn: 100, // 100% do CDI
            indexerBonus: 0
        },
        {
            id: 'TEST-CDI-PLUS',
            investedAmount: 1000,
            purchaseDate: oneYearAgo,
            returnType: 'CDI',
            expectedReturn: 110, // 110% do CDI
            indexerBonus: 0
        },
        {
            id: 'TEST-IPCA',
            investedAmount: 1000,
            purchaseDate: oneYearAgo,
            returnType: 'IPCA',
            expectedReturn: 6, // IPCA + 6%
            indexerBonus: 0
        }
    ];

    console.log('\n--- Simulation Results (1 Year Period) ---');

    for (const p of products) {
        const result = await fixedIncomeService.calculateCurrentValue(p);

        console.log(`\n🔹 Product: ${p.id} (${p.returnType} ${p.expectedReturn})`);
        console.log(`   Invested: R$ ${p.investedAmount}`);
        console.log(`   Current:  R$ ${result.currentValue}`);
        console.log(`   Profit:   R$ ${result.profit} (${((result.profit / p.investedAmount) * 100).toFixed(2)}%)`);
        console.log(`   Rate Used: ${result.rateUsed}%`);
        console.log(`   Days:     ${result.daysPassed}`);
    }

    console.log('\n✅ Test Completed!');
};

runTest().catch(console.error);
