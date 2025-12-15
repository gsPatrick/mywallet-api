const { Message } = require('../../models');

class MessagesService {
    async list(userId) {
        return await Message.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        });
    }

    async create(userId, data) {
        return await Message.create({
            ...data,
            userId
        });
    }

    async markAsRead(userId, id) {
        const message = await Message.findOne({
            where: { id, userId }
        });

        if (!message) {
            throw new Error('Mensagem não encontrada');
        }

        return await message.update({ isRead: true });
    }

    async getUnreadCount(userId) {
        return await Message.count({
            where: { userId, isRead: false }
        });
    }
}

module.exports = new MessagesService();
