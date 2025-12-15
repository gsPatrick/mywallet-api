const reportsService = require('./reports.service');

class ReportsController {
    async getPortfolio(req, res) {
        try {
            const data = await reportsService.getPortfolioSummary(req.user.id);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEvolution(req, res) {
        try {
            const data = await reportsService.getEvolution(req.user.id);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDividends(req, res) {
        try {
            const data = await reportsService.getDividends(req.user.id);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ReportsController();
