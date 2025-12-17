const reportsService = require('./reports.service');
const statementService = require('./statement.service');

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

    // Statement (Extrato Financeiro)
    async getStatement(req, res) {
        try {
            const { year, month } = req.query;
            const currentDate = new Date();

            const y = parseInt(year) || currentDate.getFullYear();
            const m = parseInt(month) || (currentDate.getMonth() + 1);

            const userId = req.user?.id || req.userId;
            const data = await statementService.getMonthlyStatement(userId, y, m);
            res.json({ data });
        } catch (error) {
            res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
        }
    }

    async getStatementYears(req, res) {
        try {
            const userId = req.user?.id || req.userId;
            const years = await statementService.getAvailableYears(userId);
            res.json({ data: years });
        } catch (error) {
            res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
        }
    }
}

module.exports = new ReportsController();

