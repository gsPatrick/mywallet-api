/**
 * Auto Dividend Service
 * Registra automaticamente dividendos de FIIs quando detectados
 * ============================================================
 * 
 * Fluxo:
 * 1. Ao carregar portfolio, verifica se FII pagou dividendo recentemente
 * 2. Se usuário tinha cotas na data de pagamento → registra automaticamente
 * 3. Marca como origin='AUTO_SCRAPER' para auditoria
 */

const { Dividend, Investment, Asset, FIIData } = require('../../models');
const { Op } = require('sequelize');
const { logger } = require('../../config/logger');

/**
 * Verifica e registra automaticamente dividendos de FIIs
 * @param {string} userId - ID do usuário
 * @param {object} fiiDataMap - Map de ticker -> FIIData
 * @param {object} positionsMap - Map de ticker -> posição do usuário
 */
const autoRegisterDividends = async (userId, fiiDataMap, positionsMap) => {
    const registeredDividends = [];
    const today = new Date();

    for (const [ticker, fiiData] of Object.entries(fiiDataMap)) {
        if (!fiiData || !fiiData.lastDividend || !fiiData.lastDividendDate) continue;

        const position = positionsMap[ticker];
        if (!position || position.quantity <= 0) continue;

        const paymentDate = new Date(fiiData.lastDividendDate);

        // Só registra se pagamento foi nos últimos 30 dias
        const daysSincePayment = Math.floor((today - paymentDate) / (1000 * 60 * 60 * 24));
        if (daysSincePayment > 30 || daysSincePayment < 0) continue;

        // Verifica se já tem esse dividendo registrado
        const existingDividend = await Dividend.findOne({
            where: {
                userId,
                assetId: position.assetId,
                paymentDate: fiiData.lastDividendDate,
                origin: 'AUTO_SCRAPER'
            }
        });

        if (existingDividend) continue; // Já registrado

        // Busca quantidade que o usuário tinha na data do pagamento
        // (simplificado: usa quantidade atual - pode melhorar no futuro)
        const quantity = position.quantity;
        const amountPerUnit = parseFloat(fiiData.lastDividend);
        const grossAmount = quantity * amountPerUnit;

        try {
            const dividend = await Dividend.create({
                userId,
                assetId: position.assetId,
                type: 'RENDIMENTO', // FIIs pagam rendimentos
                amountPerUnit,
                quantity,
                grossAmount,
                withholdingTax: 0, // FIIs são isentos de IR para PF
                netAmount: grossAmount,
                exDate: fiiData.lastDividendDate, // Usa data de pagamento como ex-date (simplificado)
                paymentDate: fiiData.lastDividendDate,
                status: 'RECEIVED',
                origin: 'AUTO_SCRAPER',
                notes: `Registrado automaticamente via Funds Explorer em ${new Date().toISOString().split('T')[0]}`
            });

            registeredDividends.push({
                ticker,
                amount: grossAmount,
                date: fiiData.lastDividendDate
            });

            logger.info(`💰 [AUTO_DIV] Dividendo registrado: ${ticker} | R$${grossAmount.toFixed(2)} | ${fiiData.lastDividendDate}`);
        } catch (err) {
            logger.warn(`⚠️ [AUTO_DIV] Erro ao registrar dividendo de ${ticker}: ${err.message}`);
        }
    }

    if (registeredDividends.length > 0) {
        logger.info(`💰 [AUTO_DIV] ${registeredDividends.length} dividendos registrados automaticamente para usuário ${userId.substring(0, 8)}...`);
    }

    return registeredDividends;
};

module.exports = {
    autoRegisterDividends
};
