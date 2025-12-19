/**
 * Model BankAccount
 * Contas bancárias importadas do Open Finance
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BankAccount = sequelize.define('BankAccount', {
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
        // Perfil ao qual a conta bancária pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        consentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'consents',
                key: 'id'
            }
        },
        // ID da conta no Open Finance
        openFinanceId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        },
        bankName: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        bankCode: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        // Tipo de conta
        type: {
            type: DataTypes.ENUM(
                'CONTA_CORRENTE',
                'CONTA_POUPANCA',
                'CONTA_PAGAMENTO',
                'CONTA_SALARIO'
            ),
            allowNull: false,
            defaultValue: 'CONTA_CORRENTE'
        },
        // Número da conta (mascarado)
        accountNumber: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        // Agência
        branchCode: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        // Saldo atual
        balance: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            defaultValue: 0
        },
        // Moeda
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'BRL'
        },
        // Data da última sincronização
        lastSyncAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Status da conta
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'bank_accounts',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['consent_id'] },
            { fields: ['open_finance_id'], unique: true }
        ]
    });

    return BankAccount;
};
