/**
 * Investor Portfolio AUDIT Test
 * ==============================
 * 
 * Este script valida as 3 prioridades obrigatórias:
 * 1. AUDITABILIDADE - Verifica breakdowns em todas as métricas
 * 2. ANÁLISE TEMPORAL - Verifica trends 3m, 6m, YTD
 * 3. RISCO EXPLICÁVEL - Verifica reasons array
 * 
 * Uso: node tests/investorPortfolio.audit.test.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

const httpGet = (url, headers = {}) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...headers }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
};

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatPercent = (v) => `${(v || 0).toFixed(2)}%`;

const runAuditTest = async () => {
    console.log('═'.repeat(70));
    console.log('  TESTE DE AUDITORIA DO PORTFOLIO DO INVESTIDOR');
    console.log('═'.repeat(70));
    console.log(`\n📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

    let passed = 0;
    let failed = 0;
    const results = [];

    try {
        const response = await httpGet(`${BASE_URL}/api/investments/portfolio`);

        if (response.status !== 200) {
            console.error(`❌ Erro HTTP: ${response.status}`);
            return;
        }

        const portfolio = response.data.data;

        // Salvar response completo
        const responsePath = path.join(__dirname, 'investorPortfolio.audit.response.txt');
        fs.writeFileSync(responsePath, JSON.stringify(portfolio, null, 2));
        console.log(`✅ Response salvo em: ${responsePath}\n`);

        // =====================================================
        // 1. AUDITABILIDADE - RENTABILIDADE BREAKDOWN
        // =====================================================
        console.log('─'.repeat(70));
        console.log('📊 1. AUDITABILIDADE - RENTABILITY BREAKDOWN');
        console.log('─'.repeat(70));

        const firstPosition = portfolio.positions?.[0];
        if (firstPosition?.rentability?.breakdown) {
            console.log(`\n✅ PASSED: rentability.breakdown existe`);
            passed++;
            console.log(`\n   Ativo: ${firstPosition.ticker}`);
            console.log(`   breakdown.investedCapital: ${formatCurrency(firstPosition.rentability.breakdown.investedCapital)}`);
            console.log(`   breakdown.currentValue:    ${formatCurrency(firstPosition.rentability.breakdown.currentValue)}`);
            console.log(`   breakdown.dividendsReceived: ${formatCurrency(firstPosition.rentability.breakdown.dividendsReceived)}`);
            console.log(`   breakdown.capitalGain:     ${formatCurrency(firstPosition.rentability.breakdown.capitalGain)}`);
            console.log(`   breakdown.formula:         ${firstPosition.rentability.breakdown.formula}`);
            console.log(`   breakdown.calculation:     ${firstPosition.rentability.breakdown.calculation}`);
        } else {
            console.log(`\n❌ FAILED: rentability.breakdown não encontrado`);
            failed++;
        }

        // Portfolio metrics breakdown
        console.log('\n   Portfolio Metrics Breakdown:');
        if (portfolio.portfolioMetrics?.breakdown) {
            console.log(`   ✅ PASSED: portfolioMetrics.breakdown existe`);
            passed++;
            const pm = portfolio.portfolioMetrics.breakdown;
            console.log(`   investedCapital:    ${formatCurrency(pm.investedCapital)}`);
            console.log(`   currentValue:       ${formatCurrency(pm.currentValue)}`);
            console.log(`   dividendsReceived:  ${formatCurrency(pm.dividendsReceived)}`);
            console.log(`   capitalGain:        ${formatCurrency(pm.capitalGain)}`);
            console.log(`   formula:            ${pm.formula}`);
        } else {
            console.log(`   ❌ FAILED: portfolioMetrics.breakdown não encontrado`);
            failed++;
        }

        // =====================================================
        // 2. ANÁLISE TEMPORAL - DIVIDENDS TRENDS
        // =====================================================
        console.log('\n' + '─'.repeat(70));
        console.log('📈 2. ANÁLISE TEMPORAL - DIVIDENDS TRENDS');
        console.log('─'.repeat(70));

        const trends = portfolio.dividends?.trends;
        if (trends) {
            console.log(`\n✅ PASSED: dividends.trends existe`);
            passed++;

            // 3 months
            if (trends.threeMonths) {
                console.log(`\n   Últimos 3 meses vs anteriores:`);
                console.log(`   value:         ${formatCurrency(trends.threeMonths.value)}`);
                console.log(`   previous:      ${formatCurrency(trends.threeMonths.previous)}`);
                console.log(`   changePercent: ${formatPercent(trends.threeMonths.changePercent)}`);
                console.log(`   status:        ${trends.threeMonths.status}`);

                if (['GROWING', 'STABLE', 'DECLINING'].includes(trends.threeMonths.status)) {
                    console.log(`   ✅ PASSED: status é válido`);
                    passed++;
                } else {
                    console.log(`   ❌ FAILED: status inválido`);
                    failed++;
                }
            }

            // 6 months
            if (trends.sixMonths) {
                console.log(`\n   Últimos 6 meses vs anteriores:`);
                console.log(`   value:         ${formatCurrency(trends.sixMonths.value)}`);
                console.log(`   previous:      ${formatCurrency(trends.sixMonths.previous)}`);
                console.log(`   changePercent: ${formatPercent(trends.sixMonths.changePercent)}`);
                console.log(`   status:        ${trends.sixMonths.status}`);
            }

            // YTD
            if (trends.ytd) {
                console.log(`\n   YTD (Year-To-Date):`);
                console.log(`   value:         ${formatCurrency(trends.ytd.value)}`);
                console.log(`   daysElapsed:   ${trends.ytd.daysElapsed} dias`);
                console.log(`   averagePerDay: ${formatCurrency(trends.ytd.averagePerDay)}`);
            }

            // 12 months
            if (trends.twelveMonths) {
                console.log(`\n   Últimos 12 meses:`);
                console.log(`   value:          ${formatCurrency(trends.twelveMonths.value)}`);
                console.log(`   monthlyAverage: ${formatCurrency(trends.twelveMonths.monthlyAverage)}`);
            }
        } else {
            console.log(`\n❌ FAILED: dividends.trends não encontrado`);
            failed++;
        }

        // =====================================================
        // 3. RISCO EXPLICÁVEL - RISK WITH REASONS
        // =====================================================
        console.log('\n' + '─'.repeat(70));
        console.log('⚠️  3. RISCO EXPLICÁVEL - RISK WITH REASONS');
        console.log('─'.repeat(70));

        let hasRiskReasons = false;
        portfolio.positions?.forEach(pos => {
            if (pos.risk?.reasons) {
                if (!hasRiskReasons) {
                    console.log(`\n✅ PASSED: position.risk.reasons existe`);
                    passed++;
                    hasRiskReasons = true;
                }
                console.log(`\n   ${pos.ticker}:`);
                console.log(`   level:   ${pos.risk.level}`);
                console.log(`   score:   ${pos.risk.score}`);
                console.log(`   reasons:`);
                pos.risk.reasons.forEach((r, i) => {
                    console.log(`     ${i + 1}. ${r}`);
                });
            }
        });

        if (!hasRiskReasons) {
            console.log(`\n❌ FAILED: Nenhuma posição com risk.reasons encontrada`);
            failed++;
        }

        // High risk assets in indicators
        console.log('\n   High Risk Assets (indicadores):');
        if (portfolio.indicators?.highRiskAssets?.length > 0) {
            portfolio.indicators.highRiskAssets.forEach(a => {
                console.log(`   - ${a.ticker}: ${a.riskLevel}`);
                a.reasons?.forEach(r => console.log(`       • ${r}`));
            });
        } else {
            console.log('   Nenhum ativo classificado como alto risco');
        }

        // =====================================================
        // 4. SAÚDE DA CARTEIRA - BREAKDOWN
        // =====================================================
        console.log('\n' + '─'.repeat(70));
        console.log('💚 4. SAÚDE DA CARTEIRA - BREAKDOWN');
        console.log('─'.repeat(70));

        const health = portfolio.indicators?.portfolioHealth;
        if (health?.breakdown) {
            console.log(`\n✅ PASSED: portfolioHealth.breakdown existe`);
            passed++;
            console.log(`\n   score:     ${health.score}/100`);
            console.log(`   status:    ${health.status}`);
            console.log(`   baseScore: ${health.breakdown.baseScore}`);
            console.log(`   formula:   ${health.breakdown.formula}`);
            console.log(`\n   Adjustments:`);
            health.breakdown.adjustments?.forEach(adj => {
                console.log(`     • ${adj.factor}: ${adj.impact > 0 ? '+' : ''}${adj.impact}`);
            });
            console.log(`\n   Issues:`);
            health.issues?.forEach(issue => console.log(`     ⚠️ ${issue}`));
        } else {
            console.log(`\n❌ FAILED: portfolioHealth.breakdown não encontrado`);
            failed++;
        }

        // =====================================================
        // RESULTADO FINAL
        // =====================================================
        console.log('\n' + '═'.repeat(70));
        console.log('  RESULTADO DO TESTE DE AUDITORIA');
        console.log('═'.repeat(70));
        console.log(`\n  ✅ Passed: ${passed}`);
        console.log(`  ❌ Failed: ${failed}`);
        console.log(`\n  Resultado: ${failed === 0 ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS TESTES FALHARAM'}`);
        console.log('═'.repeat(70));

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        console.error(error.stack);
    }
};

runAuditTest();
