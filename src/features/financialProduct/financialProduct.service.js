/**
 * Financial Products Service
 * Gestão de produtos financeiros (Renda Fixa, Crypto, etc.)
 */

const { FinancialProduct, AuditLog } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { Op } = require('sequelize');

// ===========================================
// CRUD
// ===========================================

/**
 * Lista produtos financeiros do usuário
 */
const listProducts = async (userId, filters = {}) => {
    const { type, status = 'ACTIVE', page = 1, limit = 50 } = filters;

    const where = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const products = await FinancialProduct.findAll({
        where,
        order: [['purchaseDate', 'DESC']],
        limit,
        offset: (page - 1) * limit
    });

    return products.map(p => ({
        id: p.id,
        type: p.type,
        subtype: p.subtype,
        name: p.name,
        institution: p.institution,
        investedAmount: parseFloat(p.investedAmount),
        currentValue: p.currentValue ? parseFloat(p.currentValue) : null,
        profit: p.getProfit(),
        profitPercent: p.getProfitPercent(),
        expectedReturn: p.expectedReturn ? parseFloat(p.expectedReturn) : null,
        returnType: p.returnType,
        liquidity: p.liquidity,
        purchaseDate: p.purchaseDate,
        maturityDate: p.maturityDate,
        daysToMaturity: p.getDaysToMaturity(),
        isMatured: p.isMatured(),
        calculationSource: p.calculationSource,
        status: p.status,
        currency: p.currency
    }));
};

/**
 * Cria um produto financeiro
 */
const createProduct = async (userId, data) => {
    const product = await FinancialProduct.create({
        userId,
        ...data,
        calculationSource: data.calculationSource || 'MANUAL'
    });

    await AuditLog.log({
        userId,
        action: 'FINANCIAL_PRODUCT_CREATE',
        resource: 'FINANCIAL_PRODUCT',
        resourceId: product.id,
        newData: { type: data.type, name: data.name, investedAmount: data.investedAmount }
    });

    return product;
};

/**
 * Atualiza um produto financeiro
 */
const updateProduct = async (userId, productId, data) => {
    const product = await FinancialProduct.findOne({
        where: { id: productId, userId }
    });

    if (!product) {
        throw new AppError('Produto não encontrado', 404, 'PRODUCT_NOT_FOUND');
    }

    const previousData = product.toJSON();

    const updateableFields = [
        'name', 'institution', 'investedAmount', 'currentValue',
        'expectedReturn', 'returnType', 'indexerBonus', 'liquidity',
        'maturityDate', 'calculationSource', 'lastValueUpdate',
        'status', 'notes', 'subtype'
    ];

    for (const field of updateableFields) {
        if (data[field] !== undefined) {
            product[field] = data[field];
        }
    }

    // Atualizar data de última atualização de valor
    if (data.currentValue !== undefined) {
        product.lastValueUpdate = new Date();
    }

    await product.save();

    await AuditLog.log({
        userId,
        action: 'FINANCIAL_PRODUCT_UPDATE',
        resource: 'FINANCIAL_PRODUCT',
        resourceId: product.id,
        previousData,
        newData: data
    });

    return product;
};

/**
 * Atualiza o valor atual de um produto (resgate parcial ou atualização)
 */
const updateValue = async (userId, productId, currentValue, source = 'MANUAL') => {
    const product = await FinancialProduct.findOne({
        where: { id: productId, userId }
    });

    if (!product) {
        throw new AppError('Produto não encontrado', 404, 'PRODUCT_NOT_FOUND');
    }

    product.currentValue = currentValue;
    product.calculationSource = source;
    product.lastValueUpdate = new Date();

    await product.save();

    return {
        id: product.id,
        name: product.name,
        currentValue: parseFloat(product.currentValue),
        profit: product.getProfit(),
        profitPercent: product.getProfitPercent()
    };
};

/**
 * Resgata/encerra um produto
 */
const redeemProduct = async (userId, productId, finalValue = null) => {
    const product = await FinancialProduct.findOne({
        where: { id: productId, userId }
    });

    if (!product) {
        throw new AppError('Produto não encontrado', 404, 'PRODUCT_NOT_FOUND');
    }

    if (finalValue !== null) {
        product.currentValue = finalValue;
    }
    product.status = 'REDEEMED';
    product.lastValueUpdate = new Date();

    await product.save();

    await AuditLog.log({
        userId,
        action: 'FINANCIAL_PRODUCT_REDEEM',
        resource: 'FINANCIAL_PRODUCT',
        resourceId: product.id,
        newData: { finalValue, profit: product.getProfit() }
    });

    return {
        message: 'Produto resgatado com sucesso',
        finalValue: product.currentValue ? parseFloat(product.currentValue) : null,
        profit: product.getProfit(),
        profitPercent: product.getProfitPercent()
    };
};

// ===========================================
// RESUMO E ANÁLISES
// ===========================================

/**
 * Obtém resumo de produtos financeiros
 */
const getSummary = async (userId) => {
    const products = await FinancialProduct.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    let totalInvested = 0;
    let totalCurrentValue = 0;
    const byType = {};

    for (const p of products) {
        const invested = parseFloat(p.investedAmount);
        const current = p.currentValue ? parseFloat(p.currentValue) : invested;

        totalInvested += invested;
        totalCurrentValue += current;

        if (!byType[p.type]) {
            byType[p.type] = {
                type: p.type,
                count: 0,
                invested: 0,
                currentValue: 0
            };
        }

        byType[p.type].count += 1;
        byType[p.type].invested += invested;
        byType[p.type].currentValue += current;
    }

    // Calcular rentabilidade por tipo
    for (const type of Object.keys(byType)) {
        const t = byType[type];
        t.profit = t.currentValue - t.invested;
        t.profitPercent = t.invested > 0 ? ((t.currentValue - t.invested) / t.invested) * 100 : 0;
    }

    return {
        totalProducts: products.length,
        totalInvested,
        totalCurrentValue,
        totalProfit: totalCurrentValue - totalInvested,
        totalProfitPercent: totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0,
        byType: Object.values(byType)
    };
};

/**
 * Obtém alertas de produtos financeiros
 */
const getAlerts = async (userId) => {
    const products = await FinancialProduct.findAll({
        where: { userId, status: 'ACTIVE' }
    });

    const alerts = [];
    const today = new Date();

    for (const p of products) {
        // Alerta de vencimento próximo
        const daysToMaturity = p.getDaysToMaturity();
        if (daysToMaturity !== null && daysToMaturity <= 30 && daysToMaturity >= 0) {
            alerts.push({
                type: 'MATURITY_APPROACHING',
                severity: daysToMaturity <= 7 ? 'HIGH' : 'MEDIUM',
                productId: p.id,
                name: p.name,
                daysToMaturity,
                message: `${p.name} vence em ${daysToMaturity} dias`
            });
        }

        // Alerta de valor desatualizado (mais de 30 dias)
        if (p.lastValueUpdate) {
            const daysSinceUpdate = Math.ceil((today - new Date(p.lastValueUpdate)) / (1000 * 60 * 60 * 24));
            if (daysSinceUpdate > 30) {
                alerts.push({
                    type: 'VALUE_OUTDATED',
                    severity: 'LOW',
                    productId: p.id,
                    name: p.name,
                    daysSinceUpdate,
                    message: `${p.name} não atualizado há ${daysSinceUpdate} dias`
                });
            }
        }
    }

    return alerts.sort((a, b) => {
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
};

module.exports = {
    listProducts,
    createProduct,
    updateProduct,
    updateValue,
    redeemProduct,
    getSummary,
    getAlerts
};
