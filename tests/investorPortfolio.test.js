/**
 * Investor Portfolio Test
 * ========================
 * 
 * Este arquivo testa os endpoints de investimento
 * simulando a perspectiva de um investidor real.
 * 
 * Uso: node tests/investorPortfolio.test.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuração
const BASE_URL = 'http://localhost:3001';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-id'; // Substituir por ID real

/**
 * Faz uma requisição HTTP GET
 */
const httpGet = (url, headers = {}) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
};

/**
 * Formata valores monetários
 */
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

/**
 * Formata percentuais
 */
const formatPercent = (value) => {
    return `${(value || 0).toFixed(2)}%`;
};

/**
 * Testa o endpoint de portfolio
 */
const testPortfolio = async () => {
    console.log('='.repeat(60));
    console.log('TESTE DE PORTFOLIO DO INVESTIDOR');
    console.log('='.repeat(60));
    console.log(`\nData/Hora: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log('');

    try {
        // Busca portfolio
        console.log('📊 Buscando portfolio...\n');
        const response = await httpGet(`${BASE_URL}/api/investments/portfolio`, {
            'X-User-Id': TEST_USER_ID // Header de autenticação simulado
        });

        if (response.status !== 200) {
            console.error(`❌ Erro: Status ${response.status}`);
            console.error(response.data);
            return;
        }

        const portfolio = response.data.data;

        // Salva response completo
        const responsePath = path.join(__dirname, 'investorPortfolio.response.txt');
        fs.writeFileSync(responsePath, JSON.stringify(portfolio, null, 2));
        console.log(`✅ Response salvo em: ${responsePath}\n`);

        // =====================================================
        // SUMÁRIO BÁSICO
        // =====================================================
        console.log('─'.repeat(60));
        console.log('📈 SUMÁRIO DA CARTEIRA');
        console.log('─'.repeat(60));
        console.log(`Total Investido:    ${formatCurrency(portfolio.summary?.totalInvested)}`);
        console.log(`Saldo Atual:        ${formatCurrency(portfolio.summary?.totalCurrentBalance)}`);
        console.log(`Lucro/Prejuízo:     ${formatCurrency(portfolio.summary?.totalProfit)}`);
        console.log(`Rentabilidade:      ${formatPercent(portfolio.summary?.totalProfitPercent)}`);
        console.log('');

        // =====================================================
        // DIVIDENDOS RECEBIDOS
        // =====================================================
        console.log('─'.repeat(60));
        console.log('💰 DIVIDENDOS RECEBIDOS');
        console.log('─'.repeat(60));

        const dividends = portfolio.dividends;
        if (dividends) {
            console.log(`Este mês:           ${formatCurrency(dividends.month?.total)} (${dividends.month?.count || 0} proventos)`);
            console.log(`Este ano:           ${formatCurrency(dividends.year?.total)} (${dividends.year?.count || 0} proventos)`);
            console.log(`Total histórico:    ${formatCurrency(dividends.allTime?.total)} (${dividends.allTime?.count || 0} proventos)`);
            console.log(`Renda projetada:    ${formatCurrency(dividends.projectedMonthlyIncome)}/mês`);

            if (dividends.recent?.length > 0) {
                console.log('\nÚltimos proventos:');
                dividends.recent.forEach((d, i) => {
                    console.log(`  ${i + 1}. ${d.ticker}: ${formatCurrency(d.amount)} (${d.paymentDate})`);
                });
            }
        } else {
            console.log('Nenhum dividendo recebido.');
        }
        console.log('');

        // =====================================================
        // RENTABILIDADE POR ATIVO
        // =====================================================
        console.log('─'.repeat(60));
        console.log('📊 RENTABILIDADE POR ATIVO');
        console.log('─'.repeat(60));

        const positions = portfolio.positions || [];
        positions.forEach(pos => {
            const rent = pos.rentability;
            console.log(`\n${pos.ticker} (${pos.type})`);
            console.log(`  Capital Investido:  ${formatCurrency(rent?.capitalInvested)}`);
            console.log(`  Valor Atual:        ${formatCurrency(rent?.currentValue)}`);
            console.log(`  Ganho de Capital:   ${formatCurrency(rent?.capitalGain)} (${formatPercent(rent?.capitalGainPercent)})`);
            console.log(`  Dividendos:         ${formatCurrency(rent?.dividendsReceived)} (${formatPercent(rent?.dividendsPercent)})`);
            console.log(`  Retorno Total:      ${formatCurrency(rent?.totalReturn)} (${formatPercent(rent?.totalReturnPercent)})`);
        });
        console.log('');

        // =====================================================
        // CONCENTRAÇÃO DA CARTEIRA
        // =====================================================
        console.log('─'.repeat(60));
        console.log('🎯 CONCENTRAÇÃO DA CARTEIRA');
        console.log('─'.repeat(60));

        const concentration = portfolio.concentration;
        if (concentration) {
            console.log('\nPor Tipo de Ativo:');
            concentration.byType?.forEach(t => {
                console.log(`  ${t.type}: ${formatPercent(t.percentage)} (${t.count} ativos)`);
            });

            console.log('\nPor Segmento (FIIs):');
            concentration.bySegment?.forEach(s => {
                console.log(`  ${s.segment}: ${formatPercent(s.percentage)} (${s.count} ativos)`);
            });

            console.log('\nTop 5 Ativos:');
            concentration.topAssets?.forEach((a, i) => {
                console.log(`  ${i + 1}. ${a.ticker}: ${formatPercent(a.percentage)} (${formatCurrency(a.value)})`);
            });

            console.log('\nIndicadores de Risco:');
            console.log(`  Maior concentração:     ${formatPercent(concentration.indicators?.topAssetConcentration)}`);
            console.log(`  Top 3 concentração:     ${formatPercent(concentration.indicators?.top3Concentration)}`);
            console.log(`  Sobre-concentrado:      ${concentration.indicators?.isOverConcentrated ? '⚠️ SIM' : '✅ NÃO'}`);
            console.log(`  Número de ativos:       ${concentration.indicators?.numberOfAssets}`);
        }
        console.log('');

        // =====================================================
        // RANKINGS
        // =====================================================
        console.log('─'.repeat(60));
        console.log('🏆 RANKINGS');
        console.log('─'.repeat(60));

        const rankings = portfolio.rankings;
        if (rankings) {
            console.log('\nTop Pagadores de Dividendos:');
            rankings.topDividendPayers?.forEach((p, i) => {
                console.log(`  ${i + 1}. ${p.ticker}: DY ${formatPercent(p.dy)}`);
            });

            console.log('\nMais Rentáveis:');
            rankings.mostProfitable?.forEach((p, i) => {
                console.log(`  ${i + 1}. ${p.ticker}: ${formatPercent(p.totalReturnPercent)} retorno total`);
            });

            console.log('\nMenos Rentáveis (atenção):');
            rankings.leastProfitable?.forEach((p, i) => {
                console.log(`  ${i + 1}. ${p.ticker}: ${formatPercent(p.totalReturnPercent)} retorno total`);
            });

            console.log('\nDistribuição por Risco (FIIs):');
            console.log(`  Baixo:  ${rankings.byRiskLevel?.low || 0} ativos`);
            console.log(`  Médio:  ${rankings.byRiskLevel?.medium || 0} ativos`);
            console.log(`  Alto:   ${rankings.byRiskLevel?.high || 0} ativos`);
        }
        console.log('');

        // =====================================================
        // INDICADORES-CHAVE
        // =====================================================
        console.log('─'.repeat(60));
        console.log('🎯 INDICADORES-CHAVE');
        console.log('─'.repeat(60));

        const indicators = portfolio.indicators;
        if (indicators) {
            if (indicators.mostProfitable) {
                console.log(`\nAtivo mais rentável: ${indicators.mostProfitable.ticker} (${formatPercent(indicators.mostProfitable.totalReturnPercent)})`);
            }

            if (indicators.topConcentration) {
                console.log(`Maior concentração:  ${indicators.topConcentration.ticker} (${formatPercent(indicators.topConcentration.percentage)})`);
            }

            if (indicators.topSegment) {
                console.log(`Segmento dominante:  ${indicators.topSegment.segment} (${formatPercent(indicators.topSegment.percentage)})`);
            }

            if (indicators.highRiskCount > 0) {
                console.log(`\n⚠️ Ativos de alto risco: ${indicators.highRiskCount}`);
                indicators.highRiskAssets?.forEach(a => {
                    console.log(`   - ${a.ticker}: ${a.reason}`);
                });
            }

            const health = indicators.portfolioHealth;
            if (health) {
                console.log(`\n📊 Saúde da Carteira: ${health.score}/100 (${health.status})`);
                if (health.issues?.length > 0) {
                    console.log('Problemas identificados:');
                    health.issues.forEach(issue => {
                        console.log(`   - ${issue}`);
                    });
                }
            }
        }
        console.log('');

        // =====================================================
        // MÉTRICAS DA CARTEIRA
        // =====================================================
        console.log('─'.repeat(60));
        console.log('📈 MÉTRICAS CONSOLIDADAS');
        console.log('─'.repeat(60));

        const metrics = portfolio.portfolioMetrics;
        if (metrics) {
            console.log(`Total Investido:          ${formatCurrency(metrics.totalInvested)}`);
            console.log(`Valor Atual:              ${formatCurrency(metrics.currentValue)}`);
            console.log(`Ganho de Capital:         ${formatCurrency(metrics.capitalGain)} (${formatPercent(metrics.capitalGainPercent)})`);
            console.log(`Dividendos Recebidos:     ${formatCurrency(metrics.dividendsReceived)} (${formatPercent(metrics.dividendsPercent)})`);
            console.log(`Retorno Total:            ${formatCurrency(metrics.totalReturn)} (${formatPercent(metrics.totalReturnPercent)})`);
            console.log(`DY Médio da Carteira:     ${formatPercent(metrics.averageDY)}`);
            console.log(`Renda Projetada:          ${formatCurrency(metrics.projectedMonthlyIncome)}/mês`);
            console.log(`Número de Ativos:         ${metrics.numberOfAssets}`);
        }
        console.log('');

        console.log('='.repeat(60));
        console.log('✅ TESTE CONCLUÍDO COM SUCESSO');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        console.error(error.stack);
    }
};

// Executa o teste
testPortfolio();
