/**
 * Investments Service
 * Gerencia a carteira do usuário e busca de ativos
 */

const { Investment, Asset, FinancialProduct } = require('../../models');
const yahooClient = require('./yahoo.client');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista ativos disponíveis no banco de dados (Catálogo)
 * Usado na aba "Mercado" e no Autocomplete
 */
const listAssets = async (filters = {}) => {
    const { search, type } = filters;
    const where = { isActive: true };

    if (search) {
        where[Op.or] = [
            { ticker: { [Op.iLike]: `%${search}%` } },
            { name: { [Op.iLike]: `%${search}%` } }
        ];
    }

    if (type && type !== 'ALL') {
        where.type = type;
    }

    const assets = await Asset.findAll({
        where,
        limit: 50, // Limita resultados para não pesar
        order: [['ticker', 'ASC']],
        attributes: ['id', 'ticker', 'name', 'type', 'logoUrl', 'sector']
    });

    // Tenta buscar cotação atual para a lista de mercado ficar bonita
    // (Opcional: pode deixar sem preço na busca se ficar lento)
    const tickers = assets.map(a => a.ticker);
    const quotes = await yahooClient.getQuotes(tickers);

    return assets.map(asset => ({
        ...asset.toJSON(),
        price: quotes[asset.ticker]?.price || 0,
        change: quotes[asset.ticker]?.changePercent || 0
    }));
};

/**
 * Lista o histórico de operações (compras e vendas) do usuário
 */
const listInvestments = async (userId, filters = {}) => {
    const { assetType, page = 1, limit = 50 } = filters;

    const where = {};
    if (assetType) {
        where['$asset.type$'] = assetType;
    }

    const investments = await Investment.findAll({
        where: { userId, ...where },
        include: [{
            model: Asset,
            as: 'asset',
            required: true
        }],
        order: [['date', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    return investments.map(inv => ({
        id: inv.id,
        ticker: inv.asset.ticker,
        name: inv.asset.name,
        type: inv.asset.type,
        logoUrl: inv.asset.logoUrl,
        operationType: inv.operationType,
        quantity: parseFloat(inv.quantity),
        price: parseFloat(inv.price),
        totalValue: inv.getTotalValue(),
        date: inv.date,
        broker: inv.broker
    }));
};

/**
 * Registra um novo investimento
 */
const createInvestment = async (userId, data) => {
    const { ticker, operationType, quantity, price, brokerageFee, date, broker } = data;

    // 1. Busca o ativo no banco local
    let asset = await Asset.findOne({
        where: { ticker: ticker.toUpperCase() }
    });

    // Fallback: Se não existir, tenta buscar info básica no Yahoo e cria
    if (!asset) {
        const yahooData = await yahooClient.getQuote(ticker);
        if (!yahooData) {
            throw new AppError('Ativo não encontrado na bolsa.', 404, 'ASSET_NOT_FOUND');
        }

        asset = await Asset.create({
            ticker: ticker.toUpperCase(),
            name: yahooData.shortName || ticker.toUpperCase(),
            type: 'STOCK', // Default se não soubermos
            isActive: true
        });
    }

    // 2. Salva a operação
    const investment = await Investment.create({
        userId,
        assetId: asset.id,
        operationType,
        quantity,
        price,
        brokerageFee: brokerageFee || 0,
        date: date || new Date(),
        broker
    });

    return investment;
};

/**
 * Calcula o Portfólio Consolidado
 */
const getPortfolio = async (userId) => {
    // 1. Busca operações de renda variável
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }]
    });

    // 2. Busca produtos financeiros manuais
    const financialProducts = await FinancialProduct.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    const positionsMap = {};
    const tickersToFetch = new Set();

    // 3. Processa Renda Variável
    investments.forEach(inv => {
        const ticker = inv.asset.ticker;
        tickersToFetch.add(ticker);

        if (!positionsMap[ticker]) {
            positionsMap[ticker] = {
                ticker,
                name: inv.asset.name,
                logoUrl: inv.asset.logoUrl,
                type: inv.asset.type,
                quantity: 0,
                totalCost: 0,
            };
        }

        const qty = parseFloat(inv.quantity);
        const price = parseFloat(inv.price);
        const fees = parseFloat(inv.brokerageFee || 0);

        if (inv.operationType === 'BUY') {
            positionsMap[ticker].quantity += qty;
            positionsMap[ticker].totalCost += (qty * price) + fees;
        } else {
            if (positionsMap[ticker].quantity > 0) {
                const avgPrice = positionsMap[ticker].totalCost / positionsMap[ticker].quantity;
                positionsMap[ticker].totalCost -= (qty * avgPrice);
                positionsMap[ticker].quantity -= qty;
            }
        }
    });

    // 4. Busca Cotações Yahoo
    const quotes = await yahooClient.getQuotes(Array.from(tickersToFetch));

    let totalInvested = 0;
    let totalCurrentBalance = 0;

    // 5. Monta posições de Renda Variável
    const variableIncomePositions = Object.values(positionsMap)
        .filter(p => p.quantity > 0.000001)
        .map(p => {
            const quote = quotes[p.ticker];
            const currentPrice = quote ? quote.price : (p.totalCost / p.quantity);
            const currentBalance = p.quantity * currentPrice;
            const profit = currentBalance - p.totalCost;
            const profitPercent = p.totalCost > 0 ? (profit / p.totalCost) * 100 : 0;

            totalInvested += p.totalCost;
            totalCurrentBalance += currentBalance;

            return {
                source: 'VARIABLE_INCOME',
                ticker: p.ticker,
                name: p.name,
                logoUrl: p.logoUrl,
                type: p.type,
                quantity: p.quantity,
                averagePrice: p.totalCost / p.quantity,
                currentPrice,
                totalCost: p.totalCost,
                currentBalance,
                profit,
                profitPercent,
                dayChange: quote?.changePercent || 0,
                lastUpdate: quote?.updatedAt
            };
        });

    // 6. Monta posições de Renda Fixa/Outros
    const fixedIncomePositions = financialProducts.map(fp => {
        const invested = parseFloat(fp.investedAmount);
        const current = fp.currentValue ? parseFloat(fp.currentValue) : invested;

        totalInvested += invested;
        totalCurrentBalance += current;

        return {
            source: 'FIXED_INCOME',
            id: fp.id,
            name: fp.name,
            type: fp.type,
            totalCost: invested,
            currentBalance: current,
            profit: current - invested,
            profitPercent: invested > 0 ? ((current - invested) / invested) * 100 : 0
        };
    });

    return {
        summary: {
            totalInvested,
            totalCurrentBalance,
            totalProfit: totalCurrentBalance - totalInvested,
            totalProfitPercent: totalInvested > 0
                ? ((totalCurrentBalance - totalInvested) / totalInvested) * 100
                : 0
        },
        positions: [...variableIncomePositions, ...fixedIncomePositions],
        allocation: calculateAllocation([...variableIncomePositions, ...fixedIncomePositions], totalCurrentBalance)
    };
};

const calculateAllocation = (allPositions, totalValue) => {
    const allocation = {};
    if (totalValue === 0) return allocation;

    allPositions.forEach(pos => {
        const type = pos.type;
        if (!allocation[type]) allocation[type] = 0;
        allocation[type] += pos.currentBalance;
    });

    Object.keys(allocation).forEach(key => {
        allocation[key] = parseFloat(((allocation[key] / totalValue) * 100).toFixed(2));
    });

    return allocation;
};

module.exports = {
    listAssets, // Esta função estava faltando!
    listInvestments,
    createInvestment,
    getPortfolio
};