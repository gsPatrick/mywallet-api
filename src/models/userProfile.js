/**
 * Model UserProfile
 * Perfil do usuário com gamificação
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserProfile = sequelize.define('UserProfile', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Avatar
        avatarSkinTone: {
            type: DataTypes.ENUM('branco', 'pardo', 'negro', 'indigena', 'asiatico'),
            defaultValue: 'pardo'
        },
        avatarGender: {
            type: DataTypes.ENUM('masculino', 'feminino'),
            defaultValue: 'masculino'
        },
        // Stats
        totalPatrimony: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0
        },
        totalProfitability: {
            type: DataTypes.DECIMAL(10, 4),
            defaultValue: 0
        },
        totalDividends: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0
        },
        // Assets count
        totalAssets: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        assetTypes: {
            type: DataTypes.JSON,
            defaultValue: {}
        },
        // Gamification
        level: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        xp: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        streak: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        maxStreak: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        // Activity
        lastActiveAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        totalTransactions: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        // Goals
        totalGoals: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        completedGoals: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        // Open Finance
        connectedBanks: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        connectedCards: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'user_profiles',
        timestamps: true
    });

    UserProfile.associate = (models) => {
        UserProfile.belongsTo(models.User, {
            foreignKey: 'userId',
            as: 'user'
        });
        UserProfile.hasMany(models.UserMedal, {
            foreignKey: 'userId',
            sourceKey: 'userId',
            as: 'medals'
        });
    };

    // Calculate level from XP
    UserProfile.prototype.calculateLevel = function () {
        // 100 XP per level, increasing by 50 each level
        let xpNeeded = 0;
        let level = 1;
        while (xpNeeded <= this.xp) {
            xpNeeded += 100 + (level - 1) * 50;
            if (xpNeeded <= this.xp) level++;
        }
        return level;
    };

    // XP needed for next level
    UserProfile.prototype.xpForNextLevel = function () {
        let xpNeeded = 0;
        for (let l = 1; l <= this.level; l++) {
            xpNeeded += 100 + (l - 1) * 50;
        }
        return xpNeeded;
    };

    return UserProfile;
};
