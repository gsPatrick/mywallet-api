/**
 * Gamification Controller
 * Endpoints para perfil, estatísticas e medalhas
 */

const gamificationService = require('./gamification.service');

/**
 * GET /api/gamification/profile
 * Obtém perfil do usuário com estatísticas de gamificação
 */
const getProfile = async (req, res) => {
    try {
        const profile = await gamificationService.getOrCreateProfile(req.user.id);
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar perfil' });
    }
};

/**
 * PUT /api/gamification/profile
 * Atualiza perfil do usuário (avatar, nome)
 */
const updateProfile = async (req, res) => {
    try {
        const { avatarSkinTone, avatarGender, name } = req.body;
        const profile = await gamificationService.updateProfile(req.user.id, {
            avatarSkinTone,
            avatarGender,
            name
        });
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ success: false, error: 'Erro ao atualizar perfil' });
    }
};

/**
 * PUT /api/gamification/password
 * Altera senha do usuário
 */
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Senha atual e nova senha são obrigatórias'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Nova senha deve ter no mínimo 6 caracteres'
            });
        }

        await gamificationService.changePassword(req.user.id, currentPassword, newPassword);
        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        if (error.message === 'Senha atual incorreta') {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Erro ao alterar senha' });
    }
};

/**
 * GET /api/gamification/stats
 * Obtém estatísticas detalhadas do usuário
 */
const getStats = async (req, res) => {
    try {
        const stats = await gamificationService.calculateStats(req.user.id);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
    }
};

/**
 * GET /api/gamification/medals
 * Obtém todas as medalhas com progresso do usuário
 */
const getMedals = async (req, res) => {
    try {
        const medals = await gamificationService.getMedalsWithProgress(req.user.id);
        res.json({ success: true, data: medals });
    } catch (error) {
        console.error('Erro ao buscar medalhas:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar medalhas' });
    }
};

/**
 * POST /api/gamification/medals/check
 * Verifica e desbloqueia novas medalhas
 */
const checkMedals = async (req, res) => {
    try {
        const newMedals = await gamificationService.checkAndUnlockMedals(req.user.id);
        res.json({ success: true, data: { newMedals } });
    } catch (error) {
        console.error('Erro ao verificar medalhas:', error);
        res.status(500).json({ success: false, error: 'Erro ao verificar medalhas' });
    }
};

/**
 * POST /api/gamification/activity
 * Registra atividade do usuário (atualiza streak)
 */
const registerActivity = async (req, res) => {
    try {
        const profile = await gamificationService.registerActivity(req.user.id);
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Erro ao registrar atividade:', error);
        res.status(500).json({ success: false, error: 'Erro ao registrar atividade' });
    }
};

/**
 * GET /api/gamification/medals/new
 * Obtém medalhas recém desbloqueadas não notificadas
 */
const getNewMedals = async (req, res) => {
    try {
        const newMedals = await gamificationService.getUnnotifiedMedals(req.user.id);
        res.json({ success: true, data: newMedals });
    } catch (error) {
        console.error('Erro ao buscar novas medalhas:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar novas medalhas' });
    }
};

/**
 * POST /api/gamification/medals/:medalId/notify
 * Marca medalha como notificada
 */
const markMedalNotified = async (req, res) => {
    try {
        await gamificationService.markMedalAsNotified(req.user.id, req.params.medalId);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar medalha:', error);
        res.status(500).json({ success: false, error: 'Erro ao marcar medalha' });
    }
};

/**
 * PUT /api/gamification/profile/featured-medals
 * Atualiza medalhas em destaque do usuário (máx 5)
 */
const updateFeaturedMedals = async (req, res) => {
    try {
        const { medalIds } = req.body;

        if (!Array.isArray(medalIds)) {
            return res.status(400).json({
                success: false,
                error: 'medalIds deve ser um array'
            });
        }

        if (medalIds.length > 5) {
            return res.status(400).json({
                success: false,
                error: 'Máximo de 5 medalhas em destaque'
            });
        }

        const profile = await gamificationService.updateFeaturedMedals(req.user.id, medalIds);
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Erro ao atualizar medalhas em destaque:', error);
        res.status(500).json({ success: false, error: 'Erro ao atualizar medalhas' });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    getStats,
    getMedals,
    checkMedals,
    registerActivity,
    getNewMedals,
    markMedalNotified,
    updateFeaturedMedals
};
