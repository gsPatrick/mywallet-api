/**
 * Investments Service
 * Gerencia a carteira do usuário (Renda Variável)
 * 
 * Lógica:
 * 1. O usuário registra a compra (com o preço que ELE pagou).
 * 2. O sistema busca o preço ATUAL via Yahoo Finance.
 * 3. O sistema calcula o lucro/prejuízo.
 */

const { Investment, Asset, FinancialProduct } = require('../../models');
const yahooClient = require('./yahoo.client'); // Usa Yahoo para cotação em tempo real (Grátis)
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

/**
 * Lista o histórico de operações (compras e vendas) do usuário
 */
const listInvestments = async (userId, filters = {}) => {
    const { assetType, page = 1, limit = 50 } = filters;

    const where = {};
    // Filtro por tipo de ativo se solicitado
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
        operationType: inv.operationType, // COMPRA ou VENDA
        quantity: parseFloat(inv.quantity),
        price: parseFloat(inv.price), // Preço que o usuário pagou na época
        totalValue: inv.getTotalValue(),
        date: inv.date,
        broker: inv.broker
    }));
};

/**
 * Registra um novo investimento (Ordem de Compra/Venda)
 * O usuário INFORMA o preço que pagou aqui.
 */
const createInvestment = async (userId, data) => {
    const { ticker, operationType, quantity, price, brokerageFee, date, broker } = data;

    // 1. Busca o ativo no nosso banco local (que foi populado pela Brapi)
    let asset = await Asset.findOne({
        where: { ticker: ticker.toUpperCase() }
    });

    // Fallback: Se o ativo não existir no banco local (raro se o sync rodar),
    // tentamos buscar dados básicos dele no Yahoo para não travar o usuário
    if (!asset) {
        const yahooData = await yahooClient.getQuote(ticker);
        if (!yahooData) {
            throw new AppError('Ativo não encontrado na bolsa.', 404, 'ASSET_NOT_FOUND');
        }

        // Cria o ativo on-the-fly
        asset = await Asset.create({
            ticker: ticker.toUpperCase(),
            name: yahooData.shortName || ticker.toUpperCase(),
            type: 'STOCK', // Default, já que yahoo não retorna tipo fácil
            isActive: true
        });
    }

    // 2. Salva a operação com o preço MANUAL do usuário
    const investment = await Investment.create({
        userId,
        assetId: asset.id,
        operationType,
        quantity,
        price, // IMPORTANTE: Preço de execução da ordem
        brokerageFee: brokerageFee || 0,
        date: date || new Date(),
        broker
    });

    return investment;
};

/**
 * Calcula o Portfólio Consolidado (Dashboard)
 * Mistura: O que o usuário tem + Cotação Atual do Yahoo
 */
const getPortfolio = async (userId) => {
    // 1. Busca todas as operações de renda variável do usuário
    const investments = await Investment.findAll({
        where: { userId },
        include: [{ model: Asset, as: 'asset' }]
    });

    // 2. Busca produtos financeiros manuais (Renda Fixa, Crypto manual, etc)
    const financialProducts = await FinancialProduct.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    // Estrutura para consolidar posições (Preço Médio)
    const positionsMap = {};
    const tickersToFetch = new Set();

    // 3. Processa Renda Variável (Cálculo de Preço Médio)
    investments.forEach(inv => {
        const ticker = inv.asset.ticker;
        tickersToFetch.add(ticker);

        if (!positionsMap[ticker]) {
            positionsMap[ticker] = {
                ticker,
                name: inv.asset.name,
                logoUrl: inv.asset.logoUrl, // Logo vinda do banco (Brapi sync)
                type: inv.asset.type,
                quantity: 0,
                totalCost: 0, // Custo total de aquisição
            };
        }

        const qty = parseFloat(inv.quantity);
        const price = parseFloat(inv.price); // Preço histórico
        const fees = parseFloat(inv.brokerageFee || 0);

        if (inv.operationType === 'BUY') {
            positionsMap[ticker].quantity += qty;
            positionsMap[ticker].totalCost += (qty * price) + fees;
        } else {
            // Lógica de venda (reduz quantidade e custo proporcional)
            if (positionsMap[ticker].quantity > 0) {
                const avgPrice = positionsMap[ticker].totalCost / positionsMap[ticker].quantity;
                positionsMap[ticker].totalCost -= (qty * avgPrice);
                positionsMap[ticker].quantity -= qty;
            }
        }
    });

    // 4. Busca Cotações em Tempo Real (Yahoo Finance Grátis)
    const quotes = await yahooClient.getQuotes(Array.from(tickersToFetch));

    let totalInvested = 0;
    let totalCurrentBalance = 0;

    // 5. Monta lista de Renda Variável com Lucro/Prejuízo
    const variableIncomePositions = Object.values(positionsMap)
        .filter(p => p.quantity > 0.000001) // Remove posições zeradas
        .map(p => {
            const quote = quotes[p.ticker];

            // Se o Yahoo achou preço, usa. Se não, usa o preço médio (fallback)
            const currentPrice = quote ? quote.price : (p.totalCost / p.quantity);

            const currentBalance = p.quantity * currentPrice;
            const profit = currentBalance - p.totalCost;

            // Evita divisão por zero
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
                averagePrice: p.totalCost / p.quantity, // Preço Médio de Compra
                currentPrice,                           // Preço Atual de Mercado
                totalCost: p.totalCost,
                currentBalance,
                profit,
                profitPercent,
                dayChange: quote?.changePercent || 0,
                lastUpdate: quote?.updatedAt
            };
        });

    // 6. Soma Renda Fixa / Outros Produtos
    const fixedIncomePositions = financialProducts.map(fp => {
        const invested = parseFloat(fp.investedAmount);
        // Se tiver valor atual atualizado manualmente ou via outra API, usa ele
        // Senão usa o investido (Renda Fixa muitas vezes só atualiza no vencimento ou mensalmente)
        const current = fp.currentValue ? parseFloat(fp.currentValue) : invested;

        totalInvested += invested;
        totalCurrentBalance += current;

        return {
            source: 'FIXED_INCOME',
            id: fp.id,
            name: fp.name,
            type: fp.type, // 'RENDA_FIXA', 'CRYPTO', etc
            totalCost: invested,
            currentBalance: current,
            profit: current - invested,
            profitPercent: invested > 0 ? ((current - invested) / invested) * 100 : 0
        };
    });

    // 7. Retorno unificado
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

/**
 * Helper para calcular % de alocação (Gráfico de Pizza)
 */
const calculateAllocation = (allPositions, totalValue) => {
    const allocation = {};
    if (totalValue === 0) return allocation;

    allPositions.forEach(pos => {
        const type = pos.type; // STOCK, FII, RENDA_FIXA...
        if (!allocation[type]) allocation[type] = 0;
        allocation[type] += pos.currentBalance;
    });

    // Converte para porcentagem
    Object.keys(allocation).forEach(key => {
        allocation[key] = parseFloat(((allocation[key] / totalValue) * 100).toFixed(2));
    });

    return allocation;
};

module.exports = {
    listInvestments,
    createInvestment,
    getPortfolio
};