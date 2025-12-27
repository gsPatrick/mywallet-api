/**
 * Model BankAccount
 * Contas bancárias manuais ou importadas do Open Finance
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
            allowNull: false, // CHANGED: Now required for profile isolation
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Fonte da conta: Manual, Open Finance ou Automática (Sistema)
        source: {
            type: DataTypes.ENUM('MANUAL', 'OPEN_FINANCE', 'AUTO'),
            allowNull: false,
            defaultValue: 'MANUAL'
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
        // Apelido da conta (ex: "Conta Principal", "Reserva de Emergência")
        nickname: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Cor do banco (para UI, do cardBanks.json)
        color: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        // Ícone/logo do banco (URL do cardBanks.json)
        icon: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Tipo de conta
        type: {
            type: DataTypes.ENUM(
                'CONTA_CORRENTE',
                'CONTA_POUPANCA',
                'CONTA_PAGAMENTO',
                'CONTA_SALARIO',
                'CARTEIRA', // For general wallet
                'CORRETORA' // Investment account
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
            allowNull: false,
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
        },
        // Conta padrão para o perfil (pré-selecionada em novas transações)
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'bank_accounts',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['profile_id'] },
            { fields: ['consent_id'] },
            { fields: ['open_finance_id'], unique: true }
        ]
    });

    return BankAccount;
};
