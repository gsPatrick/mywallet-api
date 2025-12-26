/**
 * Investor Metrics Service - v2.0 AUDITABLE
 * ==========================================
 * 
 * Camada de lógica de negócio para métricas REAIS de investimentos.
 * 
 * PRIORIDADES IMPLEMENTADAS:
 * 1. AUDITABILIDADE - Todo cálculo tem breakdown explícito
 * 2. ANÁLISE TEMPORAL - Trends 3m, 6m, YTD, 12m
 * 3. RISCO EXPLICÁVEL - Reasons array para cada nível de risco
 */

const { Dividend, Investment, Asset, FIIData } = require('../../models');
const { Op } = require('sequelize');
const { logger } = require('../../config/logger');

// =============================================================================
// HELPER: DETERMINAR STATUS DE TREND
// =============================================================================
const determineTrendStatus = (current, previous) => {
    if (previous === 0) return 'STABLE';
    const changePercent = ((current - previous) / previous) * 100;
    if (changePercent > 5) return 'GROWING';
    if (changePercent < -5) return 'DECLINING';
    return 'STABLE';
};

// =============================================================================
// 1. DIVIDENDOS RECEBIDOS - COM AUDITABILIDADE E TRENDS
// =============================================================================
const calculateDividendsReceived = async (userId, ticker = null) => {
    const now = new Date();

    // Períodos de tempo
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Para trends: últimos 3 meses vs 3 anteriores
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // Base where clause
    const whereClause = { userId };
    if (ticker) {
        const asset = await Asset.findOne({ where: { ticker } });
        if (asset) whereClause.assetId = asset.id;
    }

    // Buscar todos os dividendos
    const allDividends = await Dividend.findAll({
        where: whereClause,
        include: [{
            model: Asset,
            as: 'asset',
            attributes: ['ticker', 'name', 'type']
        }],
        order: [['paymentDate', 'DESC']]
    });

    // Agrupar por período
    const monthDividends = allDividends.filter(d => new Date(d.paymentDate) >= startOfMonth);
    const yearDividends = allDividends.filter(d => new Date(d.paymentDate) >= startOfYear);
    const last3m = allDividends.filter(d => new Date(d.paymentDate) >= threeMonthsAgo);
    const prev3m = allDividends.filter(d => {
        const date = new Date(d.paymentDate);
        return date >= sixMonthsAgo && date < threeMonthsAgo;
    });
    const last6m = allDividends.filter(d => new Date(d.paymentDate) >= sixMonthsAgo);
    const prev6m = allDividends.filter(d => {
        const date = new Date(d.paymentDate);
        return date >= twelveMonthsAgo && date < sixMonthsAgo;
    });
    const last12m = allDividends.filter(d => new Date(d.paymentDate) >= twelveMonthsAgo);

    // Funções de soma
    const sumDividends = (divs) => divs.reduce((sum, d) => sum + parseFloat(d.totalAmount || 0), 0);

    // Calcular totais
    const monthTotal = sumDividends(monthDividends);
    const yearTotal = sumDividends(yearDividends);
    const allTimeTotal = sumDividends(allDividends);
    const last3mTotal = sumDividends(last3m);
    const prev3mTotal = sumDividends(prev3m);
    const last6mTotal = sumDividends(last6m);
    const prev6mTotal = sumDividends(prev6m);
    const last12mTotal = sumDividends(last12m);

    // Agrupa por mês para histórico
    const monthlyBreakdown = {};
    allDividends.forEach(d => {
        const monthKey = new Date(d.paymentDate).toISOString().slice(0, 7);
        if (!monthlyBreakdown[monthKey]) monthlyBreakdown[monthKey] = { total: 0, count: 0 };
        monthlyBreakdown[monthKey].total += parseFloat(d.totalAmount || 0);
        monthlyBreakdown[monthKey].count++;
    });

    // Agrupar por ativo para breakdown
    const byAsset = {};
    allDividends.forEach(d => {
        const t = d.asset?.ticker || 'UNKNOWN';
        if (!byAsset[t]) byAsset[t] = { total: 0, count: 0 };
        byAsset[t].total += parseFloat(d.totalAmount || 0);
        byAsset[t].count++;
    });

    // Recentes
    const recentDividends = allDividends.slice(0, 10).map(d => ({
        ticker: d.asset?.ticker,
        name: d.asset?.name,
        type: d.asset?.type,
        amount: parseFloat(d.totalAmount || 0),
        amountPerUnit: parseFloat(d.amountPerUnit || 0),
        paymentDate: d.paymentDate
    }));

    return {
        // Período atual com breakdown
        month: {
            total: monthTotal,
            count: monthDividends.length,
            breakdown: {
                period: `${startOfMonth.toISOString().slice(0, 10)} a ${now.toISOString().slice(0, 10)}`,
                dividendsList: monthDividends.map(d => ({
                    ticker: d.asset?.ticker,
                    amount: parseFloat(d.totalAmount || 0),
                    date: d.paymentDate
                }))
            }
        },
        year: {
            total: yearTotal,
            count: yearDividends.length,
            breakdown: {
                period: `${startOfYear.toISOString().slice(0, 10)} a ${now.toISOString().slice(0, 10)}`,
                byMonth: monthlyBreakdown
            }
        },
        allTime: {
            total: allTimeTotal,
            count: allDividends.length,
            breakdown: {
                byAsset: Object.entries(byAsset).map(([ticker, data]) => ({
                    ticker,
                    total: data.total,
                    count: data.count
                })).sort((a, b) => b.total - a.total)
            }
        },
        // TRENDS TEMPORAIS
        trends: {
            threeMonths: {
                value: last3mTotal,
                previous: prev3mTotal,
                changePercent: prev3mTotal > 0 ? ((last3mTotal - prev3mTotal) / prev3mTotal) * 100 : 0,
                status: determineTrendStatus(last3mTotal, prev3mTotal)
            },
            sixMonths: {
                value: last6mTotal,
                previous: prev6mTotal,
                changePercent: prev6mTotal > 0 ? ((last6mTotal - prev6mTotal) / prev6mTotal) * 100 : 0,
                status: determineTrendStatus(last6mTotal, prev6mTotal)
            },
            ytd: {
                value: yearTotal,
                daysElapsed: Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)),
                averagePerDay: yearTotal / Math.max(1, Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24)))
            },
            twelveMonths: {
                value: last12mTotal,
                monthlyAverage: last12mTotal / 12
            }
        },
        recentDividends,
        monthlyBreakdown
    };
};

// =============================================================================
// 2. RENTABILIDADE COM BREAKDOWN AUDITÁVEL
// =============================================================================
const calculateAssetRentability = (position, dividendsReceived) => {
    const capitalInvested = position.totalCost || 0;
    const currentValue = position.currentBalance || 0;
    const capitalGain = currentValue - capitalInvested;
    const capitalGainPercent = capitalInvested > 0 ? (capitalGain / capitalInvested) * 100 : 0;
    const dividendsPercent = capitalInvested > 0 ? (dividendsReceived / capitalInvested) * 100 : 0;
    const totalReturn = capitalGain + dividendsReceived;
    const totalReturnPercent = capitalInvested > 0 ? (totalReturn / capitalInvested) * 100 : 0;

    return {
        totalReturnPercent,
        // BREAKDOWN AUDITÁVEL
        breakdown: {
            investedCapital: capitalInvested,
            currentValue: currentValue,
            dividendsReceived: dividendsReceived,
            capitalGain: capitalGain,
            formula: 'totalReturn = capitalGain + dividendsReceived',
            calculation: `${capitalGain.toFixed(2)} + ${dividendsReceived.toFixed(2)} = ${totalReturn.toFixed(2)}`
        },
        // Detalhes
        capitalGainPercent,
        dividendsPercent,
        totalReturn
    };
};

// =============================================================================
// 3. RISCO EXPLICÁVEL - COM REASONS
// =============================================================================
const calculateExplainableRisk = (position, concentration, allPositions) => {
    const reasons = [];
    let level = 'LOW';

    // 1. Concentração acima de 25%
    const concentrationPercent = concentration?.percentage || 0;
    if (concentrationPercent > 25) {
        reasons.push(`Concentração acima de 25% (${concentrationPercent.toFixed(1)}%)`);
        level = 'HIGH';
    } else if (concentrationPercent > 15) {
        reasons.push(`Concentração moderada (${concentrationPercent.toFixed(1)}%)`);
        if (level !== 'HIGH') level = 'MEDIUM';
    }

    // 2. Baixa liquidez (para FIIs)
    if (position.fiiAnalytics?.dailyLiquidity) {
        const liquidity = position.fiiAnalytics.dailyLiquidity;
        if (liquidity < 500000) {
            reasons.push(`Baixa liquidez diária (R$ ${(liquidity / 1000).toFixed(0)}K)`);
            level = 'HIGH';
        } else if (liquidity < 1000000) {
            reasons.push(`Liquidez moderada (R$ ${(liquidity / 1000000).toFixed(1)}M)`);
            if (level !== 'HIGH') level = 'MEDIUM';
        }
    }

    // 3. Dividendos inconsistentes
    if (position.fiiAnalytics?.paymentConsistency) {
        const consistency = position.fiiAnalytics.paymentConsistency;
        if (consistency < 80) {
            reasons.push(`Dividendos inconsistentes (${consistency.toFixed(0)}% consistência)`);
            level = 'HIGH';
        } else if (consistency < 90) {
            reasons.push(`Consistência de dividendos moderada (${consistency.toFixed(0)}%)`);
            if (level !== 'HIGH') level = 'MEDIUM';
        }
    }

    // 4. Tendência de dividendos em queda
    if (position.fiiAnalytics?.dividendTrend === 'FALLING') {
        reasons.push('Dividendos em tendência de queda');
        level = 'HIGH';
    }

    // 5. P/VP muito alto (prêmio)
    if (position.fiiAnalytics?.pvp) {
        const pvp = position.fiiAnalytics.pvp;
        if (pvp > 1.2) {
            reasons.push(`P/VP elevado (${pvp.toFixed(2)})`);
            if (level !== 'HIGH') level = 'MEDIUM';
        }
    }

    // 6. Rentabilidade negativa
    if (position.rentability?.totalReturnPercent < -10) {
        reasons.push(`Rentabilidade negativa (${position.rentability.totalReturnPercent.toFixed(1)}%)`);
        level = 'HIGH';
    } else if (position.rentability?.totalReturnPercent < 0) {
        reasons.push(`Rentabilidade levemente negativa (${position.rentability.totalReturnPercent.toFixed(1)}%)`);
        if (level !== 'HIGH') level = 'MEDIUM';
    }

    // Se não houver riscos, é LOW
    if (reasons.length === 0) {
        reasons.push('Sem fatores de risco identificados');
    }

    return {
        level,
        reasons,
        score: level === 'HIGH' ? 30 : level === 'MEDIUM' ? 60 : 90
    };
};

// =============================================================================
// 4. CONCENTRAÇÃO
// =============================================================================
const calculateConcentration = (positions) => {
    const totalValue = positions.reduce((sum, p) => sum + (p.currentBalance || 0), 0);

    const byAsset = positions.map(p => ({
        ticker: p.ticker,
        name: p.name,
        type: p.type,
        value: p.currentBalance || 0,
        percentage: totalValue > 0 ? ((p.currentBalance || 0) / totalValue) * 100 : 0
    })).sort((a, b) => b.percentage - a.percentage);

    const byType = {};
    positions.forEach(p => {
        const type = p.type || 'OTHER';
        if (!byType[type]) byType[type] = { value: 0, count: 0 };
        byType[type].value += p.currentBalance || 0;
        byType[type].count++;
    });

    const byTypeArray = Object.entries(byType).map(([type, data]) => ({
        type,
        value: data.value,
        count: data.count,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0
    })).sort((a, b) => b.percentage - a.percentage);

    const bySegment = {};
    positions.forEach(p => {
        const segment = p.fiiAnalytics?.segment || (p.type === 'FII' ? 'Não classificado' : null);
        if (segment) {
            if (!bySegment[segment]) bySegment[segment] = { value: 0, count: 0 };
            bySegment[segment].value += p.currentBalance || 0;
            bySegment[segment].count++;
        }
    });

    const bySegmentArray = Object.entries(bySegment).map(([segment, data]) => ({
        segment,
        value: data.value,
        count: data.count,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0
    })).sort((a, b) => b.percentage - a.percentage);

    const topAssetConcentration = byAsset[0]?.percentage || 0;
    const top3Concentration = byAsset.slice(0, 3).reduce((sum, a) => sum + a.percentage, 0);

    return {
        byAsset,
        byType: byTypeArray,
        bySegment: bySegmentArray,
        totalValue,
        indicators: {
            topAssetConcentration,
            top3Concentration,
            isOverConcentrated: topAssetConcentration > 25,
            numberOfAssets: positions.length
        }
    };
};

// =============================================================================
// 5. RANKINGS
// =============================================================================
const generateRankings = (positionsWithRentability) => {
    const topDividendPayers = [...positionsWithRentability]
        .filter(p => p.dy > 0)
        .sort((a, b) => b.dy - a.dy)
        .slice(0, 5)
        .map(p => ({
            ticker: p.ticker,
            name: p.name,
            dy: p.dy,
            lastDividend: p.lastDividendPerShare
        }));

    const topByWeight = [...positionsWithRentability]
        .sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0))
        .slice(0, 5)
        .map(p => ({
            ticker: p.ticker,
            name: p.name,
            value: p.currentBalance,
            percentage: p.concentration?.percentage || 0
        }));

    const mostProfitable = [...positionsWithRentability]
        .sort((a, b) => (b.rentability?.totalReturnPercent || 0) - (a.rentability?.totalReturnPercent || 0))
        .slice(0, 5)
        .map(p => ({
            ticker: p.ticker,
            name: p.name,
            totalReturnPercent: p.rentability?.totalReturnPercent || 0,
            breakdown: p.rentability?.breakdown
        }));

    const leastProfitable = [...positionsWithRentability]
        .sort((a, b) => (a.rentability?.totalReturnPercent || 0) - (b.rentability?.totalReturnPercent || 0))
        .slice(0, 5)
        .map(p => ({
            ticker: p.ticker,
            name: p.name,
            totalReturnPercent: p.rentability?.totalReturnPercent || 0,
            breakdown: p.rentability?.breakdown
        }));

    const byRiskLevel = {
        low: positionsWithRentability.filter(p => p.risk?.level === 'LOW').length,
        medium: positionsWithRentability.filter(p => p.risk?.level === 'MEDIUM').length,
        high: positionsWithRentability.filter(p => p.risk?.level === 'HIGH').length
    };

    return {
        topDividendPayers,
        topByWeight,
        mostProfitable,
        leastProfitable,
        byRiskLevel
    };
};

// =============================================================================
// 6. SAÚDE DA CARTEIRA COM BREAKDOWN
// =============================================================================
const calculatePortfolioHealth = (positions, concentration) => {
    let score = 100;
    const issues = [];
    const scoreBreakdown = [];

    // 1. Concentração
    if (concentration.indicators.topAssetConcentration > 30) {
        score -= 20;
        issues.push('Concentração excessiva em um único ativo');
        scoreBreakdown.push({ factor: 'Concentração > 30%', impact: -20 });
    } else if (concentration.indicators.topAssetConcentration > 20) {
        score -= 10;
        issues.push('Concentração moderada em um ativo');
        scoreBreakdown.push({ factor: 'Concentração > 20%', impact: -10 });
    }

    // 2. Top 3
    if (concentration.indicators.top3Concentration > 60) {
        score -= 15;
        issues.push('Top 3 ativos representam mais de 60% da carteira');
        scoreBreakdown.push({ factor: 'Top 3 > 60%', impact: -15 });
    }

    // 3. Alto risco
    const highRiskCount = positions.filter(p => p.risk?.level === 'HIGH').length;
    if (highRiskCount > 2) {
        score -= 15;
        issues.push(`${highRiskCount} ativos classificados como alto risco`);
        scoreBreakdown.push({ factor: `${highRiskCount} ativos alto risco`, impact: -15 });
    } else if (highRiskCount > 0) {
        score -= 5 * highRiskCount;
        scoreBreakdown.push({ factor: `${highRiskCount} ativo(s) alto risco`, impact: -5 * highRiskCount });
    }

    // 4. Diversificação
    if (positions.length < 5) {
        score -= 10;
        issues.push('Baixa diversificação (menos de 5 ativos)');
        scoreBreakdown.push({ factor: 'Menos de 5 ativos', impact: -10 });
    }

    // 5. Bônus dividendos em alta
    const risingDividends = positions.filter(p => p.fiiAnalytics?.dividendTrend === 'RISING').length;
    if (risingDividends > 0) {
        const bonus = 5 * Math.min(risingDividends, 3);
        score += bonus;
        scoreBreakdown.push({ factor: `${risingDividends} FII(s) dividendos em alta`, impact: +bonus });
    }

    score = Math.max(0, Math.min(100, score));

    let status = 'EXCELLENT';
    if (score < 50) status = 'POOR';
    else if (score < 70) status = 'FAIR';
    else if (score < 85) status = 'GOOD';

    return {
        score,
        status,
        issues,
        // BREAKDOWN AUDITÁVEL
        breakdown: {
            baseScore: 100,
            adjustments: scoreBreakdown,
            finalScore: score,
            formula: 'score = 100 + sum(adjustments)'
        }
    };
};

// =============================================================================
// 7. INDICADORES-CHAVE
// =============================================================================
const identifyKeyIndicators = (positionsWithRentability, concentration) => {
    const mostProfitable = positionsWithRentability.reduce((best, p) => {
        const returnPercent = p.rentability?.totalReturnPercent || 0;
        if (!best || returnPercent > (best.rentability?.totalReturnPercent || 0)) return p;
        return best;
    }, null);

    const highRiskAssets = positionsWithRentability.filter(p => p.risk?.level === 'HIGH');
    const topConcentration = concentration.byAsset[0];
    const topSegment = concentration.bySegment[0];

    return {
        mostProfitable: mostProfitable ? {
            ticker: mostProfitable.ticker,
            name: mostProfitable.name,
            totalReturnPercent: mostProfitable.rentability?.totalReturnPercent,
            breakdown: mostProfitable.rentability?.breakdown
        } : null,
        highRiskCount: highRiskAssets.length,
        highRiskAssets: highRiskAssets.map(p => ({
            ticker: p.ticker,
            riskLevel: p.risk?.level,
            reasons: p.risk?.reasons || []
        })),
        topConcentration: topConcentration ? {
            ticker: topConcentration.ticker,
            percentage: topConcentration.percentage
        } : null,
        topSegment: topSegment ? {
            segment: topSegment.segment,
            percentage: topSegment.percentage
        } : null,
        portfolioHealth: calculatePortfolioHealth(positionsWithRentability, concentration)
    };
};

// =============================================================================
// 8. MÉTRICAS DA CARTEIRA COM BREAKDOWN
// =============================================================================
const calculatePortfolioMetrics = (positionsWithRentability) => {
    const totalInvested = positionsWithRentability.reduce((sum, p) =>
        sum + (p.rentability?.breakdown?.investedCapital || 0), 0);

    const currentValue = positionsWithRentability.reduce((sum, p) =>
        sum + (p.rentability?.breakdown?.currentValue || 0), 0);

    const totalDividendsReceived = positionsWithRentability.reduce((sum, p) =>
        sum + (p.rentability?.breakdown?.dividendsReceived || 0), 0);

    const totalCapitalGain = currentValue - totalInvested;
    const totalReturn = totalCapitalGain + totalDividendsReceived;

    return {
        totalReturnPercent: totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0,
        // BREAKDOWN AUDITÁVEL
        breakdown: {
            investedCapital: totalInvested,
            currentValue: currentValue,
            dividendsReceived: totalDividendsReceived,
            capitalGain: totalCapitalGain,
            totalReturn: totalReturn,
            formula: 'totalReturn = capitalGain + dividendsReceived',
            calculation: `(${currentValue.toFixed(2)} - ${totalInvested.toFixed(2)}) + ${totalDividendsReceived.toFixed(2)} = ${totalReturn.toFixed(2)}`
        },
        capitalGainPercent: totalInvested > 0 ? (totalCapitalGain / totalInvested) * 100 : 0,
        dividendsPercent: totalInvested > 0 ? (totalDividendsReceived / totalInvested) * 100 : 0,
        averageDY: positionsWithRentability.length > 0
            ? positionsWithRentability.reduce((sum, p) => sum + (p.dy || 0), 0) / positionsWithRentability.length
            : 0,
        projectedMonthlyIncome: positionsWithRentability.reduce((sum, p) => {
            return sum + (p.lastDividendPerShare || 0) * (p.quantity || 0);
        }, 0),
        numberOfAssets: positionsWithRentability.length
    };
};

module.exports = {
    calculateDividendsReceived,
    calculateAssetRentability,
    calculateExplainableRisk,
    calculateConcentration,
    generateRankings,
    identifyKeyIndicators,
    calculatePortfolioHealth,
    calculatePortfolioMetrics
};
