/**
 * Brand Dictionary for Backend
 * ========================================
 * SYNC WITH: front-investpro/src/data/subscriptionIcons.json
 * 
 * This file mirrors the keywords from subscriptionIcons.json
 * so backend can detect brands and save brandKey
 * 
 * INSTRUCTIONS TO ADD NEW BRANDS:
 * 1. Add to frontend subscriptionIcons.json with icon
 * 2. Add same brandKey and keywords here (icon not needed)
 * ========================================
 */

const BRAND_LIBRARY = [
    // ========================================
    // FOOD & DELIVERY
    // ========================================
    { name: 'iFood', brandKey: 'ifood', category: 'FOOD', keywords: ['ifood', 'pag*ifood', 'ifood*', 'i food'] },
    { name: 'Rappi', brandKey: 'rappi', category: 'FOOD', keywords: ['rappi', 'rappipay'] },
    { name: 'Zé Delivery', brandKey: 'ze_delivery', category: 'FOOD', keywords: ['ze delivery', 'zé delivery', 'zedelivery'] },
    { name: "McDonald's", brandKey: 'mcdonalds', category: 'FOOD', keywords: ['mcdonalds', 'mequi', 'mc donalds', 'mc donald', 'mcd', 'big mac', 'arcos dourados'] },
    { name: 'Burger King', brandKey: 'burger_king', category: 'FOOD', keywords: ['burger king', 'bk', 'bk brasil', 'whopper'] },
    { name: 'Starbucks', brandKey: 'starbucks', category: 'FOOD', keywords: ['starbucks', 'sbux'] },
    { name: "Bob's", brandKey: 'bobs', category: 'FOOD', keywords: ['bobs', "bob's", 'big bob'] },
    { name: 'Subway', brandKey: 'subway', category: 'FOOD', keywords: ['subway'] },
    { name: 'Pizza Hut', brandKey: 'pizza_hut', category: 'FOOD', keywords: ['pizza hut', 'pizzahut'] },
    { name: "Domino's", brandKey: 'dominos', category: 'FOOD', keywords: ['dominos', "domino's", 'dominos pizza'] },
    { name: 'Outback', brandKey: 'outback', category: 'FOOD', keywords: ['outback', 'outback steakhouse'] },

    // ========================================
    // SHOPPING
    // ========================================
    { name: 'Mercado Livre', brandKey: 'mercado_livre', category: 'SHOPPING', keywords: ['mercado livre', 'mercadolivre', 'mercadopago', 'meli', 'ml*'] },
    { name: 'Amazon', brandKey: 'amazon', category: 'SHOPPING', keywords: ['amazon', 'amzn mktp', 'amazon.com.br', 'amz*'] },
    { name: 'Shopee', brandKey: 'shopee', category: 'SHOPPING', keywords: ['shopee', 'shopee brasil'] },
    { name: 'Shein', brandKey: 'shein', category: 'SHOPPING', keywords: ['shein'] },
    { name: 'Magalu', brandKey: 'magalu', category: 'SHOPPING', keywords: ['magalu', 'magazine luiza', 'magazineluiza', 'mglu'] },
    { name: 'Casas Bahia', brandKey: 'casas_bahia', category: 'SHOPPING', keywords: ['casas bahia', 'casasbahia'] },
    { name: 'Americanas', brandKey: 'americanas', category: 'SHOPPING', keywords: ['americanas', 'lojas americanas', 'ame digital'] },
    { name: 'AliExpress', brandKey: 'aliexpress', category: 'SHOPPING', keywords: ['aliexpress', 'ali express'] },

    // ========================================
    // MARKET
    // ========================================
    { name: 'Carrefour', brandKey: 'carrefour', category: 'MARKET', keywords: ['carrefour', 'atacadao', 'atacadão'] },
    { name: 'Pão de Açúcar', brandKey: 'pao_de_acucar', category: 'MARKET', keywords: ['pao de acucar', 'pão de açúcar', 'gpa'] },
    { name: 'Assaí', brandKey: 'assai', category: 'MARKET', keywords: ['assai', 'assaí atacadista'] },
    { name: 'Extra', brandKey: 'extra', category: 'MARKET', keywords: ['extra', 'extra hipermercado'] },

    // ========================================
    // FUEL
    // ========================================
    { name: 'Shell', brandKey: 'shell', category: 'FUEL', keywords: ['shell', 'posto shell', 'shell box'] },
    { name: 'Ipiranga', brandKey: 'ipiranga', category: 'FUEL', keywords: ['ipiranga', 'posto ipiranga', 'abastece ai', 'km de vantagens'] },
    { name: 'Petrobras', brandKey: 'petrobras', category: 'FUEL', keywords: ['petrobras', 'br mania', 'premmia', 'posto br'] },

    // ========================================
    // HEALTH
    // ========================================
    { name: 'Drogasil', brandKey: 'drogasil', category: 'HEALTH', keywords: ['drogasil', 'droga sil'] },
    { name: 'Droga Raia', brandKey: 'droga_raia', category: 'HEALTH', keywords: ['droga raia', 'raia', 'drogaraia'] },
    { name: 'Drogarias Pacheco', brandKey: 'pacheco', category: 'HEALTH', keywords: ['pacheco', 'drogarias pacheco'] },

    // ========================================
    // FINANCE
    // ========================================
    { name: 'Nubank', brandKey: 'nubank', category: 'FINANCE', keywords: ['nubank', 'nu', 'nuconta'] },
    { name: 'PicPay', brandKey: 'picpay', category: 'FINANCE', keywords: ['picpay', 'pic pay'] },
    { name: 'PagBank', brandKey: 'pagbank', category: 'FINANCE', keywords: ['pagbank', 'pagseguro'] },

    // ========================================
    // TRANSPORT
    // ========================================
    { name: 'Uber', brandKey: 'uber', category: 'UTILITIES', keywords: ['uber', 'uber*trip', 'uber trip', 'ubereats'] },
    { name: '99', brandKey: '99', category: 'UTILITIES', keywords: ['99app', '99 pop', '99 taxi', '99*', '99pay'] },
    { name: 'Cabify', brandKey: 'cabify', category: 'UTILITIES', keywords: ['cabify'] },

    // ========================================
    // STREAMING (from existing subscriptions)
    // ========================================
    { name: 'Netflix', brandKey: 'netflix', category: 'STREAMING', keywords: ['netflix', 'netfix'] },
    { name: 'Spotify', brandKey: 'spotify', category: 'MUSIC', keywords: ['spotify'] },
    { name: 'Disney+', brandKey: 'disney_plus', category: 'STREAMING', keywords: ['disney+', 'disney plus', 'disneyplus'] },
    { name: 'HBO Max', brandKey: 'hbo_max', category: 'STREAMING', keywords: ['hbo max', 'hbomax', 'hbo'] },
    { name: 'Prime Video', brandKey: 'amazon_prime', category: 'STREAMING', keywords: ['prime video', 'amazon prime video', 'primevideo', 'amazon prime'] },
    { name: 'YouTube Premium', brandKey: 'youtube_premium', category: 'STREAMING', keywords: ['youtube premium', 'youtube music', 'yt premium'] },
    { name: 'Globoplay', brandKey: 'globoplay', category: 'STREAMING', keywords: ['globoplay', 'globo play'] },
    { name: 'Apple', brandKey: 'apple_music', category: 'MUSIC', keywords: ['apple', 'apple.com', 'itunes', 'app store', 'icloud', 'apple one', 'apple music', 'apple tv+'] },
    { name: 'Google', brandKey: 'google_one', category: 'STORAGE', keywords: ['google', 'google play', 'google one', 'google storage', 'google cloud'] },
    { name: 'Microsoft', brandKey: 'microsoft_365', category: 'SOFTWARE', keywords: ['microsoft', 'xbox', 'office 365', 'microsoft 365', 'onedrive'] },
    { name: 'ChatGPT', brandKey: 'chatgpt', category: 'SOFTWARE', keywords: ['chatgpt', 'openai', 'gpt'] },
    { name: 'Claude', brandKey: 'claude', category: 'SOFTWARE', keywords: ['claude', 'anthropic'] },

    // ========================================
    // TELECOM
    // ========================================
    { name: 'Vivo', brandKey: 'vivo', category: 'UTILITIES', keywords: ['vivo', 'telefonica', 'vivo fibra'] },
    { name: 'Claro', brandKey: 'claro', category: 'UTILITIES', keywords: ['claro', 'claro net', 'net claro'] },
    { name: 'Tim', brandKey: 'tim', category: 'UTILITIES', keywords: ['tim', 'tim celular'] },
    { name: 'Oi', brandKey: 'oi', category: 'UTILITIES', keywords: ['oi', 'oi fibra'] }
];

module.exports = { BRAND_LIBRARY };
