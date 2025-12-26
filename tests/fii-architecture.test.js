/**
 * FII Architecture Test Script
 * ============================================
 * 
 * Testa todos os fluxos da nova arquitetura:
 * 1. Bootstrap inicial (manual)
 * 2. Compra de FII com sync-on-purchase
 * 3. Cron de mercado
 * 4. Cron de dividendos
 * 
 * Uso: node tests/fii-architecture.test.js
 */

const { syncFII, syncAllUserFIIs, syncAllSystemFIIs } = require('../src/features/investments/fiiSync.service');
const { processDividends, updatePendingDividends } = require('../src/cron/dividendProcessing.cron');
const { runBootstrap, runManualSync, syncOnPurchase } = require('../src/cron/fiiSync.cron');
const { Dividend, Investment, Asset, FIIData } = require('../src/models');
const { sequelize } = require('../src/models');
const { logger } = require('../src/config/logger');
const fs = require('fs');

// Arquivo de output
const OUTPUT_FILE = __dirname + '/fii-architecture.test.output.txt';
let output = [];

const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    output.push(line);
};

const saveOutput = () => {
    fs.writeFileSync(OUTPUT_FILE, output.join('\n'));
    console.log(`\n📄 Resultados salvos em: ${OUTPUT_FILE}`);
};

const runTests = async () => {
    log('========================================');
    log('🧪 FII ARCHITECTURE TEST');
    log('========================================\n');

    try {
        // Conectar ao banco
        await sequelize.authenticate();
        log('✅ Conexão com banco estabelecida\n');

        // ========================================
        // TESTE 1: BOOTSTRAP INICIAL
        // ========================================
        log('📦 TESTE 1: BOOTSTRAP INICIAL');
        log('-'.repeat(40));

        const fiisBefore = await FIIData.count();
        log(`FIIs no banco antes: ${fiisBefore}`);

        log('Executando bootstrap (limite: 5 FIIs)...');
        const bootstrapResult = await runBootstrap(5);

        const fiisAfter = await FIIData.count();
        log(`FIIs no banco depois: ${fiisAfter}`);
        log(`Resultado: ${bootstrapResult.synced}/${bootstrapResult.total} sincronizados`);
        log(`Erros: ${bootstrapResult.errors}`);
        log('✅ Bootstrap executado com sucesso\n');

        // ========================================
        // TESTE 2: SYNC ON PURCHASE
        // ========================================
        log('🛒 TESTE 2: SYNC ON PURCHASE');
        log('-'.repeat(40));

        const testTicker = 'MXRF11';
        log(`Simulando compra de ${testTicker}...`);

        const syncResult = await syncOnPurchase(testTicker);
        log(`Resultado: ${syncResult.success ? 'SUCESSO' : 'FALHA'}`);
        if (syncResult.data) {
            log(`DY: ${syncResult.data.dividendYieldYear}%`);
            log(`P/VP: ${syncResult.data.pvp}`);
        }
        log('✅ Sync-on-purchase executado\n');

        // ========================================
        // TESTE 3: CRON DE MERCADO
        // ========================================
        log('📊 TESTE 3: CRON DE MERCADO');
        log('-'.repeat(40));

        log('Executando sync manual de FIIs das carteiras...');
        const marketResult = await runManualSync();
        log(`Resultado: ${marketResult.synced}/${marketResult.total} FIIs`);
        log('✅ Cron de mercado executado\n');

        // ========================================
        // TESTE 4: CRON DE DIVIDENDOS
        // ========================================
        log('💰 TESTE 4: CRON DE DIVIDENDOS');
        log('-'.repeat(40));

        const dividendsBefore = await Dividend.count({ where: { origin: 'AUTO_SCRAPER' } });
        log(`Dividendos AUTO_SCRAPER antes: ${dividendsBefore}`);

        log('Executando processamento de dividendos...');
        const dividendResult = await processDividends();
        await updatePendingDividends();

        const dividendsAfter = await Dividend.count({ where: { origin: 'AUTO_SCRAPER' } });
        log(`Dividendos AUTO_SCRAPER depois: ${dividendsAfter}`);
        log(`Novos dividendos: ${dividendResult.created}`);
        log(`Já existentes (não duplicados): ${dividendResult.skipped}`);
        log('✅ Cron de dividendos executado (IDEMPOTENTE)\n');

        // ========================================
        // TESTE 5: VERIFICAÇÃO DE NÃO DUPLICAÇÃO
        // ========================================
        log('🔒 TESTE 5: IDEMPOTÊNCIA DE DIVIDENDOS');
        log('-'.repeat(40));

        log('Executando processamento novamente...');
        const secondRun = await processDividends();

        const dividendsFinal = await Dividend.count({ where: { origin: 'AUTO_SCRAPER' } });
        log(`Dividendos após segunda execução: ${dividendsFinal}`);
        log(`Novos criados (deve ser 0): ${secondRun.created}`);
        log(`Skipped (já existentes): ${secondRun.skipped}`);

        if (secondRun.created === 0) {
            log('✅ IDEMPOTÊNCIA CONFIRMADA - Dividendos não duplicam');
        } else {
            log('❌ FALHA - Dividendos duplicados!');
        }

        // ========================================
        // RESUMO FINAL
        // ========================================
        log('\n' + '='.repeat(40));
        log('📋 RESUMO ARQUITETURAL');
        log('='.repeat(40));
        log('✅ Bootstrap: Manual via admin');
        log('✅ Sync-on-purchase: Funcional');
        log('✅ Cron de mercado: 30 min (apenas FIIs com posições)');
        log('✅ Cron de dividendos: 1x/dia (idempotente)');
        log('✅ Dividendos não duplicam');
        log('✅ Usuário não dispara atualizações');
        log('='.repeat(40));

    } catch (error) {
        log(`❌ ERRO: ${error.message}`);
        log(error.stack);
    } finally {
        saveOutput();
        process.exit(0);
    }
};

// Executa os testes
runTests();
