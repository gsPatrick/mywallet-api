/**
 * Model InvestmentSnapshot
 * Histórico de evolução patrimonial
 * ========================================
 * 
 * Registra snapshots mensais para:
 * - Gráficos de evolução
 * - Comparativos históricos
 * - Análise de performance ao longo do tempo
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InvestmentSnapshot = sequelize.define('InvestmentSnapshot', {
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
        // Mês do snapshot
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: { min: 1, max: 12 }
        },
        // Ano do snapshot
        year: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // Valor total investido (custo)
        totalCost: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Valor de mercado (com cotações do mês)
        marketValue: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Lucro/prejuízo acumulado
        profit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Rentabilidade percentual
        profitPercent: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: false,
            defaultValue: 0
        },
        // Aportes do mês
        contributions: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Resgates do mês
        withdrawals: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Proventos recebidos no mês
        dividends: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // ========================================
        // ALOCAÇÃO POR TIPO (snapshot)
        // ========================================
        allocationByType: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {}
            // Exemplo: { "STOCK": 50.5, "FII": 30, "ETF": 19.5 }
        },
        // Posições detalhadas no momento do snapshot
        positions: {
            type: DataTypes.JSONB,
            allowNull: true
            // Exemplo: [{ ticker: "PETR4", quantity: 100, price: 35.50, value: 3550 }]
        },
        // Valor de produtos financeiros (Renda Fixa, Crypto, etc.)
        financialProductsValue: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Fonte do cálculo (rastreabilidade)
        calculationSource: {
            type: DataTypes.ENUM('BRAPI', 'MANUAL', 'MIXED'),
            allowNull: false,
            defaultValue: 'BRAPI'
        }
    }, {
        tableName: 'investment_snapshots',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['year', 'month'] },
            { fields: ['user_id', 'year', 'month'], unique: true }
        ]
    });

    return InvestmentSnapshot;
};
