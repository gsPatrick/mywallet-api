/**
 * Notifications Controller
 * Gerencia notificações de pagamentos e recebimentos
 */

const { Notification, ManualTransaction, Subscription } = require('../../models');
const { Op } = require('sequelize');

/**
 * Cria notificações para transações pendentes
 * Deve ser chamado por um job agendado ou no login
 */
const createPaymentNotifications = async (userId) => {
    try {
        const today = new Date();
        const fiveDaysFromNow = new Date(today);
        fiveDaysFromNow.setDate(today.getDate() + 5);

        // Buscar transações pendentes nos próximos 5 dias
        const pendingTransactions = await ManualTransaction.findAll({
            where: {
                userId,
                status: 'PENDING',
                date: {
                    [Op.between]: [today.toISOString().split('T')[0], fiveDaysFromNow.toISOString().split('T')[0]]
                },
                notificationsCreated: false
            }
        });

        for (const tx of pendingTransactions) {
            const txDate = new Date(tx.date);
            const isIncome = tx.type === 'INCOME';

            // Notificação de 5 dias antes
            const fiveDaysBefore = new Date(txDate);
            fiveDaysBefore.setDate(txDate.getDate() - 5);
            if (fiveDaysBefore >= today) {
                await Notification.findOrCreate({
                    where: {
                        userId,
                        type: isIncome ? 'INCOME_REMINDER_5D' : 'PAYMENT_REMINDER_5D',
                        relatedTransactionId: tx.id
                    },
                    defaults: {
                        userId,
                        type: isIncome ? 'INCOME_REMINDER_5D' : 'PAYMENT_REMINDER_5D',
                        title: isIncome ? '💰 Receita em 5 dias' : '⚠️ Pagamento em 5 dias',
                        message: `${tx.description} - R$ ${parseFloat(tx.amount).toFixed(2)}`,
                        relatedTransactionId: tx.id,
                        relatedTransactionType: 'MANUAL',
                        relatedAmount: tx.amount,
                        scheduledFor: fiveDaysBefore
                    }
                });
            }

            // Notificação de 1 dia antes
            const oneDayBefore = new Date(txDate);
            oneDayBefore.setDate(txDate.getDate() - 1);
            if (oneDayBefore >= today) {
                await Notification.findOrCreate({
                    where: {
                        userId,
                        type: isIncome ? 'INCOME_REMINDER_1D' : 'PAYMENT_REMINDER_1D',
                        relatedTransactionId: tx.id
                    },
                    defaults: {
                        userId,
                        type: isIncome ? 'INCOME_REMINDER_1D' : 'PAYMENT_REMINDER_1D',
                        title: isIncome ? '💰 Receita amanhã!' : '⚠️ Pagamento amanhã!',
                        message: `${tx.description} - R$ ${parseFloat(tx.amount).toFixed(2)}`,
                        relatedTransactionId: tx.id,
                        relatedTransactionType: 'MANUAL',
                        relatedAmount: tx.amount,
                        scheduledFor: oneDayBefore
                    }
                });
            }

            // Notificação no dia
            await Notification.findOrCreate({
                where: {
                    userId,
                    type: isIncome ? 'INCOME_DUE' : 'PAYMENT_DUE',
                    relatedTransactionId: tx.id
                },
                defaults: {
                    userId,
                    type: isIncome ? 'INCOME_DUE' : 'PAYMENT_DUE',
                    title: isIncome ? '💰 Receita hoje!' : '🔔 Pagamento vence hoje!',
                    message: `${tx.description} - R$ ${parseFloat(tx.amount).toFixed(2)}`,
                    relatedTransactionId: tx.id,
                    relatedTransactionType: 'MANUAL',
                    relatedAmount: tx.amount,
                    scheduledFor: txDate
                }
            });

            // Marca que as notificações foram criadas
            tx.notificationsCreated = true;
            await tx.save();
        }

        return { created: pendingTransactions.length };
    } catch (error) {
        console.error('Error creating payment notifications:', error);
        throw error;
    }
};

/**
 * GET /notifications
 * Lista notificações pendentes do usuário
 */
const list = async (req, res) => {
    try {
        const { unreadOnly } = req.query;
        const today = new Date();

        const where = {
            userId: req.user.id,
            scheduledFor: { [Op.lte]: today }
        };

        if (unreadOnly === 'true') {
            where.isRead = false;
        }

        const notifications = await Notification.findAll({
            where,
            order: [['scheduledFor', 'DESC']],
            limit: 50
        });

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error('Error listing notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar notificações'
        });
    }
};

/**
 * GET /notifications/pending
 * Retorna notificações que devem ser exibidas como popup
 */
const getPending = async (req, res) => {
    try {
        const today = new Date();

        const notifications = await Notification.findAll({
            where: {
                userId: req.user.id,
                scheduledFor: { [Op.lte]: today },
                isDisplayed: false
            },
            order: [['scheduledFor', 'ASC']],
            limit: 5
        });

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error('Error getting pending notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar notificações pendentes'
        });
    }
};

/**
 * PUT /notifications/:id/displayed
 * Marca notificação como exibida
 */
const markDisplayed = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOne({
            where: { id, userId: req.user.id }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }

        notification.isDisplayed = true;
        notification.displayedAt = new Date();
        await notification.save();

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification displayed:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar notificação'
        });
    }
};

/**
 * PUT /notifications/:id/read
 * Marca notificação como lida
 */
const markRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOne({
            where: { id, userId: req.user.id }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }

        notification.isRead = true;
        notification.readAt = new Date();
        notification.isDisplayed = true;
        notification.displayedAt = notification.displayedAt || new Date();
        await notification.save();

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar notificação'
        });
    }
};

/**
 * POST /notifications/check
 * Verifica e cria notificações pendentes para o usuário
 */
const check = async (req, res) => {
    try {
        const result = await createPaymentNotifications(req.user.id);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error checking notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar notificações'
        });
    }
};

module.exports = {
    createPaymentNotifications,
    list,
    getPending,
    markDisplayed,
    markRead,
    check
};
