/**
 * Model GoalHistory
 * Histórico de transações das metas (depósitos/retiradas)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const GoalHistory = sequelize.define('GoalHistory', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        goalId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'goals',
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
        // Valor da transação
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Tipo: DEPOSIT (adicionar) ou WITHDRAW (retirar)
        type: {
            type: DataTypes.ENUM('DEPOSIT', 'WITHDRAW'),
            allowNull: false
        },
        // Data da transação
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        // Motivo/Descrição opcional
        reason: {
            type: DataTypes.STRING(255),
            allowNull: true
        }
    }, {
        tableName: 'goal_history',
        timestamps: true,
        indexes: [
            { fields: ['goal_id'] },
            { fields: ['user_id'] },
            { fields: ['date'] }
        ]
    });

    return GoalHistory;
};
