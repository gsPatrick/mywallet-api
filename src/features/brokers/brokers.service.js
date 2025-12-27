/**
 * Brokers Service
 * ========================================
 * CRUD e lógica de negócio para Corretoras
 */

const { Broker, Profile } = require('../../models');
const { BROKERS_LIST, getDefaultBroker } = require('../../utils/brokersList');
const { logger } = require('../../config/logger');
const bankAccountsService = require('../bankAccounts/bankAccounts.service');

class BrokersService {
    /**
     * Listar corretoras do usuário/perfil
     */
    async list(userId, profileId) {
        const where = { userId, isActive: true };
        if (profileId) {
            where.profileId = profileId;
        }

        const brokers = await Broker.findAll({
            where,
            order: [['isSystemDefault', 'DESC'], ['name', 'ASC']]
        });

        return brokers;
    }

    /**
     * Buscar corretora por ID
     */
    async getById(brokerId, userId) {
        const broker = await Broker.findOne({
            where: { id: brokerId, userId }
        });
        return broker;
    }

    /**
     * Buscar corretora padrão do perfil
     */
    async getDefaultBroker(userId, profileId) {
        const broker = await Broker.findOne({
            where: {
                userId,
                profileId,
                isSystemDefault: true,
                isActive: true
            }
        });
        return broker;
    }

    /**
     * Criar nova corretora
     */
    async create(userId, profileId, data) {
        const broker = await Broker.create({
            userId,
            profileId,
            name: data.name,
            code: data.code || null,
            logoUrl: data.logoUrl || null,
            color: data.color || '#8B5CF6',
            icon: data.icon || 'trending-up',
            investmentFocus: data.investmentFocus || null,
            isSystemDefault: false,
            isActive: true
        });

        logger.info(`📈 Corretora criada: ${broker.name} para perfil ${profileId}`);

        // ✅ AUTO-CREATE: Create linked digital account for transfers
        try {
            await bankAccountsService.createBankAccount(userId, profileId, {
                bankName: broker.name,
                nickname: broker.name,
                type: 'CORRETORA',
                color: broker.color,
                icon: broker.logoUrl || broker.icon, // Prefer logoUrl (dictionary image) over generic icon
                initialBalance: 0,
                source: 'AUTO' // Mark as system-created
            });
            logger.info(`🏦 Conta digital criada automaticamente para corretora: ${broker.name}`);
        } catch (err) {
            // Log but don't fail the broker creation (soft failure)
            logger.error(`⚠️ Erro ao criar conta digital automática para ${broker.name}:`, err);
        }

        return broker;
    }

    /**
     * Criar corretora a partir do dicionário
     */
    async createFromDictionary(userId, profileId, code) {
        const template = BROKERS_LIST.find(b => b.code === code);
        if (!template) {
            throw new Error(`Corretora ${code} não encontrada no dicionário`);
        }

        // Verificar se já existe
        const existing = await Broker.findOne({
            where: { userId, profileId, code, isActive: true }
        });

        if (existing) {
            return existing;
        }

        return this.create(userId, profileId, {
            name: template.name,
            code: template.code,
            logoUrl: template.logoUrl,
            color: template.color,
            icon: template.icon,
            investmentFocus: null
        });
    }

    /**
     * Atualizar corretora
     */
    async update(brokerId, userId, data) {
        const broker = await Broker.findOne({
            where: { id: brokerId, userId }
        });

        if (!broker) {
            throw new Error('Corretora não encontrada');
        }

        // Não permitir editar campos críticos da corretora padrão
        if (broker.isSystemDefault) {
            delete data.name;
            delete data.code;
        }

        await broker.update({
            name: data.name ?? broker.name,
            logoUrl: data.logoUrl ?? broker.logoUrl,
            color: data.color ?? broker.color,
            icon: data.icon ?? broker.icon,
            investmentFocus: data.investmentFocus ?? broker.investmentFocus
        });

        return broker;
    }

    /**
     * Desativar corretora (soft delete)
     */
    async delete(brokerId, userId) {
        const broker = await Broker.findOne({
            where: { id: brokerId, userId }
        });

        if (!broker) {
            throw new Error('Corretora não encontrada');
        }

        if (broker.isSystemDefault) {
            throw new Error('Não é possível remover a corretora padrão do sistema');
        }

        await broker.update({ isActive: false });
        return { success: true };
    }

    /**
     * Garantir que existe uma corretora padrão para o perfil
     * Chamado no onboarding e quando necessário
     */
    async ensureDefaultBroker(userId, profileId) {
        // Verificar se já existe
        let defaultBroker = await Broker.findOne({
            where: {
                userId,
                profileId,
                isSystemDefault: true,
                isActive: true
            }
        });

        if (defaultBroker) {
            return defaultBroker;
        }

        // Criar corretora padrão
        const template = getDefaultBroker();
        defaultBroker = await Broker.create({
            userId,
            profileId,
            name: template.name,
            code: template.code,
            logoUrl: null,
            color: template.color,
            icon: template.icon,
            investmentFocus: 'Carteira principal de investimentos',
            isSystemDefault: true,
            isActive: true
        });

        logger.info(`📈 Corretora padrão criada automaticamente para perfil ${profileId}`);
        return defaultBroker;
    }

    /**
     * Retorna lista de corretoras disponíveis no dicionário
     */
    getAvailableBrokers() {
        return BROKERS_LIST.filter(b => !b.isSystemDefault);
    }
}

module.exports = new BrokersService();
