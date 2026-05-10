const {
    Investment, Asset, Dividend, InvestmentSnapshot
} = require('../../models');
const { Op } = require('sequelize');

class ReportsService {
    async getPortfolioSummary(userId, brokerId, profileId = null) {
        // Build where clause
        const where = { userId };
        if (brokerId) {
            where.brokerId = brokerId;
        }
        if (profileId) {
            where.profileId = profileId;
        }

        // Buscar todos os investimentos do usuário
        const investments = await Investment.findAll({
            where,
            include: [{ model: Asset, as: 'asset' }]
        });

        // Este é um cálculo simplificado. Em produção, você usaria o Brapi para pegar cotação atual.
        // Aqui vamos assumir que o 'price' do investimento é o preço médio inicial
        // Para cotação real, precisaríamos integrar com o brapi.client.js aqui

        let totalCost = 0;
        let totalCurrentValue = 0; // Precisaria de cotação real
        let allocation = {};
        let positions = [];

        // Simulação básica sem cotação em tempo real para este endpoint de "Reports"
        // Idealmente, reuse a lógica do InvestmentsService.getPortfolio()

        for (const inv of investments) {
            const cost = parseFloat(inv.quantity) * parseFloat(inv.price);
            totalCost += cost;

            // Mock de valorização para exemplo (em prod, buscar cotação)
            const mockCurrentPrice = parseFloat(inv.price) * (1 + (Math.random() * 0.2 - 0.05));
            const currentValue = parseFloat(inv.quantity) * mockCurrentPrice;

            totalCurrentValue += currentValue;

            const type = inv.asset.type;
            allocation[type] = (allocation[type] || 0) + currentValue;

            positions.push({
                ticker: inv.asset.ticker,
                name: inv.asset.name,
                logoUrl: inv.asset.logoUrl,
                type: inv.asset.type,
                quantity: inv.quantity,
                averagePrice: inv.price,
                currentPrice: mockCurrentPrice, // Mock
                totalCost: cost,
                totalCurrentValue: currentValue,
                currentBalance: currentValue,
                profit: currentValue - cost,
                profitPercent: ((currentValue - cost) / cost) * 100
            });
        }

        const totalProfit = totalCurrentValue - totalCost;
        const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

        // Normalizar alocação para %
        Object.keys(allocation).forEach(key => {
            allocation[key] = totalCurrentValue > 0 ? parseFloat(((allocation[key] / totalCurrentValue) * 100).toFixed(2)) : 0;
        });

        return {
            summary: {
                totalCost,
                totalCurrentValue,
                totalProfit,
                totalProfitPercent
            },
            allocation,
            positions
        };
    }

    async getEvolution(userId, profileId = null) {
        // Buscar snapshots históricos (idealmente diários ou mensais)
        const where = { userId };
        if (profileId) where.profileId = profileId;

        const snapshots = await InvestmentSnapshot.findAll({
            where,
            order: [['date', 'ASC']],
            limit: 30 // Últimos 30 pontos
        });

        return snapshots.map(s => ({
            date: s.date,
            value: parseFloat(s.totalValue)
        }));
    }

    async getDividends(userId, profileId = null) {
        const where = { userId };
        if (profileId) where.profileId = profileId;

        const dividends = await Dividend.findAll({
            where,
            include: [{ model: Asset, as: 'asset' }],
            order: [['paymentDate', 'DESC']]
        });

        const total = dividends.reduce((sum, d) => sum + parseFloat(d.amount), 0);

        return {
            total,
            history: dividends.map(d => ({
                asset: d.asset.ticker,
                type: d.type,
                amount: parseFloat(d.amount),
                date: d.paymentDate
            }))
        };
    }
}

module.exports = new ReportsService();
