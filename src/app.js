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

    if (process.env.NODE_ENV === 'development' || process.env.DB_FORCE_SYNC === 'true') {
      // DEVELOPMENT: Force sync recria todas as tabelas (CUIDADO: apaga dados!)
      // Para produção: use migrations ou DB_FORCE_SYNC=true uma vez para criar tabelas
      const forceSync = process.env.DB_FORCE_SYNC === 'true';
      await sequelize.sync({ force: forceSync });
      logger.info(`✅ Models sincronizados (force: ${forceSync})`);
    } else {
      // PRODUCTION: Apenas valida conexão, não altera schema automaticamente
      // Use migrations para mudanças de schema em produção
      logger.info('📌 Produção: Schema sync desabilitado (use migrations)');
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

    app.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
    });

  } catch (error) {
    logger.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;