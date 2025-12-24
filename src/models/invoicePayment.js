/**
 * Model InvoicePayment
 * ========================================
 * PAGAMENTOS DE FATURA
 * ========================================
 * 
 * Registra cada pagamento feito em uma fatura.
 * Suporta pagamento total, parcial, mínimo e antecipação.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InvoicePayment = sequelize.define('InvoicePayment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        invoiceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'card_invoices',
                key: 'id'
            }
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Conta de onde saiu o pagamento (opcional)
        bankAccountId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'bank_accounts',
                key: 'id'
            }
        },
        // Valor do pagamento
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Data do pagamento
        paymentDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Tipo de pagamento
        // FULL = Pagamento total
        // PARTIAL = Pagamento parcial (valor customizado)
        // MINIMUM = Pagamento mínimo (15%)
        // ADVANCE = Antecipação de fatura
        paymentType: {
            type: DataTypes.ENUM('FULL', 'PARTIAL', 'MINIMUM', 'ADVANCE'),
            allowNull: false
        },
        // Método de pagamento (para referência)
        paymentMethod: {
            type: DataTypes.ENUM('PIX', 'BOLETO', 'DEBITO', 'TRANSFERENCIA', 'DINHEIRO', 'OUTRO'),
            allowNull: true,
            defaultValue: 'PIX'
        },
        // Notas/observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'invoice_payments',
        timestamps: true,
        indexes: [
            { fields: ['invoice_id'] },
            { fields: ['user_id'] },
            { fields: ['bank_account_id'] },
            { fields: ['payment_date'] },
            { fields: ['payment_type'] }
        ]
    });

    return InvoicePayment;
};
