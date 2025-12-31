/**
 * Internal Chat Controller
 * ========================================
 * Exposes WhatsApp bot logic for the internal app chat
 * Uses the same Groq AI parsing and transaction handling
 * ========================================
 */

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
    CardInvoice
} = require('../../models');
const { Op } = require('sequelize');

// ========================================
// HELPER FUNCTIONS (Copied from WhatsApp Service)
// ========================================

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value).replace('R$', 'R$ ');
};

const generateShortId = (uuid) => {
    return uuid.substring(0, 4).toUpperCase();
};

const getUserContext = async (userId, profileId = null) => {
    const profiles = await Profile.findAll({
        where: { userId },
        attributes: ['id', 'name', 'type', 'isDefault']
    });

    const banks = await BankAccount.findAll({
        where: { userId, isActive: true },
        attributes: ['id', 'bankName', 'nickname', 'type', 'balance']
    });

    const cards = await CreditCard.findAll({
        where: { userId, isActive: true },
        attributes: ['id', 'name', 'bankName', 'brand', 'lastFourDigits', 'creditLimit', 'usedLimit', 'closingDay', 'dueDay']
    });

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

const getActiveProfile = async (user) => {
    if (user.whatsappActiveProfileId) {
        const profile = await Profile.findByPk(user.whatsappActiveProfileId);
        if (profile) return profile;
    }

    let profile = await Profile.findOne({
        where: { userId: user.id, isDefault: true }
    });

    if (!profile) {
        profile = await Profile.findOne({
            where: { userId: user.id, type: 'PERSONAL' }
        });
    }

    if (!profile) {
        profile = await Profile.findOne({
            where: { userId: user.id }
        });
    }

    if (profile) {
        user.whatsappActiveProfileId = profile.id;
        await user.save();
    }

    return profile;
};

// ========================================
// SHORTCUT COMMANDS
// ========================================

const handleShortcutCommand = async (text, user, activeProfile, context) => {
    const upperText = text.toUpperCase().trim();

    // Profile switch: PF
    if (upperText === 'PF') {
        const profile = await Profile.findOne({
            where: { userId: user.id, type: 'PERSONAL' }
        });
        if (profile) {
            user.whatsappActiveProfileId = profile.id;
            await user.save();
            return {
                type: 'SYSTEM',
                text: `✅ Foco alterado para: ${profile.name} (PF)`,
                profile: profile.name
            };
        }
        return { type: 'ERROR', text: '❌ Perfil Pessoa Física não encontrado.' };
    }

    // Profile switch: PJ
    if (upperText === 'PJ') {
        const profile = await Profile.findOne({
            where: { userId: user.id, type: 'BUSINESS' }
        });
        if (profile) {
            user.whatsappActiveProfileId = profile.id;
            await user.save();
            return {
                type: 'SYSTEM',
                text: `✅ Foco alterado para: ${profile.name} (PJ)`,
                profile: profile.name
            };
        }
        return { type: 'ERROR', text: '❌ Perfil Pessoa Jurídica não encontrado.' };
    }

    // SALDO
    if (upperText === 'SALDO') {
        let totalBalance = 0;
        context.banks.forEach(b => {
            totalBalance += parseFloat(b.balance) || 0;
        });

        return {
            type: 'BALANCE',
            totalBalance,
            banks: context.banks.map(b => ({
                name: b.bankName,
                nickname: b.nickname,
                balance: parseFloat(b.balance) || 0
            })),
            profile: activeProfile?.name
        };
    }

    // BANCOS
    if (upperText === 'BANCOS') {
        if (context.banks.length === 0) {
            return { type: 'ERROR', text: '❌ Nenhuma conta bancária cadastrada.' };
        }

        let totalBalance = 0;
        const banksList = context.banks.map(b => {
            const balance = parseFloat(b.balance) || 0;
            totalBalance += balance;
            return { name: b.bankName, nickname: b.nickname, balance };
        });

        return {
            type: 'BANKS_LIST',
            banks: banksList,
            totalBalance,
            profile: activeProfile?.name
        };
    }

    // CARTOES
    if (upperText === 'CARTOES' || upperText === 'CARTÕES') {
        if (context.cards.length === 0) {
            return { type: 'ERROR', text: '❌ Nenhum cartão cadastrado.' };
        }

        let totalLimit = 0;
        let totalUsed = 0;

        const cardsList = context.cards.map(card => {
            const limit = parseFloat(card.creditLimit) || 0;
            const used = parseFloat(card.usedLimit) || 0;
            const available = limit - used;
            const usagePercent = limit > 0 ? Math.round((used / limit) * 100) : 0;

            totalLimit += limit;
            totalUsed += used;

            return {
                name: card.name || card.bankName,
                lastFour: card.lastFourDigits,
                brand: card.brand,
                limit,
                used,
                available,
                usagePercent,
                closingDay: card.closingDay,
                dueDay: card.dueDay
            };
        });

        return {
            type: 'CARDS_LIST',
            cards: cardsList,
            totalLimit,
            totalUsed,
            totalAvailable: totalLimit - totalUsed,
            profile: activeProfile?.name
        };
    }

    // FATURA
    if (upperText === 'FATURA') {
        if (context.cards.length === 0) {
            return { type: 'ERROR', text: '❌ Nenhum cartão cadastrado.' };
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const invoices = [];
        for (const card of context.cards) {
            let invoice = await CardInvoice.findOne({
                where: { cardId: card.id, referenceMonth: month, referenceYear: year }
            });

            if (!invoice) {
                try {
                    invoice = await invoicesService.generateInvoice(user.id, activeProfile?.id, card.id, month, year);
                } catch (err) {
                    continue;
                }
            }

            const total = parseFloat(invoice.totalAmount) || 0;
            const paid = parseFloat(invoice.paidAmount) || 0;

            invoices.push({
                cardName: card.name || card.bankName,
                lastFour: card.lastFourDigits,
                total,
                paid,
                remaining: total - paid,
                status: invoice.status,
                dueDate: invoice.dueDate
            });
        }

        return {
            type: 'INVOICES',
            invoices,
            profile: activeProfile?.name
        };
    }

    // MENU
    if (upperText === 'MENU') {
        return {
            type: 'MENU',
            commands: [
                { cmd: 'SALDO', desc: 'Ver saldo total' },
                { cmd: 'BANCOS', desc: 'Ver saldo por conta' },
                { cmd: 'CARTOES', desc: 'Ver cartões' },
                { cmd: 'FATURA', desc: 'Ver faturas atuais' },
                { cmd: 'PF/PJ', desc: 'Alternar perfil' }
            ],
            examples: [
                'Gastei 50 no Uber',
                'Recebi 1000 de salário',
                'Quanto gastei hoje?'
            ],
            profile: activeProfile?.name
        };
    }

    return null;
};

// ========================================
// TRANSACTION PROCESSING
// ========================================

const processTransactionEntries = async (entries, userId, activeProfile, context) => {
    const results = [];

    for (const entry of entries) {
        try {
            let profileId = activeProfile?.id;
            if (entry.profileType) {
                const targetProfile = context.profiles.find(p => p.type === entry.profileType);
                if (targetProfile) profileId = targetProfile.id;
            }

            let categoryId = entry.categoryId;
            if (!categoryId && entry.categoryName) {
                const category = context.categories.find(c =>
                    c.name.toLowerCase().includes(entry.categoryName.toLowerCase())
                );
                if (category) categoryId = category.id;
            }

            let bankAccountId = entry.bankId;
            if (!bankAccountId) {
                const defaultBank = context.banks.find(b => b.id);
                if (defaultBank) bankAccountId = defaultBank.id;
            }

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

            const transaction = await transactionsService.createManualTransaction(userId, profileId, transactionData);
            const shortId = generateShortId(transaction.id);
            const bankName = context.banks.find(b => b.id === bankAccountId)?.bankName || 'Conta';

            results.push({
                success: true,
                shortId,
                amount: entry.amount,
                description: entry.description,
                type: entry.type,
                bankName,
                profileName: activeProfile?.name,
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

// ========================================
// MAIN CONTROLLER
// ========================================

const processMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { text, audio } = req.body;

        if (!text && !audio) {
            return res.status(400).json({ error: 'Text or audio is required' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const activeProfile = await getActiveProfile(user);
        const context = await getUserContext(userId, activeProfile?.id);

        // Handle shortcut commands first
        if (text) {
            const shortcutResponse = await handleShortcutCommand(text, user, activeProfile, context);
            if (shortcutResponse) {
                return res.json({
                    success: true,
                    response: shortcutResponse,
                    profile: activeProfile?.name
                });
            }
        }

        // Use Groq AI to parse message
        let parsed;
        if (audio) {
            // Handle audio (base64)
            const audioBuffer = Buffer.from(audio, 'base64');
            parsed = await groqService.analyzeAudio(audioBuffer, context);
        } else {
            parsed = await groqService.parseTransaction(text, context);
        }

        logger.info('🧠 AI Response:', JSON.stringify(parsed));

        // Handle by intent
        let response;

        switch (parsed.intent) {
            case 'TRANSACTION':
                if (parsed.entries && parsed.entries.length > 0) {
                    const results = await processTransactionEntries(
                        parsed.entries,
                        userId,
                        activeProfile,
                        context
                    );

                    response = {
                        type: 'TRANSACTIONS',
                        transactions: results.filter(r => r.success).map(r => ({
                            shortId: r.shortId,
                            type: r.type,
                            amount: r.amount,
                            description: r.description,
                            bankName: r.bankName
                        })),
                        errors: results.filter(r => !r.success).map(r => r.error),
                        profile: activeProfile?.name
                    };
                } else {
                    response = { type: 'ERROR', text: '❌ Não consegui extrair a transação. Tente novamente.' };
                }
                break;

            case 'QUERY':
                // Execute query (simplified for now)
                response = {
                    type: 'QUERY_RESULT',
                    period: parsed.queryOptions?.period || 'month',
                    filter: parsed.queryOptions?.filter || 'all',
                    profile: activeProfile?.name
                };
                break;

            case 'BALANCE':
                let totalBalance = 0;
                context.banks.forEach(b => {
                    totalBalance += parseFloat(b.balance) || 0;
                });
                response = {
                    type: 'BALANCE',
                    totalBalance,
                    banks: context.banks.map(b => ({
                        name: b.bankName,
                        balance: parseFloat(b.balance) || 0
                    })),
                    profile: activeProfile?.name
                };
                break;

            case 'CARDS':
                response = {
                    type: 'CARDS_LIST',
                    cards: context.cards.map(c => ({
                        name: c.name || c.bankName,
                        lastFour: c.lastFourDigits,
                        limit: parseFloat(c.creditLimit) || 0,
                        used: parseFloat(c.usedLimit) || 0
                    })),
                    profile: activeProfile?.name
                };
                break;

            default:
                response = {
                    type: 'UNKNOWN',
                    text: 'Não entendi sua mensagem. Tente algo como "gastei 50 no uber" ou digite MENU para ver opções.',
                    profile: activeProfile?.name
                };
        }

        return res.json({
            success: true,
            response,
            profile: activeProfile?.name
        });

    } catch (error) {
        logger.error('❌ Internal Chat Error:', error);
        return res.status(500).json({
            error: 'Failed to process message',
            details: error.message
        });
    }
};

module.exports = {
    processMessage
};
