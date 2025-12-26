/**
 * Investments Service
 * Gerencia a carteira do usuário e busca de ativos
 */

const { Investment, Asset, FinancialProduct, Dividend, FIIData } = require('../../models');
const yahooClient = require('./yahoo.client');
const fiiSyncService = require('./fiiSync.service');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');
const { logger } = require('../../config/logger');

/**
 * Lista ativos disponíveis no banco de dados (Catálogo)
 * Usado na aba "Mercado" e no Autocomplete
 * Suporta: search, type, page, limit
 */
const listAssets = async (filters = {}) => {
    const { search, type, page = 1, limit = 50 } = filters;
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

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const assets = await Asset.findAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [['ticker', 'ASC']],
        attributes: ['id', 'ticker', 'name', 'type', 'logoUrl', 'sector']
    });

    // Também conta o total para paginação
    const total = await Asset.count({ where });

    // Tenta buscar cotação atual para a lista de mercado ficar bonita
    // (Opcional: pode deixar sem preço na busca se ficar lento)
    const tickers = assets.map(a => a.ticker);
    const quotes = await yahooClient.getQuotes(tickers);

    return {
        assets: assets.map(asset => ({
            ...asset.toJSON(),
            price: quotes[asset.ticker]?.price || 0,
            change: quotes[asset.ticker]?.changePercent || 0
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
        }
    };
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
    const { ticker, operationType, quantity, price, brokerageFee, date, broker, brokerId, profileId } = data;

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

    // 2. Resolver brokerId (Smart Fallback)
    let resolvedBrokerId = brokerId;
    if (!resolvedBrokerId && profileId) {
        // Busca corretora padrão do perfil
        const brokersService = require('../brokers/brokers.service');
        let defaultBroker = await brokersService.getDefaultBroker(userId, profileId);

        // Se não existir, cria automaticamente
        if (!defaultBroker) {
            defaultBroker = await brokersService.ensureDefaultBroker(userId, profileId);
        }

        resolvedBrokerId = defaultBroker?.id || null;
    }

    // 3. Salva a operação
    const investment = await Investment.create({
        userId,
        profileId: profileId || null,
        assetId: asset.id,
        operationType,
        quantity,
        price,
        brokerageFee: brokerageFee || 0,
        date: date || new Date(),
        broker,  // Legacy field (string)
        brokerId: resolvedBrokerId  // New FK field
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

    // 3. Busca dividendos dos últimos 12 meses para cálculo do DY (especialmente FIIs)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const dividends = await Dividend.findAll({
        where: {
            userId,
            paymentDate: { [Op.gte]: twelveMonthsAgo }
        },
        include: [{ model: Asset, as: 'asset', attributes: ['ticker', 'type'] }]
    });

    // Agrupa dividendos por ticker para cálculo rápido
    const dividendsByTicker = {};
    dividends.forEach(d => {
        const ticker = d.asset?.ticker;
        if (ticker) {
            if (!dividendsByTicker[ticker]) {
                dividendsByTicker[ticker] = { total: 0, count: 0, lastDividend: 0, lastDate: null };
            }
            const amount = parseFloat(d.amountPerUnit || 0);
            dividendsByTicker[ticker].total += amount;
            dividendsByTicker[ticker].count++;

            // Track most recent dividend
            const payDate = new Date(d.paymentDate);
            if (!dividendsByTicker[ticker].lastDate || payDate > dividendsByTicker[ticker].lastDate) {
                dividendsByTicker[ticker].lastDate = payDate;
                dividendsByTicker[ticker].lastDividend = amount;
            }
        }
    });

    const positionsMap = {};
    const tickersToFetch = new Set();

    // 4. Processa Renda Variável
    investments.forEach(inv => {
        const ticker = inv.asset.ticker;
        tickersToFetch.add(ticker);

        if (!positionsMap[ticker]) {
            positionsMap[ticker] = {
                ticker,
                name: inv.asset.name,
                logoUrl: inv.asset.logoUrl,
                type: inv.asset.type,
                assetId: inv.asset.id,
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

    // 5. Busca Cotações Yahoo
    const quotes = await yahooClient.getQuotes(Array.from(tickersToFetch));

    // 5.1 Busca dados de FIIs do cache (Funds Explorer scraper)
    const fiiTickers = Object.values(positionsMap)
        .filter(p => p.type === 'FII')
        .map(p => p.ticker);

    const fiiDataRecords = await FIIData.findAll({
        where: { ticker: { [Op.in]: fiiTickers } }
    });

    const fiiDataMap = {};
    fiiDataRecords.forEach(fd => {
        fiiDataMap[fd.ticker] = fd;
    });

    let totalInvested = 0;
    let totalCurrentBalance = 0;

    // 6. Monta posições de Renda Variável
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

            // DY calculation strategy:
            // 1. For FIIs: Use FIIData from Funds Explorer scraper (most reliable)
            // 2. For Stocks: Use Yahoo Finance API
            // 3. Fallback: Calculate from Dividend table
            let dyPercentage = 0;
            let annualDividendPerShare = 0;
            let lastDividendPerShare = 0;

            // FII-specific analytics
            let fiiAnalytics = null;

            if (p.type === 'FII') {
                // FII: Use Funds Explorer scraped data
                const fiiData = fiiDataMap[p.ticker];
                if (fiiData) {
                    dyPercentage = parseFloat(fiiData.dividendYieldYear) || parseFloat(fiiData.dividendYield) || 0;
                    annualDividendPerShare = parseFloat(fiiData.annualDividendSum) || 0;
                    lastDividendPerShare = parseFloat(fiiData.lastDividend) || 0;

                    // Complete FII analytics for investor
                    fiiAnalytics = {
                        segment: fiiData.segment,
                        pvp: parseFloat(fiiData.pvp) || null,
                        pvpStatus: fiiData.pvpStatus,
                        netWorth: parseFloat(fiiData.netWorth) || null,
                        dailyLiquidity: parseFloat(fiiData.dailyLiquidity) || null,
                        shareholders: fiiData.shareholders,
                        dividendYieldMonth: parseFloat(fiiData.dividendYieldMonth) || null,
                        dividendTrend: fiiData.dividendTrend,
                        paymentConsistency: parseFloat(fiiData.paymentConsistency) || null,
                        riskLevel: fiiData.riskLevel,
                        dividendHistory: fiiData.dividendHistory || [],
                        lastSyncAt: fiiData.lastSyncAt
                    };
                }
            } else {
                // Stocks: Use Yahoo Finance
                dyPercentage = quote?.dividendYield || 0;
                annualDividendPerShare = quote?.dividendRate || 0;
            }

            // Fallback: If still 0, use Dividend table
            if (dyPercentage === 0 && dividendsByTicker[p.ticker] && currentPrice > 0) {
                annualDividendPerShare = dividendsByTicker[p.ticker].total;
                dyPercentage = (annualDividendPerShare / currentPrice) * 100;
                lastDividendPerShare = dividendsByTicker[p.ticker].lastDividend || 0;
            }

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
                // Dividend data for Magic Number calculation
                dy: dyPercentage,
                dividendRate: annualDividendPerShare,
                lastDividendPerShare: lastDividendPerShare,
                // FII-specific analytics (null for stocks)
                fiiAnalytics: fiiAnalytics,
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

    // =====================================================
    // 7. MÉTRICAS DO INVESTIDOR (Investor-Oriented)
    // Cálculos reais de dividendos, rentabilidade, concentração
    // =====================================================
    const investorMetrics = require('./investorMetrics.service');

    // 7.1 Buscar dividendos recebidos pelo usuário
    const dividendsData = await investorMetrics.calculateDividendsReceived(userId);

    // 7.2 Calcular dividendos por ativo para rentabilidade
    const dividendsByAsset = {};
    dividendsData.allTime?.breakdown?.byAsset?.forEach(d => {
        if (d.ticker) {
            dividendsByAsset[d.ticker] = d.total;
        }
    });

    // 7.3 Adicionar rentabilidade a cada posição
    const allPositions = [...variableIncomePositions, ...fixedIncomePositions];

    // 7.4 Calcular concentração primeiro (necessário para risco)
    const tempPositions = allPositions.map(pos => {
        const assetDividends = dividendsByAsset[pos.ticker] || 0;
        const rentability = investorMetrics.calculateAssetRentability(pos, assetDividends);
        return { ...pos, rentability };
    });

    const concentration = investorMetrics.calculateConcentration(tempPositions);

    // 7.5 Adicionar concentração e RISCO EXPLICÁVEL a cada posição
    const positionsWithRentability = tempPositions.map(pos => {
        const assetConc = concentration.byAsset.find(a => a.ticker === pos.ticker);
        const concentrationData = assetConc ? { percentage: assetConc.percentage } : null;

        // RISCO EXPLICÁVEL com reasons
        const risk = investorMetrics.calculateExplainableRisk(pos, concentrationData, tempPositions);

        return {
            ...pos,
            concentration: concentrationData,
            risk
        };
    });

    // 7.6 Gerar rankings
    const rankings = investorMetrics.generateRankings(positionsWithRentability);

    // 7.7 Identificar indicadores-chave
    const indicators = investorMetrics.identifyKeyIndicators(positionsWithRentability, concentration);

    // 7.8 Métricas consolidadas da carteira
    const portfolioMetrics = investorMetrics.calculatePortfolioMetrics(positionsWithRentability);

    return {
        // Sumário básico (mantido para compatibilidade)
        summary: {
            totalInvested,
            totalCurrentBalance,
            totalProfit: totalCurrentBalance - totalInvested,
            totalProfitPercent: totalInvested > 0
                ? ((totalCurrentBalance - totalInvested) / totalInvested) * 100
                : 0
        },

        // Posições com rentabilidade e concentração
        positions: positionsWithRentability,

        // Alocação por tipo
        allocation: calculateAllocation(positionsWithRentability, totalCurrentBalance),

        // =====================================================
        // DADOS ORIENTADOS AO INVESTIDOR (AUDITÁVEIS)
        // =====================================================

        // Dividendos recebidos (mês, ano, total) COM BREAKDOWN E TRENDS
        dividends: {
            month: dividendsData.month,
            year: dividendsData.year,
            allTime: dividendsData.allTime,
            // TRENDS TEMPORAIS
            trends: dividendsData.trends,
            recent: dividendsData.recentDividends?.slice(0, 5),
            projectedMonthlyIncome: portfolioMetrics.projectedMonthlyIncome
        },

        // Concentração da carteira
        concentration: {
            byType: concentration.byType,
            bySegment: concentration.bySegment,
            topAssets: concentration.byAsset.slice(0, 5),
            indicators: concentration.indicators
        },

        // Rankings
        rankings,

        // Indicadores-chave
        indicators,

        // Métricas consolidadas da carteira
        portfolioMetrics
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
 * Obtém evolução histórica do portfólio para gráfico de rentabilidade
 * @param {number} userId - ID do usuário
 * @param {number} months - Número de meses para buscar (1, 3, 6, 12, 60)
 */
const getPortfolioEvolution = async (userId, months = 12) => {
    const { InvestmentSnapshot } = require('../../models');

    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth() + 1; // JS months are 0-indexed

    // Calculate cutoff date
    const cutoffDate = new Date(now);
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffYear = cutoffDate.getFullYear();
    const cutoffMonth = cutoffDate.getMonth() + 1;

    // Busca snapshots históricos ordenados por ano/mês
    const snapshots = await InvestmentSnapshot.findAll({
        where: {
            userId,
            [Op.or]: [
                { year: { [Op.gt]: cutoffYear } },
                {
                    year: cutoffYear,
                    month: { [Op.gte]: cutoffMonth }
                }
            ]
        },
        order: [['year', 'ASC'], ['month', 'ASC']],
        attributes: ['month', 'year', 'marketValue', 'totalCost', 'profit', 'profitPercent']
    });

    // Se não houver snapshots, retorna dados simulados
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

    // Mapeia snapshots reais para formato do gráfico
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

    // Calcula rentabilidade do período
    const firstValue = data[0]?.invested || 1;
    const lastValue = data[data.length - 1]?.value || 0;
    const returnPercent = ((lastValue - firstValue) / firstValue) * 100;

    // CDI aproximado (11.25% ao ano)
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