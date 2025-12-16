/**
 * Medals Data
 * Definição de todas as medalhas do sistema
 */

const medals = [
    // ========================
    // MILESTONE - Tempo de uso
    // ========================
    {
        code: 'first_access',
        name: 'Primeiro Passo',
        description: 'Acesse o MyWallet pela primeira vez',
        category: 'milestone',
        icon: 'star',
        rarity: 'bronze',
        requirement: 'firstAccess',
        requirementValue: 1,
        xpReward: 10,
        order: 1
    },
    {
        code: 'week_streak',
        name: 'Uma Semana Firme',
        description: 'Use o MyWallet por 7 dias',
        category: 'milestone',
        icon: 'calendar',
        rarity: 'bronze',
        requirement: 'memberDays',
        requirementValue: 7,
        xpReward: 25,
        order: 2
    },
    {
        code: 'month_user',
        name: 'Usuário do Mês',
        description: 'Use o MyWallet por 1 mês',
        category: 'milestone',
        icon: 'calendar',
        rarity: 'silver',
        requirement: 'memberDays',
        requirementValue: 30,
        xpReward: 50,
        order: 3
    },
    {
        code: 'year_user',
        name: 'Veterano',
        description: 'Use o MyWallet por 1 ano',
        category: 'milestone',
        icon: 'award',
        rarity: 'gold',
        requirement: 'memberDays',
        requirementValue: 365,
        xpReward: 200,
        order: 4
    },
    {
        code: 'five_years',
        name: 'Lenda Financeira',
        description: 'Use o MyWallet por 5 anos',
        category: 'milestone',
        icon: 'award',
        rarity: 'platinum',
        requirement: 'memberDays',
        requirementValue: 1825,
        xpReward: 500,
        order: 5
    },
    {
        code: 'ten_years',
        name: 'Imortal',
        description: 'Use o MyWallet por 10 anos',
        category: 'milestone',
        icon: 'crown',
        rarity: 'diamond',
        requirement: 'memberDays',
        requirementValue: 3650,
        xpReward: 1000,
        order: 6
    },

    // ========================
    // SPECIAL - Medalhas Especiais
    // ========================
    {
        code: 'system_owner',
        name: 'Criador do MyWallet',
        description: 'O visionário que criou este sistema',
        category: 'social',
        icon: 'crown',
        rarity: 'diamond',
        requirement: 'isOwner',
        requirementValue: 1,
        xpReward: 9999,
        order: 100
    },
    {
        code: 'first_user',
        name: 'Pioneiro',
        description: 'Primeiro usuário registrado no MyWallet',
        category: 'social',
        icon: 'flag',
        rarity: 'diamond',
        requirement: 'isFirstUser',
        requirementValue: 1,
        xpReward: 500,
        order: 101
    },
    {
        code: 'beta_tester',
        name: 'Beta Tester',
        description: 'Testou o MyWallet na fase beta',
        category: 'social',
        icon: 'zap',
        rarity: 'platinum',
        requirement: 'isBetaTester',
        requirementValue: 1,
        xpReward: 300,
        order: 102
    },

    // ========================
    // PATRIMONY - Patrimônio
    // ========================
    {
        code: '10k_club',
        name: '10K Club',
        description: 'Alcance R$ 10.000 em patrimônio',
        category: 'patrimony',
        icon: 'dollar-sign',
        rarity: 'bronze',
        requirement: 'totalPatrimony',
        requirementValue: 10000,
        xpReward: 50,
        order: 10
    },
    {
        code: '50k_club',
        name: '50K Club',
        description: 'Alcance R$ 50.000 em patrimônio',
        category: 'patrimony',
        icon: 'dollar-sign',
        rarity: 'silver',
        requirement: 'totalPatrimony',
        requirementValue: 50000,
        xpReward: 100,
        order: 11
    },
    {
        code: '100k_club',
        name: '100K Club',
        description: 'Alcance R$ 100.000 em patrimônio',
        category: 'patrimony',
        icon: 'trending-up',
        rarity: 'gold',
        requirement: 'totalPatrimony',
        requirementValue: 100000,
        xpReward: 200,
        order: 12
    },
    {
        code: '500k_club',
        name: 'Meio Milhão',
        description: 'Alcance R$ 500.000 em patrimônio',
        category: 'patrimony',
        icon: 'trending-up',
        rarity: 'platinum',
        requirement: 'totalPatrimony',
        requirementValue: 500000,
        xpReward: 500,
        order: 13
    },
    {
        code: 'millionaire',
        name: 'Milionário',
        description: 'Alcance R$ 1.000.000 em patrimônio',
        category: 'patrimony',
        icon: 'award',
        rarity: 'diamond',
        requirement: 'totalPatrimony',
        requirementValue: 1000000,
        xpReward: 1000,
        order: 14
    },

    // ========================
    // INVESTMENT - Investimentos
    // ========================
    {
        code: 'first_investment',
        name: 'Investidor Iniciante',
        description: 'Registre seu primeiro investimento',
        category: 'investment',
        icon: 'pie-chart',
        rarity: 'bronze',
        requirement: 'totalAssets',
        requirementValue: 1,
        xpReward: 25,
        order: 20
    },
    {
        code: 'diversified_5',
        name: 'Diversificador',
        description: 'Tenha 5 ativos diferentes',
        category: 'investment',
        icon: 'pie-chart',
        rarity: 'silver',
        requirement: 'totalAssets',
        requirementValue: 5,
        xpReward: 75,
        order: 21
    },
    {
        code: 'diversified_10',
        name: 'Diversificador Pro',
        description: 'Tenha 10 ativos diferentes',
        category: 'investment',
        icon: 'pie-chart',
        rarity: 'gold',
        requirement: 'totalAssets',
        requirementValue: 10,
        xpReward: 150,
        order: 22
    },

    // ========================
    // CONSISTENCY - Constância
    // ========================
    {
        code: 'streak_7',
        name: 'Constante',
        description: 'Mantenha 7 dias de sequência',
        category: 'consistency',
        icon: 'zap',
        rarity: 'bronze',
        requirement: 'streak',
        requirementValue: 7,
        xpReward: 30,
        order: 30
    },
    {
        code: 'streak_30',
        name: 'Disciplinado',
        description: 'Mantenha 30 dias de sequência',
        category: 'consistency',
        icon: 'zap',
        rarity: 'silver',
        requirement: 'streak',
        requirementValue: 30,
        xpReward: 100,
        order: 31
    },
    {
        code: 'streak_100',
        name: 'Imbatível',
        description: 'Mantenha 100 dias de sequência',
        category: 'consistency',
        icon: 'zap',
        rarity: 'gold',
        requirement: 'streak',
        requirementValue: 100,
        xpReward: 300,
        order: 32
    },

    // ========================
    // SAVING - Metas
    // ========================
    {
        code: 'first_goal',
        name: 'Sonhador',
        description: 'Crie sua primeira meta financeira',
        category: 'saving',
        icon: 'target',
        rarity: 'bronze',
        requirement: 'totalGoals',
        requirementValue: 1,
        xpReward: 20,
        order: 40
    },
    {
        code: 'goal_complete',
        name: 'Realizador',
        description: 'Complete uma meta financeira',
        category: 'saving',
        icon: 'check-circle',
        rarity: 'silver',
        requirement: 'completedGoals',
        requirementValue: 1,
        xpReward: 75,
        order: 41
    },
    {
        code: 'goal_master',
        name: 'Mestre das Metas',
        description: 'Complete 5 metas financeiras',
        category: 'saving',
        icon: 'check-circle',
        rarity: 'gold',
        requirement: 'completedGoals',
        requirementValue: 5,
        xpReward: 200,
        order: 42
    }
];

module.exports = medals;
