/**
 * Setting Model
 * ========================================
 * Armazena configurações do sistema (key-value)
 * Usado para salvar IDs de planos do MP, etc.
 * ========================================
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Setting = sequelize.define('Setting', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
            // comment removido para evitar erro de sintaxe no PostgreSQL durante sync
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Valor da configuração'
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'general',
            comment: 'Categoria (ex: mercadopago, system)'
        }
    }, {
        tableName: 'settings',
        timestamps: true,
        underscored: true
    });

    return Setting;
};
