/**
 * Financial Products Controller
 */

const financialProductService = require('./financialProduct.service');

const listProducts = async (req, res, next) => {
    try {
        const data = await financialProductService.listProducts(req.userId, req.query);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const createProduct = async (req, res, next) => {
    try {
        const product = await financialProductService.createProduct(req.userId, req.body);
        res.status(201).json({
            message: 'Produto criado com sucesso',
            data: product
        });
    } catch (error) {
        next(error);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const product = await financialProductService.updateProduct(
            req.userId,
            req.params.id,
            req.body
        );
        res.json({
            message: 'Produto atualizado',
            data: product
        });
    } catch (error) {
        next(error);
    }
};

const updateValue = async (req, res, next) => {
    try {
        const { currentValue, source } = req.body;
        const result = await financialProductService.updateValue(
            req.userId,
            req.params.id,
            currentValue,
            source
        );
        res.json({
            message: 'Valor atualizado',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const redeemProduct = async (req, res, next) => {
    try {
        const { finalValue } = req.body;
        const result = await financialProductService.redeemProduct(
            req.userId,
            req.params.id,
            finalValue
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const getSummary = async (req, res, next) => {
    try {
        const data = await financialProductService.getSummary(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
};

const getAlerts = async (req, res, next) => {
    try {
        const data = await financialProductService.getAlerts(req.userId);
        res.json({ data });
    } catch (error) {
        next(error);
    }
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
