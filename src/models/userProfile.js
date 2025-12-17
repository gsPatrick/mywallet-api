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
        },
        // Display badge - medalha exibida ao lado do nome
        displayBadge: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'ID da medalha exibida ao lado do nome do usuário'
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

    /**
     * Calculate level from XP (max level 100)
     * NOVA CURVA PROGRESSIVA: XP = 100 * (level ^ 1.5)
     * Nível 10: ~3.200 XP | Nível 25: ~12.500 XP | Nível 50: ~35.000 XP | Nível 100: ~100.000 XP
     */
    UserProfile.prototype.calculateLevel = function () {
        let totalXpNeeded = 0;
        let level = 1;
        const MAX_LEVEL = 100;

        while (level < MAX_LEVEL) {
            // Curva progressiva: 100 * level^1.5
            const xpForThisLevel = Math.floor(100 * Math.pow(level, 1.5));
            totalXpNeeded += xpForThisLevel;

            if (this.xp >= totalXpNeeded) {
                level++;
            } else {
                break;
            }
        }
        return Math.min(level, MAX_LEVEL);
    };

    /**
     * XP needed for next level
     */
    UserProfile.prototype.xpForNextLevel = function () {
        const MAX_LEVEL = 100;
        const currentLevel = this.calculateLevel();

        if (currentLevel >= MAX_LEVEL) {
            return this.xp; // Max level reached
        }

        // Calculate total XP needed for current level
        let xpNeeded = 0;
        for (let l = 1; l <= currentLevel; l++) {
            xpNeeded += Math.floor(100 * Math.pow(l, 1.5));
        }
        return xpNeeded;
    };

    /**
     * Get level tier name
     */
    UserProfile.prototype.getLevelTier = function () {
        const level = this.calculateLevel();
        const tiers = [
            { max: 10, name: 'Iniciante', color: '#22c55e' },
            { max: 20, name: 'Aprendiz', color: '#3b82f6' },
            { max: 30, name: 'Intermediário', color: '#8b5cf6' },
            { max: 40, name: 'Avançado', color: '#ec4899' },
            { max: 50, name: 'Expert', color: '#f97316' },
            { max: 60, name: 'Mestre', color: '#eab308' },
            { max: 70, name: 'Grão-Mestre', color: '#ef4444' },
            { max: 80, name: 'Elite', color: '#14b8a6' },
            { max: 90, name: 'Lenda', color: '#f59e0b' },
            { max: 100, name: 'Imortal', color: '#a855f7' }
        ];

        return tiers.find(t => level <= t.max) || tiers[tiers.length - 1];
    };

    return UserProfile;
};
