/**
 * Investment Health Controller
 * ============================
 * 
 * Endpoints for investment diagnostic system
 */

const healthService = require('./investmentHealth.service');
const { logger } = require('../../config/logger');

/**
 * GET /api/investments/health/diagnostics
 * Run all investment diagnostics
 */
const getDiagnostics = async (req, res) => {
    try {
        logger.info('📊 [ADMIN] Solicitação de diagnóstico de investimentos');

        const results = await healthService.runInvestmentDiagnostics();

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        logger.error('❌ [HEALTH] Erro ao executar diagnósticos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao executar diagnósticos',
            details: error.message
        });
    }
};

/**
 * GET /api/investments/health/test/:service
 * Test a specific service
 */
const testSpecificService = async (req, res) => {
    try {
        const { service } = req.params;
        let result;

        switch (service.toUpperCase()) {
            case 'FII':
            case 'FII_SCRAPER':
                result = await healthService.testFIIScraper();
                break;
            case 'BRAPI':
                result = await healthService.testBrapiAPI();
                break;
            case 'YAHOO':
                result = await healthService.testYahooAPI();
                break;
            case 'BCB':
            case 'BCB_RATES':
                result = await healthService.testBCBRates();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Serviço desconhecido: ${service}`,
                    availableServices: ['FII_SCRAPER', 'BRAPI', 'YAHOO', 'BCB_RATES']
                });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`❌ [HEALTH] Erro ao testar ${req.params.service}:`, error);
        res.status(500).json({
            success: false,
            error: 'Erro ao testar serviço',
            details: error.message
        });
    }
};

module.exports = {
    getDiagnostics,
    testSpecificService
};
