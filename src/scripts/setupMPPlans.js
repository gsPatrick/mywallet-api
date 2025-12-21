/**
 * Script para criar planos no Mercado Pago
 * Execute: node src/scripts/setupMPPlans.js
 */

require('dotenv').config();

const axios = require('axios');

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const BASE_URL = 'https://api.mercadopago.com';

const getHeaders = () => ({
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
});

const plans = [
    {
        key: 'MONTHLY',
        reason: 'MyWallet - Plano Mensal',
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 29.90
    },
    {
        key: 'ANNUAL',
        reason: 'MyWallet - Plano Anual',
        frequency: 12,
        frequency_type: 'months',
        transaction_amount: 297.00
    }
];

async function setupPlans() {
    console.log('📋 Criando planos no Mercado Pago...');
    console.log('   Token:', MP_ACCESS_TOKEN?.substring(0, 20) + '...\n');

    if (!MP_ACCESS_TOKEN) {
        console.error('❌ MP_ACCESS_TOKEN não configurado no .env');
        process.exit(1);
    }

    const createdPlans = {};

    for (const plan of plans) {
        try {
            const planData = {
                reason: plan.reason,
                auto_recurring: {
                    frequency: plan.frequency,
                    frequency_type: plan.frequency_type,
                    transaction_amount: plan.transaction_amount,
                    currency_id: 'BRL'
                },
                back_url: 'https://mywallet.codebypatrick.dev/checkout'
            };

            console.log(`Criando plano ${plan.key}...`);

            const response = await axios.post(
                `${BASE_URL}/preapproval_plan`,
                planData,
                { headers: getHeaders() }
            );

            createdPlans[plan.key] = response.data.id;
            console.log(`✅ Plano ${plan.key} criado: ${response.data.id}`);

        } catch (error) {
            console.error(`❌ Erro ao criar plano ${plan.key}:`, error.response?.data || error.message);
        }
    }

    console.log('\n========================================');
    console.log('📝 Adicione estas linhas ao seu .env:');
    console.log('========================================\n');

    for (const [key, id] of Object.entries(createdPlans)) {
        console.log(`MP_PLAN_${key}_ID=${id}`);
    }

    console.log('\n========================================');
    console.log('Depois reinicie o servidor!');
    console.log('========================================');
}

setupPlans();
