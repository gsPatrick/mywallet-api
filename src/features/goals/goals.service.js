const { Goal } = require('../../models');
const { Op } = require('sequelize');

class GoalsService {
    async list(userId) {
        return await Goal.findAll({
            where: { userId },
            order: [['deadline', 'ASC']]
        });
    }

    async create(userId, data) {
        return await Goal.create({
            ...data,
            userId
        });
    }

    async update(userId, id, data) {
        const goal = await Goal.findOne({
            where: { id, userId }
        });

        if (!goal) {
            throw new Error('Meta não encontrada');
        }

        return await goal.update(data);
    }

    async delete(userId, id) {
        const goal = await Goal.findOne({
            where: { id, userId }
        });

        if (!goal) {
            throw new Error('Meta não encontrada');
        }

        await goal.destroy();
        return true;
    }
}

module.exports = new GoalsService();
