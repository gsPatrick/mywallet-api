/**
 * Invoices Service
 * ========================================
 * GESTÃO DE FATURAS DE CARTÃO DE CRÉDITO
 * ========================================
 * 
 * Features:
 * - Listagem de faturas com histórico
 * - Geração de faturas mensais
 * - Pagamento total, parcial, mínimo
 * - Antecipação de fatura
 * - Notificações automáticas
 */

const {
    CardInvoice,
    InvoicePayment,
    CreditCard,
    CardTransaction,
    BankAccount,
    Notification
} = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

// ===========================================
// CONSTANTES
// ===========================================

const MINIMUM_PAYMENT_PERCENT = 0.15; // 15% pagamento mínimo

// ===========================================
// HELPERS
// ===========================================

/**
 * Calcula as datas do ciclo da fatura
 */
const calculateInvoiceDates = (card, month, year) => {
    const closingDay = card.closingDay || 25;
    const dueDay = card.dueDay || 10;

    // Fechamento: dia X do mês de referência
    let closingDate = new Date(year, month - 1, closingDay);

    // Vencimento: dia Y do mês seguinte
    let dueMonth = month;
    let dueYear = year;
    if (dueDay <= closingDay) {
        // Vencimento no mês seguinte
        dueMonth = month + 1;
        if (dueMonth > 12) {
            dueMonth = 1;
            dueYear = year + 1;
        }
    }
    let dueDate = new Date(dueYear, dueMonth - 1, dueDay);

    return {
        closingDate: closingDate.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0]
    };
};

/**
 * Calcula período de transações para uma fatura
 */
const calculateTransactionPeriod = (card, month, year) => {
    const closingDay = card.closingDay || 25;

    // Início: dia após fechamento do mês anterior
    let startMonth = month - 1;
    let startYear = year;
    if (startMonth < 1) {
        startMonth = 12;
        startYear = year - 1;
    }
    const startDate = new Date(startYear, startMonth - 1, closingDay + 1);

    // Fim: dia de fechamento do mês atual
    const endDate = new Date(year, month - 1, closingDay);

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};

// ===========================================
// LISTAGEM DE FATURAS
// ===========================================

/**
 * Lista faturas de um cartão
 */
const listInvoices = async (userId, profileId, cardId, options = {}) => {
    const { limit = 12, page = 1 } = options;

    const where = { userId, cardId };
    if (profileId) where.profileId = profileId;

    const invoices = await CardInvoice.findAll({
        where,
        include: [{
            model: InvoicePayment,
            as: 'payments',
            attributes: ['id', 'amount', 'paymentDate', 'paymentType']
        }],
        order: [['referenceYear', 'DESC'], ['referenceMonth', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    const total = await CardInvoice.count({ where });

    return {
        invoices: invoices.map(inv => ({
            id: inv.id,
            referenceMonth: inv.referenceMonth,
            referenceYear: inv.referenceYear,
            closingDate: inv.closingDate,
            dueDate: inv.dueDate,
            totalAmount: parseFloat(inv.totalAmount),
            paidAmount: parseFloat(inv.paidAmount),
            remainingAmount: parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount),
            minimumPayment: parseFloat(inv.minimumPayment || 0),
            status: inv.status,
            paidAt: inv.paidAt,
            paymentsCount: inv.payments?.length || 0
        })),
        pagination: { page, limit, total }
    };
};

/**
 * Obtém detalhes de uma fatura
 */
const getInvoice = async (userId, profileId, invoiceId) => {
    const where = { id: invoiceId, userId };
    if (profileId) where.profileId = profileId;

    const invoice = await CardInvoice.findOne({
        where,
        include: [
            {
                model: CreditCard,
                as: 'card',
                attributes: ['id', 'name', 'bankName', 'brand', 'lastFourDigits']
            },
            {
                model: InvoicePayment,
                as: 'payments',
                include: [{
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'bankName', 'name']
                }],
                order: [['paymentDate', 'DESC']]
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Fatura não encontrada', 404, 'INVOICE_NOT_FOUND');
    }

    // Buscar transações do período
    const { startDate, endDate } = calculateTransactionPeriod(
        invoice.card,
        invoice.referenceMonth,
        invoice.referenceYear
    );

    const transactions = await CardTransaction.findAll({
        where: {
            cardId: invoice.cardId,
            date: { [Op.between]: [startDate, endDate] }
        },
        order: [['date', 'ASC']]
    });

    return {
        id: invoice.id,
        card: invoice.card,
        referenceMonth: invoice.referenceMonth,
        referenceYear: invoice.referenceYear,
        closingDate: invoice.closingDate,
        dueDate: invoice.dueDate,
        totalAmount: parseFloat(invoice.totalAmount),
        paidAmount: parseFloat(invoice.paidAmount),
        remainingAmount: parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount),
        minimumPayment: parseFloat(invoice.minimumPayment || 0),
        status: invoice.status,
        paidAt: invoice.paidAt,
        payments: invoice.payments.map(p => ({
            id: p.id,
            amount: parseFloat(p.amount),
            paymentDate: p.paymentDate,
            paymentType: p.paymentType,
            paymentMethod: p.paymentMethod,
            bankAccount: p.bankAccount,
            notes: p.notes
        })),
        transactions: transactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: parseFloat(t.amount),
            date: t.date,
            category: t.category,
            isInstallment: t.isInstallment,
            installmentNumber: t.installmentNumber,
            totalInstallments: t.totalInstallments
        })),
        period: { startDate, endDate }
    };
};

/**
 * Obtém fatura atual de um cartão (ou cria se não existir)
 */
const getCurrentInvoice = async (userId, profileId, cardId) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Tentar encontrar fatura atual
    let invoice = await CardInvoice.findOne({
        where: {
            userId,
            cardId,
            referenceMonth: month,
            referenceYear: year
        }
    });

    if (!invoice) {
        // Gerar fatura se não existir
        invoice = await generateInvoice(userId, profileId, cardId, month, year);
    }

    return getInvoice(userId, profileId, invoice.id);
};

// ===========================================
// GERAÇÃO DE FATURAS
// ===========================================

/**
 * Gera ou atualiza fatura de um cartão para um mês específico
 */
const generateInvoice = async (userId, profileId, cardId, month, year) => {
    // Buscar cartão
    const cardWhere = { id: cardId, userId };
    if (profileId) cardWhere.profileId = profileId;

    const card = await CreditCard.findOne({ where: cardWhere });
    if (!card) {
        throw new AppError('Cartão não encontrado', 404, 'CARD_NOT_FOUND');
    }

    // Calcular datas
    const { closingDate, dueDate } = calculateInvoiceDates(card, month, year);
    const { startDate, endDate } = calculateTransactionPeriod(card, month, year);

    // Somar transações do período
    const transactions = await CardTransaction.findAll({
        where: {
            cardId,
            date: { [Op.between]: [startDate, endDate] }
        }
    });

    const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const minimumPayment = totalAmount * MINIMUM_PAYMENT_PERCENT;

    // Verificar se fatura já existe
    let invoice = await CardInvoice.findOne({
        where: { cardId, referenceMonth: month, referenceYear: year }
    });

    if (invoice) {
        // Atualizar fatura existente
        await invoice.update({
            totalAmount,
            minimumPayment,
            closingDate,
            dueDate
        });
    } else {
        // Criar nova fatura
        invoice = await CardInvoice.create({
            userId,
            cardId,
            profileId: card.profileId,
            referenceMonth: month,
            referenceYear: year,
            closingDate,
            dueDate,
            totalAmount,
            minimumPayment,
            paidAmount: 0,
            status: 'OPEN'
        });
    }

    return invoice;
};

/**
 * Atualiza status das faturas (para uso em cron)
 */
const updateInvoiceStatuses = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Faturas fechadas (após data de fechamento, antes do vencimento)
    await CardInvoice.update(
        { status: 'CLOSED' },
        {
            where: {
                status: 'OPEN',
                closingDate: { [Op.lt]: today },
                dueDate: { [Op.gte]: today }
            }
        }
    );

    // Faturas vencidas (após data de vencimento, não totalmente pagas)
    const overdue = await CardInvoice.findAll({
        where: {
            status: { [Op.in]: ['OPEN', 'CLOSED', 'PARTIAL'] },
            dueDate: { [Op.lt]: today }
        }
    });

    for (const invoice of overdue) {
        const remaining = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);
        if (remaining > 0) {
            await invoice.update({ status: 'OVERDUE' });

            // Criar notificação de fatura vencida
            await Notification.create({
                userId: invoice.userId,
                type: 'PAYMENT_DUE',
                title: '⚠️ Fatura Vencida',
                message: `Sua fatura de R$ ${parseFloat(invoice.totalAmount).toFixed(2)} venceu! Regularize para evitar juros.`,
                relatedAmount: invoice.totalAmount,
                scheduledFor: new Date(),
                isDisplayed: false
            });
        }
    }

    return { updated: overdue.length };
};

// ===========================================
// PAGAMENTOS
// ===========================================

/**
 * Registra um pagamento de fatura
 */
const payInvoice = async (userId, profileId, invoiceId, data) => {
    const { amount, paymentType, paymentMethod, bankAccountId, notes } = data;

    // Buscar fatura
    const where = { id: invoiceId, userId };
    if (profileId) where.profileId = profileId;

    const invoice = await CardInvoice.findOne({
        where,
        include: [{ model: CreditCard, as: 'card' }]
    });

    if (!invoice) {
        throw new AppError('Fatura não encontrada', 404, 'INVOICE_NOT_FOUND');
    }

    const remaining = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);

    if (remaining <= 0) {
        throw new AppError('Fatura já está totalmente paga', 400, 'INVOICE_ALREADY_PAID');
    }

    // Calcular valor do pagamento
    let paymentAmount = amount;

    if (paymentType === 'FULL') {
        paymentAmount = remaining;
    } else if (paymentType === 'MINIMUM') {
        paymentAmount = parseFloat(invoice.minimumPayment);
        if (paymentAmount > remaining) {
            paymentAmount = remaining;
        }
    } else if (paymentType === 'PARTIAL' || paymentType === 'ADVANCE') {
        if (!amount || amount <= 0) {
            throw new AppError('Valor do pagamento inválido', 400, 'INVALID_PAYMENT_AMOUNT');
        }
        if (amount > remaining) {
            throw new AppError('Valor maior que o restante da fatura', 400, 'PAYMENT_EXCEEDS_REMAINING');
        }
    }

    // Validar conta bancária se informada
    if (bankAccountId) {
        const account = await BankAccount.findOne({
            where: { id: bankAccountId, userId }
        });
        if (!account) {
            throw new AppError('Conta bancária não encontrada', 404, 'ACCOUNT_NOT_FOUND');
        }
    }

    // Criar registro de pagamento
    const payment = await InvoicePayment.create({
        invoiceId,
        userId,
        bankAccountId,
        amount: paymentAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentType,
        paymentMethod: paymentMethod || 'PIX',
        notes
    });

    // Atualizar fatura
    const newPaidAmount = parseFloat(invoice.paidAmount) + paymentAmount;
    const newRemaining = parseFloat(invoice.totalAmount) - newPaidAmount;

    let newStatus = invoice.status;
    let paidAt = null;

    if (newRemaining <= 0) {
        newStatus = 'PAID';
        paidAt = new Date();
    } else if (newPaidAmount > 0) {
        newStatus = 'PARTIAL';
    }

    await invoice.update({
        paidAmount: newPaidAmount,
        status: newStatus,
        paidAt
    });

    // Atualizar limite disponível do cartão
    if (invoice.card) {
        const newAvailableLimit = parseFloat(invoice.card.availableLimit || 0) + paymentAmount;
        await invoice.card.update({
            availableLimit: Math.min(newAvailableLimit, parseFloat(invoice.card.creditLimit || 0))
        });
    }

    return {
        payment: {
            id: payment.id,
            amount: parseFloat(payment.amount),
            paymentType: payment.paymentType,
            paymentDate: payment.paymentDate
        },
        invoice: {
            id: invoice.id,
            totalAmount: parseFloat(invoice.totalAmount),
            paidAmount: newPaidAmount,
            remainingAmount: newRemaining,
            status: newStatus
        }
    };
};

/**
 * Antecipa fatura de um cartão (paga fatura em aberto antes do fechamento)
 */
const advanceInvoice = async (userId, profileId, cardId, amount, bankAccountId) => {
    // Buscar fatura atual em aberto
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    let invoice = await CardInvoice.findOne({
        where: {
            userId,
            cardId,
            referenceMonth: month,
            referenceYear: year,
            status: 'OPEN'
        }
    });

    if (!invoice) {
        // Gerar fatura atual
        invoice = await generateInvoice(userId, profileId, cardId, month, year);
    }

    if (parseFloat(invoice.totalAmount) <= 0) {
        throw new AppError('Não há valor a pagar na fatura atual', 400, 'NO_AMOUNT_TO_PAY');
    }

    return payInvoice(userId, profileId, invoice.id, {
        amount,
        paymentType: 'ADVANCE',
        bankAccountId
    });
};

// ===========================================
// NOTIFICAÇÕES
// ===========================================

/**
 * Gera notificações de vencimento de faturas
 */
const generateInvoiceNotifications = async () => {
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(in5Days.getDate() + 5);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const notifications = [];

    // Faturas que vencem em 5 dias
    const dueSoon5 = await CardInvoice.findAll({
        where: {
            status: { [Op.in]: ['OPEN', 'CLOSED', 'PARTIAL'] },
            dueDate: in5Days.toISOString().split('T')[0]
        },
        include: [{ model: CreditCard, as: 'card' }]
    });

    for (const invoice of dueSoon5) {
        const remaining = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);
        if (remaining > 0) {
            notifications.push(await Notification.create({
                userId: invoice.userId,
                type: 'PAYMENT_REMINDER_5D',
                title: '📅 Fatura vence em 5 dias',
                message: `Fatura ${invoice.card?.name || ''} de R$ ${remaining.toFixed(2)} vence em 5 dias.`,
                relatedAmount: remaining,
                scheduledFor: new Date(),
                isDisplayed: false
            }));
        }
    }

    // Faturas que vencem amanhã
    const dueTomorrow = await CardInvoice.findAll({
        where: {
            status: { [Op.in]: ['OPEN', 'CLOSED', 'PARTIAL'] },
            dueDate: tomorrow.toISOString().split('T')[0]
        },
        include: [{ model: CreditCard, as: 'card' }]
    });

    for (const invoice of dueTomorrow) {
        const remaining = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);
        if (remaining > 0) {
            notifications.push(await Notification.create({
                userId: invoice.userId,
                type: 'PAYMENT_REMINDER_1D',
                title: '⏰ Fatura vence amanhã!',
                message: `Fatura ${invoice.card?.name || ''} de R$ ${remaining.toFixed(2)} vence amanhã! Não esqueça de pagar.`,
                relatedAmount: remaining,
                scheduledFor: new Date(),
                isDisplayed: false
            }));
        }
    }

    // Faturas que vencem hoje
    const dueToday = await CardInvoice.findAll({
        where: {
            status: { [Op.in]: ['OPEN', 'CLOSED', 'PARTIAL'] },
            dueDate: today.toISOString().split('T')[0]
        },
        include: [{ model: CreditCard, as: 'card' }]
    });

    for (const invoice of dueToday) {
        const remaining = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);
        if (remaining > 0) {
            notifications.push(await Notification.create({
                userId: invoice.userId,
                type: 'PAYMENT_DUE',
                title: '🚨 Fatura vence HOJE!',
                message: `Fatura ${invoice.card?.name || ''} de R$ ${remaining.toFixed(2)} vence HOJE! Pague agora para evitar juros.`,
                relatedAmount: remaining,
                scheduledFor: new Date(),
                isDisplayed: false
            }));
        }
    }

    return { notificationsCreated: notifications.length };
};

// ===========================================
// EXPORTS
// ===========================================

module.exports = {
    // Listagem
    listInvoices,
    getInvoice,
    getCurrentInvoice,
    // Geração
    generateInvoice,
    updateInvoiceStatuses,
    // Pagamentos
    payInvoice,
    advanceInvoice,
    // Notificações
    generateInvoiceNotifications
};
