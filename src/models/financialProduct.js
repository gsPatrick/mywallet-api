/**
 * Model FinancialProduct
 * ========================================
 * Produtos financeiros NÃO listados na B3
 * - Renda Fixa (CDB, LCI, LCA, Tesouro)
 * - Crypto (Bitcoin, Ethereum, etc.)
 * - Outros (Consórcio, Previdência, etc.)
 * ========================================
 * 
 * SEPARAÇÃO CLARA:
 * - Asset → apenas ativos B3 (STOCK, FII, ETF, BDR)
 * - FinancialProduct → todo o resto
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const FinancialProduct = sequelize.define('FinancialProduct', {
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
        // Tipo do produto
        type: {
            type: DataTypes.ENUM('RENDA_FIXA', 'CRYPTO', 'PREVIDENCIA', 'CONSORCIO', 'OTHER'),
            allowNull: false
        },
        // Subtipo específico
        subtype: {
            type: DataTypes.STRING(100),
            allowNull: true
            // Exemplos: 'CDB', 'LCI', 'LCA', 'TESOURO_SELIC', 'BITCOIN', 'ETHEREUM'
        },
        // Nome do produto
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // Instituição/Corretora
        institution: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Valor investido (aporte total)
        investedAmount: {
            type: DataTypes.DECIMAL(20, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Valor atual (atualizado manualmente ou por extrato)
        currentValue: {
            type: DataTypes.DECIMAL(20, 2),
            allowNull: true
        },
        // Rentabilidade esperada/contratada (ex: 12.5 = 12.5% a.a.)
        expectedReturn: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: true
        },
        // Tipo de rentabilidade
        returnType: {
            type: DataTypes.ENUM('PREFIXADO', 'CDI', 'IPCA', 'SELIC', 'VARIAVEL', 'OTHER'),
            allowNull: true
        },
        // Indexador adicional (ex: CDI + 2%)
        indexerBonus: {
            type: DataTypes.DECIMAL(10, 4),
            allowNull: true
        },
        // Liquidez
        liquidity: {
            type: DataTypes.STRING(100),
            allowNull: true
            // Exemplos: 'D+0', 'D+1', '30 dias', 'No vencimento'
        },
        // Data de aplicação
        purchaseDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Data de vencimento (se aplicável)
        maturityDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        // Fonte do cálculo/valor
        calculationSource: {
            type: DataTypes.ENUM('MANUAL', 'BROKER_STATEMENT', 'API'),
            allowNull: false,
            defaultValue: 'MANUAL'
        },
        // Data da última atualização do valor
        lastValueUpdate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Status
        status: {
            type: DataTypes.ENUM('ACTIVE', 'MATURED', 'REDEEMED', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'ACTIVE'
        },
        // Observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Moeda
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'BRL'
        }
    }, {
        tableName: 'financial_products',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['type'] },
            { fields: ['status'] },
            { fields: ['maturity_date'] }
        ]
    });

    // Métodos de instância

    /**
     * Calcula lucro/prejuízo
     */
    FinancialProduct.prototype.getProfit = function () {
        if (!this.currentValue) return 0;
        return parseFloat(this.currentValue) - parseFloat(this.investedAmount);
    };

    /**
     * Calcula rentabilidade percentual
     */
    FinancialProduct.prototype.getProfitPercent = function () {
        if (!this.currentValue || parseFloat(this.investedAmount) === 0) return 0;
        return ((parseFloat(this.currentValue) - parseFloat(this.investedAmount)) / parseFloat(this.investedAmount)) * 100;
    };

    /**
     * Verifica se está vencido
     */
    FinancialProduct.prototype.isMatured = function () {
        if (!this.maturityDate) return false;
        return new Date(this.maturityDate) < new Date();
    };

    /**
     * Calcula dias até vencimento
     */
    FinancialProduct.prototype.getDaysToMaturity = function () {
        if (!this.maturityDate) return null;
        const today = new Date();
        const maturity = new Date(this.maturityDate);
        return Math.ceil((maturity - today) / (1000 * 60 * 60 * 24));
    };

    return FinancialProduct;
};
