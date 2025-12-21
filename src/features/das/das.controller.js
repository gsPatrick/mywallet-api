/**
 * DAS Controller
 * ========================================
 * CENTRAL DO DAS - Endpoints REST
 * ========================================
 */

const dasService = require('./das.service');

/**
 * POST /das/generate
 * Gera as guias do ano
 */
const generateGuides = async (req, res) => {
    try {
        const { year } = req.body;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({ error: 'Profile ID é obrigatório' });
        }

        const targetYear = year || new Date().getFullYear();
        const result = await dasService.generateYearlyGuides(profileId, targetYear);

        res.json(result);
    } catch (error) {
        console.error('Erro ao gerar guias DAS:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /das/guides/:year
 * Lista guias de um ano
 */
const listGuides = async (req, res) => {
    try {
        const { year } = req.params;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({ error: 'Profile ID é obrigatório' });
        }

        const guides = await dasService.listGuides(profileId, parseInt(year));
        res.json(guides);
    } catch (error) {
        console.error('Erro ao listar guias DAS:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /das/pay/:guideId
 * Paga uma guia DAS
 */
const payGuide = async (req, res) => {
    try {
        const { guideId } = req.params;
        const { bankAccountId, finalAmount, paymentDate } = req.body;
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({ error: 'Profile ID é obrigatório' });
        }

        if (!bankAccountId || !finalAmount) {
            return res.status(400).json({ error: 'bankAccountId e finalAmount são obrigatórios' });
        }

        const result = await dasService.payDas(userId, profileId, guideId, {
            bankAccountId,
            finalAmount: parseFloat(finalAmount),
            paymentDate: paymentDate ? new Date(paymentDate) : new Date()
        });

        res.json(result);
    } catch (error) {
        console.error('Erro ao pagar DAS:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /das/summary
 * Resumo para o dashboard
 */
const getSummary = async (req, res) => {
    try {
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({ error: 'Profile ID é obrigatório' });
        }

        const summary = await dasService.getDasSummary(profileId);
        res.json(summary || { message: 'Nenhuma guia DAS configurada' });
    } catch (error) {
        console.error('Erro ao buscar resumo DAS:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /das/ensure
 * Garante que existem guias para o ano atual
 */
const ensureGuides = async (req, res) => {
    try {
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({ error: 'Profile ID é obrigatório' });
        }

        const result = await dasService.ensureCurrentYearGuides(profileId);
        res.json(result);
    } catch (error) {
        console.error('Erro ao garantir guias DAS:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    generateGuides,
    listGuides,
    payGuide,
    getSummary,
    ensureGuides
};
