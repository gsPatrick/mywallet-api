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
        },
        // Featured medals (up to 5 medal IDs to display on profile)
        featuredMedals: {
            type: DataTypes.JSON,
            defaultValue: []
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

    // Calculate level from XP (max level 100)
    // Curve: Level 1 = 50 XP, Level 2 = 70 XP, Level 10 = 150 XP, Level 50 = 550 XP, Level 100 = 1050 XP per level
    // Total to reach level 100: ~55,000 XP
    UserProfile.prototype.calculateLevel = function () {
        let xpNeeded = 0;
        let level = 1;
        const MAX_LEVEL = 100;

        while (xpNeeded <= this.xp && level < MAX_LEVEL) {
            const xpForThisLevel = 50 + level * 10; // Gentle curve
            xpNeeded += xpForThisLevel;
            if (xpNeeded <= this.xp) level++;
        }
        return Math.min(level, MAX_LEVEL);
    };

    // XP needed for next level
    UserProfile.prototype.xpForNextLevel = function () {
        const MAX_LEVEL = 100;
        if (this.level >= MAX_LEVEL) {
            // Already max level, return current XP as "goal"
            return this.xp;
        }

        let xpNeeded = 0;
        for (let l = 1; l <= this.level; l++) {
            xpNeeded += 50 + l * 10;
        }
        return xpNeeded;
    };

    return UserProfile;
};
