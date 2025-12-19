/**
 * Profile Service
 * ========================================
 * MULTI-CONTEXT PROFILE MANAGEMENT
 * ✅ DAS/Salário como Subscription
 * ========================================
 */

const { Profile, User, UserProfile, ManualTransaction, Subscription } = require('../../models');
const { Op } = require('sequelize');

class ProfileService {
    /**
     * Buscar todos os perfis de um usuário
     */
    async getProfiles(userId) {
        const profiles = await Profile.findAll({
            where: { userId },
            order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
        });
        return profiles;
    }

    /**
     * Buscar um perfil específico
     */
    async getProfile(profileId, userId) {
        const profile = await Profile.findOne({
            where: {
                id: profileId,
                userId
            }
        });
        return profile;
    }

    /**
     * Criar novo perfil
     */
    async createProfile(data) {
        const profile = await Profile.create(data);
        return profile;
    }

    /**
     * Atualizar perfil
     */
    async updateProfile(profileId, userId, data) {
        const profile = await Profile.findOne({
            where: { id: profileId, userId }
        });

        if (!profile) {
            throw new Error('Perfil não encontrado');
        }

        await profile.update(data);
        return profile;
    }

    /**
     * Definir perfil como padrão
     */
    async setDefaultProfile(profileId, userId) {
        await Profile.update(
            { isDefault: false },
            { where: { userId } }
        );

        await Profile.update(
            { isDefault: true },
            { where: { id: profileId, userId } }
        );

        return this.getProfile(profileId, userId);
    }

    /**
     * Calcular próxima data de vencimento
     */
    _getNextDueDate(dayOfMonth) {
        const today = new Date();
        const currentDay = today.getDate();
        const nextDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);

        if (dayOfMonth <= currentDay) {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }

        return nextDate.toISOString().split('T')[0];
    }

    /**
     * Setup inicial de perfis (onboarding)
     * ========================================
     * ✅ DAS/Salário como SUBSCRIPTIONS
     * ========================================
     */
    async setupProfiles(userId, setupData) {
        const { profileType, profiles: profilesData, defaultProfileType } = setupData;

        console.log('═══════════════════════════════════════════════════');
        console.log('🔧 [PROFILE SERVICE] SETUP PROFILES STARTED');
        console.log('═══════════════════════════════════════════════════');
        console.log('📋 userId:', userId);
        console.log('📋 profileType:', profileType);
        console.log('📋 defaultProfileType:', defaultProfileType);
        console.log('📋 profilesData:', JSON.stringify(profilesData, null, 2));

        const createdProfiles = [];

        // ========================================
        // CRIAR PERFIL PESSOAL
        // ========================================
        if (profileType === 'PERSONAL' || profileType === 'HYBRID') {
            const personalData = profilesData?.personal || {};
            console.log('👤 [SETUP] Creating PERSONAL profile...');

            try {
                const personalProfile = await Profile.create({
                    userId,
                    type: 'PERSONAL',
                    name: personalData.name || 'Minha Vida',
                    icon: '👤',
                    color: '#3B82F6',
                    isDefault: defaultProfileType === 'PERSONAL',
                    settings: {
                        salary: personalData.salary || null,
                        salaryDay: personalData.salaryDay || null,
                        salaryDescription: 'Salário',
                        initialBalance: personalData.initialBalance || 0
                    }
                });

                console.log('✅ [SETUP] Personal profile created:', personalProfile.id);

                // SALDO INICIAL
                const initialBalance = parseFloat(personalData.initialBalance) || 0;
                if (initialBalance > 0) {
                    await ManualTransaction.create({
                        userId,
                        profileId: personalProfile.id,
                        type: 'INCOME',
                        amount: initialBalance,
                        description: 'Saldo Inicial',
                        date: new Date(),
                        status: 'COMPLETED',
                        source: 'OTHER'
                    });
                    console.log('💰 [SETUP] Personal initial balance:', initialBalance);
                }

                // SALÁRIO COMO SUBSCRIPTION
                const salary = parseFloat(personalData.salary) || 0;
                if (salary > 0) {
                    const salaryDay = parseInt(personalData.salaryDay) || 5;
                    await Subscription.create({
                        userId,
                        profileId: personalProfile.id,
                        name: 'Salário',
                        description: 'Receita mensal de salário',
                        amount: salary,
                        frequency: 'MONTHLY',
                        startDate: this._getNextDueDate(salaryDay),
                        nextBillingDate: this._getNextDueDate(salaryDay),
                        category: 'Salário',
                        status: 'ACTIVE',
                        autoGenerate: false, // Não gera transação automática, apenas lembra
                        alertDaysBefore: 3,
                        icon: '💵',
                        color: '#10B981'
                    });
                    console.log('💵 [SETUP] Salary subscription created:', salary);
                }

                createdProfiles.push(personalProfile);
            } catch (error) {
                console.error('❌ [SETUP] Error creating personal profile:', error);
                throw error;
            }
        }

        // ========================================
        // CRIAR PERFIL EMPRESARIAL
        // ========================================
        if (profileType === 'BUSINESS' || profileType === 'HYBRID') {
            const businessData = profilesData?.business || {};
            const subtype = businessData.subtype || 'MEI';
            console.log('💼 [SETUP] Creating BUSINESS profile (subtype:', subtype, ')...');

            try {
                const businessProfile = await Profile.create({
                    userId,
                    type: 'BUSINESS',
                    subtype: subtype,
                    name: businessData.name || 'Minha Empresa',
                    document: businessData.cnpj || null,
                    icon: '💼',
                    color: '#10B981',
                    isDefault: defaultProfileType === 'BUSINESS',
                    revenueLimit: subtype === 'MEI' ? 81000 : null,
                    settings: {
                        dasValue: businessData.dasValue || null,
                        dasDueDay: businessData.dasDueDay || 20,
                        proLabore: subtype === 'ME' ? (businessData.proLabore || null) : null,
                        proLaboreDay: businessData.proLaboreDay || 5,
                        salaryDescription: subtype === 'ME' ? 'Pró-labore' : null,
                        initialBalance: businessData.initialBalance || 0
                    }
                });

                console.log('✅ [SETUP] Business profile created:', businessProfile.id);

                // SALDO INICIAL DA EMPRESA
                const initialBalance = parseFloat(businessData.initialBalance) || 0;
                if (initialBalance > 0) {
                    await ManualTransaction.create({
                        userId,
                        profileId: businessProfile.id,
                        type: 'INCOME',
                        amount: initialBalance,
                        description: 'Saldo Inicial',
                        date: new Date(),
                        status: 'COMPLETED',
                        source: 'OTHER'
                    });
                    console.log('💰 [SETUP] Business initial balance:', initialBalance);
                }

                // DAS COMO SUBSCRIPTION
                const dasValue = parseFloat(businessData.dasValue) || 0;
                if (dasValue > 0) {
                    const dasDueDay = parseInt(businessData.dasDueDay) || 20;
                    await Subscription.create({
                        userId,
                        profileId: businessProfile.id,
                        name: subtype === 'MEI' ? 'DAS MEI' : 'DAS Simples Nacional',
                        description: 'Imposto mensal do Simples Nacional',
                        amount: dasValue,
                        frequency: 'MONTHLY',
                        startDate: this._getNextDueDate(dasDueDay),
                        nextBillingDate: this._getNextDueDate(dasDueDay),
                        category: 'Impostos',
                        status: 'ACTIVE',
                        autoGenerate: true,
                        alertDaysBefore: 5,
                        icon: '📋',
                        color: '#EF4444'
                    });
                    console.log('📋 [SETUP] DAS subscription created:', dasValue);
                }

                // PRÓ-LABORE (ME only)
                if (subtype === 'ME') {
                    const proLabore = parseFloat(businessData.proLabore) || 0;
                    if (proLabore > 0) {
                        const proLaboreDay = parseInt(businessData.proLaboreDay) || 5;
                        await Subscription.create({
                            userId,
                            profileId: businessProfile.id,
                            name: 'Pró-labore',
                            description: 'Retirada mensal de pró-labore',
                            amount: proLabore,
                            frequency: 'MONTHLY',
                            startDate: this._getNextDueDate(proLaboreDay),
                            nextBillingDate: this._getNextDueDate(proLaboreDay),
                            category: 'Salário',
                            status: 'ACTIVE',
                            autoGenerate: true,
                            alertDaysBefore: 3,
                            icon: '💵',
                            color: '#6366F1'
                        });
                        console.log('💵 [SETUP] Pro-labore subscription created:', proLabore);
                    }
                }

                createdProfiles.push(businessProfile);
            } catch (error) {
                console.error('❌ [SETUP] Error creating business profile:', error);
                throw error;
            }
        }

        // Marcar onboarding como completo
        await User.update(
            { onboardingComplete: true, onboardingStep: 4 },
            { where: { id: userId } }
        );

        // Criar UserProfile de gamificação se não existir
        const existingUserProfile = await UserProfile.findOne({ where: { userId } });
        if (!existingUserProfile) {
            await UserProfile.create({
                userId,
                xp: 50,
                level: 1,
                streak: 1
            });
        }

        console.log('═══════════════════════════════════════════════════');
        console.log('✅ [SETUP] ONBOARDING COMPLETE');
        console.log('📊 Profiles created:', createdProfiles.length);
        console.log('📋 Profile IDs:', createdProfiles.map(p => ({ id: p.id, type: p.type })));
        console.log('═══════════════════════════════════════════════════');

        return createdProfiles;
    }

    /**
     * Verificar se usuário completou setup de perfis
     */
    async hasProfiles(userId) {
        const count = await Profile.count({ where: { userId } });
        return count > 0;
    }

    /**
     * Buscar perfil padrão
     */
    async getDefaultProfile(userId) {
        let profile = await Profile.findOne({
            where: { userId, isDefault: true }
        });

        if (!profile) {
            profile = await Profile.findOne({
                where: { userId },
                order: [['createdAt', 'ASC']]
            });
        }

        return profile;
    }
}

module.exports = new ProfileService();
