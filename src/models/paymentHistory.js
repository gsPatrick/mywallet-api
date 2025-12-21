/**
 * Model PaymentHistory
 * ========================================
 * HISTÓRICO DE PAGAMENTOS (SaaS)
 * ========================================
 * 
 * Registra todos os pagamentos recebidos
 * Para cálculo de MRR, faturamento total, etc.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PaymentHistory = sequelize.define('PaymentHistory', {
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
        // Valor pago
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        // Status do pagamento
        status: {
            type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED'),
            allowNull: false,
            defaultValue: 'PENDING'
        },
        // Método de pagamento
        method: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'credit_card, pix, boleto, etc'
        },
        // Tipo de plano comprado
        planType: {
            type: DataTypes.ENUM('MONTHLY', 'ANNUAL', 'LIFETIME'),
            allowNull: false
        },
        // ID do pagamento no Mercado Pago
        mpPaymentId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        },
        // ID da assinatura no Mercado Pago (se recorrente)
        mpSubscriptionId: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Dados adicionais do MP
        mpData: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: 'Dados completos do Mercado Pago'
        },
        // Data do pagamento
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'payment_history',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['status'] },
            { fields: ['plan_type'] },
            { fields: ['mp_payment_id'] }
        ]
    });

    PaymentHistory.associate = (models) => {
        PaymentHistory.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
    };

    return PaymentHistory;
};
