/**
 * Model Investment
 * Registro de operações de investimento do usuário
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Investment = sequelize.define('Investment', {
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
        // Perfil ao qual o investimento pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
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
        // Tipo de operação
        operationType: {
            type: DataTypes.ENUM('BUY', 'SELL'),
            allowNull: false
        },
        // Quantidade
        quantity: {
            type: DataTypes.DECIMAL(15, 8),
            allowNull: false,
            validate: {
                min: {
                    args: [0.00000001],
                    msg: 'Quantidade deve ser maior que zero'
                }
            }
        },
        // Preço unitário
        price: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            validate: {
                min: {
                    args: [0.01],
                    msg: 'Preço deve ser maior que zero'
                }
            }
        },
        // Taxa de corretagem
        brokerageFee: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Outras taxas (emolumentos, etc)
        otherFees: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Data da operação
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Corretora (string - fallback/legacy)
        broker: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Corretora (FK - nova referência)
        brokerId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'brokers',
                key: 'id'
            }
        },
        // Observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Conta Bancária/Corretora usada na transação (Origem/Destino dos fundos)
        bankAccountId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'bank_accounts',
                key: 'id'
            }
        }
    }, {
        tableName: 'investments',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['asset_id'] },
            { fields: ['date'] },
            { fields: ['operation_type'] }
        ]
    });

    // Métodos de instância

    /**
     * Calcula o valor total da operação (com taxas)
     */
    Investment.prototype.getTotalValue = function () {
        const baseValue = parseFloat(this.quantity) * parseFloat(this.price);
        const fees = parseFloat(this.brokerageFee) + parseFloat(this.otherFees);

        if (this.operationType === 'BUY') {
            return baseValue + fees;
        } else {
            return baseValue - fees;
        }
    };

    return Investment;
};
