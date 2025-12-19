/**
 * Profile Service
 * ========================================
 * MULTI-CONTEXT PROFILE MANAGEMENT
 * ========================================
 */

const { Profile, User, UserProfile } = require('../../models');
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
     * Setup inicial de perfis (onboarding)
     * Cria perfis baseado no tipo selecionado
     * 
     * NOVO: Cada perfil tem seus próprios dados financeiros
     * - profiles.personal: { name, salary, salaryDay, initialBalance }
     * - profiles.business: { name, subtype, cnpj, dasValue, dasDueDay, proLabore, proLaboreDay, initialBalance }
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
                    // Dados financeiros do perfil pessoal
                    salary: personalData.salary || null,
                    salaryDay: personalData.salaryDay || null,
                    salaryDescription: 'Salário',
                    initialBalance: personalData.initialBalance || 0
                }
            });

            console.log('✅ [SETUP] Perfil Pessoal criado:', {
                id: personalProfile.id,
                name: personalProfile.name,
                settings: personalProfile.settings
            });

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
                    // DAS (imposto)
                    dasValue: businessData.dasValue || null,
                    dasDueDay: businessData.dasDueDay || 20,

                    // Pró-labore (apenas para ME)
                    proLabore: subtype === 'ME' ? (businessData.proLabore || null) : null,
                    proLaboreDay: businessData.proLaboreDay || 5,
                    salaryDescription: subtype === 'ME' ? 'Pró-labore' : null,

                    // Saldo inicial da empresa
                    initialBalance: businessData.initialBalance || 0
                }
            });

            console.log('✅ [SETUP] Perfil Empresarial criado:', {
                id: businessProfile.id,
                name: businessProfile.name,
                subtype: businessProfile.subtype,
                settings: businessProfile.settings
            });

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
                xp: 50, // XP inicial por completar onboarding
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
