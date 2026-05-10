const reportsService = require('./reports.service');
const statementService = require('./statement.service');

class ReportsController {
    async getPortfolio(req, res) {
        try {
            const { brokerId } = req.query;
            const data = await reportsService.getPortfolioSummary(req.user.id, brokerId, req.profileId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getEvolution(req, res) {
        try {
            const data = await reportsService.getEvolution(req.user.id, req.profileId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDividends(req, res) {
        try {
            const data = await reportsService.getDividends(req.user.id, req.profileId);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Statement (Extrato Financeiro)
    async getStatement(req, res) {
        try {
            const { year, month, bankAccountId, cardIds } = req.query;
            const result = await statementService.getMonthlyStatement(
                req.user?.id || req.userId,
                parseInt(year) || new Date().getFullYear(),
                parseInt(month) || (new Date().getMonth() + 1),
                bankAccountId,
                cardIds ? cardIds.split(',') : null,
                req.profileId // ✅ Passar o Perfil
            );

            res.json({ data: result });
        } catch (error) {
            res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
        }
    }

    async getStatementYears(req, res) {
        try {
            const userId = req.user?.id || req.userId;
            const years = await statementService.getAvailableYears(userId, req.profileId);
            res.json({ data: years });
        } catch (error) {
            res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
        }
    }
}

module.exports = new ReportsController();

