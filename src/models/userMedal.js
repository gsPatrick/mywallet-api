/**
 * Model UserMedal
 * Medalhas conquistadas pelo usuário
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserMedal = sequelize.define('UserMedal', {
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
        medalId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'medals',
                key: 'id'
            }
        },
        progress: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        isComplete: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        unlockedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        notified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'user_medals',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['userId', 'medalId']
            }
        ]
    });

    UserMedal.associate = (models) => {
        UserMedal.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        UserMedal.belongsTo(models.Medal, {
            foreignKey: 'medalId',
            as: 'medal'
        });
    };

    return UserMedal;
};
