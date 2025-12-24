/**
 * Brokers Controller
 * ========================================
 * Endpoints para gestão de corretoras
 */

const brokersService = require('./brokers.service');

/**
 * Listar corretoras do usuário
 * GET /api/brokers
 */
const list = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        const brokers = await brokersService.list(userId, profileId);
        res.json({ data: brokers });
    } catch (error) {
        next(error);
    }
};

/**
 * Buscar corretora por ID
 * GET /api/brokers/:id
 */
const getById = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const broker = await brokersService.getById(id, userId);
        if (!broker) {
            return res.status(404).json({ error: 'Corretora não encontrada' });
        }

        res.json({ data: broker });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar nova corretora
 * POST /api/brokers
 */
const create = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];
        const data = req.body;

        const broker = await brokersService.create(userId, profileId, data);
        res.status(201).json({
            message: 'Corretora criada com sucesso',
            data: broker
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Criar corretora a partir do dicionário
 * POST /api/brokers/from-dictionary
 */
const createFromDictionary = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Código da corretora é obrigatório' });
        }

        const broker = await brokersService.createFromDictionary(userId, profileId, code);
        res.status(201).json({
            message: 'Corretora adicionada com sucesso',
            data: broker
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Atualizar corretora
 * PUT /api/brokers/:id
 */
const update = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const data = req.body;

        const broker = await brokersService.update(id, userId, data);
        res.json({
            message: 'Corretora atualizada',
            data: broker
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Remover corretora
 * DELETE /api/brokers/:id
 */
const remove = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await brokersService.delete(id, userId);
        res.json({ message: 'Corretora removida com sucesso' });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar corretoras disponíveis no dicionário
 * GET /api/brokers/available
 */
const getAvailable = async (req, res, next) => {
    try {
        const available = brokersService.getAvailableBrokers();
        res.json({ data: available });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    list,
    getById,
    create,
    createFromDictionary,
    update,
    remove,
    getAvailable
};
