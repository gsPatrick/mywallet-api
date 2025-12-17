/**
 * SISTEMA FINANCEIRO - OPEN FINANCE BRASIL
 * Startup com população automática do catálogo B3 + Crypto
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { logger } = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rotas
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

/**
 * Popula catálogo completo de ativos
 * - Ações, FIIs, BDRs, ETFs via BRAPI
 * - Criptomoedas via Yahoo
 */
const populateAssetsCatalog = async () => {
  const { Asset } = require('./models');
  const assetsService = require('./features/investments/assets.service');

  try {
    const assetCount = await Asset.count();

    if (assetCount === 0) {
      logger.info('📭 Catálogo vazio. Iniciando população completa...');

      // Roda em background para não travar o boot
      (async () => {
        try {
          // 1. Popula B3 (Ações, FIIs, BDRs, ETFs)
          logger.info('🔄 [1/2] Sincronizando ativos da B3...');
          await assetsService.syncAllAssets();

          // 2. Adiciona principais criptos
          logger.info('🔄 [2/2] Adicionando principais criptomoedas...');
          await addTopCryptos();

          logger.info('✨ Catálogo completo populado!');

          // Mostra estatísticas
          const stats = await assetsService.getAssetStats();
          logger.info('📊 Estatísticas finais:');
          logger.info(`   Total: ${stats.total} ativos`);
          Object.entries(stats.byType).forEach(([type, count]) => {
            logger.info(`   ${type}: ${count}`);
          });

        } catch (error) {
          logger.error('❌ Erro na população do catálogo:', error);
        }
      })();

    } else {
      logger.info(`📚 Catálogo já possui ${assetCount} ativos`);
    }

  } catch (error) {
    logger.error('❌ Erro ao verificar catálogo:', error);
  }
};

/**
 * Adiciona principais criptomoedas ao catálogo
 * Yahoo Finance usa sufixo -USD: BTC-USD, ETH-USD
 */
const addTopCryptos = async () => {
  const { Asset } = require('./models');

  const topCryptos = [
    { ticker: 'BTC-USD', name: 'Bitcoin', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
    { ticker: 'ETH-USD', name: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
    { ticker: 'USDT-USD', name: 'Tether', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { ticker: 'BNB-USD', name: 'Binance Coin', logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
    { ticker: 'SOL-USD', name: 'Solana', logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
    { ticker: 'USDC-USD', name: 'USD Coin', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    { ticker: 'XRP-USD', name: 'Ripple', logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png' },
    { ticker: 'ADA-USD', name: 'Cardano', logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png' },
    { ticker: 'DOGE-USD', name: 'Dogecoin', logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
    { ticker: 'TRX-USD', name: 'Tron', logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' }
  ];

  for (const crypto of topCryptos) {
    await Asset.upsert({
      ticker: crypto.ticker,
      name: crypto.name,
      logoUrl: crypto.logo,
      type: 'CRYPTO',
      sector: 'Cryptocurrency',
      isActive: true
    }, {
      conflictFields: ['ticker']
    });
  }

  logger.info(`✅ ${topCryptos.length} criptomoedas adicionadas`);
};

// Inicialização
const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conexão com banco estabelecida');

    if (process.env.NODE_ENV === 'development') {
      // CUIDADO: force: true apaga dados! Use alter: true ou remova se já tiver dados
      await sequelize.sync({ alter: true });
      logger.info('✅ Models sincronizados');
    }

    // População automática do catálogo
    await populateAssetsCatalog();

    // Seeds de gamificação e categorias
    const { seedMedals } = require('./features/gamification/gamification.service');
    await seedMedals();

    const { seedDefaultCategories } = require('./features/categories/categories.controller');
    await seedDefaultCategories();

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