/**
 * Investments Service
 */

const { Investment, Asset, AuditLog } = require('../../models');
const brapiClient = require('./brapi.client');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista investimentos do usuário
 */
const listInvestments = async (userId, filters = {}) => {
    const { assetType, page = 1, limit = 50 } = filters;

    const include = [{
        model: Asset,
        as: 'asset',
        where: assetType ? { type: assetType } : {},
        required: true
    }];

    const investments = await Investment.findAll({
        where: { userId },
        include,
        order: [['date', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    return investments.map(inv => ({
        id: inv.id,
        asset: {
            id: inv.asset.id,
            ticker: inv.asset.ticker,
            name: inv.asset.name,
            type: inv.asset.type
        },
        operationType: inv.operationType,
        quantity: parseFloat(inv.quantity),
        price: parseFloat(inv.price),
        brokerageFee: parseFloat(inv.brokerageFee),
        otherFees: parseFloat(inv.otherFees),
        totalValue: inv.getTotalValue(),
        date: inv.date,
        broker: inv.broker
    }));
};

/**
 * Registra um novo investimento
 */
const createInvestment = async (userId, data) => {
    const { ticker, operationType, quantity, price, brokerageFee, otherFees, date, broker } = data;

    // Buscar ou criar ativo
    let asset = await Asset.findOne({ where: { ticker: ticker.toUpperCase() } });

    if (!asset) {
        // Buscar info na Brapi
        const assetInfo = await brapiClient.getAssetInfo(ticker.toUpperCase());

        if (!assetInfo) {
            throw new AppError('Ativo não encontrado na B3', 404, 'ASSET_NOT_FOUND');
        }

        asset = await Asset.create({
            ticker: ticker.toUpperCase(),
            name: assetInfo.longName || assetInfo.shortName || ticker,
            type: determineAssetType(ticker)
        });
    }

    const investment = await Investment.create({
        userId,
        assetId: asset.id,
        operationType,
        quantity,
        price,
        brokerageFee: brokerageFee || 0,
        otherFees: otherFees || 0,
        date,
        broker
    });

    return {
        id: investment.id,
        asset: {
            ticker: asset.ticker,
            name: asset.name,
            type: asset.type
        },
        operationType: investment.operationType,
        quantity: parseFloat(investment.quantity),
        price: parseFloat(investment.price),
        totalValue: investment.getTotalValue(),
        date: investment.date
    };
};

/**
 * Calcula portfólio do usuário com cotações atuais
 */
const getPortfolio = async (userId) => {
    // Buscar todos os investimentos agrupados por ativo
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
        order: [['date', 'ASC']]
    });

    // Calcular posição por ativo
    const positions = {};

    for (const inv of investments) {
        const ticker = inv.asset.ticker;

        if (!positions[ticker]) {
            positions[ticker] = {
                asset: {
                    id: inv.asset.id,
                    ticker: inv.asset.ticker,
                    name: inv.asset.name,
                    type: inv.asset.type
                },
                quantity: 0,
                totalCost: 0,
                averagePrice: 0
            };
        }

        const qty = parseFloat(inv.quantity);
        const price = parseFloat(inv.price);
        const fees = parseFloat(inv.brokerageFee) + parseFloat(inv.otherFees);

        if (inv.operationType === 'BUY') {
            positions[ticker].totalCost += (qty * price) + fees;
            positions[ticker].quantity += qty;
        } else {
            // SELL - reduz posição
            const sellValue = qty * price - fees;
            positions[ticker].quantity -= qty;
            if (positions[ticker].quantity > 0) {
                positions[ticker].totalCost =
                    positions[ticker].totalCost * (positions[ticker].quantity / (positions[ticker].quantity + qty));
            } else {
                positions[ticker].totalCost = 0;
            }
        }
    }

    // Filtrar posições ativas
    const activePositions = Object.values(positions).filter(p => p.quantity > 0);

    // Buscar cotações atuais
    const tickers = activePositions.map(p => p.asset.ticker);
    const quotes = await brapiClient.getQuotes(tickers);

    // Calcular valores
    let totalCost = 0;
    let totalCurrentValue = 0;

    const portfolio = activePositions.map(pos => {
        pos.averagePrice = pos.quantity > 0 ? pos.totalCost / pos.quantity : 0;

        const quote = quotes[pos.asset.ticker];
        const currentPrice = quote?.price || pos.averagePrice;
        const currentValue = pos.quantity * currentPrice;
        const profit = currentValue - pos.totalCost;
        const profitPercent = pos.totalCost > 0 ? (profit / pos.totalCost) * 100 : 0;

        totalCost += pos.totalCost;
        totalCurrentValue += currentValue;

        return {
            ...pos,
            currentPrice,
            currentValue,
            profit,
            profitPercent,
            quote
        };
    });

    return {
        positions: portfolio,
        summary: {
            totalCost,
            totalCurrentValue,
            totalProfit: totalCurrentValue - totalCost,
            totalProfitPercent: totalCost > 0 ? ((totalCurrentValue - totalCost) / totalCost) * 100 : 0
        }
    };
};

/**
 * Lista ativos disponíveis
 */
const listAssets = async (filters = {}) => {
    const { type, search, page = 1, limit = 50 } = filters;

    const where = {};
    if (type) where.type = type;
    if (search) where.ticker = { [Op.iLike]: `%${search}%` };

    const assets = await Asset.findAll({
        where,
        order: [['ticker', 'ASC']],
        limit,
        offset: (page - 1) * limit
    });

    return assets;
};

/**
 * Determina tipo do ativo pelo ticker
 */
const determineAssetType = (ticker) => {
    const num = ticker.slice(-2);
    if (num === '11') return 'FII';
    if (['31', '32', '33', '34', '35'].includes(num)) return 'BDR';
    if (ticker.length > 5 && ticker.includes('11')) return 'ETF';
    return 'STOCK';
};

module.exports = {
    listInvestments,
    createInvestment,
    getPortfolio,
    listAssets
};
