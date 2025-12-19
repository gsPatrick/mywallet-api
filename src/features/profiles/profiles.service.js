/**
 * Profile Service
 * ========================================
 * MULTI-CONTEXT PROFILE MANAGEMENT
 * ✅ DAS como Subscription para geração automática
 * ========================================
 */

const { Profile, User, UserProfile, ManualTransaction, Subscription, Category } = require('../../models');
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
        // Remover default de todos os perfis
        await Profile.update(
            { isDefault: false },
            { where: { userId } }
        );

        // Definir o novo default
        await Profile.update(
            { isDefault: true },
            { where: { id: profileId, userId } }
        );

        return this.getProfile(profileId, userId);
    }

    /**
     * Buscar ou criar categoria "Impostos"
     */
    async _getOrCreateImpostosCategory(userId) {
        let category = await Category.findOne({
            where: {
                userId,
                name: { [Op.iLike]: '%imposto%' }
            }
        });

        if (!category) {
            category = await Category.create({
                userId,
                name: 'Impostos',
                icon: '📋',
                color: '#EF4444',
                type: 'EXPENSE',
                isSystem: true
            });
            console.log('📋 [SETUP] Categoria "Impostos" criada');
        }

        return category;
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
     * ✅ DAS/Pró-labore agora são SUBSCRIPTIONS (Assinaturas)
     * ✅ Isso usa o motor de geração automática de lançamentos
     * ========================================
     */
    async setupProfiles(userId, setupData) {
        const { profileType, profiles: profilesData, defaultProfileType } = setupData;

        const createdProfiles = [];

        // ========================================
        // CRIAR PERFIL PESSOAL se necessário
        // ========================================
        if (profileType === 'PERSONAL' || profileType === 'HYBRID') {
            const personalData = profilesData?.personal || {};

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

            console.log('✅ [SETUP] Perfil Pessoal criado:', personalProfile.id);

            // ========================================
            // SALDO INICIAL COMO TRANSAÇÃO
            // ========================================
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
                    source: 'ONBOARDING'
                });
                console.log('💰 [SETUP] Saldo inicial pessoal:', initialBalance);
            }

            // ========================================
            // SALÁRIO COMO SUBSCRIPTION (Receita Recorrente)
            // ========================================
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
                    autoGenerate: true,
                    alertDaysBefore: 3,
                    icon: '💵',
                    color: '#10B981',
                    isIncome: true  // Flag para indicar receita
                });
                console.log('💵 [SETUP] Salário como Subscription:', salary);
            }

            createdProfiles.push(personalProfile);
        }

        // ========================================
        // CRIAR PERFIL EMPRESARIAL se necessário
        // ========================================
        if (profileType === 'BUSINESS' || profileType === 'HYBRID') {
            const businessData = profilesData?.business || {};
            const subtype = businessData.subtype || 'MEI';

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

            console.log('✅ [SETUP] Perfil Empresarial criado:', businessProfile.id, 'subtype:', subtype);

            // ========================================
            // SALDO INICIAL DA EMPRESA COMO TRANSAÇÃO
            // ========================================
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
                    source: 'ONBOARDING'
                });
                console.log('💰 [SETUP] Saldo inicial empresa:', initialBalance);
            }

            // ========================================
            // DAS COMO SUBSCRIPTION (Imposto MEI/ME)
            // ========================================
            const dasValue = parseFloat(businessData.dasValue) || 0;
            if (dasValue > 0) {
                const dasDueDay = parseInt(businessData.dasDueDay) || 20;

                // Buscar ou criar categoria Impostos
                const impostosCategory = await this._getOrCreateImpostosCategory(userId);

                await Subscription.create({
                    userId,
                    profileId: businessProfile.id,
                    name: subtype === 'MEI' ? 'DAS MEI (Imposto)' : 'DAS Simples Nacional',
                    description: 'Imposto mensal do Simples Nacional',
                    amount: dasValue,
                    frequency: 'MONTHLY',
                    startDate: this._getNextDueDate(dasDueDay),
                    nextBillingDate: this._getNextDueDate(dasDueDay),
                    category: 'Impostos',
                    categoryId: impostosCategory?.id || null,
                    status: 'ACTIVE',
                    autoGenerate: true,
                    alertDaysBefore: 5,  // Alerta 5 dias antes
                    icon: '📋',
                    color: '#EF4444'
                });
                console.log('📋 [SETUP] DAS como Subscription:', dasValue, 'vence dia', dasDueDay);
            }

            // ========================================
            // PRÓ-LABORE (apenas ME) COMO SUBSCRIPTION
            // ========================================
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
                    console.log('💵 [SETUP] Pró-labore como Subscription:', proLabore);
                }
            }

            createdProfiles.push(businessProfile);
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

        console.log('✅ [SETUP] Onboarding completo. Perfis criados:', createdProfiles.length);

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
