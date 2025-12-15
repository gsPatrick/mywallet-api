/**
 * Investment Dashboard Service
 * ========================================
 * Dashboard EXCLUSIVO para investimentos
 * NÃO mistura com gastos/cartões
 * 
 * SEPARAÇÃO CLARA:
 * - Asset (B3): STOCK, FII, ETF, BDR
 * - FinancialProduct: RENDA_FIXA, CRYPTO, PREVIDENCIA, etc.
 * ========================================
 */

const {
    Investment,
    Asset,
    Dividend,
    InvestmentSnapshot,
    FinancialProduct,
    sequelize
} = require('../../models');
const brapiClient = require('../investments/brapi.client');
const { Op } = require('sequelize');

// ===========================================
// MÉTRICAS PRINCIPAIS
// ===========================================

/**
 * Obtém resumo completo do portfólio de investimentos
 * COMBINA: Assets (B3) + FinancialProducts
 */
const getPortfolioSummary = async (userId) => {
    // ========================================
    // 1. ATIVOS B3 (via Brapi)
    // ========================================
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
        order: [['date', 'ASC']]
    });

    const positions = calculatePositions(investments);
    const activePositions = Object.values(positions).filter(p => p.quantity > 0);

    // Buscar cotações
    const tickers = activePositions.map(p => p.asset.ticker);
    const quotes = await brapiClient.getQuotes(tickers);

    // Calcular valores atuais de B3
    let b3Cost = 0;
    let b3MarketValue = 0;
    const enrichedPositions = {};

    for (const pos of activePositions) {
        const quote = quotes[pos.asset.ticker];
        const currentPrice = quote?.price || pos.averagePrice;
        const marketValue = pos.quantity * currentPrice;
        const profit = marketValue - pos.totalCost;
        const profitPercent = pos.totalCost > 0 ? (profit / pos.totalCost) * 100 : 0;

        b3Cost += pos.totalCost;
        b3MarketValue += marketValue;

        enrichedPositions[pos.asset.ticker] = {
            ...pos,
            source: 'B3',
            currentPrice,
            marketValue,
            profit,
            profitPercent,
            lastUpdate: quote?.updatedAt || null
        };
    }

    // ========================================
    // 2. PRODUTOS FINANCEIROS (Renda Fixa, Crypto, etc.)
    // ========================================
    const financialProducts = await FinancialProduct.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    let fpInvested = 0;
    let fpCurrentValue = 0;

    for (const fp of financialProducts) {
        const invested = parseFloat(fp.investedAmount);
        const current = fp.currentValue ? parseFloat(fp.currentValue) : invested;

        fpInvested += invested;
        fpCurrentValue += current;
    }

    // ========================================
    // 3. TOTAIS COMBINADOS
    // ========================================
    const totalCost = b3Cost + fpInvested;
    const totalMarketValue = b3MarketValue + fpCurrentValue;

    // Calcular alocação por tipo (B3 + FinancialProducts)
    const allocationByType = calculateCombinedAllocation(enrichedPositions, financialProducts, totalMarketValue);

    // Buscar proventos
    const dividends = await getTotalDividends(userId);

    return {
        summary: {
            // Totais
            totalInvested: totalCost,
            marketValue: totalMarketValue,
            profit: totalMarketValue - totalCost,
            profitPercent: totalCost > 0 ? ((totalMarketValue - totalCost) / totalCost) * 100 : 0,
            dividendsReceived: dividends.total,
            // B3 separado
            b3Invested: b3Cost,
            b3MarketValue,
            b3Profit: b3MarketValue - b3Cost,
            // Produtos Financeiros separado
            financialProductsInvested: fpInvested,
            financialProductsValue: fpCurrentValue,
            financialProductsProfit: fpCurrentValue - fpInvested,
            // Contagens
            b3PositionsCount: activePositions.length,
            financialProductsCount: financialProducts.length
        },
        allocation: allocationByType,
        b3Positions: Object.values(enrichedPositions),
        financialProducts: financialProducts.map(fp => ({
            id: fp.id,
            type: fp.type,
            subtype: fp.subtype,
            name: fp.name,
            investedAmount: parseFloat(fp.investedAmount),
            currentValue: fp.currentValue ? parseFloat(fp.currentValue) : null,
            profit: fp.getProfit(),
            profitPercent: fp.getProfitPercent(),
            calculationSource: fp.calculationSource
        }))
    };
};

/**
 * Calcula rentabilidade por ativo
 */
const getPerformanceByAsset = async (userId) => {
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
        order: [['date', 'ASC']]
    });

    const positions = calculatePositions(investments);
    const activePositions = Object.values(positions).filter(p => p.quantity > 0);

    const tickers = activePositions.map(p => p.asset.ticker);
    const quotes = await brapiClient.getQuotes(tickers);

    const performance = activePositions.map(pos => {
        const quote = quotes[pos.asset.ticker];
        const currentPrice = quote?.price || pos.averagePrice;
        const marketValue = pos.quantity * currentPrice;
        const profit = marketValue - pos.totalCost;
        const profitPercent = pos.totalCost > 0 ? (profit / pos.totalCost) * 100 : 0;

        // Buscar dividendos do ativo
        return {
            ticker: pos.asset.ticker,
            name: pos.asset.name,
            type: pos.asset.type,
            quantity: pos.quantity,
            averagePrice: pos.averagePrice,
            currentPrice,
            totalCost: pos.totalCost,
            marketValue,
            profit,
            profitPercent,
            dayChange: quote?.change || 0,
            dayChangePercent: quote?.changePercent || 0
        };
    });

    // Ordenar por rentabilidade
    return performance.sort((a, b) => b.profitPercent - a.profitPercent);
};

/**
 * Calcula rentabilidade por classe de ativo
 */
const getPerformanceByClass = async (userId) => {
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
        order: [['date', 'ASC']]
    });

    const positions = calculatePositions(investments);
    const activePositions = Object.values(positions).filter(p => p.quantity > 0);

    const tickers = activePositions.map(p => p.asset.ticker);
    const quotes = await brapiClient.getQuotes(tickers);

    // Agrupar por tipo
    const byClass = {};

    for (const pos of activePositions) {
        const type = pos.asset.type;
        const quote = quotes[pos.asset.ticker];
        const currentPrice = quote?.price || pos.averagePrice;
        const marketValue = pos.quantity * currentPrice;

        if (!byClass[type]) {
            byClass[type] = {
                type,
                totalCost: 0,
                marketValue: 0,
                assetsCount: 0,
                assets: []
            };
        }

        byClass[type].totalCost += pos.totalCost;
        byClass[type].marketValue += marketValue;
        byClass[type].assetsCount += 1;
        byClass[type].assets.push(pos.asset.ticker);
    }

    // Calcular performance
    return Object.values(byClass).map(c => ({
        ...c,
        profit: c.marketValue - c.totalCost,
        profitPercent: c.totalCost > 0 ? ((c.marketValue - c.totalCost) / c.totalCost) * 100 : 0
    })).sort((a, b) => b.marketValue - a.marketValue);
};

// ===========================================
// ALOCAÇÃO E REBALANCEAMENTO
// ===========================================

/**
 * Obtém alocação atual e sugestões de rebalanceamento
 */
const getAllocationAnalysis = async (userId, targetAllocation = null) => {
    const summary = await getPortfolioSummary(userId);

    // Alocação padrão se não definida
    const defaultTarget = {
        'STOCK': 40,
        'FII': 30,
        'ETF': 15,
        'RENDA_FIXA': 10,
        'CRYPTO': 5
    };

    const target = targetAllocation || defaultTarget;
    const current = summary.allocation;
    const totalValue = summary.summary.marketValue;

    const analysis = [];

    for (const [type, targetPercent] of Object.entries(target)) {
        const currentPercent = current[type] || 0;
        const diff = currentPercent - targetPercent;
        const currentValue = (currentPercent / 100) * totalValue;
        const targetValue = (targetPercent / 100) * totalValue;
        const adjustmentNeeded = targetValue - currentValue;

        analysis.push({
            type,
            current: currentPercent,
            target: targetPercent,
            difference: diff,
            currentValue,
            targetValue,
            adjustmentNeeded,
            status: Math.abs(diff) <= 5 ? 'ON_TARGET' : (diff > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT')
        });
    }

    // Verificar concentração excessiva
    const concentrationAlerts = checkConcentration(summary.positions);

    return {
        current,
        target,
        analysis,
        concentrationAlerts,
        totalValue
    };
};

/**
 * Verifica concentração excessiva
 */
const checkConcentration = (positions) => {
    const alerts = [];
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

    // Alerta se um ativo representa mais de 20% do portfólio
    for (const pos of positions) {
        const percent = (pos.marketValue / totalValue) * 100;
        if (percent > 20) {
            alerts.push({
                type: 'ASSET_CONCENTRATION',
                severity: percent > 30 ? 'HIGH' : 'MEDIUM',
                ticker: pos.asset.ticker,
                percent,
                message: `${pos.asset.ticker} representa ${percent.toFixed(1)}% do portfólio`
            });
        }
    }

    return alerts;
};

// ===========================================
// EVOLUÇÃO HISTÓRICA
// ===========================================

/**
 * Obtém evolução patrimonial (histórico)
 */
const getPatrimonyEvolution = async (userId, months = 12) => {
    const snapshots = await InvestmentSnapshot.findAll({
        where: { userId },
        order: [['year', 'DESC'], ['month', 'DESC']],
        limit: months
    });

    // Se não houver snapshots, gerar baseado nos investimentos
    if (snapshots.length === 0) {
        return await generateEvolutionFromInvestments(userId, months);
    }

    return snapshots.reverse().map(s => ({
        period: `${s.year}-${String(s.month).padStart(2, '0')}`,
        totalCost: parseFloat(s.totalCost),
        marketValue: parseFloat(s.marketValue),
        profit: parseFloat(s.profit),
        profitPercent: parseFloat(s.profitPercent),
        contributions: parseFloat(s.contributions),
        dividends: parseFloat(s.dividends)
    }));
};

/**
 * Gera evolução histórica baseado nos investimentos (fallback)
 */
const generateEvolutionFromInvestments = async (userId, months) => {
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
        order: [['date', 'ASC']]
    });

    if (investments.length === 0) return [];

    // Agrupar por mês
    const byMonth = {};

    for (const inv of investments) {
        const date = new Date(inv.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!byMonth[key]) {
            byMonth[key] = { contributions: 0, withdrawals: 0 };
        }

        const value = parseFloat(inv.quantity) * parseFloat(inv.price);
        if (inv.operationType === 'BUY') {
            byMonth[key].contributions += value;
        } else {
            byMonth[key].withdrawals += value;
        }
    }

    // Calcular evolução acumulada
    let cumulative = 0;
    return Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-months)
        .map(([period, data]) => {
            cumulative += data.contributions - data.withdrawals;
            return {
                period,
                totalCost: cumulative,
                marketValue: cumulative, // Simplificação sem cotações históricas
                contributions: data.contributions,
                withdrawals: data.withdrawals
            };
        });
};

// ===========================================
// PROVENTOS
// ===========================================

/**
 * Obtém total de proventos
 */
const getTotalDividends = async (userId, year = null) => {
    const where = { userId, status: 'RECEIVED' };
    if (year) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        where.paymentDate = { [Op.between]: [startDate, endDate] };
    }

    const total = await Dividend.sum('netAmount', { where }) || 0;

    const byType = await Dividend.findAll({
        where,
        attributes: [
            'type',
            [sequelize.fn('SUM', sequelize.col('net_amount')), 'total'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['type'],
        raw: true
    });

    return {
        total: parseFloat(total),
        byType: byType.map(d => ({
            type: d.type,
            total: parseFloat(d.total),
            count: parseInt(d.count)
        }))
    };
};

/**
 * Lista proventos por ativo
 */
const getDividendsByAsset = async (userId) => {
    const dividends = await Dividend.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }],
        order: [['paymentDate', 'DESC']]
    });

    // Agrupar por ativo
    const byAsset = {};

    for (const div of dividends) {
        const ticker = div.asset.ticker;
        if (!byAsset[ticker]) {
            byAsset[ticker] = {
                ticker,
                name: div.asset.name,
                total: 0,
                count: 0,
                items: []
            };
        }

        byAsset[ticker].total += parseFloat(div.netAmount);
        byAsset[ticker].count += 1;
        byAsset[ticker].items.push({
            type: div.type,
            amount: parseFloat(div.netAmount),
            date: div.paymentDate
        });
    }

    return Object.values(byAsset).sort((a, b) => b.total - a.total);
};

// ===========================================
// ALERTAS DE INVESTIMENTOS
// ===========================================

/**
 * Gera alertas de investimentos
 */
const getInvestmentAlerts = async (userId) => {
    const summary = await getPortfolioSummary(userId);
    const allocation = await getAllocationAnalysis(userId);
    const alerts = [];

    // Alertas de concentração
    alerts.push(...allocation.concentrationAlerts);

    // Alertas de performance
    for (const pos of summary.positions) {
        // Queda brusca (mais de 10% de prejuízo)
        if (pos.profitPercent < -10) {
            alerts.push({
                type: 'SIGNIFICANT_LOSS',
                severity: pos.profitPercent < -20 ? 'HIGH' : 'MEDIUM',
                ticker: pos.asset.ticker,
                value: pos.profitPercent,
                message: `${pos.asset.ticker} com ${pos.profitPercent.toFixed(1)}% de prejuízo`
            });
        }

        // Queda no dia (>5%)
        if (pos.dayChangePercent && pos.dayChangePercent < -5) {
            alerts.push({
                type: 'DAY_DROP',
                severity: 'MEDIUM',
                ticker: pos.asset.ticker,
                value: pos.dayChangePercent,
                message: `${pos.asset.ticker} caiu ${Math.abs(pos.dayChangePercent).toFixed(1)}% hoje`
            });
        }
    }

    // Alertas de alocação
    for (const item of allocation.analysis) {
        if (Math.abs(item.difference) > 10) {
            alerts.push({
                type: 'ALLOCATION_DEVIATION',
                severity: Math.abs(item.difference) > 20 ? 'HIGH' : 'MEDIUM',
                assetType: item.type,
                current: item.current,
                target: item.target,
                message: `${item.type}: ${item.current.toFixed(1)}% (alvo: ${item.target}%)`
            });
        }
    }

    return alerts.sort((a, b) => {
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
};

// ===========================================
// HELPERS
// ===========================================

/**
 * Calcula posições a partir dos investimentos
 */
const calculatePositions = (investments) => {
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
            positions[ticker].quantity -= qty;
            if (positions[ticker].quantity > 0) {
                positions[ticker].totalCost =
                    positions[ticker].totalCost * (positions[ticker].quantity / (positions[ticker].quantity + qty));
            } else {
                positions[ticker].totalCost = 0;
            }
        }

        if (positions[ticker].quantity > 0) {
            positions[ticker].averagePrice = positions[ticker].totalCost / positions[ticker].quantity;
        }
    }

    return positions;
};

/**
 * Calcula alocação por tipo
 */
const calculateAllocationByType = (positions, totalValue) => {
    const allocation = {};

    for (const pos of Object.values(positions)) {
        const type = pos.asset.type;
        if (!allocation[type]) allocation[type] = 0;
        allocation[type] += (pos.marketValue / totalValue) * 100;
    }

    return allocation;
};

/**
 * Calcula alocação combinada (B3 + FinancialProducts)
 */
const calculateCombinedAllocation = (b3Positions, financialProducts, totalValue) => {
    if (totalValue === 0) return {};

    const allocation = {};

    // B3 positions
    for (const pos of Object.values(b3Positions)) {
        const type = pos.asset.type;
        if (!allocation[type]) allocation[type] = 0;
        allocation[type] += (pos.marketValue / totalValue) * 100;
    }

    // Financial Products
    for (const fp of financialProducts) {
        const type = fp.type; // RENDA_FIXA, CRYPTO, etc.
        const value = fp.currentValue ? parseFloat(fp.currentValue) : parseFloat(fp.investedAmount);

        if (!allocation[type]) allocation[type] = 0;
        allocation[type] += (value / totalValue) * 100;
    }

    return allocation;
};

module.exports = {
    getPortfolioSummary,
    getPerformanceByAsset,
    getPerformanceByClass,
    getAllocationAnalysis,
    getPatrimonyEvolution,
    getTotalDividends,
    getDividendsByAsset,
    getInvestmentAlerts
};

