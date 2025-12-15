/**
 * ============================================================
 * SISTEMA FINANCEIRO - OPEN FINANCE BRASIL
 * ============================================================
 * Arquitetura compatível e preparada para futura homologação
 * Open Finance Brasil, condicionada ao cadastro oficial.
 * ============================================================
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { logger } = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// MIDDLEWARES DE SEGURANÇA
// ===========================================

// Helmet - Headers de segurança
app.use(helmet());

// CORS - Configuração de origens permitidas
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate Limiting - Proteção contra DDoS
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ===========================================
// MIDDLEWARES DE PARSING
// ===========================================

// JSON Parser com limite de tamanho
app.use(express.json({ limit: '10mb' }));

// URL Encoded Parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===========================================
// ROTAS
// ===========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version
  });
});

// API Routes
app.use('/api', routes);

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Recurso não encontrado',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Global Error Handler
app.use(errorHandler);

// ===========================================
// INICIALIZAÇÃO DO SERVIDOR
// ===========================================

const startServer = async () => {
  try {
    // Testar conexão com banco de dados
    await sequelize.authenticate();
    logger.info('✅ Conexão com banco de dados estabelecida');

    // Sincronizar models (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('✅ Models sincronizados com banco de dados');
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
      logger.info(`📌 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    logger.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('🔄 Recebido SIGTERM, encerrando servidor...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🔄 Recebido SIGINT, encerrando servidor...');
  await sequelize.close();
  process.exit(0);
});

startServer();

module.exports = app;
