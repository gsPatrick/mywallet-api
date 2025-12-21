/**
 * Script para criar usuário de teste no Mercado Pago
 * Execute: node src/scripts/createMPTestUser.js
 */

require('dotenv').config();

const axios = require('axios');

// Use seu token de PRODUÇÃO da conta principal
const YOUR_MAIN_PROD_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-6853336883604393-122023-4cfe1dc74dc68d3e2a0d2e7ac2c96aa7-2019519940';

async function createTestUser() {
    try {
        console.log('🔄 Criando usuário de teste no Mercado Pago...\n');
        console.log('Token usado:', YOUR_MAIN_PROD_TOKEN.substring(0, 30) + '...\n');

        const response = await axios.post(
            'https://api.mercadopago.com/users/test_user',
            { site_id: 'MLB' },
            {
                headers: {
                    'Authorization': `Bearer ${YOUR_MAIN_PROD_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Usuário de teste criado!\n');
        console.log('========================================');
        console.log('📋 USE ESTAS CREDENCIAIS:');
        console.log('========================================');
        console.log('');
        console.log('MP_PUBLIC_KEY=' + response.data.public_key);
        console.log('MP_ACCESS_TOKEN=' + response.data.access_token);
        console.log('');
        console.log('========================================');
        console.log('Dados do usuário de teste:');
        console.log('========================================');
        console.log('ID:', response.data.id);
        console.log('Nickname:', response.data.nickname);
        console.log('Email:', response.data.email);
        console.log('Password:', response.data.password);
        console.log('');
        console.log('✅ Estas são credenciais de PRODUÇÃO do usuário de teste');
        console.log('✅ Use cartões de teste oficiais do MP para testar');
        console.log('');
        console.log('📌 Cartões de teste:');
        console.log('   APROVADO: 5031 4332 1540 6351 - CVV: 123 - Validade: 11/25');
        console.log('   REJEITADO: 5031 7557 3453 0604 - CVV: 123 - Validade: 11/25');

        return response.data;
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('\n⚠️  Token inválido ou expirado.');
            console.log('Use um token de PRODUÇÃO válido no MP_ACCESS_TOKEN');
        }
    }
}

createTestUser();
