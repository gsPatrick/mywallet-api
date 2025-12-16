/**
 * Medals Seed Data
 * 50 medals for gamification system
 */

const medals = [
    // ===========================================
    // PATRIMONY (10)
    // ===========================================
    {
        code: 'first_asset',
        name: 'Primeiro Patrimônio',
        description: 'Registre seu primeiro ativo',
        category: 'patrimony',
        icon: 'briefcase',
        rarity: 'bronze',
        requirement: 'totalAssets >= 1',
        requirementValue: 1,
        xpReward: 10,
        order: 1
    },
    {
        code: '10k_club',
        name: '10K Club',
        description: 'Alcance R$ 10.000 em patrimônio',
        category: 'patrimony',
        icon: 'trending-up',
        rarity: 'bronze',
        requirement: 'totalPatrimony >= 10000',
        requirementValue: 10000,
        xpReward: 50,
        order: 2
    },
    {
        code: '50k_club',
        name: '50K Club',
        description: 'Alcance R$ 50.000 em patrimônio',
        category: 'patrimony',
        icon: 'trending-up',
        rarity: 'silver',
        requirement: 'totalPatrimony >= 50000',
        requirementValue: 50000,
        xpReward: 100,
        order: 3
    },
    {
        code: '100k_club',
        name: '100K Club',
        description: 'Alcance R$ 100.000 em patrimônio',
        category: 'patrimony',
        icon: 'award',
        rarity: 'gold',
        requirement: 'totalPatrimony >= 100000',
        requirementValue: 100000,
        xpReward: 200,
        order: 4
    },
    {
        code: '500k_club',
        name: 'Meio Milhão',
        description: 'Alcance R$ 500.000 em patrimônio',
        category: 'patrimony',
        icon: 'award',
        rarity: 'platinum',
        requirement: 'totalPatrimony >= 500000',
        requirementValue: 500000,
        xpReward: 500,
        order: 5
    },
    {
        code: 'millionaire',
        name: 'Milionário',
        description: 'Alcance R$ 1.000.000 em patrimônio',
        category: 'patrimony',
        icon: 'star',
        rarity: 'diamond',
        requirement: 'totalPatrimony >= 1000000',
        requirementValue: 1000000,
        xpReward: 1000,
        order: 6
    },
    {
        code: 'diversified',
        name: 'Diversificado',
        description: 'Tenha 5 tipos de ativos diferentes',
        category: 'patrimony',
        icon: 'pie-chart',
        rarity: 'silver',
        requirement: 'assetTypes >= 5',
        requirementValue: 5,
        xpReward: 75,
        order: 7
    },
    {
        code: 'global_portfolio',
        name: 'Portfólio Global',
        description: 'Tenha BDRs internacionais',
        category: 'patrimony',
        icon: 'globe',
        rarity: 'silver',
        requirement: 'hasBDR',
        requirementValue: 1,
        xpReward: 50,
        order: 8
    },
    {
        code: 'passive_income',
        name: 'Renda Passiva',
        description: 'Receba seu primeiro dividendo',
        category: 'patrimony',
        icon: 'dollar-sign',
        rarity: 'bronze',
        requirement: 'totalDividends >= 1',
        requirementValue: 1,
        xpReward: 25,
        order: 9
    },
    {
        code: 'dividend_king',
        name: 'Dividendo Gordo',
        description: 'Receba R$ 1.000 em dividendos',
        category: 'patrimony',
        icon: 'dollar-sign',
        rarity: 'gold',
        requirement: 'totalDividends >= 1000',
        requirementValue: 1000,
        xpReward: 150,
        order: 10
    },

    // ===========================================
    // INVESTMENT (10)
    // ===========================================
    {
        code: 'stock_beginner',
        name: 'Iniciante em Ações',
        description: 'Compre sua primeira ação',
        category: 'investment',
        icon: 'bar-chart-2',
        rarity: 'bronze',
        requirement: 'hasStock',
        requirementValue: 1,
        xpReward: 15,
        order: 11
    },
    {
        code: 'fii_day_one',
        name: 'Day One FII',
        description: 'Compre seu primeiro FII',
        category: 'investment',
        icon: 'home',
        rarity: 'bronze',
        requirement: 'hasFII',
        requirementValue: 1,
        xpReward: 15,
        order: 12
    },
    {
        code: 'etf_explorer',
        name: 'ETF Explorer',
        description: 'Compre seu primeiro ETF',
        category: 'investment',
        icon: 'layers',
        rarity: 'bronze',
        requirement: 'hasETF',
        requirementValue: 1,
        xpReward: 15,
        order: 13
    },
    {
        code: 'fixed_income_fan',
        name: 'Renda Fixa Fan',
        description: 'Adicione renda fixa',
        category: 'investment',
        icon: 'shield',
        rarity: 'bronze',
        requirement: 'hasRendaFixa',
        requirementValue: 1,
        xpReward: 15,
        order: 14
    },
    {
        code: 'crypto_curious',
        name: 'Crypto Curious',
        description: 'Adicione criptomoeda',
        category: 'investment',
        icon: 'cpu',
        rarity: 'bronze',
        requirement: 'hasCrypto',
        requirementValue: 1,
        xpReward: 15,
        order: 15
    },
    {
        code: '10_assets',
        name: '10 Ativos',
        description: 'Tenha 10 ativos diferentes',
        category: 'investment',
        icon: 'grid',
        rarity: 'silver',
        requirement: 'totalAssets >= 10',
        requirementValue: 10,
        xpReward: 50,
        order: 16
    },
    {
        code: '25_assets',
        name: '25 Ativos',
        description: 'Diversificação avançada',
        category: 'investment',
        icon: 'grid',
        rarity: 'gold',
        requirement: 'totalAssets >= 25',
        requirementValue: 25,
        xpReward: 100,
        order: 17
    },
    {
        code: '50_assets',
        name: '50 Ativos',
        description: 'Portfólio de elite',
        category: 'investment',
        icon: 'grid',
        rarity: 'platinum',
        requirement: 'totalAssets >= 50',
        requirementValue: 50,
        xpReward: 200,
        order: 18
    },
    {
        code: 'positive_return',
        name: 'Rentabilidade Positiva',
        description: 'Tenha rentabilidade positiva',
        category: 'investment',
        icon: 'trending-up',
        rarity: 'silver',
        requirement: 'totalProfitability > 0',
        requirementValue: 0.01,
        xpReward: 50,
        order: 19
    },
    {
        code: 'super_return',
        name: 'Super Rentabilidade',
        description: 'Rentabilidade acima de 20%',
        category: 'investment',
        icon: 'zap',
        rarity: 'gold',
        requirement: 'totalProfitability >= 20',
        requirementValue: 20,
        xpReward: 150,
        order: 20
    },

    // ===========================================
    // SAVING (10)
    // ===========================================
    {
        code: 'first_goal',
        name: 'Primeira Meta',
        description: 'Crie sua primeira meta',
        category: 'saving',
        icon: 'target',
        rarity: 'bronze',
        requirement: 'totalGoals >= 1',
        requirementValue: 1,
        xpReward: 15,
        order: 21
    },
    {
        code: '5_goals',
        name: '5 Metas',
        description: 'Tenha 5 metas ativas',
        category: 'saving',
        icon: 'target',
        rarity: 'silver',
        requirement: 'totalGoals >= 5',
        requirementValue: 5,
        xpReward: 50,
        order: 22
    },
    {
        code: 'goal_complete',
        name: 'Meta Concluída',
        description: 'Complete uma meta',
        category: 'saving',
        icon: 'check-circle',
        rarity: 'silver',
        requirement: 'completedGoals >= 1',
        requirementValue: 1,
        xpReward: 75,
        order: 23
    },
    {
        code: '5_goals_complete',
        name: '5 Metas Completas',
        description: 'Complete 5 metas',
        category: 'saving',
        icon: 'check-circle',
        rarity: 'gold',
        requirement: 'completedGoals >= 5',
        requirementValue: 5,
        xpReward: 150,
        order: 24
    },
    {
        code: 'budget_created',
        name: 'Orçamento Criado',
        description: 'Configure seu orçamento',
        category: 'saving',
        icon: 'clipboard',
        rarity: 'bronze',
        requirement: 'hasBudget',
        requirementValue: 1,
        xpReward: 20,
        order: 25
    },
    {
        code: 'saver',
        name: 'Economizador',
        description: 'Gaste menos que o orçado',
        category: 'saving',
        icon: 'piggy-bank',
        rarity: 'silver',
        requirement: 'monthsOnBudget >= 1',
        requirementValue: 1,
        xpReward: 50,
        order: 26
    },
    {
        code: 'super_saver',
        name: 'Super Economizador',
        description: '3 meses consecutivos na meta',
        category: 'saving',
        icon: 'piggy-bank',
        rarity: 'gold',
        requirement: 'monthsOnBudget >= 3',
        requirementValue: 3,
        xpReward: 100,
        order: 27
    },
    {
        code: 'budget_master',
        name: 'Mestre do Orçamento',
        description: '6 meses consecutivos na meta',
        category: 'saving',
        icon: 'award',
        rarity: 'platinum',
        requirement: 'monthsOnBudget >= 6',
        requirementValue: 6,
        xpReward: 200,
        order: 28
    },
    {
        code: 'first_deposit',
        name: 'Primeiro Depósito',
        description: 'Faça seu primeiro depósito',
        category: 'saving',
        icon: 'plus-circle',
        rarity: 'bronze',
        requirement: 'hasDeposit',
        requirementValue: 1,
        xpReward: 10,
        order: 29
    },
    {
        code: 'regular_saving',
        name: 'Poupança Regular',
        description: 'Deposite por 3 meses seguidos',
        category: 'saving',
        icon: 'repeat',
        rarity: 'silver',
        requirement: 'consecutiveDeposits >= 3',
        requirementValue: 3,
        xpReward: 75,
        order: 30
    },

    // ===========================================
    // CONSISTENCY (10)
    // ===========================================
    {
        code: 'first_login',
        name: 'Primeiro Login',
        description: 'Faça login no sistema',
        category: 'consistency',
        icon: 'log-in',
        rarity: 'bronze',
        requirement: 'streak >= 1',
        requirementValue: 1,
        xpReward: 5,
        order: 31
    },
    {
        code: 'streak_7',
        name: '7 Dias Ativo',
        description: 'Acesse 7 dias seguidos',
        category: 'consistency',
        icon: 'calendar',
        rarity: 'bronze',
        requirement: 'streak >= 7',
        requirementValue: 7,
        xpReward: 25,
        order: 32
    },
    {
        code: 'streak_30',
        name: '30 Dias Ativo',
        description: 'Acesse 30 dias seguidos',
        category: 'consistency',
        icon: 'calendar',
        rarity: 'silver',
        requirement: 'streak >= 30',
        requirementValue: 30,
        xpReward: 75,
        order: 33
    },
    {
        code: 'streak_60',
        name: 'Veterano 60',
        description: 'Acesse 60 dias seguidos',
        category: 'consistency',
        icon: 'calendar',
        rarity: 'gold',
        requirement: 'streak >= 60',
        requirementValue: 60,
        xpReward: 150,
        order: 34
    },
    {
        code: 'streak_100',
        name: 'Mestre 100',
        description: 'Acesse 100 dias seguidos',
        category: 'consistency',
        icon: 'zap',
        rarity: 'platinum',
        requirement: 'streak >= 100',
        requirementValue: 100,
        xpReward: 300,
        order: 35
    },
    {
        code: 'streak_365',
        name: 'Lendário 365',
        description: 'Acesse 365 dias seguidos',
        category: 'consistency',
        icon: 'star',
        rarity: 'diamond',
        requirement: 'streak >= 365',
        requirementValue: 365,
        xpReward: 1000,
        order: 36
    },
    {
        code: 'transaction_tracker',
        name: 'Registrador',
        description: 'Registre uma transação manual',
        category: 'consistency',
        icon: 'edit',
        rarity: 'bronze',
        requirement: 'totalTransactions >= 1',
        requirementValue: 1,
        xpReward: 10,
        order: 37
    },
    {
        code: '50_transactions',
        name: '50 Transações',
        description: 'Registre 50 transações',
        category: 'consistency',
        icon: 'file-text',
        rarity: 'silver',
        requirement: 'totalTransactions >= 50',
        requirementValue: 50,
        xpReward: 50,
        order: 38
    },
    {
        code: '100_transactions',
        name: '100 Transações',
        description: 'Registre 100 transações',
        category: 'consistency',
        icon: 'file-text',
        rarity: 'gold',
        requirement: 'totalTransactions >= 100',
        requirementValue: 100,
        xpReward: 100,
        order: 39
    },
    {
        code: '500_transactions',
        name: '500 Transações',
        description: 'Registre 500 transações',
        category: 'consistency',
        icon: 'database',
        rarity: 'platinum',
        requirement: 'totalTransactions >= 500',
        requirementValue: 500,
        xpReward: 250,
        order: 40
    },

    // ===========================================
    // SOCIAL (5)
    // ===========================================
    {
        code: 'profile_complete',
        name: 'Perfil Completo',
        description: 'Complete seu perfil',
        category: 'social',
        icon: 'user-check',
        rarity: 'bronze',
        requirement: 'profileComplete',
        requirementValue: 1,
        xpReward: 20,
        order: 41
    },
    {
        code: 'avatar_customized',
        name: 'Avatar Personalizado',
        description: 'Personalize seu avatar',
        category: 'social',
        icon: 'smile',
        rarity: 'bronze',
        requirement: 'avatarCustomized',
        requirementValue: 1,
        xpReward: 10,
        order: 42
    },
    {
        code: 'open_finance_connected',
        name: 'Open Finance',
        description: 'Conecte uma conta via Open Finance',
        category: 'social',
        icon: 'link',
        rarity: 'silver',
        requirement: 'connectedBanks >= 1',
        requirementValue: 1,
        xpReward: 50,
        order: 43
    },
    {
        code: 'multi_bank',
        name: 'Multi-Banco',
        description: 'Conecte 3 bancos diferentes',
        category: 'social',
        icon: 'link-2',
        rarity: 'gold',
        requirement: 'connectedBanks >= 3',
        requirementValue: 3,
        xpReward: 100,
        order: 44
    },
    {
        code: 'card_connected',
        name: 'Cartão Conectado',
        description: 'Conecte um cartão de crédito',
        category: 'social',
        icon: 'credit-card',
        rarity: 'bronze',
        requirement: 'connectedCards >= 1',
        requirementValue: 1,
        xpReward: 25,
        order: 45
    },

    // ===========================================
    // MILESTONE (5)
    // ===========================================
    {
        code: 'member_1_month',
        name: '1 Mês de Membro',
        description: 'Complete 1 mês de uso',
        category: 'milestone',
        icon: 'clock',
        rarity: 'bronze',
        requirement: 'memberDays >= 30',
        requirementValue: 30,
        xpReward: 25,
        order: 46
    },
    {
        code: 'member_6_months',
        name: '6 Meses de Membro',
        description: 'Complete 6 meses de uso',
        category: 'milestone',
        icon: 'clock',
        rarity: 'silver',
        requirement: 'memberDays >= 180',
        requirementValue: 180,
        xpReward: 75,
        order: 47
    },
    {
        code: 'member_1_year',
        name: '1 Ano de Membro',
        description: 'Complete 1 ano de uso',
        category: 'milestone',
        icon: 'award',
        rarity: 'gold',
        requirement: 'memberDays >= 365',
        requirementValue: 365,
        xpReward: 200,
        order: 48
    },
    {
        code: 'level_5',
        name: 'Nível 5',
        description: 'Alcance nível 5',
        category: 'milestone',
        icon: 'chevrons-up',
        rarity: 'silver',
        requirement: 'level >= 5',
        requirementValue: 5,
        xpReward: 50,
        order: 49
    },
    {
        code: 'level_10',
        name: 'Nível 10',
        description: 'Alcance nível 10',
        category: 'milestone',
        icon: 'chevrons-up',
        rarity: 'gold',
        requirement: 'level >= 10',
        requirementValue: 10,
        xpReward: 100,
        order: 50
    }
];

module.exports = medals;
