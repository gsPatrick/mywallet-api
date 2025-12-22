/**
 * Model DasGuide
 * ========================================
 * CENTRAL DO DAS - Guias de Impostos MEI/ME
 * ========================================
 * 
 * Guias mensais do DAS (Documento de Arrecadação do Simples Nacional)
 * Exclusivo para perfis BUSINESS
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DasGuide = sequelize.define('DasGuide', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        profileId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'profiles',
                key: 'id'
            },
            comment: 'Perfil BUSINESS (MEI/ME) dono da guia'
        },
        // Competência
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            },
            comment: 'Mês de competência (1-12)'
        },
        year: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Ano de competência'
        },
        // Valores
        baseValue: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Valor original do DAS (sem juros/multa)'
        },
        finalPaidValue: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Valor real pago (com juros/multa se houver)'
        },
        // Datas
        dueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: 'Data de vencimento da guia'
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Data/hora do pagamento'
        },
        // Status
        status: {
            type: DataTypes.ENUM('PENDING', 'PAID', 'OVERDUE'),
            allowNull: false,
            defaultValue: 'PENDING'
        },
        // Vínculo com conta bancária (de onde saiu o dinheiro)
        bankAccountId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'bank_accounts',
                key: 'id'
            },
            comment: 'Conta bancária usada para pagamento'
        },
        // Vínculo com transação gerada
        transactionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'manual_transactions',
                key: 'id'
            },
            comment: 'Transação de despesa gerada pelo pagamento'
        }
    }, {
        tableName: 'das_guides',
        timestamps: true,
        indexes: [
            { fields: ['profile_id'] },
            { fields: ['year'] },
            { fields: ['status'] },
            { unique: true, fields: ['profile_id', 'month', 'year'] } // Uma guia por mês/ano por perfil
        ]
    });

    DasGuide.associate = (models) => {
        DasGuide.belongsTo(models.Profile, {
            foreignKey: 'profileId',
            as: 'profile'
        });
        DasGuide.belongsTo(models.BankAccount, {
            foreignKey: 'bankAccountId',
            as: 'bankAccount'
        });
        DasGuide.belongsTo(models.ManualTransaction, {
            foreignKey: 'transactionId',
            as: 'transaction'
        });
    };

    return DasGuide;
};
