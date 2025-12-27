/**
 * Model PaymentMethod
 * ========================================
 * MÉTODOS DE PAGAMENTO DO USUÁRIO
 * ========================================
 * 
 * Armazena cartões e métodos de pagamento para assinatura
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PaymentMethod = sequelize.define('PaymentMethod', {
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
        // Payment type
        type: {
            type: DataTypes.ENUM('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO'),
            allowNull: false,
            defaultValue: 'CREDIT_CARD'
        },
        // Card info (tokenized)
        cardBrand: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'VISA, MASTERCARD, ELO, etc.'
        },
        cardLastFour: {
            type: DataTypes.STRING(4),
            allowNull: true,
            comment: 'Últimos 4 dígitos do cartão'
        },
        cardExpMonth: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: { min: 1, max: 12 }
        },
        cardExpYear: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        cardHolderName: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Gateway token
        gatewayToken: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'Token do cartão no gateway (Mercado Pago)'
        },
        gatewayCustomerId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'ID do cliente no gateway'
        },
        // Default flag
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Active flag
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'payment_methods',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['is_default'] },
            { fields: ['is_active'] }
        ]
    });

    return PaymentMethod;
};
