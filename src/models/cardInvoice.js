/**
 * Model CardInvoice
 * ========================================
 * FATURA DO CARTÃO DE CRÉDITO
 * ========================================
 * 
 * Representa uma fatura mensal do cartão.
 * Rastreia valor total, pagamentos e status.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CardInvoice = sequelize.define('CardInvoice', {
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
        cardId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'credit_cards',
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
        // Mês/Ano de referência da fatura
        referenceMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            }
        },
        referenceYear: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // Datas do ciclo
        closingDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        dueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Valores
        totalAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        paidAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Pagamento mínimo (15% do total)
        minimumPayment: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // Status da fatura
        // OPEN = Em aberto (antes do vencimento)
        // CLOSED = Fechada, aguardando pagamento
        // PAID = Totalmente paga
        // PARTIAL = Parcialmente paga
        // OVERDUE = Vencida sem pagamento total
        status: {
            type: DataTypes.ENUM('OPEN', 'CLOSED', 'PAID', 'PARTIAL', 'OVERDUE'),
            allowNull: false,
            defaultValue: 'OPEN'
        },
        // Data do pagamento completo
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Notas/observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'card_invoices',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['card_id'] },
            { fields: ['profile_id'] },
            { fields: ['reference_month', 'reference_year'] },
            { fields: ['status'] },
            { fields: ['due_date'] },
            // Unique constraint: one invoice per card per month
            {
                unique: true,
                fields: ['card_id', 'reference_month', 'reference_year']
            }
        ]
    });

    return CardInvoice;
};
