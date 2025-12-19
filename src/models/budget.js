/**
 * Model Budget
 * Planejamento financeiro mensal
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Budget = sequelize.define('Budget', {
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
        // Perfil ao qual o orçamento pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Mês (1-12)
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            }
        },
        // Ano
        year: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 2020,
                max: 2100
            }
        },
        // Receita esperada
        incomeExpected: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Percentual para investimentos
        investPercent: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 30,
            validate: {
                min: 0,
                max: 100
            }
        },
        // Percentual para reserva de emergência
        emergencyPercent: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 10,
            validate: {
                min: 0,
                max: 100
            }
        },
        // Limite de gastos fixos
        fixedExpensesLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // Limite de gastos variáveis
        variableExpensesLimit: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true
        },
        // Observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'budgets',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['year', 'month'] },
            { fields: ['user_id', 'year', 'month'], unique: true }
        ]
    });

    // Métodos de instância

    /**
     * Calcula o valor recomendado para investimentos
     */
    Budget.prototype.getRecommendedInvestment = function () {
        return (parseFloat(this.incomeExpected) * parseFloat(this.investPercent)) / 100;
    };

    /**
     * Calcula o valor recomendado para reserva de emergência
     */
    Budget.prototype.getRecommendedEmergencyFund = function () {
        return (parseFloat(this.incomeExpected) * parseFloat(this.emergencyPercent)) / 100;
    };

    /**
     * Calcula o limite de gastos após investimentos e reserva
     */
    Budget.prototype.getSpendingLimit = function () {
        const income = parseFloat(this.incomeExpected);
        const investment = this.getRecommendedInvestment();
        const emergency = this.getRecommendedEmergencyFund();
        return income - investment - emergency;
    };

    return Budget;
};
