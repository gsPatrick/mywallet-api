/**
 * Model Broker (Corretora de Investimentos)
 * ========================================
 * Entidade separada de BankAccount para gestão de corretoras
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Broker = sequelize.define('Broker', {
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
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Nome da corretora
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        // Código curto (XP, BTG, NUINVEST)
        code: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        // URL do logotipo
        logoUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Cor da marca
        color: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: '#8B5CF6'
        },
        // Ícone (para UI)
        icon: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'trending-up'
        },
        // Foco de investimento (texto livre)
        investmentFocus: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        // Corretora padrão criada pelo sistema
        isSystemDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Status ativo
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'brokers',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['profile_id'] },
            { fields: ['is_system_default'] },
            { fields: ['code'] }
        ]
    });

    return Broker;
};
