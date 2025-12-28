/**
 * ============================================================
 * SISTEMA FINANCEIRO - OPEN FINANCE BRASIL
 * ============================================================
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { logger } = require('./config/logger');

// IMPORTANTE: Importar o serviço de sync de ativos
const assetsService = require('./features/investments/assets.service');

const app = express();
const PORT = process.env.PORT || 3000;

// ... (Middlewares de segurança e parsing continuam iguais) ...
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rotas
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

// Inicialização
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conexão com banco de dados estabelecida');

    if (process.env.NODE_ENV === 'development' || process.env.DB_SYNC === 'false') {
      // DEVELOPMENT: Sync com alter adiciona novas tabelas/colunas sem apagar dados
      // Para produção: use DB_SYNC=true para sincronizar uma vez
      await sequelize.sync({ force: true });
      logger.info('✅ Models sincronizados (force: true - tabelas novas criadas automaticamente)');
    } else {
      // PRODUCTION: Apenas valida conexão, não altera schema automaticamente
      logger.info('📌 Produção: Schema sync desabilitado (use DB_SYNC=true ou migrations)');
    }

    // =====================================================
    // 🚀 GATILHO DE POPULAÇÃO DO MERCADO
    // =====================================================
    // Verifica se precisa popular a tabela de ativos
    const { Asset } = require('./models');
    const assetCount = await Asset.count();

    if (assetCount === 0) {
      logger.info('📭 Tabela de ativos vazia. Iniciando carga inicial da Brapi...');
      // Roda em background para não travar o boot
      assetsService.syncAllAssets()
        .then(() => logger.info('✨ Carga inicial de ativos concluída!'))
        .catch(err => logger.error('❌ Erro na carga inicial:', err));
    } else {
      logger.info(`📚 Catálogo de ativos carregado: ${assetCount} itens.`);
    }

    // Seed medals e categories (seus outros seeds)
    const { seedMedals } = require('./features/gamification/gamification.service');
    await seedMedals();

    const { seedDefaultCategories } = require('./features/categories/categories.controller');
    await seedDefaultCategories();

    // =====================================================
    // 👑 SEED ADMIN USER (OWNER)
    // =====================================================
    const { User } = require('./models');

    const adminEmail = 'patricksiqueira.developer@admin.com';
    const adminPassword = 'Patrick#180204';

    // Verificar se já existe
    let existingAdmin = await User.findOne({ where: { email: adminEmail } });

    if (!existingAdmin) {
      // Criar novo - hooks farão o hash automaticamente
      existingAdmin = await User.create({
        name: 'Patrick Siqueira',
        email: adminEmail,
        password: adminPassword, // Plain text - beforeCreate hook will hash
        plan: 'OWNER',
        subscriptionStatus: 'ACTIVE',
        onboardingComplete: true,
        onboardingStep: 99
      });
      logger.info('👑 Admin OWNER criado: patricksiqueira.developer@admin.com');
    } else {
      // Atualizar existente - hooks farão o hash automaticamente
      existingAdmin.password = adminPassword; // Plain text - beforeUpdate hook will hash
      existingAdmin.plan = 'OWNER';
      existingAdmin.subscriptionStatus = 'ACTIVE';
      existingAdmin.onboardingComplete = true;
      await existingAdmin.save();
      logger.info('👑 Admin OWNER atualizado (senha resetada): patricksiqueira.developer@admin.com');
    }

    // =====================================================
    // 💳 SETUP MERCADO PAGO PLANS (Auto-create if missing)
    // =====================================================
    const { setupMPPlansIfNeeded } = require('./features/subscription/mpPlansSetup');
    await setupMPPlansIfNeeded();

    app.listen(PORT, async () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);

      // =====================================================
      // 📱 RESTORE WHATSAPP SESSIONS
      // =====================================================
      // Run after server starts to not block boot
      try {
        const whatsappService = require('./features/whatsapp/whatsapp.service');
        // Give some time for everything to stabilize
        setTimeout(async () => {
          logger.info('📱 Iniciando restauração de sessões WhatsApp...');
          const result = await whatsappService.restoreAllSessions();
          logger.info(`📱 WhatsApp: ${result.restored} sessões restauradas, ${result.failed} falhas`);
        }, 5000); // Wait 5 seconds after boot
      } catch (err) {
        logger.warn('📱 WhatsApp restore skipped:', err.message);
      }

      // =====================================================
      // 📊 INICIAR CRON JOBS DE FII (DADOS DE MERCADO)
      // =====================================================
      // Arquitetura correta:
      // 1. Bootstrap inicial: MANUAL via admin (não automático)
      // 2. Sync por evento: ao comprar FII
      // 3. Cron de mercado: 30 min, apenas FIIs com usuários posicionados
      try {
        const { initFIIMarketCron } = require('./cron/fiiSync.cron');
        initFIIMarketCron();
        // NÃO faz bootstrap automático - deve ser manual via admin
        logger.info('📊 [FII] Cron de mercado iniciado. Bootstrap manual via /api/admin/fii/bootstrap');
      } catch (err) {
        logger.warn('📊 FII market cron skipped:', err.message);
      }

      // =====================================================
      // 💰 INICIAR CRON DE DIVIDENDOS (CONTÁBIL - 1x/DIA)
      // =====================================================
      // Dividendos são eventos contábeis, NÃO tempo real
      // Processados 1x/dia às 18:00 BRT
      try {
        const { initDividendProcessingCron } = require('./cron/dividendProcessing.cron');
        initDividendProcessingCron();
        // NÃO processa dividendos no startup - apenas via cron 1x/dia
        logger.info('💰 [DIVIDEND] Cron de dividendos iniciado (1x/dia às 18:00)');
      } catch (err) {
        logger.warn('💰 Dividend cron skipped:', err.message);
      }

      // =====================================================
      // 🌅 INICIAR CRON DE MORNING BRIEFING (08:00 BRT)
      // =====================================================
      // Envia resumo financeiro diário via WhatsApp
      try {
        const { initMorningBriefingCron } = require('./cron/morningBriefing.cron');
        initMorningBriefingCron();
        logger.info('🌅 [BRIEFING] Cron de briefing matinal iniciado (08:00 BRT)');
      } catch (err) {
        logger.warn('🌅 Morning briefing cron skipped:', err.message);
      }
    });

  } catch (error) {
    logger.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;