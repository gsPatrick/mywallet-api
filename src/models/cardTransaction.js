/**
 * Model CardTransaction
 * Transações de cartão de crédito MANUAL
 * ========================================
 * 
 * Diferente de OpenFinanceTransaction:
 * - Totalmente editável
 * - Suporta parcelamento
 * - Suporta recorrência
 * - Vinculado a cartão manual
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CardTransaction = sequelize.define('CardTransaction', {
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
        cardId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'credit_cards',
                key: 'id'
            }
        },
        // Referência à assinatura (se for de assinatura)
        subscriptionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'subscriptions',
                key: 'id'
            }
        },
        // Descrição da transação
        description: {
            type: DataTypes.STRING(500),
            allowNull: false
        },
        // Valor total (ou valor da parcela)
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Data da transação
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Categoria
        category: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Subcategoria
        subcategory: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // ========================================
        // PARCELAMENTO
        // ========================================
        isInstallment: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Número da parcela atual
        installmentNumber: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        // Total de parcelas
        totalInstallments: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        // Valor total da compra (antes de parcelar)
        totalAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // ID do grupo de parcelas (para vincular todas)
        installmentGroupId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        // ========================================
        // RECORRÊNCIA
        // ========================================
        isRecurring: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        recurringFrequency: {
            type: DataTypes.ENUM('WEEKLY', 'MONTHLY', 'YEARLY'),
            allowNull: true
        },
        // ========================================
        // STATUS E CONTROLE
        // ========================================
        status: {
            type: DataTypes.ENUM('PENDING', 'PAID', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'PENDING'
        },
        // Observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Tags para organização
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: []
        }
    }, {
        tableName: 'card_transactions',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['card_id'] },
            { fields: ['subscription_id'] },
            { fields: ['date'] },
            { fields: ['category'] },
            { fields: ['installment_group_id'] },
            { fields: ['status'] }
        ]
    });

    return CardTransaction;
};
