/**
 * ============================================================
 * CONFIGURAÇÃO OPEN FINANCE BRASIL
 * ============================================================
 * LIMITES LEGAIS DO OPEN FINANCE:
 * ✅ Fornece: Contas, Cartões, Transações bancárias/cartão
 * ❌ NÃO fornece: Investimentos, Renda fixa, Ações/FIIs,
 *    Categorização, Previsões futuras
 * ============================================================
 */

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

// ===========================================
// CONFIGURAÇÕES BASE
// ===========================================

const config = {
    // URLs do ambiente (sandbox por padrão)
    directoryUrl: process.env.OF_DIRECTORY_URL || 'https://data.sandbox.directory.openbankingbrasil.org.br',
    redirectUri: process.env.OF_REDIRECT_URI || 'http://localhost:3000/api/open-finance/callback',
    clientId: process.env.OF_CLIENT_ID || '',

    // Certificados mTLS
    mtls: {
        certPath: process.env.MTLS_CERT_PATH || './src/config/certificates/transport.crt',
        keyPath: process.env.MTLS_KEY_PATH || './src/config/certificates/transport.key',
        caPath: process.env.MTLS_CA_PATH || './src/config/certificates/ca-bundle.crt'
    },

    // Certificado de assinatura
    signing: {
        certPath: process.env.SIGNING_CERT_PATH || './src/config/certificates/signing.crt',
        keyPath: process.env.SIGNING_KEY_PATH || './src/config/certificates/signing.key'
    },

    // Escopos suportados
    scopes: {
        ACCOUNTS_READ: 'accounts',
        CREDIT_CARDS_READ: 'credit-cards-accounts',
        CREDIT_CARDS_TRANSACTIONS_READ: 'credit-cards-accounts'
    },

    // Permissões Open Finance
    permissions: [
        'ACCOUNTS_READ',
        'ACCOUNTS_BALANCES_READ',
        'CREDIT_CARDS_ACCOUNTS_READ',
        'CREDIT_CARDS_ACCOUNTS_BILLS_READ',
        'CREDIT_CARDS_ACCOUNTS_BILLS_TRANSACTIONS_READ'
    ]
};

// ===========================================
// PKCE HELPERS
// ===========================================

/**
 * Gera um code_verifier para PKCE
 * @returns {string} Code verifier com 43-128 caracteres
 */
const generateCodeVerifier = () => {
    return crypto.randomBytes(32)
        .toString('base64url')
        .substring(0, 128);
};

/**
 * Gera code_challenge a partir do code_verifier
 * @param {string} verifier - Code verifier
 * @returns {string} Code challenge (SHA256)
 */
const generateCodeChallenge = (verifier) => {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
};

/**
 * Gera um state seguro para OAuth
 * @returns {string} State aleatório
 */
const generateState = () => {
    return crypto.randomBytes(16).toString('hex');
};

// ===========================================
// CLIENTE HTTPS COM mTLS
// ===========================================

/**
 * Cria opções HTTPS com certificados mTLS
 * @returns {Object} Opções para requisições HTTPS
 */
const createMtlsOptions = () => {
    const options = {
        rejectUnauthorized: true
    };

    // Carregar certificados se existirem
    try {
        if (fs.existsSync(config.mtls.certPath)) {
            options.cert = fs.readFileSync(config.mtls.certPath);
        }
        if (fs.existsSync(config.mtls.keyPath)) {
            options.key = fs.readFileSync(config.mtls.keyPath);
        }
        if (fs.existsSync(config.mtls.caPath)) {
            options.ca = fs.readFileSync(config.mtls.caPath);
        }
    } catch (error) {
        console.warn('⚠️ Certificados mTLS não encontrados. Necessário para produção.');
    }

    return options;
};

/**
 * Cria um agente HTTPS com mTLS
 * @returns {https.Agent} Agente HTTPS configurado
 */
const createMtlsAgent = () => {
    return new https.Agent(createMtlsOptions());
};

// ===========================================
// ENDPOINTS OPEN FINANCE
// ===========================================

const endpoints = {
    // Discovery
    wellKnown: (authServer) => `${authServer}/.well-known/openid-configuration`,

    // Consentimento
    consents: (resourceServer) => `${resourceServer}/open-banking/consents/v2/consents`,

    // Contas
    accounts: (resourceServer) => `${resourceServer}/open-banking/accounts/v2/accounts`,
    accountById: (resourceServer, accountId) =>
        `${resourceServer}/open-banking/accounts/v2/accounts/${accountId}`,
    accountBalances: (resourceServer, accountId) =>
        `${resourceServer}/open-banking/accounts/v2/accounts/${accountId}/balances`,
    accountTransactions: (resourceServer, accountId) =>
        `${resourceServer}/open-banking/accounts/v2/accounts/${accountId}/transactions`,

    // Cartões de Crédito
    creditCards: (resourceServer) =>
        `${resourceServer}/open-banking/credit-cards-accounts/v2/accounts`,
    creditCardById: (resourceServer, cardId) =>
        `${resourceServer}/open-banking/credit-cards-accounts/v2/accounts/${cardId}`,
    creditCardBills: (resourceServer, cardId) =>
        `${resourceServer}/open-banking/credit-cards-accounts/v2/accounts/${cardId}/bills`,
    creditCardTransactions: (resourceServer, cardId, billId) =>
        `${resourceServer}/open-banking/credit-cards-accounts/v2/accounts/${cardId}/bills/${billId}/transactions`
};

// ===========================================
// VALIDAÇÕES
// ===========================================

/**
 * Verifica se os certificados estão configurados
 * @returns {boolean} True se certificados existem
 */
const hasCertificates = () => {
    return fs.existsSync(config.mtls.certPath) &&
        fs.existsSync(config.mtls.keyPath);
};

/**
 * Valida configuração para produção
 * @throws {Error} Se configuração incompleta
 */
const validateProductionConfig = () => {
    const errors = [];

    if (!config.clientId) {
        errors.push('OF_CLIENT_ID não configurado');
    }

    if (!hasCertificates()) {
        errors.push('Certificados mTLS não encontrados');
    }

    if (errors.length > 0) {
        throw new Error(`Configuração Open Finance incompleta:\n${errors.join('\n')}`);
    }
};

module.exports = {
    config,
    endpoints,
    generateCodeVerifier,
    generateCodeChallenge,
    generateState,
    createMtlsAgent,
    createMtlsOptions,
    hasCertificates,
    validateProductionConfig
};
