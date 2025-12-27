/**
 * Morning Briefing Service
 * ========================================
 * NOTIFICAÇÃO MATINAL - 08:00 AM
 * ========================================
 * 
 * Gera relatório financeiro completo via WhatsApp:
 * - Gastos do dia anterior
 * - Saldo em contas
 * - Orçamento mensal
 * - Investimentos e proventos
 * - Dados empresariais (se houver PJ)
 * 
 * NÃO USA IA - Templates determinísticos
 */

const { logger } = require('../../config/logger');
const {
    User,
    Profile,
    BankAccount,
    ManualTransaction,
    CardTransaction,
    Budget,
    BudgetAllocation,
    Dividend,
    DasGuide,
    NotificationPreference
} = require('../../models');
const { Op } = require('sequelize');
const investmentDashboardService = require('../investmentDashboard/investmentDashboard.service');

// ========================================
// ROTATING TEMPLATES (No AI)
// ========================================

const GREETINGS = [
    'Bom dia, investidor! ☀️',
    'Hora do café e dos números ☕',
    'Resumo do seu império 🚀',
    'Acordou? Seus números também! 📊',
    'Bom dia! Vamos aos fatos 💰',
    'Seu briefing chegou! 🎯',
    'Manhã de resultados! 📈',
    'Olá! Seu resumo financeiro está pronto 💎'
];

const MOTIVATIONAL_QUOTES = [
    '_"O dinheiro é um servo excelente, mas um mestre terrível."_ - P.T. Barnum',
    '_"Não economize o que sobra após gastar, gaste o que sobra após economizar."_ - Warren Buffett',
    '_"A melhor época para começar foi ontem. A segunda melhor é hoje."_',
    '_"Riqueza não é sobre ter muito dinheiro; é sobre ter muitas opções."_ - Chris Rock',
    '_"Invista em si mesmo. O retorno é infinito."_',
    '_"Pequenos vazamentos afundam grandes navios."_ - Benjamin Franklin',
    '_"O tempo é mais valioso que o dinheiro. Você pode conseguir mais dinheiro, mas não mais tempo."_',
    '_"Não é sobre quanto você ganha, mas quanto você guarda."_'
];

// ========================================
// HELPER FUNCTIONS
// ========================================

const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const formatPercent = (value, showSign = true) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
};

const getRandomItem = (array) => {
    return array[Math.floor(Math.random() * array.length)];
};

const getYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
};

const getYesterdayEnd = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    return yesterday;
};

const getMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

const getTodayEnd = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
};

// ========================================
// DATA COLLECTION
// ========================================

/**
 * Collect personal financial data
 */
const getPersonalData = async (userId, profileId) => {
    const yesterday = getYesterday();
    const yesterdayEnd = getYesterdayEnd();
    const monthStart = getMonthStart();

    try {
        // 1. Yesterday's expenses
        const [manualExpenses, cardExpenses] = await Promise.all([
            ManualTransaction.sum('amount', {
                where: {
                    profileId,
                    type: 'EXPENSE',
                    date: { [Op.between]: [yesterday, yesterdayEnd] }
                }
            }),
            CardTransaction.sum('amount', {
                where: {
                    profileId,
                    date: { [Op.between]: [yesterday, yesterdayEnd] }
                }
            })
        ]);

        const yesterdayExpenses = (parseFloat(manualExpenses) || 0) + (parseFloat(cardExpenses) || 0);

        // 2. Bank balance
        const banks = await BankAccount.findAll({
            where: { profileId, isActive: true }
        });

        const totalBalance = banks.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);

        // 3. Budget consumption
        const budget = await Budget.findOne({
            where: {
                profileId,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                isActive: true
            }
        });

        let budgetPercent = 0;
        let budgetTotal = 0;
        let budgetSpent = 0;

        if (budget) {
            budgetTotal = parseFloat(budget.totalBudget) || 0;

            // Sum allocations spent
            const allocations = await BudgetAllocation.findAll({
                where: { budgetId: budget.id }
            });

            budgetSpent = allocations.reduce((sum, a) => sum + (parseFloat(a.spent) || 0), 0);

            if (budgetTotal > 0) {
                budgetPercent = (budgetSpent / budgetTotal) * 100;
            }
        }

        return {
            yesterdayExpenses,
            totalBalance,
            budgetPercent,
            budgetTotal,
            budgetSpent,
            bankCount: banks.length
        };
    } catch (error) {
        logger.error(`Error collecting personal data for user ${userId}:`, error);
        return {
            yesterdayExpenses: 0,
            totalBalance: 0,
            budgetPercent: 0,
            budgetTotal: 0,
            budgetSpent: 0,
            bankCount: 0
        };
    }
};

/**
 * Collect investment data
 */
const getInvestmentData = async (userId) => {
    try {
        const today = getToday();
        const todayEnd = getTodayEnd();
        const yesterday = getYesterday();
        const yesterdayEnd = getYesterdayEnd();
        const monthStart = getMonthStart();

        // Get portfolio summary
        let portfolioSummary = null;
        try {
            portfolioSummary = await investmentDashboardService.getPortfolioSummary(userId);
        } catch (e) {
            logger.warn(`Could not get portfolio summary for ${userId}:`, e.message);
        }

        // Get performance by asset to find top performer
        let topPerformer = null;
        try {
            const performance = await investmentDashboardService.getPerformanceByAsset(userId);
            if (performance && performance.length > 0) {
                topPerformer = performance[0]; // Already sorted by profitPercent DESC
            }
        } catch (e) {
            logger.warn(`Could not get performance for ${userId}:`, e.message);
        }

        // Dividends received yesterday
        const dividendsYesterday = await Dividend.sum('netAmount', {
            where: {
                userId,
                status: 'RECEIVED',
                paymentDate: { [Op.between]: [yesterday, yesterdayEnd] }
            }
        }) || 0;

        // Dividends expected today
        const dividendsToday = await Dividend.findAll({
            where: {
                userId,
                status: 'PENDING',
                paymentDate: { [Op.between]: [today, todayEnd] }
            },
            include: [{ model: require('../../models').Asset, as: 'asset' }]
        });

        const dividendsTodayTotal = dividendsToday.reduce((sum, d) => sum + (parseFloat(d.netAmount) || 0), 0);
        const dividendsTodayTickers = dividendsToday.map(d => d.asset?.ticker).filter(Boolean);

        // Total dividends this month
        const dividendsMonth = await Dividend.sum('netAmount', {
            where: {
                userId,
                status: 'RECEIVED',
                paymentDate: { [Op.gte]: monthStart }
            }
        }) || 0;

        return {
            totalValue: portfolioSummary?.summary?.marketValue || 0,
            totalInvested: portfolioSummary?.summary?.totalInvested || 0,
            profit: portfolioSummary?.summary?.profit || 0,
            profitPercent: portfolioSummary?.summary?.profitPercent || 0,
            topPerformer: topPerformer ? {
                ticker: topPerformer.ticker,
                profitPercent: topPerformer.profitPercent
            } : null,
            dividendsYesterday,
            dividendsToday: dividendsTodayTotal,
            dividendsTodayTickers,
            dividendsMonth
        };
    } catch (error) {
        logger.error(`Error collecting investment data for user ${userId}:`, error);
        return {
            totalValue: 0,
            totalInvested: 0,
            profit: 0,
            profitPercent: 0,
            topPerformer: null,
            dividendsYesterday: 0,
            dividendsToday: 0,
            dividendsTodayTickers: [],
            dividendsMonth: 0
        };
    }
};

/**
 * Collect business data (if BUSINESS profile exists)
 */
const getBusinessData = async (userId, profileId) => {
    const yesterday = getYesterday();
    const yesterdayEnd = getYesterdayEnd();
    const now = new Date();

    try {
        // Yesterday's income (faturamento)
        const income = await ManualTransaction.sum('amount', {
            where: {
                profileId,
                type: 'INCOME',
                date: { [Op.between]: [yesterday, yesterdayEnd] }
            }
        }) || 0;

        // Bank balance (caixa)
        const banks = await BankAccount.findAll({
            where: { profileId, isActive: true }
        });
        const cash = banks.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);

        // DAS status
        const upcomingDas = await DasGuide.findAll({
            where: {
                userId,
                status: { [Op.in]: ['PENDENTE', 'VENCIDO'] },
                dueDate: { [Op.lte]: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) } // Next 5 days
            },
            order: [['dueDate', 'ASC']]
        });

        let dasStatus = 'Tudo pago ✅';
        if (upcomingDas.length > 0) {
            const first = upcomingDas[0];
            const dueDate = new Date(first.dueDate);
            const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

            if (first.status === 'VENCIDO' || daysUntil < 0) {
                dasStatus = `⚠️ DAS vencido!`;
            } else if (daysUntil === 0) {
                dasStatus = `🔔 DAS vence HOJE!`;
            } else {
                dasStatus = `⏰ Vence em ${daysUntil} dia(s)`;
            }
        }

        return {
            income,
            cash,
            dasStatus
        };
    } catch (error) {
        logger.error(`Error collecting business data for user ${userId}:`, error);
        return {
            income: 0,
            cash: 0,
            dasStatus: 'N/A'
        };
    }
};

// ========================================
// MAIN BRIEFING GENERATOR
// ========================================

/**
 * Generate complete briefing message for a user
 */
const generateBriefing = async (userId) => {
    logger.info(`📋 Generating briefing for user ${userId}`);

    try {
        // Get user and profiles
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const profiles = await Profile.findAll({
            where: { userId }
        });

        const personalProfile = profiles.find(p => p.type === 'PERSONAL');
        const businessProfile = profiles.find(p => p.type === 'BUSINESS');

        // Collect all data in parallel
        const [personalData, investmentData] = await Promise.all([
            personalProfile ? getPersonalData(userId, personalProfile.id) : Promise.resolve(null),
            getInvestmentData(userId)
        ]);

        let businessData = null;
        if (businessProfile) {
            businessData = await getBusinessData(userId, businessProfile.id);
        }

        // Build message
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit'
        });

        let message = `🤖 ${getRandomItem(GREETINGS)}\n`;
        message += `Aqui está seu briefing de *${dateStr}*:\n\n`;

        // Personal section
        if (personalData) {
            message += `👤 *PESSOAL*\n`;
            message += `📉 Gastos ontem: *${formatCurrency(personalData.yesterdayExpenses)}*\n`;
            message += `📊 Orçamento mês: *${formatPercent(personalData.budgetPercent, false)}* consumido\n`;
            message += `💰 Saldo em conta: *${formatCurrency(personalData.totalBalance)}*\n\n`;
        }

        // Investment section
        if (investmentData.totalValue > 0 || investmentData.dividendsMonth > 0) {
            const profitSign = investmentData.profitPercent >= 0 ? '+' : '';

            message += `📈 *INVESTIMENTOS*\n`;
            message += `💎 Patrimônio: *${formatCurrency(investmentData.totalValue)}* (${profitSign}${formatPercent(investmentData.profitPercent, false)})\n`;

            if (investmentData.topPerformer) {
                const topSign = investmentData.topPerformer.profitPercent >= 0 ? '+' : '';
                message += `🏆 Destaque: *${investmentData.topPerformer.ticker}* (${topSign}${formatPercent(investmentData.topPerformer.profitPercent, false)})\n`;
            }

            message += `💵 Proventos mês: *${formatCurrency(investmentData.dividendsMonth)}*\n`;

            if (investmentData.dividendsToday > 0) {
                const tickers = investmentData.dividendsTodayTickers.join(', ');
                message += `🔔 *Pinga hoje:* *${formatCurrency(investmentData.dividendsToday)}* de ${tickers}!\n`;
            }

            message += `\n`;
        }

        // Business section
        if (businessData) {
            message += `💼 *EMPRESARIAL*\n`;
            message += `📈 Faturamento ontem: *${formatCurrency(businessData.income)}*\n`;
            message += `🏛️ DAS: ${businessData.dasStatus}\n`;
            message += `🏦 Caixa: *${formatCurrency(businessData.cash)}*\n\n`;
        }

        // Motivational quote
        message += `─────────────────────\n`;
        message += getRandomItem(MOTIVATIONAL_QUOTES);

        logger.info(`✅ Briefing generated successfully for user ${userId}`);
        return message;
    } catch (error) {
        logger.error(`❌ Error generating briefing for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Get eligible users for briefing
 * - Active subscription
 * - WhatsApp connected
 * - Notifications enabled
 */
const getEligibleUsers = async () => {
    try {
        const users = await User.findAll({
            where: {
                subscriptionStatus: 'ACTIVE',
                whatsappGroupId: { [Op.not]: null },
                deletedAt: null
            }
        });

        // Filter by notification preference
        const eligibleUsers = [];

        for (const user of users) {
            const pref = await NotificationPreference.findOne({
                where: {
                    userId: user.id,
                    notificationType: 'WHATSAPP_MIRROR'
                }
            });

            // Default to enabled if no preference exists
            if (!pref || pref.enabled) {
                eligibleUsers.push(user);
            }
        }

        return eligibleUsers;
    } catch (error) {
        logger.error('Error getting eligible users:', error);
        return [];
    }
};

/**
 * Send briefing to a user via WhatsApp
 */
const sendBriefing = async (userId) => {
    const whatsappService = require('./whatsapp.service');

    try {
        const message = await generateBriefing(userId);
        await whatsappService.sendNotification(userId, message);
        logger.info(`📤 Briefing sent to user ${userId}`);
        return true;
    } catch (error) {
        logger.error(`❌ Failed to send briefing to user ${userId}:`, error);
        return false;
    }
};

module.exports = {
    generateBriefing,
    getEligibleUsers,
    sendBriefing,
    // Export for testing
    getPersonalData,
    getInvestmentData,
    getBusinessData
};
