/**
 * Mercado Pago Configuration
 * ========================================
 * SDK e credenciais do Mercado Pago
 * ========================================
 */

require('dotenv').config();

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

// Validar credenciais
if (!MP_ACCESS_TOKEN) {
    console.warn('⚠️  MP_ACCESS_TOKEN não configurado. Pagamentos não funcionarão.');
}

// Configuração dos planos
const PLANS_CONFIG = {
    MONTHLY: {
        name: 'Plano Mensal',
        price: 29.90,
        frequency: 1,
        frequencyType: 'months',
        description: 'Acesso completo ao InvestPro por 1 mês'
    },
    ANNUAL: {
        name: 'Plano Anual',
        price: 297.00,
        frequency: 12,
        frequencyType: 'months',
        description: 'Acesso completo ao InvestPro por 1 ano (2 meses grátis!)'
    },
    LIFETIME: {
        name: 'Acesso Vitalício',
        price: 997.00,
        frequency: null,
        frequencyType: null,
        description: 'Acesso completo ao InvestPro para sempre'
    }
};

// Headers para API do Mercado Pago
const getHeaders = () => ({
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
});

module.exports = {
    MP_ACCESS_TOKEN,
    MP_PUBLIC_KEY,
    MP_WEBHOOK_SECRET,
    PLANS_CONFIG,
    getHeaders,
    BASE_URL: 'https://api.mercadopago.com'
};
