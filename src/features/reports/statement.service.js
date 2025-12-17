/**
 * Statement Service
 * Gera extrato financeiro mensal (estilo banco)
 */

const { ManualTransaction, Category } = require('../../models');
const { Op } = require('sequelize');

/**
 * Obtém extrato mensal completo
 * @param {string} userId - ID do usuário
 * @param {number} year - Ano
 * @param {number} month - Mês (1-12)
 */
const getMonthlyStatement = async (userId, year, month) => {
    // Período do mês
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59); // Último dia do mês

    // Busca todas transações do período
    const transactions = await ManualTransaction.findAll({
        where: {
            userId,
            date: {
                [Op.between]: [startDate, endDate]
            },
            status: { [Op.ne]: 'CANCELLED' } // Ignorar canceladas
        },
        include: [{
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'icon', 'color']
        }],
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
        attributes: ['id', 'description', 'amount', 'type', 'status', 'date', 'source', 'createdAt']
    });

    // Calcula totais
    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransfer = 0;

    const formattedTransactions = transactions.map(t => {
        const amount = parseFloat(t.amount);

        if (t.type === 'INCOME') totalIncome += amount;
        else if (t.type === 'EXPENSE') totalExpense += amount;
        else if (t.type === 'TRANSFER') totalTransfer += amount;

        return {
            id: t.id,
            date: t.date,
            description: t.description || 'Sem descrição',
            type: t.type,
            status: t.status,
            amount: amount,
            category: t.category ? {
                id: t.category.id,
                name: t.category.name,
                icon: t.category.icon,
                color: t.category.color
            } : null,
            source: t.source
        };
    });

    // Buscar saldo anterior (soma de tudo antes deste mês)
    const previousBalance = await calculatePreviousBalance(userId, startDate);

    // Calcula saldo final
    const netChange = totalIncome - totalExpense;
    const closingBalance = previousBalance + netChange;

    return {
        period: {
            year,
            month,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            monthName: startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        },
        summary: {
            openingBalance: previousBalance,
            totalIncome,
            totalExpense,
            totalTransfer,
            netChange,
            closingBalance
        },
        transactions: formattedTransactions,
        transactionCount: formattedTransactions.length
    };
};

/**
 * Calcula saldo anterior ao período
 */
const calculatePreviousBalance = async (userId, beforeDate) => {
    const result = await ManualTransaction.findAll({
        where: {
            userId,
            date: { [Op.lt]: beforeDate },
            status: { [Op.ne]: 'CANCELLED' }
        },
        attributes: ['type', 'amount']
    });

    let balance = 0;
    result.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'INCOME') balance += amount;
        else if (t.type === 'EXPENSE') balance -= amount;
    });

    return balance;
};

/**
 * Lista anos disponíveis para extrato
 */
const getAvailableYears = async (userId) => {
    const transactions = await ManualTransaction.findAll({
        where: { userId },
        attributes: ['date'],
        order: [['date', 'ASC']]
    });

    if (transactions.length === 0) {
        return [new Date().getFullYear()];
    }

    const years = new Set();
    transactions.forEach(t => {
        years.add(new Date(t.date).getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a); // Mais recente primeiro
};

module.exports = {
    getMonthlyStatement,
    getAvailableYears
};
