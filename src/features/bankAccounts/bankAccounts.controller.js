/**
 * Bank Accounts Controller
 * ========================================
 * API endpoints for bank account management
 * ========================================
 */

const bankAccountsService = require('./bankAccounts.service');

/**
 * POST /api/bank-accounts
 * Create a new bank account
 */
const create = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const account = await bankAccountsService.createBankAccount(userId, profileId, req.body);

        res.status(201).json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error('Erro ao criar conta bancária:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao criar conta bancária'
        });
    }
};

/**
 * GET /api/bank-accounts
 * List all bank accounts for the active profile
 */
const list = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const accounts = await bankAccountsService.listBankAccounts(userId, profileId, {
            source: req.query.source,
            excludeType: req.query.excludeType
        });

        res.json({
            success: true,
            data: accounts
        });
    } catch (error) {
        console.error('Erro ao listar contas bancárias:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao listar contas bancárias'
        });
    }
};

/**
 * GET /api/bank-accounts/:id
 * Get a specific bank account
 */
const get = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];
        const accountId = req.params.id;

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const account = await bankAccountsService.getBankAccount(userId, profileId, accountId);

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Conta bancária não encontrada'
            });
        }

        res.json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error('Erro ao buscar conta bancária:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao buscar conta bancária'
        });
    }
};

/**
 * PUT /api/bank-accounts/:id
 * Update a bank account
 */
const update = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];
        const accountId = req.params.id;

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const account = await bankAccountsService.updateBankAccount(userId, profileId, accountId, req.body);

        res.json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error('Erro ao atualizar conta bancária:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao atualizar conta bancária'
        });
    }
};

/**
 * DELETE /api/bank-accounts/:id
 * Delete a bank account
 */
const remove = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];
        const accountId = req.params.id;

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        await bankAccountsService.deleteBankAccount(userId, profileId, accountId);

        res.json({
            success: true,
            message: 'Conta bancária removida'
        });
    } catch (error) {
        console.error('Erro ao excluir conta bancária:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao excluir conta bancária'
        });
    }
};

/**
 * GET /api/bank-accounts/balance/total
 * Get total balance across all accounts
 */
const getTotalBalance = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const total = await bankAccountsService.getTotalBalance(userId, profileId);

        res.json({
            success: true,
            data: { totalBalance: total }
        });
    } catch (error) {
        console.error('Erro ao calcular saldo total:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao calcular saldo total'
        });
    }
};

/**
 * GET /api/bank-accounts/balance/breakdown
 * Get balance breakdown by account
 */
const getBalanceBreakdown = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const breakdown = await bankAccountsService.getBalanceBreakdown(userId, profileId);

        res.json({
            success: true,
            data: breakdown
        });
    } catch (error) {
        console.error('Erro ao buscar breakdown de saldo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao buscar breakdown de saldo'
        });
    }
};

/**
 * GET /api/bank-accounts/default
 * Get the default account for the active profile
 */
const getDefault = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const account = await bankAccountsService.getDefaultAccount(userId, profileId);

        res.json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error('Erro ao buscar conta padrão:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao buscar conta padrão'
        });
    }
};

/**
 * PUT /api/bank-accounts/:id/set-default
 * Set an account as the default
 */
const setDefault = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];
        const accountId = req.params.id;

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        await bankAccountsService.setDefaultAccount(userId, profileId, accountId);

        res.json({
            success: true,
            message: 'Conta definida como padrão'
        });
    } catch (error) {
        console.error('Erro ao definir conta padrão:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao definir conta padrão'
        });
    }
};

/**
 * POST /api/bank-accounts/ensure-wallet
 * Ensure profile has at least one account (creates default wallet if needed)
 */
const ensureWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        if (!profileId) {
            return res.status(400).json({
                success: false,
                message: 'Profile ID é obrigatório'
            });
        }

        const account = await bankAccountsService.createDefaultWallet(
            userId,
            profileId,
            req.body.initialBalance || 0
        );

        res.json({
            success: true,
            data: account,
            created: account !== null
        });
    } catch (error) {
        console.error('Erro ao garantir carteira:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao garantir carteira'
        });
    }
};

module.exports = {
    create,
    list,
    get,
    update,
    remove,
    getTotalBalance,
    getBalanceBreakdown,
    getDefault,
    setDefault,
    ensureWallet
};
