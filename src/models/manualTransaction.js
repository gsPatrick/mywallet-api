/**
 * Model ManualTransaction
 * ========================================
 * TRANSAÇÕES MANUAIS DO USUÁRIO
 * ========================================
 * 
 * ✅ TOTALMENTE EDITÁVEL
 * 
 * - Gastos inseridos manualmente
 * - PIX, dinheiro, transferências fora do Open Finance
 * - Podem ser editados
 * - Podem ser excluídos
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ManualTransaction = sequelize.define('ManualTransaction', {
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
        // Tipo da transação
        type: {
            type: DataTypes.ENUM('INCOME', 'EXPENSE', 'TRANSFER'),
            allowNull: false
        },
        // Fonte/método de pagamento
        source: {
            type: DataTypes.ENUM('PIX', 'CASH', 'WIRE_TRANSFER', 'BOLETO', 'OTHER'),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        // Descrição
        description: {
            type: DataTypes.STRING(500),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Descrição é obrigatória' }
            }
        },
        // Valor
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: {
                min: {
                    args: [0.01],
                    msg: 'Valor deve ser maior que zero'
                }
            }
        },
        // Data da transação
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Moeda
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'BRL'
        },
        // Recorrência
        isRecurring: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        recurringFrequency: {
            type: DataTypes.ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'),
            allowNull: true
        }
    }, {
        tableName: 'manual_transactions',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['date'] },
            { fields: ['type'] },
            { fields: ['source'] }
        ]
    });

    return ManualTransaction;
};
