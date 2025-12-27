/**
 * Fixed Income Service
 * =====================
 * Handles automated calculation of Fixed Income assets (CDB, LCI, Tesouro).
 * Features:
 * - Fetches daily rates (CDI, IPCA) from official APIs (BCB)
 * - Calculates compound interest for:
 *   - POST_FIXED (CDI %)
 *   - INFLATION (IPCA + spread)
 *   - PRE (Fixed rate)
 * - Caches rates to minimize external API calls
 */

const axios = require('axios');
const nodeCache = require('node-cache');
const moment = require('moment');
const { logger } = require('../../config/logger');

// Cache rates for 24 hours
const rateCache = new nodeCache({ stdTTL: 86400 });

/**
 * Fetch real market rates (CDI, IPCA, Selic) from BCB API
 * Uses independent caching to ensure availability
 */
const getFees = async () => {
    // Check cache
    const cached = rateCache.get('market_rates');
    if (cached) return cached;

    try {
        logger.info('🏦 [BCB] Fetching real market rates from API...');

        // Fetch URLs
        // Series 432: Meta Selic (% a.a)
        // Series 13522: IPCA Accumulado 12 meses (% a.a)
        const selicUrl = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';
        const ipcaUrl = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json';

        // Parallel execution
        const [selicRes, ipcaRes] = await Promise.all([
            axios.get(selicUrl, { timeout: 5000 }),
            axios.get(ipcaUrl, { timeout: 5000 })
        ]);

        const selicVal = parseFloat(selicRes.data[0]?.valor || 11.25);
        const ipcaVal = parseFloat(ipcaRes.data[0]?.valor || 4.5);

        // CDI is typically synonymous with Selic for this level of precision (or Selic - 0.10)
        // Using Selic value for robustness
        const cdiVal = selicVal;

        const rates = {
            cdi: cdiVal,
            ipca: ipcaVal, // IPCA Accumulado 12m
            selic: selicVal,
            lastUpdate: new Date()
        };

        logger.info(`✅ [BCB] Rates updated: CDI ${rates.cdi}%, IPCA ${rates.ipca}%`);

        rateCache.set('market_rates', rates);
        return rates;
    } catch (error) {
        logger.error(`❌ Failed to fetch BCB rates: ${error.message}`);
        // Fallback to recent averages if API fails to prevent breakdown
        return { cdi: 11.25, ipca: 4.50, selic: 11.25, error: true };
    }
};

/**
 * Calculates the current value of a fixed income product
 * @param {Object} product - FinancialProduct instance
 */
const calculateCurrentValue = async (product) => {
    if (!product.investedAmount || !product.purchaseDate) return product.investedAmount;

    // Validate dates
    const start = moment(product.purchaseDate);
    const now = moment();

    // Validations
    if (!start.isValid()) {
        logger.warn(`⚠️ Invalid purchase date for product ${product.id}`);
        return product.investedAmount; // Fallback to invested amount
    }

    if (now.isBefore(start)) return product.investedAmount;

    // Calculate days passed (using calendar days for simplicity in MVP)
    const daysPassed = now.diff(start, 'days');
    // Using 365.25 for average year length in compound interest
    const yearsPassed = daysPassed / 365.25;

    // Get Usage Rates
    const rates = await getFees();
    const cdiRate = rates.cdi / 100;
    const ipcaRate = rates.ipca / 100;

    let currentValue = parseFloat(product.investedAmount);
    let rateApplied = 0;

    // Calculation Logic based on Type
    try {
        switch (product.returnType) {
            case 'PREFIXADO':
                // Juros compostos simples: Valor * (1 + taxa)^anos
                // rate is stored as percent (e.g. 12.5 for 12.5%)
                const preRate = (parseFloat(product.expectedReturn) || 0) / 100;
                currentValue = currentValue * Math.pow((1 + preRate), yearsPassed);
                rateApplied = preRate;
                break;

            case 'CDI':
                // Ex: 100% do CDI -> interest = CDI * (percent/100)
                // expectedReturn = % do CDI (ex: 100, 110)
                // indexerBonus = taxa extra (CDI + 1%)

                const percentOfCDI = (parseFloat(product.expectedReturn) || 100) / 100;
                const bonusCDI = (parseFloat(product.indexerBonus) || 0) / 100;

                // Effective Rate = (CDI * %) + Bonus
                const effectiveCDIRate = (cdiRate * percentOfCDI) + bonusCDI;

                currentValue = currentValue * Math.pow((1 + effectiveCDIRate), yearsPassed);
                rateApplied = effectiveCDIRate;
                break;

            case 'IPCA':
                // Ex: IPCA + 6%
                // expectedReturn = taxa fixa (spread)

                const fixedSpread = (parseFloat(product.expectedReturn) || 0) / 100;

                // Effective Rate = (1 + IPCA) * (1 + Spread) - 1
                const effectiveIPCARate = ((1 + ipcaRate) * (1 + fixedSpread)) - 1;

                currentValue = currentValue * Math.pow((1 + effectiveIPCARate), yearsPassed);
                rateApplied = effectiveIPCARate;
                break;

            case 'SELIC':
                // Similar to CDI usually
                const selicEffective = (rates.selic / 100) + ((parseFloat(product.indexerBonus) || 0) / 100);
                currentValue = currentValue * Math.pow((1 + selicEffective), yearsPassed);
                rateApplied = selicEffective;
                break;

            default:
                // No calculation for others
                return parseFloat(product.currentValue) || currentValue;
        }

        // Return enhanced object with calculation details
        return {
            currentValue: parseFloat(currentValue.toFixed(2)),
            daysPassed,
            rateUsed: (rateApplied * 100).toFixed(2), // Annualized % used
            profit: parseFloat((currentValue - product.investedAmount).toFixed(2)),
            lastUpdate: new Date(),
            calculated: true
        };

    } catch (error) {
        logger.error(`❌ Calculation error for product ${product.id}`, error);
        return {
            currentValue: parseFloat(product.investedAmount),
            error: true
        };
    }
};

module.exports = {
    calculateCurrentValue,
    getFees
};
