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
 * - Suporta transferências internas entre perfis
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
        // Perfil ao qual a transação pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Conta bancária vinculada (obrigatório para novas transações manuais)
        bankAccountId: {
            type: DataTypes.UUID,
            allowNull: true, // Allow null for backward compatibility with existing data
            references: {
                model: 'bank_accounts',
                key: 'id'
            }
        },
        // ID da transação par (para INTERNAL_TRANSFER - liga as duas pontas)
        linkedTransferId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'manual_transactions',
                key: 'id'
            }
        },
        // Tipo da transação
        type: {
            type: DataTypes.ENUM('INCOME', 'EXPENSE', 'TRANSFER', 'INTERNAL_TRANSFER'),
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
            type: DataTypes.ENUM('PIX', 'CASH', 'WIRE_TRANSFER', 'BOLETO', 'SALARY', 'SUBSCRIPTION', 'OTHER'),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        // Link para assinatura (se gerada por subscription)
        subscriptionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'subscriptions',
                key: 'id'
            }
        },
        // Imagem/Ícone do produto (opcional)
        imageUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
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
            { fields: ['profile_id'] },
            { fields: ['bank_account_id'] },
            { fields: ['linked_transfer_id'] },
            { fields: ['date'] },
            { fields: ['type'] },
            { fields: ['source'] },
            { fields: ['status'] },
            { fields: ['category_id'] }
        ]
    });

    return ManualTransaction;
};
