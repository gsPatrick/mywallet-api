/**
 * Model Medal
 * Definições de medalhas do sistema
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Medal = sequelize.define('Medal', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        category: {
            type: DataTypes.ENUM('patrimony', 'investment', 'saving', 'consistency', 'social', 'milestone', 'special'),
            allowNull: false
        },
        icon: {
            type: DataTypes.STRING(50),
            defaultValue: 'trophy'
        },
        rarity: {
            type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond', 'ruby', 'emerald'),
            defaultValue: 'bronze'
        },
        requirement: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        requirementValue: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0
        },
        xpReward: {
            type: DataTypes.INTEGER,
            defaultValue: 10
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'medals',
        timestamps: true
    });

    Medal.associate = (models) => {
        Medal.hasMany(models.UserMedal, {
            foreignKey: 'medalId',
            as: 'userMedals'
        });
    };

    return Medal;
};
