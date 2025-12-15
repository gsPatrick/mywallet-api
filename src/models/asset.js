/**
 * Model Asset
 * Ativos da B3 (Ações, FIIs, ETFs)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Asset = sequelize.define('Asset', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Código do ativo (ex: PETR4, MXRF11)
        ticker: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            validate: {
                notEmpty: { msg: 'Ticker é obrigatório' },
                isUppercase: { msg: 'Ticker deve ser em maiúsculas' }
            }
        },
        // Nome do ativo
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // Tipo do ativo (APENAS B3)
        type: {
            type: DataTypes.ENUM('STOCK', 'FII', 'ETF', 'BDR'),
            allowNull: false
        },
        // Setor (para ações)
        sector: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Segmento
        segment: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // CNPJ do fundo (para FIIs)
        cnpj: {
            type: DataTypes.STRING(18),
            allowNull: true
        },
        // Ativo está listado na B3?
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'assets',
        timestamps: true,
        indexes: [
            { fields: ['ticker'], unique: true },
            { fields: ['type'] }
        ]
    });

    return Asset;
};
