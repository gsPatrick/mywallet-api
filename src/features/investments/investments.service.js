/**
 * Investments Service
 * Gerencia carteira do usuário e busca de ativos
 * BRAPI para B3, Yahoo para Crypto + Internacional
 */

const { Investment, Asset, FinancialProduct } = require('../../models');
const brapiClient = require('./brapi.client');
const yahooClient = require('./yahoo.client');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista ativos disponíveis (Catálogo/Mercado/Autocomplete)
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
        limit: 50,
        order: [['ticker', 'ASC']],
        attributes: ['id', 'ticker', 'name', 'type', 'logoUrl', 'sector']
    });

    // Busca cotações (BRAPI para B3, Yahoo para Crypto)
    const tickers = assets.map(a => a.ticker);
    const b3Tickers = tickers.filter(t => !t.includes('-'));
    const cryptoTickers = tickers.filter(t => t.includes('-'));

    let quotes = {};

    if (b3Tickers.length > 0) {
        quotes = await brapiClient.getQuotes(b3Tickers);
    }

    if (cryptoTickers.length > 0) {
        const yahooQuotes = await yahooClient.getQuotes(cryptoTickers);
        quotes = { ...quotes, ...yahooQuotes };
    }

    return assets.map(asset => ({
        ...asset.toJSON(),
        price: quotes[asset.ticker]?.price || 0,
        change: quotes[asset.ticker]?.changePercent || 0
    }));
};

/**
 * Lista histórico de operações do usuário
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
 * Registra novo investimento
 */
const createInvestment = async (userId, data) => {
    const { ticker, operationType, quantity, price, brokerageFee, date, broker } = data;

    // 1. Busca ativo no banco
    let asset = await Asset.findOne({
        where: { ticker: ticker.toUpperCase() }
    });

    // 2. Se não existe, tenta buscar e criar
    if (!asset) {
        const isCrypto = ticker.includes('-');
        const assetData = isCrypto
            ? await yahooClient.getQuote(ticker)
            : await brapiClient.getQuote(ticker);

        if (!assetData) {
            throw new AppError('Ativo não encontrado', 404, 'ASSET_NOT_FOUND');
        }

        asset = await Asset.create({
            ticker: ticker.toUpperCase(),
            name: assetData.shortName || assetData.longName || ticker.toUpperCase(),
            logoUrl: assetData.logo || assetData.logoUrl,
            type: isCrypto ? 'CRYPTO' : 'STOCK',
            isActive: true
        });
    }

    // 3. Salva operação
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
 * Calcula portfólio consolidado
 */
const getPortfolio = async (userId) => {
    // 1. Busca operações
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }]
    });

    const financialProducts = await FinancialProduct.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    const positionsMap = {};
    const tickersToFetch = new Set();

    // 2. Processa posições
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

    // 3. Busca cotações (BRAPI para B3, Yahoo para Crypto)
    const allTickers = Array.from(tickersToFetch);
    const b3Tickers = allTickers.filter(t => !t.includes('-'));
    const cryptoTickers = allTickers.filter(t => t.includes('-'));

    let quotes = {};

    if (b3Tickers.length > 0) {
        quotes = await brapiClient.getQuotes(b3Tickers);
    }

    if (cryptoTickers.length > 0) {
        const yahooQuotes = await yahooClient.getQuotes(cryptoTickers);
        quotes = { ...quotes, ...yahooQuotes };
    }

    let totalInvested = 0;
    let totalCurrentBalance = 0;

    // 4. Monta posições de renda variável
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

    // 5. Monta posições de renda fixa
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

/**
 * Evolução histórica do portfólio
 */
const getPortfolioEvolution = async (userId, months = 12) => {
    const { InvestmentSnapshot } = require('../../models');

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffYear = cutoffDate.getFullYear();
    const cutoffMonth = cutoffDate.getMonth() + 1;

    const snapshots = await InvestmentSnapshot.findAll({
        where: {
            userId,
            [Op.or]: [
                { year: { [Op.gt]: cutoffYear } },
                { year: cutoffYear, month: { [Op.gte]: cutoffMonth } }
            ]
        },
        order: [['year', 'ASC'], ['month', 'ASC']],
        attributes: ['month', 'year', 'marketValue', 'totalCost', 'profit', 'profitPercent']
    });

    if (snapshots.length === 0) {
        const portfolio = await getPortfolio(userId);
        const currentValue = portfolio.summary?.totalCurrentBalance || 0;
        const totalInvested = portfolio.summary?.totalInvested || 0;

        const data = [];
        for (let i = months; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);

            const progress = (months - i) / months;
            const value = totalInvested * (0.8 + progress * 0.2) + (currentValue - totalInvested) * progress;

            data.push({
                date: date.toISOString().split('T')[0],
                displayDate: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                value: Math.max(0, value),
                invested: totalInvested * (0.5 + progress * 0.5)
            });
        }

        return {
            data,
            hasRealData: false,
            summary: {
                returnPercent: portfolio.summary?.totalProfitPercent || 0,
                cdiPercent: 100,
                cdiForPeriod: (11.25 / 12) * months
            }
        };
    }

    const data = snapshots.map(s => {
        const snapshotDate = new Date(s.year, s.month - 1, 1);
        return {
            date: snapshotDate.toISOString().split('T')[0],
            displayDate: snapshotDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            value: parseFloat(s.marketValue) || 0,
            invested: parseFloat(s.totalCost) || 0,
            profit: parseFloat(s.profit) || 0,
            profitPercent: parseFloat(s.profitPercent) || 0
        };
    });

    const firstValue = data[0]?.invested || 1;
    const lastValue = data[data.length - 1]?.value || 0;
    const returnPercent = ((lastValue - firstValue) / firstValue) * 100;

    const cdiAnnual = 11.25;
    const cdiForPeriod = (cdiAnnual / 12) * months;
    const cdiPercent = returnPercent > 0 ? (returnPercent / cdiForPeriod) * 100 : 0;

    return {
        data,
        hasRealData: true,
        summary: {
            returnPercent,
            cdiPercent,
            cdiForPeriod
        }
    };
};

module.exports = {
    listAssets,
    listInvestments,
    createInvestment,
    getPortfolio,
    getPortfolioEvolution
};