const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Asset = sequelize.define('Asset', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        ticker: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // NOVO CAMPO: URL da Logo
        logoUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        type: {
            type: DataTypes.ENUM('STOCK', 'FII', 'ETF', 'BDR'),
            allowNull: false
        },
        sector: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
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
            // Índice para busca rápida no autocomplete
            { fields: ['name'] }
        ]
    });

    return Asset;
};