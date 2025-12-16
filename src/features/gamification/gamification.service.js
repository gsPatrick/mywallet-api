/**
 * Gamification Service
 * Lógica de negócio para gamificação
 */

const {
    User,
    UserProfile,
    Medal,
    UserMedal,
    Investment,
    Goal,
    ManualTransaction,
    Consent,
    CreditCard,
    Dividend
} = require('../../models');
const { Op } = require('sequelize');

/**
 * Obtém ou cria perfil do usuário
 */
const getOrCreateProfile = async (userId) => {
    let profile = await UserProfile.findOne({
        where: { userId },
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'createdAt'] }]
    });

    if (!profile) {
        profile = await UserProfile.create({ userId });
        profile = await UserProfile.findOne({
            where: { userId },
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'createdAt'] }]
        });
    }

    // Calculate level
    const level = profile.calculateLevel();
    const xpForNext = profile.xpForNextLevel();

    return {
        ...profile.toJSON(),
        level,
        xpForNextLevel: xpForNext,
        xpProgress: ((profile.xp / xpForNext) * 100).toFixed(1)
    };
};

/**
 * Atualiza perfil do usuário
 */
const updateProfile = async (userId, data) => {
    const { avatarSkinTone, avatarGender, name } = data;

    // Update UserProfile
    if (avatarSkinTone || avatarGender) {
        await UserProfile.update(
            {
                avatarSkinTone: avatarSkinTone || undefined,
                avatarGender: avatarGender || undefined
            },
            { where: { userId } }
        );
    }

    // Update User name
    if (name) {
        await User.update({ name }, { where: { id: userId } });
    }

    return getOrCreateProfile(userId);
};

/**
 * Altera senha do usuário
 */
const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new Error('Usuário não encontrado');
    }

    const isValid = await user.checkPassword(currentPassword);
    if (!isValid) {
        throw new Error('Senha atual incorreta');
    }

    user.password = newPassword;
    await user.save();
};

/**
 * Calcula estatísticas do usuário
 */
const calculateStats = async (userId) => {
    const user = await User.findByPk(userId);

    // Get investments
    const investments = await Investment.findAll({ where: { userId } });
    const totalPatrimony = investments.reduce((sum, inv) => sum + parseFloat(inv.currentValue || 0), 0);
    const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.totalInvested || 0), 0);
    const profitability = totalInvested > 0 ? ((totalPatrimony - totalInvested) / totalInvested * 100) : 0;

    // Get unique asset types
    const assetTypes = [...new Set(investments.map(inv => inv.assetType))].filter(Boolean);

    // Get goals
    const goals = await Goal.findAll({ where: { userId } });
    const completedGoals = goals.filter(g => g.status === 'completed').length;

    // Get transactions count
    const transactionCount = await ManualTransaction.count({ where: { userId } });

    // Get connected banks/cards (with error handling)
    let consents = 0;
    let cards = 0;
    try {
        consents = await Consent.count({ where: { userId, status: 'AUTHORIZED' } });
    } catch (e) {
        console.warn('Could not count consents:', e.message);
    }
    try {
        cards = await CreditCard.count({ where: { userId } });
    } catch (e) {
        console.warn('Could not count cards:', e.message);
    }

    // Get dividends
    let totalDividends = 0;
    try {
        const dividends = await Dividend.findAll({ where: { userId } });
        totalDividends = dividends.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    } catch (e) {
        console.warn('Could not get dividends:', e.message);
    }

    // Update profile with stats
    await UserProfile.update({
        totalPatrimony,
        totalProfitability: profitability,
        totalAssets: investments.length,
        assetTypes: assetTypes.reduce((obj, type) => ({ ...obj, [type]: true }), {}),
        totalGoals: goals.length,
        completedGoals,
        totalTransactions: transactionCount,
        connectedBanks: consents,
        connectedCards: cards,
        totalDividends
    }, { where: { userId } });

    return {
        totalPatrimony,
        totalProfitability: profitability,
        totalAssets: investments.length,
        assetTypes,
        totalGoals: goals.length,
        completedGoals,
        totalTransactions: transactionCount,
        connectedBanks: consents,
        connectedCards: cards,
        totalDividends,
        memberSince: user.createdAt,
        memberDays: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
    };
};

/**
 * Obtém medalhas com progresso
 */
const getMedalsWithProgress = async (userId) => {
    const medals = await Medal.findAll({ order: [['order', 'ASC']] });
    const userMedals = await UserMedal.findAll({ where: { userId } });

    const userMedalMap = userMedals.reduce((map, um) => {
        map[um.medalId] = um;
        return map;
    }, {});

    return medals.map(medal => ({
        ...medal.toJSON(),
        isComplete: userMedalMap[medal.id]?.isComplete || false,
        progress: userMedalMap[medal.id]?.progress || 0,
        unlockedAt: userMedalMap[medal.id]?.unlockedAt || null
    }));
};

/**
 * Verifica e desbloqueia novas medalhas
 */
const checkAndUnlockMedals = async (userId) => {
    const stats = await calculateStats(userId);
    const profile = await UserProfile.findOne({ where: { userId } });
    const medals = await Medal.findAll();
    const newlyUnlocked = [];

    for (const medal of medals) {
        // Check if already unlocked
        let userMedal = await UserMedal.findOne({
            where: { userId, medalId: medal.id }
        });

        if (userMedal?.isComplete) continue;

        // Calculate progress based on requirement
        let progress = 0;
        let isComplete = false;

        // Parse requirement and check
        const req = medal.requirement;
        const val = parseFloat(medal.requirementValue);

        if (req.includes('totalPatrimony')) {
            progress = (stats.totalPatrimony / val) * 100;
            isComplete = stats.totalPatrimony >= val;
        } else if (req.includes('totalAssets')) {
            progress = (stats.totalAssets / val) * 100;
            isComplete = stats.totalAssets >= val;
        } else if (req.includes('streak')) {
            progress = (profile.streak / val) * 100;
            isComplete = profile.streak >= val;
        } else if (req.includes('totalGoals')) {
            progress = (stats.totalGoals / val) * 100;
            isComplete = stats.totalGoals >= val;
        } else if (req.includes('completedGoals')) {
            progress = (stats.completedGoals / val) * 100;
            isComplete = stats.completedGoals >= val;
        } else if (req.includes('totalTransactions')) {
            progress = (stats.totalTransactions / val) * 100;
            isComplete = stats.totalTransactions >= val;
        } else if (req.includes('connectedBanks')) {
            progress = (stats.connectedBanks / val) * 100;
            isComplete = stats.connectedBanks >= val;
        } else if (req.includes('totalDividends')) {
            progress = (stats.totalDividends / val) * 100;
            isComplete = stats.totalDividends >= val;
        } else if (req.includes('level')) {
            const level = profile.calculateLevel();
            progress = (level / val) * 100;
            isComplete = level >= val;
        } else if (req.includes('memberDays')) {
            progress = (stats.memberDays / val) * 100;
            isComplete = stats.memberDays >= val;
        } else if (req.includes('totalProfitability')) {
            if (req.includes('> 0')) {
                isComplete = stats.totalProfitability > 0;
                progress = isComplete ? 100 : 0;
            } else {
                progress = (stats.totalProfitability / val) * 100;
                isComplete = stats.totalProfitability >= val;
            }
        } else if (req.includes('assetTypes')) {
            progress = (stats.assetTypes.length / val) * 100;
            isComplete = stats.assetTypes.length >= val;
        } else if (req === 'firstAccess') {
            // First access is always complete
            isComplete = true;
            progress = 100;
        } else if (req === 'isOwner') {
            // Check if user email is owner (Patrick)
            const user = await User.findByPk(userId);
            isComplete = user?.email === 'patrick@gmail.com' || user?.email === 'patrick123@gmail.com';
            progress = isComplete ? 100 : 0;
        } else if (req === 'isFirstUser') {
            // Check if user is the first registered
            const firstUser = await User.findOne({ order: [['createdAt', 'ASC']] });
            isComplete = firstUser?.id === userId;
            progress = isComplete ? 100 : 0;
        } else if (req === 'isBetaTester') {
            // Beta testers: registered before 2025-02-01
            const user = await User.findByPk(userId);
            const betaEndDate = new Date('2025-02-01');
            isComplete = user && new Date(user.createdAt) < betaEndDate;
            progress = isComplete ? 100 : 0;
        } else if (req.includes('has')) {
            // Check for specific asset types
            const typeChecks = {
                hasStock: stats.assetTypes.includes('STOCK'),
                hasFII: stats.assetTypes.includes('FII'),
                hasETF: stats.assetTypes.includes('ETF'),
                hasBDR: stats.assetTypes.includes('BDR'),
                hasRendaFixa: stats.assetTypes.includes('RENDA_FIXA'),
                hasCrypto: stats.assetTypes.includes('CRYPTO')
            };
            const checkKey = req.trim();
            isComplete = typeChecks[checkKey] || false;
            progress = isComplete ? 100 : 0;
        }

        progress = Math.min(progress, 100);

        // Track if was already complete before
        const wasComplete = userMedal?.isComplete || false;

        // Create or update user medal
        if (!userMedal) {
            userMedal = await UserMedal.create({
                userId,
                medalId: medal.id,
                progress,
                isComplete,
                unlockedAt: isComplete ? new Date() : null
            });
        } else {
            await userMedal.update({
                progress,
                isComplete,
                unlockedAt: isComplete && !userMedal.unlockedAt ? new Date() : userMedal.unlockedAt
            });
        }

        // If newly completed (wasn't complete before, now is), add XP and track
        if (isComplete && !wasComplete) {
            await profile.update({ xp: profile.xp + medal.xpReward });
            newlyUnlocked.push({
                ...medal.toJSON(),
                unlockedAt: new Date()
            });
        }
    }

    return newlyUnlocked;
};

/**
 * Registra atividade e atualiza streak
 */
const registerActivity = async (userId) => {
    const profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) return getOrCreateProfile(userId);

    const now = new Date();
    const lastActive = profile.lastActiveAt ? new Date(profile.lastActiveAt) : null;

    // Check if it's a new day
    const isNewDay = !lastActive ||
        now.toDateString() !== lastActive.toDateString();

    if (isNewDay) {
        // Check if streak continues (within 24-48 hours)
        const hoursSinceLastActive = lastActive
            ? (now - lastActive) / (1000 * 60 * 60)
            : 999;

        let newStreak = profile.streak;
        if (hoursSinceLastActive > 48) {
            // Streak broken
            newStreak = 1;
        } else if (hoursSinceLastActive > 24) {
            // Continue streak
            newStreak = profile.streak + 1;
        }

        await profile.update({
            streak: newStreak,
            maxStreak: Math.max(profile.maxStreak, newStreak),
            lastActiveAt: now
        });
    }

    return getOrCreateProfile(userId);
};

/**
 * Obtém medalhas não notificadas
 */
const getUnnotifiedMedals = async (userId) => {
    const userMedals = await UserMedal.findAll({
        where: {
            userId,
            isComplete: true,
            notified: false
        },
        include: [{ model: Medal, as: 'medal' }]
    });

    return userMedals.map(um => um.medal);
};

/**
 * Marca medalha como notificada
 */
const markMedalAsNotified = async (userId, medalId) => {
    await UserMedal.update(
        { notified: true },
        { where: { userId, medalId } }
    );
};

/**
 * Seed medals from medalsData.js
 */
const seedMedals = async () => {
    try {
        const medalsData = require('./medalsData');

        for (const medalData of medalsData) {
            const [medal, created] = await Medal.findOrCreate({
                where: { code: medalData.code },
                defaults: medalData
            });

            if (!created) {
                // Update existing medal
                await medal.update(medalData);
            }
        }

        console.log(`✅ ${medalsData.length} medalhas sincronizadas`);
    } catch (error) {
        console.error('Erro ao sincronizar medalhas:', error);
    }
};

/**
 * Atualiza medalhas em destaque do usuário
 */
const updateFeaturedMedals = async (userId, medalIds) => {
    await UserProfile.update(
        { featuredMedals: medalIds.slice(0, 5) },
        { where: { userId } }
    );
    return getOrCreateProfile(userId);
};

module.exports = {
    getOrCreateProfile,
    updateProfile,
    changePassword,
    calculateStats,
    getMedalsWithProgress,
    checkAndUnlockMedals,
    registerActivity,
    getUnnotifiedMedals,
    markMedalAsNotified,
    seedMedals,
    updateFeaturedMedals
};
