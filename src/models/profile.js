/**
 * Model Profile
 * ========================================
 * MULTI-TENANT PROFILE SYSTEM
 * ========================================
 * 
 * - Perfis PERSONAL (PF) e BUSINESS (PJ)
 * - Isolamento total de dados financeiros
 * - Um usuário pode ter múltiplos perfis
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Profile = sequelize.define('Profile', {
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
        // Tipo do perfil
        type: {
            type: DataTypes.ENUM('PERSONAL', 'BUSINESS'),
            allowNull: false,
            defaultValue: 'PERSONAL'
        },
        // Subtipo (apenas para BUSINESS)
        subtype: {
            type: DataTypes.ENUM('MEI', 'ME'),
            allowNull: true
        },
        // Nome do perfil
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Nome do perfil é obrigatório' }
            }
        },
        // Documento (CPF ou CNPJ)
        document: {
            type: DataTypes.STRING(18),
            allowNull: true,
            comment: 'CPF ou CNPJ formatado'
        },
        // Moeda padrão
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'BRL'
        },
        // Perfil padrão ao logar
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Configurações específicas (DAS, metas, etc)
        settings: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: {},
            comment: 'Config: dueDay (DAS), revenueGoal, etc'
        },
        // Limite de faturamento (MEI = 81000)
        revenueLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            comment: 'Limite anual de faturamento (MEI: 81000)'
        },
        // Faturamento acumulado no ano
        yearlyRevenue: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0,
            comment: 'Faturamento acumulado do ano atual'
        },
        // Ícone do perfil
        icon: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: null,
            comment: 'Emoji ou nome de ícone'
        },
        // Cor do perfil
        color: {
            type: DataTypes.STRING(7),
            allowNull: true,
            defaultValue: '#6366f1'
        }
    }, {
        tableName: 'profiles',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['type'] },
            { fields: ['is_default'] },
            { unique: true, fields: ['user_id', 'type'] } // Um perfil por tipo por usuário
        ]
    });

    Profile.associate = (models) => {
        Profile.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        // Profile tem muitos dados financeiros
        Profile.hasMany(models.ManualTransaction, {
            foreignKey: 'profileId',
            as: 'manualTransactions'
        });
        Profile.hasMany(models.Category, {
            foreignKey: 'profileId',
            as: 'categories'
        });
        Profile.hasMany(models.Goal, {
            foreignKey: 'profileId',
            as: 'goals'
        });
        Profile.hasMany(models.Budget, {
            foreignKey: 'profileId',
            as: 'budgets'
        });
        Profile.hasMany(models.CreditCard, {
            foreignKey: 'profileId',
            as: 'creditCards'
        });
        Profile.hasMany(models.Subscription, {
            foreignKey: 'profileId',
            as: 'subscriptions'
        });
        Profile.hasMany(models.BudgetAllocation, {
            foreignKey: 'profileId',
            as: 'budgetAllocations'
        });
        Profile.hasMany(models.Investment, {
            foreignKey: 'profileId',
            as: 'investments'
        });
        Profile.hasMany(models.BankAccount, {
            foreignKey: 'profileId',
            as: 'bankAccounts'
        });
    };

    return Profile;
};
