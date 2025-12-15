const messagesService = require('./messages.service');

class MessagesController {
    async list(req, res) {
        try {
            const messages = await messagesService.list(req.user.id);
            res.json(messages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async create(req, res) {
        try {
            // Permite criar mensagem (simulação de chat envio pelo usuário ou sistema)
            const message = await messagesService.create(req.user.id, req.body);
            res.status(201).json(message);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async markAsRead(req, res) {
        try {
            const message = await messagesService.markAsRead(req.user.id, req.params.id);
            res.json(message);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async getUnreadCount(req, res) {
        try {
            const count = await messagesService.getUnreadCount(req.user.id);
            res.json({ count });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MessagesController();
