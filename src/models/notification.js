/**
 * Model Notification
 * ========================================
 * NOTIFICAÇÕES DO SISTEMA
 * ========================================
 * 
 * - Lembretes de pagamento (5 dias, 1 dia, no dia)
 * - Lembretes de recebimento
 * - Notificações gerais
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Notification = sequelize.define('Notification', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Tipo da notificação
        type: {
            type: DataTypes.ENUM(
                'PAYMENT_REMINDER_5D',  // 5 dias antes
                'PAYMENT_REMINDER_1D',  // 1 dia antes
                'PAYMENT_DUE',          // No dia
                'INCOME_REMINDER_5D',   // Receita 5 dias
                'INCOME_REMINDER_1D',   // Receita 1 dia
                'INCOME_DUE',           // Receita no dia
                'GENERAL'               // Geral
            ),
            allowNull: false
        },
        // Título da notificação
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // Mensagem
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // Referência à transação relacionada (opcional)
        relatedTransactionId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        // Tipo da transação relacionada
        relatedTransactionType: {
            type: DataTypes.ENUM('MANUAL', 'SUBSCRIPTION', 'CARD'),
            allowNull: true
        },
        // Valor relacionado (para exibição)
        relatedAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // Data agendada para exibição
        scheduledFor: {
            type: DataTypes.DATE,
            allowNull: false
        },
        // Se foi exibida
        isDisplayed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Data que foi exibida
        displayedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Se foi lida/dispensada
        isRead: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Data que foi lida
        readAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'notifications',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['scheduled_for'] },
            { fields: ['is_displayed'] },
            { fields: ['is_read'] },
            { fields: ['type'] }
        ]
    });

    return Notification;
};
