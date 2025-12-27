/**
 * Model NotificationPreference
 * ========================================
 * PREFERÊNCIAS DE NOTIFICAÇÕES DO USUÁRIO
 * ========================================
 * 
 * Permite o usuário configurar quais notificações quer receber
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NotificationPreference = sequelize.define('NotificationPreference', {
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
        // Notification type
        notificationType: {
            type: DataTypes.ENUM(
                // Pagamentos
                'PAYMENT_REMINDERS',      // Lembretes de pagamento
                'INCOME_REMINDERS',       // Lembretes de receita
                'INVOICE_REMINDERS',      // Lembretes de fatura
                // Investimentos
                'DIVIDENDS',              // Dividendos recebidos
                'INVESTMENT_ALERTS',      // Alertas de investimento
                // Metas e Orçamento
                'GOALS',                  // Progresso de metas
                'BUDGET_ALERTS',          // Alertas de orçamento
                'STREAK_ALERTS',          // Alertas de streak
                // MEI
                'DAS_REMINDERS',          // Lembretes de DAS
                // Sistema
                'MARKETING',              // Novidades e promoções
                'SECURITY_ALERTS',        // Alertas de segurança
                'WHATSAPP_MIRROR'         // Espelhar no WhatsApp
            ),
            allowNull: false
        },
        // Enabled flag
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        // Channel preference
        emailEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        pushEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        whatsappEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'notification_preferences',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['notification_type'] },
            { fields: ['user_id', 'notification_type'], unique: true }
        ]
    });

    return NotificationPreference;
};
