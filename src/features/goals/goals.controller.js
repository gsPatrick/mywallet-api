const goalsService = require('./goals.service');

class GoalsController {
    async list(req, res) {
        try {
            const goals = await goalsService.list(req.user.id);
            res.json(goals);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async create(req, res) {
        try {
            const goal = await goalsService.create(req.user.id, req.body);
            res.status(201).json(goal);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            const goal = await goalsService.update(req.user.id, req.params.id, req.body);
            res.json(goal);
        } catch (error) {
            const status = error.message === 'Meta não encontrada' ? 404 : 400;
            res.status(status).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            await goalsService.delete(req.user.id, req.params.id);
            res.status(204).send();
        } catch (error) {
            const status = error.message === 'Meta não encontrada' ? 404 : 500;
            res.status(status).json({ error: error.message });
        }
    }
}

module.exports = new GoalsController();
