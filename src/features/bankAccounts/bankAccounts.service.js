/**
 * Bank Accounts Service
 * ========================================
 * CRUD and balance operations for bank accounts
 * ========================================
 * ✅ PROFILE ISOLATION: All queries filter by profileId
 * ✅ UX FRIENDLY: isDefault for friction-free transactions
 */

const { BankAccount, ManualTransaction, sequelize } = require('../../models');
const { Op } = require('sequelize');

// Default wallet configuration for fallback
const DEFAULT_WALLET = {
    bankName: 'Minha Carteira',
    bankCode: 'wallet',
    nickname: 'Dinheiro',
    color: '#6b7280',
    icon: null,
    type: 'CARTEIRA'
};

// ===========================================
// CRUD Operations
// ===========================================

/**
 * Create a new bank account
 * ✅ PROFILE ISOLATION: profileId required
 * ✅ AUTO-DEFAULT: First account is automatically isDefault
 */
const createBankAccount = async (userId, profileId, data) => {
    try {
        // Check if this is the first account for the profile
        const existingCount = await BankAccount.count({
            where: { userId, profileId, isActive: true }
        });

        const isFirstAccount = existingCount === 0;

        const account = await BankAccount.create({
            userId,
            profileId,
            source: data.source || 'MANUAL',
            bankName: data.bankName,
            bankCode: data.bankCode || null,
            nickname: data.nickname || null,
            color: data.color || null,
            icon: data.icon || null,
            type: data.type || 'CONTA_CORRENTE',
            accountNumber: data.accountNumber || null,
            branchCode: data.branchCode || null,
            balance: data.initialBalance || 0,
            currency: data.currency || 'BRL',
            isActive: true,
            isDefault: isFirstAccount // First account is auto-default
        });

        return account;
    } catch (error) {
        console.error('Erro ao criar conta bancária:', error);
        throw error;
    }
};

/**
 * Create default wallet (Minha Carteira) if user has no accounts
 * Called after onboarding if user skipped bank setup
 */
const createDefaultWallet = async (userId, profileId, initialBalance = 0) => {
    try {
        // Check if already has accounts
        const existingCount = await BankAccount.count({
            where: { userId, profileId, isActive: true }
        });

        if (existingCount > 0) {
            console.log('📝 Profile already has accounts, skipping default wallet');
            return null;
        }

        const account = await BankAccount.create({
            userId,
            profileId,
            source: 'MANUAL',
            bankName: DEFAULT_WALLET.bankName,
            bankCode: DEFAULT_WALLET.bankCode,
            nickname: DEFAULT_WALLET.nickname,
            color: DEFAULT_WALLET.color,
            icon: DEFAULT_WALLET.icon,
            type: DEFAULT_WALLET.type,
            balance: initialBalance,
            currency: 'BRL',
            isActive: true,
            isDefault: true
        });

        console.log('✅ Created default wallet for profile:', profileId);
        return account;
    } catch (error) {
        console.error('Erro ao criar carteira padrão:', error);
        throw error;
    }
};

/**
 * Get the default account for a profile
 * ✅ UX: Returns the preferred account for pre-filling forms
 */
const getDefaultAccount = async (userId, profileId) => {
    try {
        // First try to get the marked default
        let account = await BankAccount.findOne({
            where: {
                userId,
                profileId,
                isActive: true,
                isDefault: true
            }
        });

        // Fallback to first account if no default set
        if (!account) {
            account = await BankAccount.findOne({
                where: {
                    userId,
                    profileId,
                    isActive: true
                },
                order: [['createdAt', 'ASC']]
            });
        }

        return account;
    } catch (error) {
        console.error('Erro ao buscar conta padrão:', error);
        throw error;
    }
};

/**
 * Set an account as default (unset others)
 */
const setDefaultAccount = async (userId, profileId, accountId) => {
    const t = await sequelize.transaction();

    try {
        // Unset all defaults for this profile
        await BankAccount.update(
            { isDefault: false },
            { where: { userId, profileId }, transaction: t }
        );

        // Set the new default
        await BankAccount.update(
            { isDefault: true },
            { where: { id: accountId, userId, profileId }, transaction: t }
        );

        await t.commit();
        return { success: true };
    } catch (error) {
        await t.rollback();
        console.error('Erro ao definir conta padrão:', error);
        throw error;
    }
};

/**
 * List all bank accounts for a profile
 * ✅ PROFILE ISOLATION: filters by profileId
 */
const listBankAccounts = async (userId, profileId, options = {}) => {
    try {
        const where = {
            userId,
            profileId,
            isActive: true
        };

        if (options.source) {
            where.source = options.source;
        }

        const accounts = await BankAccount.findAll({
            where,
            order: [['isDefault', 'DESC'], ['createdAt', 'ASC']] // Default first
        });

        return accounts;
    } catch (error) {
        console.error('Erro ao listar contas bancárias:', error);
        throw error;
    }
};

/**
 * Get a single bank account
 * ✅ PROFILE ISOLATION: filters by profileId
 */
const getBankAccount = async (userId, profileId, accountId) => {
    try {
        const account = await BankAccount.findOne({
            where: {
                id: accountId,
                userId,
                profileId
            }
        });

        return account;
    } catch (error) {
        console.error('Erro ao buscar conta bancária:', error);
        throw error;
    }
};

/**
 * Update a bank account
 * ✅ PROFILE ISOLATION: filters by profileId
 */
const updateBankAccount = async (userId, profileId, accountId, data) => {
    try {
        const account = await BankAccount.findOne({
            where: {
                id: accountId,
                userId,
                profileId
            }
        });

        if (!account) {
            throw new Error('Conta bancária não encontrada');
        }

        // Only allow updating certain fields
        const allowedFields = ['bankName', 'bankCode', 'nickname', 'color', 'icon', 'type', 'accountNumber', 'branchCode', 'isActive'];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                account[field] = data[field];
            }
        }

        // Handle isDefault separately (needs to unset others)
        if (data.isDefault === true) {
            await setDefaultAccount(userId, profileId, accountId);
        }

        await account.save();
        return account;
    } catch (error) {
        console.error('Erro ao atualizar conta bancária:', error);
        throw error;
    }
};

/**
 * Delete a bank account (soft delete)
 * ✅ PROFILE ISOLATION: filters by profileId
 */
const deleteBankAccount = async (userId, profileId, accountId) => {
    try {
        const account = await BankAccount.findOne({
            where: {
                id: accountId,
                userId,
                profileId
            }
        });

        if (!account) {
            throw new Error('Conta bancária não encontrada');
        }

        // Check if there are transactions linked to this account
        const transactionCount = await ManualTransaction.count({
            where: {
                bankAccountId: accountId
            }
        });

        if (transactionCount > 0) {
            // Soft delete - just mark as inactive
            account.isActive = false;
            await account.save();
        } else {
            // Hard delete if no transactions
            await account.destroy();
        }

        // If this was the default, set another as default
        if (account.isDefault) {
            const nextAccount = await BankAccount.findOne({
                where: { userId, profileId, isActive: true },
                order: [['createdAt', 'ASC']]
            });
            if (nextAccount) {
                nextAccount.isDefault = true;
                await nextAccount.save();
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Erro ao excluir conta bancária:', error);
        throw error;
    }
};

// ===========================================
// Balance Operations
// ===========================================

/**
 * Update bank account balance
 * Used internally when creating/updating/deleting transactions
 * @param {string} accountId - Bank account ID
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @param {object} transaction - Sequelize transaction for ACID operations
 */
const updateBalance = async (accountId, amount, transaction = null) => {
    try {
        const options = transaction ? { transaction } : {};

        const account = await BankAccount.findByPk(accountId, options);

        if (!account) {
            throw new Error('Conta bancária não encontrada');
        }

        const currentBalance = parseFloat(account.balance) || 0;
        const newBalance = currentBalance + parseFloat(amount);

        account.balance = newBalance;
        await account.save(options);

        return account;
    } catch (error) {
        console.error('Erro ao atualizar saldo:', error);
        throw error;
    }
};

/**
 * Get total balance across all accounts for a profile
 * ✅ PROFILE ISOLATION: filters by profileId
 */
const getTotalBalance = async (userId, profileId) => {
    try {
        const result = await BankAccount.findAll({
            where: {
                userId,
                profileId,
                isActive: true
            },
            attributes: [
                [sequelize.fn('SUM', sequelize.col('balance')), 'totalBalance']
            ],
            raw: true
        });

        return parseFloat(result[0]?.totalBalance) || 0;
    } catch (error) {
        console.error('Erro ao calcular saldo total:', error);
        throw error;
    }
};

/**
 * Get balance breakdown by account
 * ✅ PROFILE ISOLATION: filters by profileId
 */
const getBalanceBreakdown = async (userId, profileId) => {
    try {
        const accounts = await BankAccount.findAll({
            where: {
                userId,
                profileId,
                isActive: true
            },
            attributes: ['id', 'bankName', 'nickname', 'color', 'icon', 'type', 'balance', 'isDefault'],
            order: [['isDefault', 'DESC'], ['balance', 'DESC']]
        });

        return accounts;
    } catch (error) {
        console.error('Erro ao buscar breakdown de saldo:', error);
        throw error;
    }
};

module.exports = {
    createBankAccount,
    createDefaultWallet,
    getDefaultAccount,
    setDefaultAccount,
    listBankAccounts,
    getBankAccount,
    updateBankAccount,
    deleteBankAccount,
    updateBalance,
    getTotalBalance,
    getBalanceBreakdown
};
