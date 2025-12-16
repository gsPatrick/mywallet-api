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
 * - Suporta transações futuras/agendadas
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
        // Status da transação (para agendados)
        status: {
            type: DataTypes.ENUM('PENDING', 'COMPLETED', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'COMPLETED'
        },
        // Fonte/método de pagamento
        source: {
            type: DataTypes.ENUM('PIX', 'CASH', 'WIRE_TRANSFER', 'BOLETO', 'SALARY', 'OTHER'),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        // Categoria
        categoryId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'categories',
                key: 'id'
            }
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
        // Data da transação (ou data de vencimento para PENDING)
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
        },
        // Dia do mês para recorrência mensal (1-31)
        recurringDay: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 31
            }
        },
        // Se as notificações já foram criadas para esta transação
        notificationsCreated: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'manual_transactions',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['date'] },
            { fields: ['type'] },
            { fields: ['source'] },
            { fields: ['status'] },
            { fields: ['category_id'] }
        ]
    });

    return ManualTransaction;
};
