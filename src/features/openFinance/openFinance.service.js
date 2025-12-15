/**
 * Open Finance Service
 * ========================================
 * Lógica de negócio para Open Finance Brasil
 * ========================================
 * 
 * LIMITES LEGAIS:
 * ✅ Fornece: Contas, Cartões, Transações
 * ❌ NÃO fornece: Investimentos, Renda fixa, Categorização
 */

const {
    Consent,
    BankAccount,
    CreditCard,
    OpenFinanceTransaction,
    AuditLog
} = require('../../models');
const {
    config: ofConfig,
    endpoints,
    generateCodeVerifier,
    generateCodeChallenge,
    generateState,
    hasCertificates
} = require('../../config/openFinance');
const { createOpenFinanceClient, makeOpenFinanceRequest } = require('./openFinance.client');
const { logger } = require('../../config/logger');
const { AppError } = require('../../middlewares/errorHandler');
const { v4: uuidv4 } = require('uuid');

// ===========================================
// GERENCIAMENTO DE CONSENTIMENTO
// ===========================================

/**
 * Cria um novo consentimento
 */
const createConsent = async (userId, params) => {
    const { transmitterName, authServerUrl, resourceServerUrl, permissions } = params;

    // Gerar PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Criar consentimento no banco local
    const consent = await Consent.create({
        userId,
        status: 'AWAITING',
        scopes: permissions || ofConfig.permissions,
        transmitterName,
        authServerUrl,
        resourceServerUrl,
        codeVerifier,
        state,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 1825
    });

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.CONSENT_CREATE,
        resource: 'CONSENT',
        resourceId: consent.id,
        details: { transmitterName, permissions }
    });

    // Construir URL de autorização (simulado para sandbox)
    const authorizationUrl = buildAuthorizationUrl({
        authServerUrl,
        clientId: ofConfig.clientId,
        redirectUri: ofConfig.redirectUri,
        state,
        codeChallenge
    });

    return {
        consentId: consent.id,
        authorizationUrl,
        state,
        message: 'Redirecione o usuário para a URL de autorização'
    };
};

/**
 * Constrói URL de autorização OAuth 2.0
 */
const buildAuthorizationUrl = ({ authServerUrl, clientId, redirectUri, state, codeChallenge }) => {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid accounts credit-cards-accounts',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });

    return `${authServerUrl}/authorize?${params.toString()}`;
};

/**
 * Processa callback OAuth
 */
const handleCallback = async (userId, { code, state }) => {
    // Buscar consentimento pelo state
    const consent = await Consent.findOne({
        where: { userId, state, status: 'AWAITING' }
    });

    if (!consent) {
        throw new AppError('Consentimento não encontrado ou já processado', 404, 'CONSENT_NOT_FOUND');
    }

    try {
        // Em produção: trocar code por tokens via API do transmissor
        // Aqui simulamos para sandbox
        const tokens = await exchangeCodeForTokens(consent, code);

        // Atualizar consentimento
        consent.status = 'AUTHORIZED';
        consent.accessToken = tokens.accessToken;
        consent.refreshToken = tokens.refreshToken;
        consent.tokenExpiresAt = tokens.expiresAt;
        consent.consentIdOF = tokens.consentId || uuidv4();
        consent.version += 1;
        await consent.save();

        // Log de auditoria
        await AuditLog.log({
            userId,
            action: AuditLog.ACTIONS.CONSENT_AUTHORIZE,
            resource: 'CONSENT',
            resourceId: consent.id,
            details: { transmitterName: consent.transmitterName }
        });

        logger.info(`Consentimento autorizado: ${consent.id}`);

        return {
            consentId: consent.id,
            status: consent.status,
            message: 'Consentimento autorizado com sucesso'
        };

    } catch (error) {
        consent.status = 'REVOKED';
        consent.revokedReason = 'Erro durante autorização';
        await consent.save();
        throw error;
    }
};

/**
 * Troca authorization code por tokens
 * Em produção: faz requisição ao token endpoint do transmissor
 */
const exchangeCodeForTokens = async (consent, code) => {
    // Em sandbox/desenvolvimento, simular tokens
    if (process.env.NODE_ENV !== 'production' || !hasCertificates()) {
        logger.warn('Usando tokens simulados (sandbox/dev)');
        return {
            accessToken: `simulated_access_token_${uuidv4()}`,
            refreshToken: `simulated_refresh_token_${uuidv4()}`,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            consentId: uuidv4()
        };
    }

    // Em produção: implementar chamada real ao token endpoint
    // const client = createOpenFinanceClient(consent.authServerUrl);
    // const response = await client.post('/token', { ... });
    throw new AppError('Ambiente de produção requer certificados ICP-Brasil', 500, 'PRODUCTION_CONFIG_REQUIRED');
};

/**
 * Lista consentimentos do usuário
 */
const listConsents = async (userId) => {
    const consents = await Consent.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        attributes: [
            'id', 'status', 'transmitterName', 'scopes',
            'expiresAt', 'revokedAt', 'createdAt', 'version'
        ]
    });

    return consents.map(c => ({
        id: c.id,
        status: c.status,
        transmitterName: c.transmitterName,
        scopes: c.scopes,
        expiresAt: c.expiresAt,
        revokedAt: c.revokedAt,
        createdAt: c.createdAt,
        version: c.version,
        isValid: c.isValid()
    }));
};

/**
 * Revoga um consentimento
 */
const revokeConsent = async (userId, consentId, reason = 'Revogado pelo usuário') => {
    const consent = await Consent.findOne({
        where: { id: consentId, userId }
    });

    if (!consent) {
        throw new AppError('Consentimento não encontrado', 404, 'CONSENT_NOT_FOUND');
    }

    if (consent.status === 'REVOKED') {
        throw new AppError('Consentimento já revogado', 400, 'ALREADY_REVOKED');
    }

    await consent.revoke(reason);

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.CONSENT_REVOKE,
        resource: 'CONSENT',
        resourceId: consent.id,
        details: { reason }
    });

    logger.info(`Consentimento revogado: ${consentId}`);

    return {
        consentId: consent.id,
        status: consent.status,
        message: 'Consentimento revogado com sucesso'
    };
};

// ===========================================
// IMPORTAÇÃO DE DADOS
// ===========================================

/**
 * Valida consentimento antes de importar dados
 */
const validateConsentForImport = async (userId, consentId) => {
    const consent = await Consent.findOne({
        where: { id: consentId, userId }
    });

    if (!consent) {
        throw new AppError('Consentimento não encontrado', 404, 'CONSENT_NOT_FOUND');
    }

    if (!consent.isValid()) {
        throw new AppError('Consentimento não está válido', 400, 'INVALID_CONSENT');
    }

    if (!consent.hasValidToken()) {
        throw new AppError('Token de acesso expirado', 401, 'TOKEN_EXPIRED');
    }

    return consent;
};

/**
 * Importa contas bancárias
 */
const importAccounts = async (userId, consentId) => {
    const consent = await validateConsentForImport(userId, consentId);

    // Em sandbox: simular dados
    if (process.env.NODE_ENV !== 'production' || !hasCertificates()) {
        return await importSimulatedAccounts(userId, consent);
    }

    // Em produção: chamar API real
    const client = createOpenFinanceClient(consent.resourceServerUrl, consent.accessToken);
    const accountsData = await makeOpenFinanceRequest(
        client,
        'GET',
        endpoints.accounts(consent.resourceServerUrl)
    );

    const imported = [];
    for (const account of accountsData.data || []) {
        const [bankAccount, created] = await BankAccount.findOrCreate({
            where: { openFinanceId: account.accountId },
            defaults: {
                userId,
                consentId: consent.id,
                openFinanceId: account.accountId,
                bankName: account.brandName || consent.transmitterName,
                type: mapAccountType(account.type),
                accountNumber: account.number,
                branchCode: account.branchCode,
                balance: 0,
                lastSyncAt: new Date()
            }
        });

        if (!created) {
            bankAccount.lastSyncAt = new Date();
            await bankAccount.save();
        }

        imported.push(bankAccount);
    }

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.DATA_IMPORT,
        resource: 'BANK_ACCOUNT',
        details: { count: imported.length, consentId }
    });

    return {
        imported: imported.length,
        accounts: imported.map(a => ({
            id: a.id,
            bankName: a.bankName,
            type: a.type
        }))
    };
};

/**
 * Importa dados simulados de contas (sandbox)
 */
const importSimulatedAccounts = async (userId, consent) => {
    const simulatedAccounts = [
        {
            openFinanceId: `sim_acc_${uuidv4()}`,
            bankName: consent.transmitterName || 'Banco Simulado',
            type: 'CONTA_CORRENTE',
            accountNumber: '****1234',
            branchCode: '0001',
            balance: 5000.00
        }
    ];

    const imported = [];
    for (const acc of simulatedAccounts) {
        const bankAccount = await BankAccount.create({
            userId,
            consentId: consent.id,
            ...acc,
            lastSyncAt: new Date()
        });
        imported.push(bankAccount);
    }

    logger.info(`Contas simuladas importadas: ${imported.length}`);

    return {
        imported: imported.length,
        accounts: imported.map(a => ({
            id: a.id,
            bankName: a.bankName,
            type: a.type
        })),
        _simulated: true
    };
};

/**
 * Importa cartões de crédito
 */
const importCards = async (userId, consentId) => {
    const consent = await validateConsentForImport(userId, consentId);

    // Em sandbox: simular dados
    if (process.env.NODE_ENV !== 'production' || !hasCertificates()) {
        return await importSimulatedCards(userId, consent);
    }

    // Em produção: implementar requisição real
    throw new AppError('Requer configuração de produção', 500, 'PRODUCTION_CONFIG_REQUIRED');
};

/**
 * Importa cartões simulados (sandbox)
 */
const importSimulatedCards = async (userId, consent) => {
    const simulatedCards = [
        {
            openFinanceId: `sim_card_${uuidv4()}`,
            bankName: consent.transmitterName || 'Banco Simulado',
            brand: 'VISA',
            lastFourDigits: '5678',
            name: 'Cartão Principal',
            creditLimit: 10000.00,
            availableLimit: 7500.00,
            closingDay: 15,
            dueDay: 22
        }
    ];

    const imported = [];
    for (const card of simulatedCards) {
        const creditCard = await CreditCard.create({
            userId,
            consentId: consent.id,
            ...card,
            lastSyncAt: new Date()
        });
        imported.push(creditCard);
    }

    logger.info(`Cartões simulados importados: ${imported.length}`);

    return {
        imported: imported.length,
        cards: imported.map(c => ({
            id: c.id,
            bankName: c.bankName,
            brand: c.brand,
            lastFourDigits: c.lastFourDigits
        })),
        _simulated: true
    };
};

/**
 * Importa transações
 */
const importTransactions = async (userId, consentId, options = {}) => {
    const consent = await validateConsentForImport(userId, consentId);

    // Em sandbox: simular dados
    if (process.env.NODE_ENV !== 'production' || !hasCertificates()) {
        return await importSimulatedTransactions(userId, consent);
    }

    throw new AppError('Requer configuração de produção', 500, 'PRODUCTION_CONFIG_REQUIRED');
};

/**
 * Importa transações simuladas (sandbox)
 */
const importSimulatedTransactions = async (userId, consent) => {
    // Buscar contas e cartões do usuário
    const accounts = await BankAccount.findAll({
        where: { userId, consentId: consent.id }
    });
    const cards = await CreditCard.findAll({
        where: { userId, consentId: consent.id }
    });

    const imported = [];

    // Gerar transações de conta
    for (const account of accounts) {
        const transactions = generateSimulatedTransactions('ACCOUNT', account.id, 10);
        for (const tx of transactions) {
            const ofTx = await OpenFinanceTransaction.create({
                userId,
                consentId: consent.id,
                openFinanceId: tx.openFinanceId,
                type: tx.type,
                description: tx.description,
                amount: tx.amount,
                date: tx.date,
                sourceType: 'ACCOUNT',
                relatedAccountId: account.id,
                rawData: tx,
                importedAt: new Date()
            });
            imported.push(ofTx);
        }
    }

    // Gerar transações de cartão
    for (const card of cards) {
        const transactions = generateSimulatedTransactions('CREDIT_CARD', card.id, 15);
        for (const tx of transactions) {
            const ofTx = await OpenFinanceTransaction.create({
                userId,
                consentId: consent.id,
                openFinanceId: tx.openFinanceId,
                type: tx.type,
                description: tx.description,
                amount: tx.amount,
                date: tx.date,
                sourceType: 'CREDIT_CARD',
                relatedCardId: card.id,
                rawData: tx,
                importedAt: new Date()
            });
            imported.push(ofTx);
        }
    }

    // Log de auditoria
    await AuditLog.log({
        userId,
        action: AuditLog.ACTIONS.DATA_IMPORT,
        resource: 'OPEN_FINANCE_TRANSACTION',
        details: { count: imported.length, consentId: consent.id }
    });

    logger.info(`Transações simuladas importadas: ${imported.length}`);

    return {
        imported: imported.length,
        _simulated: true
    };
};

/**
 * Gera transações simuladas para teste
 */
const generateSimulatedTransactions = (sourceType, sourceId, count) => {
    const descriptions = sourceType === 'CREDIT_CARD'
        ? ['AMAZON', 'NETFLIX', 'UBER', 'IFOOD', 'MERCADO LIVRE', 'SPOTIFY', 'FARMACIA', 'POSTO SHELL']
        : ['PIX RECEBIDO', 'PIX ENVIADO', 'TED RECEBIDO', 'PAG BOLETO', 'SALARIO', 'DEB AUTO'];

    const transactions = [];
    for (let i = 0; i < count; i++) {
        const isDebit = Math.random() > 0.3;
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30));

        transactions.push({
            openFinanceId: `sim_tx_${uuidv4()}`,
            type: isDebit ? 'DEBIT' : 'CREDIT',
            description: descriptions[Math.floor(Math.random() * descriptions.length)],
            amount: parseFloat((Math.random() * 500 + 10).toFixed(2)),
            date: date.toISOString().split('T')[0]
        });
    }

    return transactions;
};

/**
 * Mapeia tipo de conta do Open Finance
 */
const mapAccountType = (type) => {
    const mapping = {
        'CONTA_CORRENTE': 'CONTA_CORRENTE',
        'CONTA_POUPANCA': 'CONTA_POUPANCA',
        'CONTA_PAGAMENTO_PRE_PAGA': 'CONTA_PAGAMENTO',
        'CONTA_SALARIO': 'CONTA_SALARIO'
    };
    return mapping[type] || 'CONTA_CORRENTE';
};

module.exports = {
    createConsent,
    handleCallback,
    listConsents,
    revokeConsent,
    importAccounts,
    importCards,
    importTransactions
};
