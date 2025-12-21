/**
 * Admin Controller
 * ========================================
 * ENDPOINTS DO PAINEL ADMINISTRATIVO
 * ========================================
 */

const adminService = require('./admin.service');

/**
 * GET /admin/dashboard
 * Retorna métricas do painel
 */
const getDashboard = async (req, res) => {
    try {
        const metrics = await adminService.getDashboard();
        res.json(metrics);
    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar métricas' });
    }
};

/**
 * GET /admin/users
 * Lista usuários com paginação
 */
const getUsers = async (req, res) => {
    try {
        const { page, limit, search, plan, status } = req.query;
        const result = await adminService.getUsers({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            search,
            plan,
            status
        });
        res.json(result);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
};

/**
 * POST /admin/users/:id/grant
 * Concede plano a um usuário
 */
const grantPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { planType, expiresAt } = req.body;

        if (!planType) {
            return res.status(400).json({ error: 'Plano é obrigatório' });
        }

        const user = await adminService.grantPlan(id, planType, expiresAt);
        res.json({ message: 'Plano concedido com sucesso', user });
    } catch (error) {
        console.error('Erro ao conceder plano:', error);
        res.status(500).json({ error: error.message || 'Erro ao conceder plano' });
    }
};

/**
 * POST /admin/users/:id/revoke
 * Revoga acesso de um usuário
 */
const revokePlan = async (req, res) => {
    try {
        const { id } = req.params;
        await adminService.revokePlan(id);
        res.json({ message: 'Acesso revogado com sucesso' });
    } catch (error) {
        console.error('Erro ao revogar acesso:', error);
        res.status(500).json({ error: error.message || 'Erro ao revogar acesso' });
    }
};

/**
 * POST /admin/users/create
 * Cria um novo usuário com plano
 */
const createUser = async (req, res) => {
    try {
        const { name, email, password, plan } = req.body;

        if (!name || !email || !password || !plan) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        const user = await adminService.createUser({ name, email, password, plan });
        res.status(201).json({ message: 'Usuário criado com sucesso', user });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(400).json({ error: error.message || 'Erro ao criar usuário' });
    }
};

module.exports = {
    getDashboard,
    getUsers,
    grantPlan,
    revokePlan,
    createUser
};
