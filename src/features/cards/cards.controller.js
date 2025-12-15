/**
 * Cards Controller
 */

const cardsService = require('./cards.service');

const listCards = async (req, res, next) => {
    try {
        const cards = await cardsService.listCards(req.userId);
        res.json({ data: cards });
    } catch (error) {
        next(error);
    }
};

const getCard = async (req, res, next) => {
    try {
        const card = await cardsService.getCard(req.userId, req.params.id);
        res.json({ data: card });
    } catch (error) {
        next(error);
    }
};

const getCardTransactions = async (req, res, next) => {
    try {
        const result = await cardsService.getCardTransactions(
            req.userId,
            req.params.id,
            {
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50
            }
        );
        res.json({ data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = { listCards, getCard, getCardTransactions };
