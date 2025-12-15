/**
 * Model Dividend
 * Proventos (dividendos, JCP, rendimentos)
 * ========================================
 * 
 * Registra todos os proventos recebidos:
 * - Dividendos de ações
 * - Juros sobre Capital Próprio
 * - Rendimentos de FIIs
 * - Amortizações
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Dividend = sequelize.define('Dividend', {
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
        assetId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'assets',
                key: 'id'
            }
        },
        // Tipo de provento
        type: {
            type: DataTypes.ENUM('DIVIDEND', 'JCP', 'RENDIMENTO', 'AMORTIZACAO', 'BONUS', 'OTHER'),
            allowNull: false
        },
        // Valor bruto por unidade
        amountPerUnit: {
            type: DataTypes.DECIMAL(15, 8),
            allowNull: false
        },
        // Quantidade de ativos na data-com
        quantity: {
            type: DataTypes.DECIMAL(15, 8),
            allowNull: false
        },
        // Valor total bruto
        grossAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Imposto retido na fonte (IR)
        withholdingTax: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Valor líquido recebido
        netAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Data-com (data de corte)
        exDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Data de pagamento
        paymentDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        // Status
        status: {
            type: DataTypes.ENUM('ANNOUNCED', 'PENDING', 'RECEIVED'),
            allowNull: false,
            defaultValue: 'RECEIVED'
        },
        // Observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Origem do dado (rastreabilidade)
        origin: {
            type: DataTypes.ENUM('MANUAL', 'BROKER_STATEMENT', 'API'),
            allowNull: false,
            defaultValue: 'MANUAL'
        }
    }, {
        tableName: 'dividends',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['asset_id'] },
            { fields: ['type'] },
            { fields: ['ex_date'] },
            { fields: ['payment_date'] },
            { fields: ['status'] }
        ]
    });

    return Dividend;
};
