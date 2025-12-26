/**
 * Model FIIData
 * Cache de dados completos de FIIs do Funds Explorer
 * ==================================================
 * 
 * VERSÃO ATUALIZADA - Inclui todas as métricas para análise de investimentos:
 * - Indicadores de preço (preço atual, P/VP)
 * - Indicadores de dividendos (DY mensal, DY anual, histórico)
 * - Indicadores de liquidez (volume diário, nº cotistas)
 * - Informações qualitativas (segmento, patrimônio)
 * - Métricas derivadas (tendência, consistência)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const FIIData = sequelize.define('FIIData', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // ========================================
        // IDENTIFICAÇÃO
        // ========================================
        ticker: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        segment: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'Segmento do FII: Logística, Shopping, Papel, etc'
        },

        // ========================================
        // INDICADORES DE PREÇO
        // ========================================
        price: {
            type: DataTypes.DECIMAL(15, 4),
            allowNull: true,
            comment: 'Preço atual da cota'
        },
        priceSource: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: 'Fonte do preço: selector, fallback'
        },
        pvp: {
            type: DataTypes.DECIMAL(8, 4),
            allowNull: true,
            comment: 'Preço sobre Valor Patrimonial'
        },
        equityValue: {
            type: DataTypes.DECIMAL(15, 4),
            allowNull: true,
            comment: 'Valor Patrimonial por cota'
        },

        // ========================================
        // INDICADORES DE PATRIMÔNIO
        // ========================================
        netWorth: {
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            comment: 'Patrimônio Líquido total do fundo'
        },

        // ========================================
        // INDICADORES DE LIQUIDEZ
        // ========================================
        dailyLiquidity: {
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true,
            comment: 'Liquidez média diária em R$'
        },
        shareholders: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Número de cotistas'
        },

        // ========================================
        // INDICADORES DE DIVIDENDOS
        // ========================================
        lastDividend: {
            type: DataTypes.DECIMAL(15, 8),
            allowNull: true,
            comment: 'Valor do último dividendo por cota'
        },
        lastDividendDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Data do último dividendo'
        },
        dividendYieldMonth: {
            type: DataTypes.DECIMAL(8, 4),
            allowNull: true,
            comment: 'DY do último dividendo (%)'
        },
        dividendYieldYear: {
            type: DataTypes.DECIMAL(8, 4),
            allowNull: true,
            comment: 'DY anual - 12 meses móveis (%)'
        },
        annualDividendSum: {
            type: DataTypes.DECIMAL(15, 6),
            allowNull: true,
            comment: 'Soma dos dividendos dos últimos 12 meses'
        },
        dividendCount12m: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Quantidade de dividendos nos últimos 12 meses'
        },
        dividendHistory: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [],
            comment: 'Histórico de dividendos (até 24 registros)'
        },

        // ========================================
        // MÉTRICAS DERIVADAS (ANÁLISE)
        // ========================================
        dividendTrend: {
            type: DataTypes.ENUM('RISING', 'STABLE', 'FALLING', 'UNKNOWN'),
            allowNull: true,
            defaultValue: 'UNKNOWN'
        },
        paymentConsistency: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Consistência de pagamentos (% meses pagos nos últimos 12)'
        },
        riskLevel: {
            type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'),
            allowNull: true,
            defaultValue: 'UNKNOWN'
        },
        pvpStatus: {
            type: DataTypes.ENUM('DISCOUNT', 'FAIR', 'PREMIUM', 'UNKNOWN'),
            allowNull: true,
            defaultValue: 'UNKNOWN'
        },

        // ========================================
        // CONTROLE DE SINCRONIZAÇÃO
        // ========================================
        lastSyncAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastSyncStatus: {
            type: DataTypes.ENUM('SUCCESS', 'ERROR', 'PENDING'),
            allowNull: false,
            defaultValue: 'PENDING'
        },
        lastSyncError: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        errorCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        tableName: 'fii_data',
        timestamps: true,
        indexes: [
            { fields: ['ticker'], unique: true },
            { fields: ['segment'] },
            { fields: ['dividend_yield_year'] },
            { fields: ['pvp'] },
            { fields: ['last_sync_at'] },
            { fields: ['last_sync_status'] }
        ]
    });

    return FIIData;
};
