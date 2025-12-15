/**
 * Model OpenFinanceTransaction
 * ========================================
 * TRANSAÇÕES IMPORTADAS DO OPEN FINANCE
 * ========================================
 * 
 * ⚠️ IMUTÁVEL - READ ONLY
 * 
 * - Dados importados via Open Finance
 * - NÃO podem ser editados
 * - NÃO podem ser excluídos
 * - Representam a "fonte da verdade"
 * 
 * O usuário pode apenas:
 * - Categorizar (via TransactionMetadata)
 * - Adicionar tags (via TransactionMetadata)
 * - Adicionar observações (via TransactionMetadata)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OpenFinanceTransaction = sequelize.define('OpenFinanceTransaction', {
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
        consentId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'consents',
                key: 'id'
            }
        },
        // ID original do Open Finance (único)
        openFinanceId: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true
        },
        // Tipo da transação
        type: {
            type: DataTypes.ENUM('CREDIT', 'DEBIT'),
            allowNull: false
        },
        // Descrição original do banco - IMUTÁVEL
        description: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Valor - IMUTÁVEL
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Data - IMUTÁVEL
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Data e hora da transação
        transactionDateTime: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Referência ao cartão de crédito (se aplicável)
        relatedCardId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'credit_cards',
                key: 'id'
            }
        },
        // Referência à conta bancária (se aplicável)
        relatedAccountId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'bank_accounts',
                key: 'id'
            }
        },
        // Tipo de fonte (conta ou cartão)
        sourceType: {
            type: DataTypes.ENUM('ACCOUNT', 'CREDIT_CARD'),
            allowNull: false
        },
        // Dados brutos do Open Finance (para auditoria)
        rawData: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        // Data de importação
        importedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'open_finance_transactions',
        timestamps: true,
        // Bloquear updates - Dados são imutáveis
        hooks: {
            beforeUpdate: (transaction) => {
                // Apenas permite atualização de campos técnicos
                const allowedFields = ['updatedAt'];
                const changedFields = transaction.changed();

                if (changedFields) {
                    const forbiddenChanges = changedFields.filter(
                        field => !allowedFields.includes(field)
                    );

                    if (forbiddenChanges.length > 0) {
                        throw new Error(
                            `Transações Open Finance são imutáveis. Campos bloqueados: ${forbiddenChanges.join(', ')}`
                        );
                    }
                }
            },
            beforeDestroy: () => {
                throw new Error('Transações Open Finance não podem ser excluídas');
            }
        },
        indexes: [
            { fields: ['user_id'] },
            { fields: ['consent_id'] },
            { fields: ['open_finance_id'], unique: true },
            { fields: ['date'] },
            { fields: ['related_card_id'] },
            { fields: ['related_account_id'] },
            { fields: ['type'] }
        ]
    });

    return OpenFinanceTransaction;
};
