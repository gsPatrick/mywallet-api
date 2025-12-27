/**
 * Dicionário de Corretoras Brasileiras
 * ========================================
 * Lista de corretoras com logos, cores e informações
 * Para uso no frontend como seleção rápida
 */

const BROKERS_LIST = [
    {
        code: 'XP',
        name: 'XP Investimentos',
        color: '#F7B500',
        logoUrl: 'https://logo.clearbit.com/xpi.com.br',
        icon: 'trending-up',
        type: 'FULL_SERVICE'
    },
    {
        code: 'NUINVEST',
        name: 'NuInvest',
        color: '#820AD1',
        logoUrl: 'https://logo.clearbit.com/nuinvest.com.br',
        icon: 'trending-up',
        type: 'DIGITAL'
    },
    {
        code: 'BTG',
        name: 'BTG Pactual',
        color: '#001B48',
        logoUrl: 'https://logo.clearbit.com/btgpactual.com',
        icon: 'trending-up',
        type: 'FULL_SERVICE'
    },
    {
        code: 'RICO',
        name: 'Rico Investimentos',
        color: '#FF6600',
        logoUrl: 'https://i.imgur.com/uSxEe0t.jpeg',
        icon: 'trending-up',
        type: 'DIGITAL'
    },
    {
        code: 'CLEAR',
        name: 'Clear',
        color: '#00A3E0',
        logoUrl: 'https://logo.clearbit.com/clear.com.br',
        icon: 'trending-up',
        type: 'DIGITAL'
    },
    {
        code: 'INTER',
        name: 'Inter Invest',
        color: '#FF7A00',
        logoUrl: 'https://logo.clearbit.com/bancointer.com.br',
        icon: 'trending-up',
        type: 'DIGITAL'
    },
    {
        code: 'AVENUE',
        name: 'Avenue',
        color: '#5B21B6',
        logoUrl: 'https://logo.clearbit.com/avenue.us',
        icon: 'globe',
        type: 'INTERNATIONAL'
    },
    {
        code: 'BINANCE',
        name: 'Binance',
        color: '#F0B90B',
        logoUrl: 'https://logo.clearbit.com/binance.com',
        icon: 'dollar-sign',
        type: 'CRYPTO'
    },
    {
        code: 'MERCADO_BITCOIN',
        name: 'Mercado Bitcoin',
        color: '#00D4A1',
        logoUrl: 'https://logo.clearbit.com/mercadobitcoin.com.br',
        icon: 'dollar-sign',
        type: 'CRYPTO'
    },
    {
        code: 'ATIVA',
        name: 'Ativa Investimentos',
        color: '#003366',
        logoUrl: 'https://logo.clearbit.com/ativainvestimentos.com.br',
        icon: 'trending-up',
        type: 'FULL_SERVICE'
    },
    {
        code: 'GENIAL',
        name: 'Genial Investimentos',
        color: '#00B4D8',
        logoUrl: 'https://logo.clearbit.com/genialinvestimentos.com.br',
        icon: 'trending-up',
        type: 'FULL_SERVICE'
    },
    {
        code: 'MODAL',
        name: 'Modal Mais',
        color: '#6C2BD9',
        logoUrl: 'https://logo.clearbit.com/modal.com.br',
        icon: 'trending-up',
        type: 'FULL_SERVICE'
    },
    {
        code: 'MYWALLET',
        name: 'MyWallet Investimentos',
        color: '#8B5CF6',
        logoUrl: null,
        icon: 'wallet',
        type: 'SYSTEM',
        isSystemDefault: true
    }
];

/**
 * Buscar corretora por código
 */
const getBrokerByCode = (code) => {
    return BROKERS_LIST.find(b => b.code === code);
};

/**
 * Buscar corretoras por tipo
 */
const getBrokersByType = (type) => {
    return BROKERS_LIST.filter(b => b.type === type);
};

/**
 * Retorna corretora padrão do sistema
 */
const getDefaultBroker = () => {
    return BROKERS_LIST.find(b => b.isSystemDefault);
};

module.exports = {
    BROKERS_LIST,
    getBrokerByCode,
    getBrokersByType,
    getDefaultBroker
};
