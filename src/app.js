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

// REDIS: Cache compartilhado para investimentos
const { initRedis, disconnectRedis } = require('./config/redis');

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

    // Inicializar Redis para cache compartilhado
    initRedis();
    logger.info('🔴 Redis inicializado para cache de investimentos');

    if (process.env.NODE_ENV === 'development' || process.env.DB_SYNC === 'false') {
      // DEVELOPMENT: Sync com alter adiciona novas tabelas/colunas sem apagar dados
      // Para produção: use DB_SYNC=true para sincronizar uma vez
      await sequelize.sync({ force: true });
      logger.info('✅ Models sincronizados (force: true - tabelas novas criadas automaticamente)');
    } else {
      // PRODUCTION: Apenas valida conexão, não altera schema automaticamente
      logger.info('📌 Produção: Schema sync desabilitado (use DB_SYNC=true ou migrations)');
    }

    // ============================================
    // SEEDER INICIAL DE PATCH NOTES (LAUNCH 1.0)
    // ============================================
    const { PatchNote } = require('./models');
    try {
      const launchNoteData = {
        version: '1.0.0',
        title: 'Lançamento Oficial: O Início da Sua Liberdade Financeira',
        description: 'Bem-vindo à versão 1.0! Estamos orgulhosos de apresentar a plataforma definitiva para o seu controle financeiro. Esta atualização consolida todas as ferramentas que você precisa para deixar de apenas "pagar contas" e começar a construir riqueza real. Assuma o controle, defina suas regras e deixe que a tecnologia trabalhe por você. O seu "eu" do futuro agradece.',
        releaseDate: new Date(),
        bannerUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?q=80&w=2560&auto=format&fit=crop',
        isActive: true,
        updates: [
          {
            type: 'new',
            content: 'Dashboard Inteligente: Visão 360º do seu patrimônio, receitas e despesas em tempo real.'
          },
          {
            type: 'new',
            content: 'Open Finance Real: Conecte bancos e cartões automaticamente. Adeus, digitação manual!'
          },
          {
            type: 'new',
            content: 'Gestão de Investimentos: Ações, FIIs, Renda Fixa e Cripto consolidado em um só lugar com cotações ao vivo.'
          },
          {
            type: 'new',
            content: 'Metas & Objetivos: Transforme sonhos em planos. Defina valores, prazos e acompanhe o progresso da sua evolução.'
          },
          {
            type: 'new',
            content: 'Orçamentos (Budgets): Defina limites por categoria e seja alertado antes de sair dos trilhos.'
          },
          {
            type: 'new',
            content: 'Central do Assinante: Gestão completa de recorrências (Netflix, Spotify, etc) para cortar gastos invisíveis.'
          },
          {
            type: 'new',
            content: 'Gamificação Financeira: Conquiste medalhas, suba de nível e torne a disciplina financeira um hábito.'
          },
          {
            type: 'new',
            content: 'Central MEI (DAS): Controle suas guias e obrigações de microempreendedor integrado ao seu fluxo de caixa.'
          },
          {
            type: 'new',
            content: 'Relatórios Avançados: Exporte seus dados e analise sua evolução patrimonial mês a mês.'
          },
          {
            type: 'new',
            content: 'Integração WhatsApp: Receba seu "Morning Briefing" financeiro e consulte saldo pelo chat.'
          },
          {
            type: 'new',
            content: 'Multi-Contexto: Separe suas finanças Pessoais das Empresariais ou Familiares com facilidade.'
          }
        ]
      };

      const existingPatch = await PatchNote.findOne({ where: { version: '1.0.0' } });

      if (existingPatch) {
        // Atualiza se já existir (para corrigir o conteúdo anterior)
        await existingPatch.update(launchNoteData);
        logger.info('✨ Patch Note 1.0 atualizado com o conteúdo oficial de lançamento!');
      } else {
        // Cria se não existir
        await PatchNote.create(launchNoteData);
        logger.info('✨ Patch Note 1.0 criado com sucesso!');
      }
    } catch (seedError) {
      logger.error('❌ Erro ao criar/atualizar patch note inicial:', seedError);
    }
    // ============================================

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