/**
 * Model CreditCard
 * Cartões de crédito importados do Open Finance
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CreditCard = sequelize.define('CreditCard', {
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
        // Perfil ao qual o cartão pertence (isolamento multi-contexto)
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
        // ID do cartão no Open Finance
        openFinanceId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        },
        // Fonte do cartão: Open Finance ou Manual
        source: {
            type: DataTypes.ENUM('OPEN_FINANCE', 'MANUAL'),
            allowNull: false,
            defaultValue: 'MANUAL'
        },
        // Cartão virtual?
        isVirtual: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Cor do cartão (para UI)
        color: {
            type: DataTypes.STRING(7),
            allowNull: true,
            defaultValue: '#1E40AF'
        },
        bankName: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // Bandeira do cartão
        brand: {
            type: DataTypes.ENUM(
                'VISA',
                'MASTERCARD',
                'ELO',
                'AMEX',
                'HIPERCARD',
                'DINERS',
                'OTHER'
            ),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        // Últimos 4 dígitos (para identificação)
        lastFourDigits: {
            type: DataTypes.STRING(4),
            allowNull: true
        },
        // Nome do cartão (apelido)
        name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Nome do titular do cartão
        holderName: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Ícone/logo do banco (URL)
        bankIcon: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Ícone/logo da bandeira (URL)
        brandIcon: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Limite total
        creditLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // Limite disponível
        availableLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // Limite bloqueado (reservado, não quer usar)
        blockedLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            defaultValue: 0
        },
        // Dia de fechamento da fatura
        closingDay: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 31
            }
        },
        // Dia de vencimento da fatura
        dueDay: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {
                min: 1,
                max: 31
            }
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
        // Status
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'credit_cards',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['consent_id'] },
            { fields: ['open_finance_id'], unique: true }
        ]
    });

    return CreditCard;
};
