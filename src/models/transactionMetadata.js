/**
 * Model TransactionMetadata
 * ========================================
 * CAMADA DO USUÁRIO PARA METADADOS
 * ========================================
 * 
 * Permite ao usuário adicionar:
 * - Categoria
 * - Tags
 * - Observações
 * 
 * SEM alterar os dados originais das transações
 * Vinculada por referência polimórfica
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TransactionMetadata = sequelize.define('TransactionMetadata', {
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
        // Referência polimórfica
        transactionType: {
            type: DataTypes.ENUM('OPEN_FINANCE', 'MANUAL'),
            allowNull: false
        },
        // ID da transação (OpenFinanceTransaction OU ManualTransaction)
        transactionId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        // Categoria definida pelo usuário
        category: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Subcategoria
        subcategory: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Tags para organização
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: []
        },
        // Observações do usuário
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Flag para transações ignoradas (não contar no dashboard)
        isIgnored: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Flag para transações marcadas como importante
        isImportant: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'transaction_metadata',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['transaction_type', 'transaction_id'], unique: true },
            { fields: ['category'] },
            { fields: ['tags'], using: 'gin' }
        ]
    });

    // Métodos estáticos

    /**
     * Busca ou cria metadata para uma transação
     */
    TransactionMetadata.findOrCreateForTransaction = async function (
        userId,
        transactionType,
        transactionId
    ) {
        const [metadata, created] = await this.findOrCreate({
            where: {
                userId,
                transactionType,
                transactionId
            },
            defaults: {
                userId,
                transactionType,
                transactionId
            }
        });
        return { metadata, created };
    };

    return TransactionMetadata;
};
