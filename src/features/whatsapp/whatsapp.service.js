/**
 * WhatsApp Service
 * ========================================
 * WHATSAPP BOT - GROQ RESILIENT EDITION
 * ========================================
 * 
 * Features:
 * - Multi-tenant: each user has their own session
 * - Groq AI: Whisper (audio) + LLaMA (parsing)
 * - Profile switching (PF/PJ)
 * - Transaction registration with short IDs
 * - Statement/Query engine
 * - Transaction editing
 * - Visual identity (🤖 prefix, bold values)
 */

const wppconnect = require('@wppconnect-team/wppconnect');
const { logger } = require('../../config/logger');
const groqService = require('../ai/groq.service');
const transactionsService = require('../transactions/transactions.service');
const invoicesService = require('../invoices/invoices.service');
const {
    Category,
    User,
    Profile,
    BankAccount,
    CreditCard,
    ManualTransaction,
    CardTransaction,
    CardInvoice,
    InvoicePayment
} = require('../../models');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

// Número auxiliar para criar o grupo (OBRIGATÓRIO para criar grupo)
const AUXILIARY_NUMBER = '557182862912@c.us';

// Armazena clientes ativos por userId
const activeSessions = new Map();

// Nome do grupo padrão
const GROUP_NAME = '💰 MyWallet AI';

// ========================================
// SESSION PATH MANAGEMENT
// ========================================

const getSessionPath = (userId) => {
    const sessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    return sessionsDir;
};

// ========================================
// SESSION INITIALIZATION
// ========================================

const initSession = async (userId) => {
    const sessionName = `session_${userId}`;

    if (activeSessions.has(userId)) {
        const session = activeSessions.get(userId);
        if (session.client && session.isConnected) {
            return { status: 'connected', message: 'WhatsApp já conectado' };
        }
    }

    return new Promise((resolve, reject) => {
        let qrCodeData = null;
        let resolved = false;

        wppconnect.create({
            session: sessionName,
            folderNameToken: getSessionPath(userId),
            headless: true,
            useChrome: false,
            debug: false,
            logQR: false,
            puppeteerOptions: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-extensions'
                ]
            },
            browserArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            catchQR: (base64Qr, asciiQR) => {
                logger.info(`📱 QR Code gerado para usuário ${userId}`);
                qrCodeData = base64Qr;

                if (!resolved) {
                    resolved = true;
                    resolve({
                        status: 'awaiting_scan',
                        qrCode: base64Qr
                    });
                }
            },
            statusFind: (statusSession, session) => {
                logger.info(`📊 Status WhatsApp [${userId}]: ${statusSession}`);

                if (statusSession === 'isLogged' || statusSession === 'inChat') {
                    const sessionData = activeSessions.get(userId);
                    if (sessionData) {
                        sessionData.isConnected = true;
                    }
                }
            }
        })
            .then(async (client) => {
                logger.info(`✅ WhatsApp conectado para usuário ${userId}`);

                activeSessions.set(userId, {
                    client,
                    isConnected: true,
                    groupId: null
                });

                setupMessageListener(client, userId);
                await findOrCreateGroup(client, userId);

                if (!resolved) {
                    resolved = true;
                    resolve({ status: 'connected', message: 'WhatsApp conectado' });
                }
            })
            .catch((error) => {
                logger.error(`❌ Erro ao conectar WhatsApp [${userId}]:`, error);
                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            });

        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (qrCodeData) {
                    resolve({ status: 'awaiting_scan', qrCode: qrCodeData });
                } else {
                    reject(new Error('Timeout ao gerar QR Code'));
                }
            }
        }, 30000);
    });
};

// ========================================
// GROUP MANAGEMENT
// ========================================

const findOrCreateGroup = async (client, userId) => {
    try {
        const user = await User.findByPk(userId);

        if (user && user.whatsappGroupId) {
            logger.info(`📌 Grupo já vinculado: ${user.whatsappGroupId}`);
            const session = activeSessions.get(userId);
            if (session) session.groupId = user.whatsappGroupId;
            return { gid: { _serialized: user.whatsappGroupId } };
        }

        const chats = await client.listChats ? await client.listChats() : await client.getAllChats();
        const existingGroup = chats.find(chat =>
            chat.isGroup && chat.name === GROUP_NAME
        );

        if (existingGroup) {
            const groupId = existingGroup.id._serialized;
            logger.info(`📌 Grupo encontrado: ${GROUP_NAME} (${groupId})`);

            if (user) {
                user.whatsappGroupId = groupId;
                await user.save();
            }

            const session = activeSessions.get(userId);
            if (session) session.groupId = groupId;
            return existingGroup;
        }

        logger.info(`📝 Criando grupo: ${GROUP_NAME} com participante auxiliar`);

        const group = await client.createGroup(GROUP_NAME, [AUXILIARY_NUMBER]);

        if (group && group.gid) {
            const groupId = group.gid._serialized;

            if (user) {
                user.whatsappGroupId = groupId;
                await user.save();
                logger.info(`💾 Grupo salvo no banco: ${groupId}`);
            }

            const session = activeSessions.get(userId);
            if (session) session.groupId = groupId;

            await client.sendText(groupId,
                `🤖 *Bem-vindo ao MyWallet AI!*\n\n` +
                `Envie suas transações aqui:\n` +
                `• Texto: "gastei 50 no uber"\n` +
                `• Áudio: grave e envie!\n\n` +
                `*Comandos rápidos:*\n` +
                `• *PF* - Alternar para Pessoa Física\n` +
                `• *PJ* - Alternar para Pessoa Jurídica\n` +
                `• *Menu* - Ver opções\n\n` +
                `Vou registrar automaticamente ✨`
            );

            try {
                logger.info('⏳ Aguardando propagação do grupo...');
                await new Promise(r => setTimeout(r, 4000));

                const logoUrl = 'https://i.imgur.com/MHJwgwz.jpeg';
                await client.setGroupIcon(groupId, logoUrl);
                logger.info('✅ Logo do MyWallet definida no grupo!');
            } catch (iconError) {
                logger.warn('⚠️ Não foi possível definir a foto do grupo:', iconError.message);
            }

            logger.info(`✅ Grupo criado com sucesso: ${groupId}`);
            return group;
        }

        return null;
    } catch (error) {
        logger.error('❌ Erro ao criar grupo:', error.message);
        return null;
    }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get user context for AI (profiles, banks, cards, categories)
 */
const getUserContext = async (userId, profileId = null) => {
    const profiles = await Profile.findAll({
        where: { userId },
        attributes: ['id', 'name', 'type', 'isDefault']
    });

    const banks = await BankAccount.findAll({
        where: { userId, isActive: true },
        attributes: ['id', 'bankName', 'nickname', 'type']
    });

    const cards = await CreditCard.findAll({
        where: { userId, isActive: true },
        attributes: ['id', 'name', 'bankName', 'brand', 'lastFourDigits']
    });

    // Use profileId filter if available
    const categoryWhere = profileId
        ? { userId, profileId }
        : { userId };

    const categories = await Category.findAll({
        where: categoryWhere,
        attributes: ['id', 'name', 'type', 'icon']
    });

    return {
        profiles: profiles.map(p => p.toJSON()),
        banks: banks.map(b => b.toJSON()),
        cards: cards.map(c => c.toJSON()),
        categories: categories.map(c => c.toJSON())
    };
};

/**
 * Get or initialize active profile for user
 */
const getActiveProfile = async (user) => {
    // If already has active profile, return it
    if (user.whatsappActiveProfileId) {
        const profile = await Profile.findByPk(user.whatsappActiveProfileId);
        if (profile) return profile;
    }

    // Find default profile
    let profile = await Profile.findOne({
        where: { userId: user.id, isDefault: true }
    });

    if (!profile) {
        // Fallback to PERSONAL profile
        profile = await Profile.findOne({
            where: { userId: user.id, type: 'PERSONAL' }
        });
    }

    if (!profile) {
        // Get any profile
        profile = await Profile.findOne({
            where: { userId: user.id }
        });
    }

    // Update user with active profile
    if (profile) {
        user.whatsappActiveProfileId = profile.id;
        await user.save();
    }

    return profile;
};

/**
 * Format currency for display
 */
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value).replace('R$', 'R$ ');
};

/**
 * Generate short ID from UUID
 */
const generateShortId = (uuid) => {
    return uuid.substring(0, 4).toUpperCase();
};

/**
 * Check if message looks like a transaction
 */
const looksLikeTransaction = (text) => {
    if (!text || text.length < 5) return false;

    const lowerText = text.toLowerCase();

    // Ignore URLs
    if (lowerText.includes('http://') || lowerText.includes('https://') ||
        lowerText.includes('.com') || lowerText.includes('.br') ||
        lowerText.includes('youtu.be') || lowerText.includes('tiktok') ||
        lowerText.includes('instagram')) {
        return false;
    }

    // Ignore very long messages
    if (text.length > 300) return false;

    // Check for monetary patterns
    const hasMoneyPattern = /R?\$?\s?\d+([.,]\d{1,2})?/.test(text);

    // Financial keywords
    const financialKeywords = [
        'gastei', 'paguei', 'comprei', 'recebi', 'ganhei', 'transferi',
        'pix', 'credito', 'crédito', 'debito', 'débito', 'boleto',
        'uber', 'ifood', '99', 'mercado', 'supermercado', 'farmácia',
        'salario', 'salário', 'pagamento', 'entrada', 'saída',
        'quanto', 'extrato', 'resumo', 'saldo'
    ];
    const hasFinancialKeyword = financialKeywords.some(kw => lowerText.includes(kw));

    return hasMoneyPattern || hasFinancialKeyword;
};

// ========================================
// SHORTCUT COMMANDS
// ========================================

/**
 * Handle shortcut commands (PF, PJ, Menu, Saldo, Bancos, Cartoes)
 * Returns response message or null if not a shortcut
 */
const handleShortcutCommand = async (text, user, activeProfile) => {
    const upperText = text.toUpperCase().trim();

    // Profile switch: PF
    if (upperText === 'PF') {
        const profile = await Profile.findOne({
            where: { userId: user.id, type: 'PERSONAL' }
        });
        if (profile) {
            user.whatsappActiveProfileId = profile.id;
            await user.save();
            return `🤖 ✅ Foco alterado para: *${profile.name}* (PF)\n\n_Operando em: ${profile.name}_`;
        }
        return `🤖 ❌ Perfil Pessoa Física não encontrado.\n\n_Operando em: ${activeProfile?.name || 'Nenhum'}_`;
    }

    // Profile switch: PJ
    if (upperText === 'PJ') {
        const profile = await Profile.findOne({
            where: { userId: user.id, type: 'BUSINESS' }
        });
        if (profile) {
            user.whatsappActiveProfileId = profile.id;
            await user.save();
            return `🤖 ✅ Foco alterado para: *${profile.name}* (PJ)\n\n_Operando em: ${profile.name}_`;
        }
        return `🤖 ❌ Perfil Pessoa Jurídica não encontrado.\n\n_Operando em: ${activeProfile?.name || 'Nenhum'}_`;
    }

    // ========================================
    // SALDO: Total balance across all accounts
    // ========================================
    if (upperText === 'SALDO') {
        const banks = await BankAccount.findAll({
            where: { userId: user.id, isActive: true }
        });

        let totalBalance = 0;
        banks.forEach(b => {
            totalBalance += parseFloat(b.balance) || 0;
        });

        return `🤖 💰 *Saldo Total*\n\n` +
            `*${formatCurrency(totalBalance)}*\n\n` +
            `📊 ${banks.length} conta(s) ativa(s)\n\n` +
            `_Digite *BANCOS* para ver detalhes_\n\n` +
            `_Operando em: ${activeProfile?.name || 'N/A'}_`;
    }

    // ========================================
    // BANCOS: Individual bank balances
    // ========================================
    if (upperText === 'BANCOS') {
        const banks = await BankAccount.findAll({
            where: { userId: user.id, isActive: true },
            order: [['bankName', 'ASC']]
        });

        if (banks.length === 0) {
            return `🤖 ❌ Nenhuma conta bancária cadastrada.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }

        let totalBalance = 0;
        let response = `🤖 🏦 *Minhas Contas*\n\n`;

        banks.forEach(b => {
            const balance = parseFloat(b.balance) || 0;
            totalBalance += balance;
            const emoji = balance >= 0 ? '💚' : '🔴';
            response += `${emoji} *${b.bankName}*${b.nickname ? ` (${b.nickname})` : ''}\n`;
            response += `   Saldo: *${formatCurrency(balance)}*\n\n`;
        });

        response += `─────────────────────\n`;
        response += `💰 *Total: ${formatCurrency(totalBalance)}*\n\n`;
        response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;

        return response;
    }

    // ========================================
    // CARTOES: Credit cards and invoices
    // ========================================
    if (upperText === 'CARTOES' || upperText === 'CARTÕES') {
        const cards = await CreditCard.findAll({
            where: { userId: user.id, isActive: true },
            order: [['name', 'ASC']]
        });

        if (cards.length === 0) {
            return `🤖 ❌ Nenhum cartão cadastrado.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }

        let totalLimit = 0;
        let totalUsed = 0;
        let response = `🤖 💳 *Meus Cartões*\n\n`;

        for (const card of cards) {
            const limit = parseFloat(card.creditLimit) || 0;
            const used = parseFloat(card.usedLimit) || 0;
            const blocked = parseFloat(card.blockedLimit) || 0;
            const available = limit - used - blocked;
            const usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;

            totalLimit += limit;
            totalUsed += used;

            // Usage indicator
            let indicator = '🟢';
            if (usagePercent > 80) indicator = '🔴';
            else if (usagePercent > 50) indicator = '🟡';

            response += `${indicator} *${card.name || card.bankName}* (${card.brand || 'Cartão'})\n`;
            response += `   Final: *${card.lastFourDigits}*\n`;
            response += `   Limite: *${formatCurrency(limit)}*\n`;
            response += `   Usado: *${formatCurrency(used)}* (${usagePercent}%)\n`;
            response += `   Disponível: *${formatCurrency(available)}*\n`;

            if (card.closingDay && card.dueDay) {
                response += `   📅 Fecha: dia ${card.closingDay} | Vence: dia ${card.dueDay}\n`;
            }
            response += `\n`;
        }

        const totalAvailable = totalLimit - totalUsed;
        response += `─────────────────────\n`;
        response += `💳 *${cards.length} cartão(ões)*\n`;
        response += `📊 Limite Total: *${formatCurrency(totalLimit)}*\n`;
        response += `📉 Usado: *${formatCurrency(totalUsed)}*\n`;
        response += `✅ Disponível: *${formatCurrency(totalAvailable)}*\n\n`;
        response += `_Digite *FATURA* para ver transações do cartão_\n\n`;
        response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;

        return response;
    }

    // ========================================
    // FATURA: Current card invoice details (ENHANCED)
    // ========================================
    if (upperText === 'FATURA' || upperText.startsWith('FATURA ')) {
        const cards = await CreditCard.findAll({
            where: { userId: user.id, isActive: true }
        });

        if (cards.length === 0) {
            return `🤖 ❌ Nenhum cartão cadastrado.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let response = `🤖 📑 *Faturas Atuais*\n\n`;

        for (const card of cards) {
            // Get or create invoice
            let invoice = await CardInvoice.findOne({
                where: { cardId: card.id, referenceMonth: month, referenceYear: year }
            });

            if (!invoice) {
                // Generate invoice if not exists
                try {
                    invoice = await invoicesService.generateInvoice(user.id, activeProfile?.id, card.id, month, year);
                } catch (err) {
                    // Skip this card
                    continue;
                }
            }

            const total = parseFloat(invoice.totalAmount) || 0;
            const paid = parseFloat(invoice.paidAmount) || 0;
            const remaining = total - paid;

            // Status emoji
            let statusEmoji = '⏳';
            let statusText = 'Aberta';
            if (invoice.status === 'PAID') {
                statusEmoji = '✅';
                statusText = 'Paga';
            } else if (invoice.status === 'PARTIAL') {
                statusEmoji = '⚠️';
                statusText = 'Parcial';
            } else if (invoice.status === 'OVERDUE') {
                statusEmoji = '❌';
                statusText = 'Vencida';
            } else if (invoice.status === 'CLOSED') {
                statusEmoji = '📋';
                statusText = 'Fechada';
            }

            response += `💳 *${card.name || card.bankName}* (${card.lastFourDigits})\n`;
            response += `   ${statusEmoji} Status: *${statusText}*\n`;
            response += `   💵 Total: *${formatCurrency(total)}*\n`;

            if (paid > 0) {
                response += `   ✅ Pago: *${formatCurrency(paid)}*\n`;
                response += `   📉 Restante: *${formatCurrency(remaining)}*\n`;
            }

            if (invoice.dueDate) {
                const dueDate = new Date(invoice.dueDate);
                response += `   📅 Vencimento: *${dueDate.toLocaleDateString('pt-BR')}*\n`;
            }
            response += `\n`;
        }

        response += `─────────────────────\n`;
        response += `💡 *Comandos:*\n`;
        response += `   *PAGAR FATURA [valor]* - Registrar pagamento\n`;
        response += `   *HISTORICO FATURAS* - Ver últimas faturas\n\n`;
        response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;
        return response;
    }

    // ========================================
    // PAGAR FATURA: Register invoice payment
    // ========================================
    if (upperText.startsWith('PAGAR FATURA')) {
        const cards = await CreditCard.findAll({
            where: { userId: user.id, isActive: true }
        });

        if (cards.length === 0) {
            return `🤖 ❌ Nenhum cartão cadastrado.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }

        // Extract amount from command
        const match = upperText.match(/PAGAR FATURA\s+(\d+(?:[.,]\d+)?)/);
        let paymentAmount = 0;
        let paymentType = 'FULL';

        if (match) {
            paymentAmount = parseFloat(match[1].replace(',', '.'));
            paymentType = 'PARTIAL';
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Get main card (first active)
        const card = cards[0];

        // Get or create invoice
        let invoice = await CardInvoice.findOne({
            where: { cardId: card.id, referenceMonth: month, referenceYear: year }
        });

        if (!invoice) {
            invoice = await invoicesService.generateInvoice(user.id, activeProfile?.id, card.id, month, year);
        }

        const remaining = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);

        if (remaining <= 0) {
            return `🤖 ✅ A fatura do cartão *${card.name || card.bankName}* já está totalmente paga!\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }

        // If no amount specified, pay full
        if (paymentAmount <= 0) {
            paymentAmount = remaining;
            paymentType = 'FULL';
        }

        try {
            const result = await invoicesService.payInvoice(user.id, activeProfile?.id, invoice.id, {
                amount: paymentAmount,
                paymentType,
                paymentMethod: 'PIX',
                notes: 'Pagamento via WhatsApp'
            });

            let response = `🤖 ✅ *Pagamento Registrado!*\n\n`;
            response += `💳 *${card.name || card.bankName}*\n`;
            response += `💵 Valor: *${formatCurrency(result.payment.amount)}*\n`;
            response += `📅 Data: *${new Date().toLocaleDateString('pt-BR')}*\n\n`;

            if (result.invoice.remainingAmount > 0) {
                response += `📉 Restante: *${formatCurrency(result.invoice.remainingAmount)}*\n`;
            } else {
                response += `🎉 *Fatura 100% paga!*\n`;
            }

            response += `\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
            return response;
        } catch (err) {
            return `🤖 ❌ Erro ao registrar pagamento: ${err.message}\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }
    }

    // ========================================
    // HISTORICO FATURAS: Invoice history
    // ========================================
    if (upperText === 'HISTORICO FATURAS' || upperText === 'HISTÓRICO FATURAS') {
        const cards = await CreditCard.findAll({
            where: { userId: user.id, isActive: true }
        });

        if (cards.length === 0) {
            return `🤖 ❌ Nenhum cartão cadastrado.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
        }

        let response = `🤖 📊 *Histórico de Faturas*\n\n`;

        for (const card of cards) {
            const invoices = await CardInvoice.findAll({
                where: { cardId: card.id },
                order: [['referenceYear', 'DESC'], ['referenceMonth', 'DESC']],
                limit: 6
            });

            if (invoices.length === 0) continue;

            response += `💳 *${card.name || card.bankName}*\n`;

            for (const inv of invoices) {
                const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                const monthName = monthNames[inv.referenceMonth - 1];
                const total = parseFloat(inv.totalAmount);

                let statusEmoji = '⏳';
                if (inv.status === 'PAID') statusEmoji = '✅';
                else if (inv.status === 'PARTIAL') statusEmoji = '⚠️';
                else if (inv.status === 'OVERDUE') statusEmoji = '❌';
                else if (inv.status === 'CLOSED') statusEmoji = '📋';

                response += `   ${statusEmoji} ${monthName}/${inv.referenceYear}: *${formatCurrency(total)}*\n`;
            }
            response += `\n`;
        }

        response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;
        return response;
    }

    // Menu command - UPDATED with invoice options
    if (upperText === 'MENU') {
        return `🤖 *Menu MyWallet AI*\n\n` +
            `📝 *Registrar transação:*\n` +
            `   "gastei 50 no uber"\n` +
            `   "recebi 1000 de salário"\n\n` +
            `📊 *Consultar:*\n` +
            `   "quanto gastei hoje?"\n` +
            `   "resumo do mês"\n\n` +
            `💰 *Saldos e Cartões:*\n` +
            `   *SALDO* - Saldo total\n` +
            `   *BANCOS* - Saldo por conta\n` +
            `   *CARTOES* - Meus cartões\n\n` +
            `💳 *Faturas:*\n` +
            `   *FATURA* - Faturas atuais\n` +
            `   *PAGAR FATURA [valor]* - Pagar fatura\n` +
            `   *HISTORICO FATURAS* - Últimas faturas\n\n` +
            `✏️ *Editar transação:*\n` +
            `   "editar #A1B2 para 75"\n\n` +
            `🔄 *Trocar perfil:*\n` +
            `   *PF* - Pessoa Física\n` +
            `   *PJ* - Pessoa Jurídica\n\n` +
            `_Operando em: ${activeProfile?.name || 'Nenhum'}_`;
    }

    return null; // Not a shortcut command
};

// ========================================
// QUERY ENGINE (STATEMENTS)
// ========================================

/**
 * Execute query and return formatted statement
 */
const executeQuery = async (queryOptions, userId, profileId, activeProfile) => {
    const { period = 'month', filter = 'all' } = queryOptions;

    // Calculate date range
    const now = new Date();
    let startDate, endDate = now;

    switch (period) {
        case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'month':
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }

    // Build where clause
    const whereClause = {
        userId,
        date: { [Op.between]: [startDate, endDate] }
    };

    if (profileId) {
        whereClause.profileId = profileId;
    }

    if (filter === 'income') {
        whereClause.type = 'INCOME';
    } else if (filter === 'expense') {
        whereClause.type = 'EXPENSE';
    }

    // Query manual transactions
    const manualTransactions = await ManualTransaction.findAll({
        where: whereClause,
        order: [['date', 'DESC']],
        limit: 50,
        include: [{ model: Category, as: 'category', attributes: ['name'] }]
    });

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;

    manualTransactions.forEach(t => {
        if (t.type === 'INCOME') {
            totalIncome += parseFloat(t.amount);
        } else {
            totalExpense += parseFloat(t.amount);
        }
    });

    const balance = totalIncome - totalExpense;

    // Period label
    const periodLabels = {
        day: 'Hoje',
        week: 'Esta Semana',
        month: 'Este Mês',
        year: 'Este Ano'
    };

    // Build response
    let response = `🤖 📊 *Resumo ${periodLabels[period]}*\n`;
    response += `👤 Perfil: *${activeProfile?.name || 'Todos'}*\n\n`;
    response += `📈 Receitas: *${formatCurrency(totalIncome)}*\n`;
    response += `📉 Despesas: *${formatCurrency(totalExpense)}*\n`;
    response += `💰 *Saldo: ${formatCurrency(balance)}*\n`;
    response += `\n─────────────────────\n`;

    // Last 5 transactions
    const last5 = manualTransactions.slice(0, 5);
    if (last5.length > 0) {
        response += `\n📋 *Últimas transações:*\n`;
        last5.forEach(t => {
            const emoji = t.type === 'INCOME' ? '💵' : '💸';
            const sign = t.type === 'INCOME' ? '+' : '-';
            const shortId = generateShortId(t.id);
            const categoryName = t.category?.name || 'Sem categoria';
            response += `${emoji} #${shortId}: ${sign}*${formatCurrency(t.amount)}* - ${t.description || categoryName}\n`;
        });
    } else {
        response += `\n_Nenhuma transação encontrada no período._\n`;
    }

    response += `\n_Operando em: ${activeProfile?.name || 'N/A'}_`;

    return response;
};

// ========================================
// TRANSACTION PROCESSING
// ========================================

/**
 * Process transaction entries from AI
 */
const processTransactionEntries = async (entries, userId, activeProfile, context) => {
    const results = [];

    for (const entry of entries) {
        try {
            // Determine profile
            let profileId = activeProfile?.id;
            if (entry.profileType) {
                const targetProfile = context.profiles.find(p => p.type === entry.profileType);
                if (targetProfile) {
                    profileId = targetProfile.id;
                }
            }

            // Find category
            let categoryId = entry.categoryId;
            if (!categoryId && entry.categoryName) {
                const category = context.categories.find(c =>
                    c.name.toLowerCase().includes(entry.categoryName.toLowerCase())
                );
                if (category) categoryId = category.id;
            }

            // Find bank account
            let bankAccountId = entry.bankId;
            if (!bankAccountId) {
                // Use first active bank account
                const defaultBank = context.banks.find(b => b.id);
                if (defaultBank) bankAccountId = defaultBank.id;
            }

            // Create transaction
            const transactionData = {
                type: entry.type || 'EXPENSE',
                source: entry.source || 'OTHER',
                description: entry.description || (entry.type === 'INCOME' ? 'Receita' : 'Despesa'),
                amount: entry.amount,
                date: new Date(),
                categoryId,
                bankAccountId,
                isRecurring: entry.isRecurring || false
            };

            // ✅ FIX: Pass profileId as second argument
            const transaction = await transactionsService.createManualTransaction(userId, profileId, transactionData);

            // Generate short ID
            const shortId = generateShortId(transaction.id);

            // Find bank name for response
            const bankName = context.banks.find(b => b.id === bankAccountId)?.bankName || 'Conta';
            const profileName = context.profiles.find(p => p.id === profileId)?.name || activeProfile?.name;

            results.push({
                success: true,
                shortId,
                amount: entry.amount,
                description: entry.description,
                type: entry.type,
                bankName,
                profileName,
                transaction
            });

        } catch (error) {
            logger.error('❌ Error creating transaction:', error.message);
            results.push({
                success: false,
                error: error.message,
                entry
            });
        }
    }

    return results;
};

/**
 * Format transaction results for response
 */
const formatTransactionResults = (results, activeProfile) => {
    if (results.length === 0) {
        return `🤖 ❌ Nenhuma transação processada.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
    }

    let response = '';

    results.forEach(r => {
        if (r.success) {
            const emoji = r.type === 'INCOME' ? '💵' : '💸';
            const sign = r.type === 'INCOME' ? '+' : '-';
            response += `🤖 ✅ #${r.shortId}: ${sign}*${formatCurrency(r.amount)}* (${r.description})\n`;
            response += `💳 Destino: *${r.bankName}*\n`;
            response += `👤 Perfil: *${r.profileName}*\n\n`;
        } else {
            response += `🤖 ❌ Erro ao registrar: ${r.error}\n\n`;
        }
    });

    response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;

    return response;
};

// ========================================
// EDIT PROCESSING
// ========================================

/**
 * Process edit command
 */
const processEdit = async (editData, userId, activeProfile) => {
    const { shortId, updates } = editData;

    if (!shortId) {
        return `🤖 ❌ ID da transação não informado.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
    }

    // Find transaction by short ID (beginning of UUID)
    const transactions = await ManualTransaction.findAll({
        where: {
            userId,
            id: { [Op.like]: `${shortId.toLowerCase()}%` }
        },
        limit: 1
    });

    if (transactions.length === 0) {
        return `🤖 ❌ Transação #${shortId} não encontrada.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`;
    }

    const transaction = transactions[0];

    // Apply updates
    if (updates.amount) transaction.amount = updates.amount;
    if (updates.description) transaction.description = updates.description;

    await transaction.save();

    const emoji = transaction.type === 'INCOME' ? '💵' : '💸';

    return `🤖 ✅ Transação #${generateShortId(transaction.id)} atualizada!\n\n` +
        `${emoji} *${formatCurrency(transaction.amount)}*\n` +
        `📝 ${transaction.description}\n\n` +
        `_Operando em: ${activeProfile?.name || 'N/A'}_`;
};

// ========================================
// MESSAGE LISTENER
// ========================================

const setupMessageListener = (client, userId) => {
    client.onAnyMessage(async (message) => {
        try {
            // Filter out system messages
            if (message.from === 'status@broadcast' ||
                message.isStatus ||
                message.type === 'e2e_notification' ||
                message.type === 'notification_template' ||
                message.type === 'protocol' ||
                message.type === 'revoked') {
                return;
            }

            // Get user
            const user = await User.findByPk(userId);
            if (!user || !user.whatsappGroupId) {
                return;
            }

            // Verify message is from the official group
            const isFromGroup =
                message.chatId === user.whatsappGroupId ||
                message.from === user.whatsappGroupId ||
                message.to === user.whatsappGroupId;

            if (!isFromGroup) {
                return;
            }

            // Anti-loop: ignore bot responses
            if (message.body && (
                message.body.startsWith('🤖') ||
                message.body.startsWith('✅') ||
                message.body.startsWith('❌') ||
                message.body.startsWith('❓') ||
                message.body.startsWith('🎉')
            )) {
                return;
            }

            // Only process text and audio
            if (message.type !== 'chat' && message.type !== 'ptt' && message.type !== 'audio') {
                return;
            }

            logger.info(`📩 Mensagem do grupo [${userId}]: ${message.type} - fromMe: ${message.fromMe}`);

            // Get active profile
            const activeProfile = await getActiveProfile(user);

            let textContent = '';
            let isAudio = false;
            let audioBuffer = null;

            // Process audio
            if (message.type === 'ptt' || message.type === 'audio') {
                try {
                    audioBuffer = await client.decryptFile(message);
                    if (!audioBuffer || audioBuffer.length === 0) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ Não consegui processar o áudio. Tente novamente.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        return;
                    }
                    isAudio = true;
                    logger.info(`🎤 Áudio recebido: ${audioBuffer.length} bytes`);
                } catch (audioError) {
                    logger.error('❌ Erro ao processar áudio:', audioError.message);
                    await client.sendText(user.whatsappGroupId,
                        `🤖 ❌ Erro ao processar áudio. Tente enviar como texto.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                    );
                    return;
                }
            } else if (message.type === 'chat' && message.body) {
                textContent = message.body;
            } else {
                return;
            }

            // Handle shortcut commands first (text only)
            if (!isAudio && textContent) {
                const shortcutResponse = await handleShortcutCommand(textContent, user, activeProfile);
                if (shortcutResponse) {
                    await client.sendText(user.whatsappGroupId, shortcutResponse);
                    return;
                }

                // Skip if doesn't look like transaction/query
                if (!looksLikeTransaction(textContent)) {
                    logger.info(`⏭️ Ignorando (não parece transação): "${textContent.substring(0, 50)}..."`);
                    return;
                }
            }

            // Get user context for AI
            const context = await getUserContext(userId, activeProfile?.id);

            // Call Groq AI (Whisper + LLaMA)
            let parsed;
            if (isAudio) {
                parsed = await groqService.analyzeAudio(audioBuffer, context);
            } else {
                parsed = await groqService.parseTransaction(textContent, context);
            }

            logger.info(`🧠 AI Response:`, JSON.stringify(parsed));

            // Handle by intent
            switch (parsed.intent) {
                case 'TRANSACTION':
                    if (parsed.entries && parsed.entries.length > 0) {
                        const results = await processTransactionEntries(
                            parsed.entries,
                            userId,
                            activeProfile,
                            context
                        );
                        const response = formatTransactionResults(results, activeProfile);
                        await client.sendText(user.whatsappGroupId, response);
                    } else {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ Não consegui extrair a transação. Tente novamente.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                    }
                    break;

                case 'QUERY':
                    const queryResponse = await executeQuery(
                        parsed.queryOptions || {},
                        userId,
                        activeProfile?.id,
                        activeProfile
                    );
                    await client.sendText(user.whatsappGroupId, queryResponse);
                    break;

                case 'EDIT':
                    const editResponse = await processEdit(
                        parsed.editData || {},
                        userId,
                        activeProfile
                    );
                    await client.sendText(user.whatsappGroupId, editResponse);
                    break;

                // ========================================
                // NEW NATURAL LANGUAGE HANDLERS
                // ========================================

                case 'BALANCE': {
                    const filter = parsed.filter || {};
                    let banks = await BankAccount.findAll({
                        where: { userId: user.id, isActive: true }
                    });

                    // Filter by specific bank if provided
                    if (filter.bankId) {
                        banks = banks.filter(b => b.id === filter.bankId);
                    } else if (filter.bankName) {
                        const searchTerm = filter.bankName.toLowerCase();
                        banks = banks.filter(b =>
                            b.bankName.toLowerCase().includes(searchTerm) ||
                            (b.nickname && b.nickname.toLowerCase().includes(searchTerm))
                        );
                    }

                    if (banks.length === 0) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ ${filter.bankName ? `Banco "${filter.bankName}" não encontrado.` : 'Nenhuma conta bancária cadastrada.'}\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    let response = `🤖 💰 *Saldo${banks.length === 1 ? ` - ${banks[0].bankName}` : ' Total'}*\n\n`;
                    let total = 0;

                    banks.forEach(b => {
                        const balance = parseFloat(b.balance) || 0;
                        total += balance;
                        const emoji = balance >= 0 ? '💚' : '🔴';
                        response += `${emoji} *${b.bankName}*: *${formatCurrency(balance)}*\n`;
                    });

                    if (banks.length > 1) {
                        response += `\n─────────────────────\n`;
                        response += `💰 *Total: ${formatCurrency(total)}*\n`;
                    }
                    response += `\n_Operando em: ${activeProfile?.name || 'N/A'}_`;

                    await client.sendText(user.whatsappGroupId, response);
                    break;
                }

                case 'CARDS': {
                    const filter = parsed.filter || {};
                    let cards = await CreditCard.findAll({
                        where: { userId: user.id, isActive: true }
                    });

                    // Filter by specific card if provided
                    if (filter.cardId) {
                        cards = cards.filter(c => c.id === filter.cardId);
                    } else if (filter.cardName) {
                        const searchTerm = filter.cardName.toLowerCase();
                        cards = cards.filter(c =>
                            (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                            c.bankName.toLowerCase().includes(searchTerm)
                        );
                    }

                    if (cards.length === 0) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ ${filter.cardName ? `Cartão "${filter.cardName}" não encontrado.` : 'Nenhum cartão cadastrado.'}\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    let response = `🤖 💳 *${cards.length === 1 ? cards[0].name || cards[0].bankName : 'Meus Cartões'}*\n\n`;

                    for (const card of cards) {
                        const limit = parseFloat(card.creditLimit) || 0;
                        const used = parseFloat(card.usedLimit) || 0;
                        const available = limit - used;
                        const usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;

                        let indicator = '🟢';
                        if (usagePercent > 80) indicator = '🔴';
                        else if (usagePercent > 50) indicator = '🟡';

                        response += `${indicator} *${card.name || card.bankName}* (${card.lastFourDigits})\n`;
                        response += `   Limite: *${formatCurrency(limit)}*\n`;
                        response += `   Usado: *${formatCurrency(used)}* (${usagePercent}%)\n`;
                        response += `   Disponível: *${formatCurrency(available)}*\n\n`;
                    }

                    response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;
                    await client.sendText(user.whatsappGroupId, response);
                    break;
                }

                case 'INVOICE': {
                    const filter = parsed.filter || {};
                    let cards = await CreditCard.findAll({
                        where: { userId: user.id, isActive: true }
                    });

                    // Filter by specific card if provided
                    if (filter.cardId) {
                        cards = cards.filter(c => c.id === filter.cardId);
                    } else if (filter.cardName) {
                        const searchTerm = filter.cardName.toLowerCase();
                        cards = cards.filter(c =>
                            (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                            c.bankName.toLowerCase().includes(searchTerm)
                        );
                    }

                    if (cards.length === 0) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ ${filter.cardName ? `Cartão "${filter.cardName}" não encontrado.` : 'Nenhum cartão cadastrado.'}\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    const now = new Date();
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                    let response = `🤖 📑 *Fatura${cards.length === 1 ? ` - ${cards[0].name || cards[0].bankName}` : 's do Mês'}*\n\n`;

                    for (const card of cards) {
                        const transactions = await CardTransaction.findAll({
                            where: {
                                cardId: card.id,
                                date: { [Op.gte]: startOfMonth }
                            },
                            order: [['date', 'DESC']],
                            limit: 10
                        });

                        const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

                        response += `💳 *${card.name || card.bankName}* (${card.lastFourDigits})\n`;
                        response += `   Total: *${formatCurrency(total)}*\n`;

                        if (transactions.length > 0) {
                            transactions.slice(0, 5).forEach(t => {
                                const date = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                response += `   • ${date} - ${t.description}: *${formatCurrency(t.amount)}*\n`;
                            });
                            if (transactions.length > 5) {
                                response += `   _... e mais ${transactions.length - 5} transações_\n`;
                            }
                        } else {
                            response += `   _Sem transações este mês_\n`;
                        }
                        response += `\n`;
                    }

                    response += `_Operando em: ${activeProfile?.name || 'N/A'}_`;
                    await client.sendText(user.whatsappGroupId, response);
                    break;
                }

                case 'PAY_INVOICE': {
                    const payData = parsed.paymentData || {};
                    let targetCard = null;

                    // Find the card
                    if (payData.cardId) {
                        targetCard = await CreditCard.findByPk(payData.cardId);
                    } else if (payData.cardName) {
                        const searchTerm = payData.cardName.toLowerCase();
                        const cards = await CreditCard.findAll({
                            where: { userId: user.id, isActive: true }
                        });
                        targetCard = cards.find(c =>
                            (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                            c.bankName.toLowerCase().includes(searchTerm)
                        );
                    }

                    if (!targetCard) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ ${payData.cardName ? `Cartão "${payData.cardName}" não encontrado.` : 'Especifique qual cartão deseja pagar.'}\n\nExemplo: "pagar fatura do nubank"\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    const invoiceAmount = parseFloat(targetCard.usedLimit) || 0;

                    // Find bank account for payment
                    let sourceBank = null;
                    if (payData.bankId) {
                        sourceBank = await BankAccount.findByPk(payData.bankId);
                    } else if (payData.bankName) {
                        const searchTerm = payData.bankName.toLowerCase();
                        const banks = await BankAccount.findAll({
                            where: { userId: user.id, isActive: true }
                        });
                        sourceBank = banks.find(b =>
                            b.bankName.toLowerCase().includes(searchTerm) ||
                            (b.nickname && b.nickname.toLowerCase().includes(searchTerm))
                        );
                    } else {
                        // Use first available bank
                        sourceBank = await BankAccount.findOne({
                            where: { userId: user.id, isActive: true }
                        });
                    }

                    if (!sourceBank) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ Nenhuma conta bancária encontrada para débito.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    // Create transaction for invoice payment
                    const paymentData = {
                        type: 'EXPENSE',
                        source: 'OTHER',
                        description: `Pagamento fatura ${targetCard.name || targetCard.bankName}`,
                        amount: invoiceAmount,
                        date: new Date(),
                        bankAccountId: sourceBank.id
                    };

                    const payment = await transactionsService.createManualTransaction(user.id, activeProfile?.id, paymentData);
                    const shortId = generateShortId(payment.id);

                    // Reset card used limit
                    targetCard.usedLimit = 0;
                    await targetCard.save();

                    await client.sendText(user.whatsappGroupId,
                        `🤖 ✅ Fatura paga!\n\n` +
                        `💳 Cartão: *${targetCard.name || targetCard.bankName}*\n` +
                        `💰 Valor: *${formatCurrency(invoiceAmount)}*\n` +
                        `🏦 Débito: *${sourceBank.bankName}*\n` +
                        `🔖 ID: *#${shortId}*\n\n` +
                        `_Operando em: ${activeProfile?.name || 'N/A'}_`
                    );
                    break;
                }

                case 'PAY_DAS': {
                    const payData = parsed.paymentData || {};
                    const month = payData.month || new Date().getMonth() + 1;
                    const year = payData.year || new Date().getFullYear();

                    // Find DAS guide for the month
                    const { DasGuide } = require('../../models');
                    const dasGuide = await DasGuide.findOne({
                        where: {
                            userId: user.id,
                            referenceMonth: month,
                            referenceYear: year
                        }
                    });

                    if (!dasGuide) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ Nenhuma guia DAS encontrada para ${month.toString().padStart(2, '0')}/${year}.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    if (dasGuide.status === 'PAID') {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ℹ️ A guia DAS de ${month.toString().padStart(2, '0')}/${year} já foi paga!\n\nValor: *${formatCurrency(dasGuide.amount)}*\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    // Find bank account for payment
                    let sourceBank = null;
                    if (payData.bankId) {
                        sourceBank = await BankAccount.findByPk(payData.bankId);
                    } else if (payData.bankName) {
                        const searchTerm = payData.bankName.toLowerCase();
                        const banks = await BankAccount.findAll({
                            where: { userId: user.id, isActive: true }
                        });
                        sourceBank = banks.find(b =>
                            b.bankName.toLowerCase().includes(searchTerm) ||
                            (b.nickname && b.nickname.toLowerCase().includes(searchTerm))
                        );
                    } else {
                        sourceBank = await BankAccount.findOne({
                            where: { userId: user.id, isActive: true }
                        });
                    }

                    if (!sourceBank) {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❌ Nenhuma conta bancária encontrada para débito.\n\n_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                        break;
                    }

                    // Create transaction for DAS payment
                    const paymentData = {
                        type: 'EXPENSE',
                        source: 'OTHER',
                        description: `Pagamento DAS ${month.toString().padStart(2, '0')}/${year}`,
                        amount: dasGuide.amount,
                        date: new Date(),
                        bankAccountId: sourceBank.id
                    };

                    const payment = await transactionsService.createManualTransaction(user.id, activeProfile?.id, paymentData);
                    const shortId = generateShortId(payment.id);

                    // Update DAS status
                    dasGuide.status = 'PAID';
                    dasGuide.paidAt = new Date();
                    await dasGuide.save();

                    await client.sendText(user.whatsappGroupId,
                        `🤖 ✅ DAS paga!\n\n` +
                        `📅 Referência: *${month.toString().padStart(2, '0')}/${year}*\n` +
                        `💰 Valor: *${formatCurrency(dasGuide.amount)}*\n` +
                        `🏦 Débito: *${sourceBank.bankName}*\n` +
                        `🔖 ID: *#${shortId}*\n\n` +
                        `_Operando em: ${activeProfile?.name || 'N/A'}_`
                    );
                    break;
                }

                case 'UNKNOWN':
                default:
                    // Try fallback parser for text
                    if (!isAudio && textContent) {
                        const fallback = groqService.fallbackParse(textContent, context);
                        if (fallback.intent === 'TRANSACTION' && fallback.entries?.length > 0) {
                            const results = await processTransactionEntries(
                                fallback.entries,
                                userId,
                                activeProfile,
                                context
                            );
                            let response = formatTransactionResults(results, activeProfile);
                            response = response.replace('_Operando', '⚠️ _Processado via fallback_\n\n_Operando');
                            await client.sendText(user.whatsappGroupId, response);
                        } else if (fallback.intent === 'QUERY') {
                            const queryResponse = await executeQuery(
                                fallback.queryOptions || {},
                                userId,
                                activeProfile?.id,
                                activeProfile
                            );
                            await client.sendText(user.whatsappGroupId, queryResponse);
                        } else {
                            await client.sendText(user.whatsappGroupId,
                                `🤖 ❓ ${parsed.message || 'Não entendi sua mensagem.'}\n\n` +
                                `Tente algo como: "gastei 50 no uber"\n\n` +
                                `_Operando em: ${activeProfile?.name || 'N/A'}_`
                            );
                        }
                    } else {
                        await client.sendText(user.whatsappGroupId,
                            `🤖 ❓ Não consegui entender o áudio. Tente novamente ou envie por texto.\n\n` +
                            `_Operando em: ${activeProfile?.name || 'N/A'}_`
                        );
                    }
                    break;
            }

        } catch (error) {
            logger.error('❌ Erro ao processar mensagem:', error);
            try {
                const user = await User.findByPk(userId);
                if (user && user.whatsappGroupId) {
                    await client.sendText(user.whatsappGroupId,
                        '🤖 ❌ Erro ao processar. Tente novamente.'
                    );
                }
            } catch (e) { }
        }
    });
};

// ========================================
// STATUS & DISCONNECT
// ========================================

const getStatus = async (userId) => {
    const session = activeSessions.get(userId);

    if (!session || !session.client) {
        return {
            status: 'disconnected',
            connected: false
        };
    }

    try {
        const state = await session.client.getConnectionState();
        const isConnected = state === 'CONNECTED';

        return {
            status: isConnected ? 'connected' : state.toLowerCase(),
            connected: isConnected,
            groupId: session.groupId,
            groupName: GROUP_NAME
        };
    } catch (error) {
        return {
            status: 'error',
            connected: false,
            error: error.message
        };
    }
};

const disconnect = async (userId) => {
    const session = activeSessions.get(userId);

    if (!session || !session.client) {
        return { success: true, message: 'Nenhuma sessão ativa' };
    }

    try {
        await session.client.logout();
        await session.client.close();
        activeSessions.delete(userId);

        logger.info(`👋 WhatsApp desconectado para usuário ${userId}`);
        return { success: true, message: 'Desconectado com sucesso' };
    } catch (error) {
        logger.error('❌ Erro ao desconectar:', error);
        activeSessions.delete(userId);
        return { success: true, message: 'Sessão encerrada' };
    }
};

// ========================================
// NOTIFICATION SENDER
// ========================================

const sendNotification = async (userId, message) => {
    const session = activeSessions.get(userId);

    if (!session?.client || !session.isConnected || !session.groupId) {
        logger.warn(`⚠️ Não foi possível enviar notificação para ${userId}: não conectado`);
        return false;
    }

    try {
        await session.client.sendText(session.groupId, message);
        return true;
    } catch (error) {
        logger.error('❌ Erro ao enviar notificação:', error);
        return false;
    }
};

// ========================================
// SESSION RESTORATION ON STARTUP
// ========================================

/**
 * Restore all saved WhatsApp sessions on server startup
 * Checks for users with saved sessions and reconnects them
 */
const restoreAllSessions = async () => {
    logger.info('🔄 Iniciando restauração de sessões WhatsApp...');

    try {
        // Find users with WhatsApp enabled (have a groupId saved)
        const usersWithWhatsApp = await User.findAll({
            where: {
                whatsappGroupId: {
                    [Op.ne]: null
                }
            },
            attributes: ['id', 'email', 'whatsappGroupId']
        });

        if (usersWithWhatsApp.length === 0) {
            logger.info('📭 Nenhuma sessão WhatsApp para restaurar');
            return { restored: 0, failed: 0 };
        }

        logger.info(`📱 Encontrados ${usersWithWhatsApp.length} usuário(s) com WhatsApp configurado`);

        let restored = 0;
        let failed = 0;

        for (const user of usersWithWhatsApp) {
            const sessionName = `session_${user.id}`;
            const sessionsDir = getSessionPath(user.id);
            const sessionPath = path.join(sessionsDir, sessionName);

            // Check if session files exist on disk
            if (fs.existsSync(sessionPath)) {
                logger.info(`🔌 Restaurando sessão para usuário ${user.id} (${user.email})...`);

                try {
                    // Try to reconnect using saved session
                    await new Promise((resolve, reject) => {
                        let resolved = false;

                        wppconnect.create({
                            session: sessionName,
                            folderNameToken: sessionsDir,
                            headless: true,
                            useChrome: false,
                            debug: false,
                            logQR: false,
                            autoClose: 0, // Don't auto-close on timeout
                            puppeteerOptions: {
                                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                                args: [
                                    '--no-sandbox',
                                    '--disable-setuid-sandbox',
                                    '--disable-dev-shm-usage',
                                    '--disable-accelerated-2d-canvas',
                                    '--no-first-run',
                                    '--no-zygote',
                                    '--single-process',
                                    '--disable-gpu',
                                    '--disable-extensions'
                                ]
                            },
                            catchQR: (base64Qr) => {
                                // Session expired, need to scan QR again
                                logger.warn(`⚠️ Sessão expirada para usuário ${user.id}. Necessário escanear QR novamente.`);
                                if (!resolved) {
                                    resolved = true;
                                    reject(new Error('SESSION_EXPIRED'));
                                }
                            },
                            statusFind: (statusSession) => {
                                logger.debug(`📊 Status restauração [${user.id}]: ${statusSession}`);
                            }
                        })
                            .then(async (client) => {
                                logger.info(`✅ Sessão restaurada para usuário ${user.id}`);

                                activeSessions.set(user.id, {
                                    client,
                                    isConnected: true,
                                    groupId: user.whatsappGroupId
                                });

                                setupMessageListener(client, user.id);

                                if (!resolved) {
                                    resolved = true;
                                    resolve();
                                }
                            })
                            .catch((error) => {
                                if (!resolved) {
                                    resolved = true;
                                    reject(error);
                                }
                            });

                        // Timeout after 60 seconds
                        setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                reject(new Error('TIMEOUT'));
                            }
                        }, 60000);
                    });

                    restored++;
                    logger.info(`✅ Usuário ${user.id}: sessão restaurada com sucesso`);

                } catch (restoreError) {
                    failed++;
                    if (restoreError.message === 'SESSION_EXPIRED') {
                        logger.warn(`⏰ Usuário ${user.id}: sessão expirada, precisa reconectar manualmente`);
                    } else {
                        logger.error(`❌ Usuário ${user.id}: falha ao restaurar - ${restoreError.message}`);
                    }
                }
            } else {
                logger.info(`📁 Usuário ${user.id}: arquivos de sessão não encontrados`);
                failed++;
            }
        }

        logger.info(`📊 Restauração concluída: ${restored} sucesso, ${failed} falhas`);
        return { restored, failed };

    } catch (error) {
        logger.error('❌ Erro na restauração de sessões:', error);
        return { restored: 0, failed: 0, error: error.message };
    }
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
    initSession,
    getStatus,
    disconnect,
    sendNotification,
    restoreAllSessions
};
