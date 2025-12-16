const { Goal, GoalHistory, sequelize } = require('../../models');
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

    async transaction(userId, goalId, { amount, type, reason }) {
        const t = await sequelize.transaction();

        try {
            const goal = await Goal.findOne({
                where: { id: goalId, userId },
                transaction: t
            });

            if (!goal) {
                throw new Error('Meta não encontrada');
            }

            const val = parseFloat(amount);
            const current = parseFloat(goal.currentAmount);
            let newAmount = current;

            if (type === 'DEPOSIT') {
                newAmount += val;
            } else if (type === 'WITHDRAW') {
                newAmount -= val;
                if (newAmount < 0) {
                    throw new Error('Saldo insuficiente');
                }
            } else {
                throw new Error('Tipo de transação inválido');
            }

            await goal.update({ currentAmount: newAmount }, { transaction: t });

            await GoalHistory.create({
                goalId,
                userId,
                amount: val,
                type,
                reason,
                date: new Date()
            }, { transaction: t });

            await t.commit();
            return goal;
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    async getHistory(userId, goalId) {
        // Verify ownership
        const goal = await Goal.findOne({ where: { id: goalId, userId } });
        if (!goal) throw new Error('Meta não encontrada');

        return await GoalHistory.findAll({
            where: { goalId, userId },
            order: [['date', 'DESC'], ['createdAt', 'DESC']]
        });
    }
}

module.exports = new GoalsService();
