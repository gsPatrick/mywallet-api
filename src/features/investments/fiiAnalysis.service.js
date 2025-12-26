/**
 * FII Analysis Service
 * Camada de Interpretação Financeira
 * ===================================
 * 
 * Este serviço NÃO faz scraping. Ele INTERPRETA dados do scraper
 * para gerar insights úteis para o investidor.
 * 
 * Responsabilidades:
 * - Calcular métricas derivadas (tendência, consistência, risco)
 * - Classificar P/VP (desconto/justo/prêmio)
 * - Analisar histórico de dividendos
 * - Gerar flags de alerta para o investidor
 */

const { logger } = require('../../config/logger');

/**
 * Analisa a tendência dos dividendos (últimos 6 meses vs 6 anteriores)
 * @param {Array} dividendHistory - Histórico de dividendos ordenado (recente primeiro)
 * @returns {string} - 'RISING', 'STABLE', 'FALLING', 'UNKNOWN'
 */
const analyzeDividendTrend = (dividendHistory) => {
    if (!dividendHistory || dividendHistory.length < 6) {
        return 'UNKNOWN';
    }

    // Últimos 6 dividendos vs 6 anteriores
    const recent6 = dividendHistory.slice(0, 6);
    const previous6 = dividendHistory.slice(6, 12);

    if (previous6.length < 3) return 'UNKNOWN';

    const avgRecent = recent6.reduce((sum, d) => sum + (d.amount || 0), 0) / recent6.length;
    const avgPrevious = previous6.reduce((sum, d) => sum + (d.amount || 0), 0) / previous6.length;

    if (avgPrevious === 0) return 'UNKNOWN';

    const percentChange = ((avgRecent - avgPrevious) / avgPrevious) * 100;

    if (percentChange > 5) return 'RISING';
    if (percentChange < -5) return 'FALLING';
    return 'STABLE';
};

/**
 * Calcula a consistência de pagamentos
 * @param {number} dividendCount12m - Quantidade de dividendos nos últimos 12 meses
 * @returns {number} - Porcentagem de meses com pagamento (0-100)
 */
const calculatePaymentConsistency = (dividendCount12m) => {
    if (!dividendCount12m || dividendCount12m < 0) return 0;
    // FIIs normalmente pagam mensalmente (12 pagamentos/ano)
    return Math.min(100, (dividendCount12m / 12) * 100);
};

/**
 * Classifica o P/VP
 * @param {number} pvp - Preço sobre Valor Patrimonial
 * @returns {string} - 'DISCOUNT', 'FAIR', 'PREMIUM', 'UNKNOWN'
 */
const classifyPVP = (pvp) => {
    if (!pvp || pvp <= 0) return 'UNKNOWN';

    if (pvp < 0.95) return 'DISCOUNT';    // Negociando abaixo do VP
    if (pvp <= 1.05) return 'FAIR';       // Negociando próximo ao VP
    return 'PREMIUM';                      // Negociando acima do VP
};

/**
 * Avalia o nível de risco do FII
 * Baseado em: liquidez, consistência de pagamentos, P/VP
 * @param {Object} metrics - Métricas do FII
 * @returns {string} - 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'
 */
const assessRiskLevel = (metrics) => {
    let riskScore = 0;
    let factors = 0;

    // Fator 1: Liquidez (< 500k/dia = risco maior)
    if (metrics.dailyLiquidity != null) {
        factors++;
        if (metrics.dailyLiquidity < 500000) riskScore += 2;
        else if (metrics.dailyLiquidity < 1000000) riskScore += 1;
    }

    // Fator 2: Consistência de pagamento (< 80% = risco)
    if (metrics.paymentConsistency != null) {
        factors++;
        if (metrics.paymentConsistency < 80) riskScore += 2;
        else if (metrics.paymentConsistency < 90) riskScore += 1;
    }

    // Fator 3: Número de cotistas (< 10k = menos líquido)
    if (metrics.shareholders != null) {
        factors++;
        if (metrics.shareholders < 10000) riskScore += 1;
    }

    // Fator 4: Tendência dos dividendos
    if (metrics.dividendTrend === 'FALLING') {
        factors++;
        riskScore += 2;
    }

    if (factors === 0) return 'UNKNOWN';

    const avgRisk = riskScore / factors;
    if (avgRisk < 0.5) return 'LOW';
    if (avgRisk < 1.5) return 'MEDIUM';
    return 'HIGH';
};

/**
 * Gera insights/alertas para o investidor
 * @param {Object} metrics - Métricas completas do FII
 * @returns {Array} - Lista de insights
 */
const generateInvestorInsights = (metrics) => {
    const insights = [];

    // P/VP
    if (metrics.pvpStatus === 'DISCOUNT') {
        insights.push({
            type: 'OPPORTUNITY',
            icon: '💰',
            message: `Negociando com ${((1 - metrics.pvp) * 100).toFixed(1)}% de desconto sobre o valor patrimonial`
        });
    } else if (metrics.pvpStatus === 'PREMIUM') {
        insights.push({
            type: 'CAUTION',
            icon: '⚠️',
            message: `Pagando ${((metrics.pvp - 1) * 100).toFixed(1)}% de prêmio sobre o valor patrimonial`
        });
    }

    // Tendência
    if (metrics.dividendTrend === 'RISING') {
        insights.push({
            type: 'POSITIVE',
            icon: '📈',
            message: 'Dividendos em tendência de alta nos últimos 6 meses'
        });
    } else if (metrics.dividendTrend === 'FALLING') {
        insights.push({
            type: 'WARNING',
            icon: '📉',
            message: 'Dividendos em tendência de queda nos últimos 6 meses'
        });
    }

    // Consistência
    if (metrics.paymentConsistency < 80 && metrics.paymentConsistency > 0) {
        insights.push({
            type: 'WARNING',
            icon: '⏰',
            message: `Pagou dividendos em apenas ${metrics.paymentConsistency.toFixed(0)}% dos meses no último ano`
        });
    }

    // Liquidez
    if (metrics.dailyLiquidity != null && metrics.dailyLiquidity < 500000) {
        insights.push({
            type: 'CAUTION',
            icon: '🔒',
            message: 'Baixa liquidez diária - pode ser difícil vender rapidamente'
        });
    }

    // DY alto (pode indicar risco)
    if (metrics.dividendYieldYear > 15) {
        insights.push({
            type: 'CAUTION',
            icon: '🎯',
            message: `DY de ${metrics.dividendYieldYear}% está acima da média - verifique a sustentabilidade`
        });
    }

    return insights;
};

/**
 * Processa métricas do scraper e adiciona análises derivadas
 * @param {Object} scrapedData - Dados brutos do scraper
 * @returns {Object} - Dados enriquecidos com análises
 */
const enrichWithAnalysis = (scrapedData) => {
    if (!scrapedData) return null;

    // Calcular métricas derivadas
    const dividendTrend = analyzeDividendTrend(scrapedData.dividendHistory);
    const paymentConsistency = calculatePaymentConsistency(scrapedData.dividendCount12m);
    const pvpStatus = classifyPVP(scrapedData.pvp);

    // Adiciona métricas antes de calcular risco
    const enrichedData = {
        ...scrapedData,
        dividendTrend,
        paymentConsistency,
        pvpStatus
    };

    // Calcular risco após ter as outras métricas
    enrichedData.riskLevel = assessRiskLevel(enrichedData);

    // Gerar insights
    enrichedData.investorInsights = generateInvestorInsights(enrichedData);

    return enrichedData;
};

/**
 * Compara dois FIIs para ajudar na decisão
 * @param {Object} fii1 - Primeiro FII
 * @param {Object} fii2 - Segundo FII
 * @returns {Object} - Comparação detalhada
 */
const compareFIIs = (fii1, fii2) => {
    const comparison = {
        tickers: [fii1.ticker, fii2.ticker],
        winner: {},
        details: []
    };

    // DY Anual
    if (fii1.dividendYieldYear && fii2.dividendYieldYear) {
        const dyWinner = fii1.dividendYieldYear > fii2.dividendYieldYear ? fii1.ticker : fii2.ticker;
        comparison.winner.dividendYield = dyWinner;
        comparison.details.push({
            metric: 'Dividend Yield Anual',
            [fii1.ticker]: `${fii1.dividendYieldYear}%`,
            [fii2.ticker]: `${fii2.dividendYieldYear}%`,
            winner: dyWinner
        });
    }

    // P/VP (menor é melhor)
    if (fii1.pvp && fii2.pvp) {
        const pvpWinner = fii1.pvp < fii2.pvp ? fii1.ticker : fii2.ticker;
        comparison.winner.pvp = pvpWinner;
        comparison.details.push({
            metric: 'P/VP',
            [fii1.ticker]: fii1.pvp.toFixed(2),
            [fii2.ticker]: fii2.pvp.toFixed(2),
            winner: pvpWinner
        });
    }

    // Liquidez (maior é melhor)
    if (fii1.dailyLiquidity && fii2.dailyLiquidity) {
        const liqWinner = fii1.dailyLiquidity > fii2.dailyLiquidity ? fii1.ticker : fii2.ticker;
        comparison.winner.liquidity = liqWinner;
    }

    // Consistência (maior é melhor)
    if (fii1.paymentConsistency && fii2.paymentConsistency) {
        const consWinner = fii1.paymentConsistency > fii2.paymentConsistency ? fii1.ticker : fii2.ticker;
        comparison.winner.consistency = consWinner;
    }

    return comparison;
};

module.exports = {
    analyzeDividendTrend,
    calculatePaymentConsistency,
    classifyPVP,
    assessRiskLevel,
    generateInvestorInsights,
    enrichWithAnalysis,
    compareFIIs
};
