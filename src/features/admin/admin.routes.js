/**
 * Admin Routes
 * ========================================
 */

const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const { requireOwner } = require('../../middlewares/subscriptionMiddleware');
const { runBootstrap, runManualSync } = require('../../cron/fiiSync.cron');
const { runManualDividendProcessing } = require('../../cron/dividendProcessing.cron');
const { logger } = require('../../config/logger');

// Todas as rotas admin requerem autenticação + OWNER
router.use(authMiddleware);
router.use(requireOwner);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Gestão de usuários
router.get('/users', adminController.getUsers);
router.post('/users/create', adminController.createUser);
router.post('/users/:id/grant', adminController.grantPlan);
router.post('/users/:id/revoke', adminController.revokePlan);

// =====================================================
// FII - Operações Administrativas
// =====================================================

// Bootstrap inicial de todos os FIIs (uma única vez)
router.post('/fii/bootstrap', async (req, res) => {
    try {
        const { limit = 100 } = req.body;
        logger.info(`🏦 [ADMIN] Bootstrap por ${req.userId} | limit: ${limit}`);
        const result = await runBootstrap(limit);
        res.json({ success: true, message: `${result.synced}/${result.total} FIIs`, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync manual de FIIs das carteiras
router.post('/fii/sync', async (req, res) => {
    try {
        logger.info(`📊 [ADMIN] Sync manual por ${req.userId}`);
        const result = await runManualSync();
        res.json({ success: true, message: `${result.synced}/${result.total} FIIs`, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Processamento manual de dividendos
router.post('/dividends/process', async (req, res) => {
    try {
        logger.info(`💰 [ADMIN] Dividendos por ${req.userId}`);
        const result = await runManualDividendProcessing();
        res.json({ success: true, message: `${result.created} criados, ${result.skipped} existentes`, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// MORNING BRIEFING - Operações Administrativas
// =====================================================

// Trigger manual do briefing matinal
router.post('/trigger-briefing', async (req, res) => {
    try {
        logger.info(`🌅 [ADMIN] Briefing manual por ${req.userId}`);
        const { sendAllBriefings } = require('../../cron/morningBriefing.cron');
        const result = await sendAllBriefings();
        res.json({
            success: true,
            message: `Briefing enviado para ${result.success} usuário(s)`,
            data: result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger briefing para um usuário específico (para testes)
router.post('/trigger-briefing/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        logger.info(`🌅 [ADMIN] Briefing individual por ${req.userId} -> ${userId}`);

        const briefingService = require('../whatsapp/briefing.service');
        const message = await briefingService.generateBriefing(userId);

        // Try to send via WhatsApp
        let sent = false;
        try {
            sent = await briefingService.sendBriefing(userId);
        } catch (e) {
            logger.warn(`WhatsApp send failed: ${e.message}`);
        }

        res.json({
            success: true,
            sent,
            message,
            info: sent ? 'Enviado via WhatsApp' : 'Gerado mas não enviado (WhatsApp desconectado?)'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

