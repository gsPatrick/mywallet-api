# Documentação Técnica: Sistema de Dados de Investimentos

## Índice
1. [Visão Geral](#visão-geral)
2. [O que foi Implementado](#o-que-foi-implementado)
3. [Arquitetura Técnica](#arquitetura-técnica)
4. [Lógica de Negócio (Foco no Investidor)](#lógica-de-negócio-foco-no-investidor)
5. [Fluxo de Dados](#fluxo-de-dados)
6. [Dados Disponíveis Atualmente](#dados-disponíveis-atualmente)
7. [Dados Faltantes para Web Scraping](#dados-faltantes-para-web-scraping)
8. [Fontes de Dados Recomendadas](#fontes-de-dados-recomendadas)
9. [Próximos Passos](#próximos-passos)

---

## Visão Geral

### Problema Original
O Yahoo Finance (nossa fonte primária de cotações) **não retorna Dividend Yield para FIIs brasileiros**. Isso impedia o cálculo do "Magic Number" e outras análises de renda passiva.

### Solução Implementada
Criamos um sistema de web scraping do **Funds Explorer** que:
- Extrai dados de dividendos de FIIs brasileiros
- Cacheia os dados no banco de dados
- Atualiza automaticamente via cron jobs
- Fornece dados confiáveis para o frontend

---

## O que foi Implementado

### Arquivos Criados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `/src/models/fiiData.js` | Model | Cache de dados FII (preço, DY, histórico) |
| `/src/features/investments/fundsExplorer.client.js` | Client | Scraper do Funds Explorer |
| `/src/features/investments/fiiSync.service.js` | Service | Orquestra sincronização |
| `/src/cron/fiiSync.cron.js` | Cron Job | Agendamento diário |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `/src/models/index.js` | Registrado FIIData model |
| `/src/app.js` | Inicialização de cron jobs |
| `/src/features/investments/investments.service.js` | Usa FIIData para FIIs |
| `/src/features/investments/yahoo.client.js` | Adicionado dividendYield na resposta |
| `PortfolioTable.js` (frontend) | Usa dados da API |

### Dependências Instaladas

```bash
npm install node-cron cheerio
```

---

## Arquitetura Técnica

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              SOURCES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────────┐     ┌──────────────────┐     ┌────────────────┐  │
│   │   Yahoo Finance  │     │  Funds Explorer  │     │  Status Invest │  │
│   │   (via npm lib)  │     │   (Web Scraping) │     │  (TODO: Scrap) │  │
│   └────────┬─────────┘     └────────┬─────────┘     └────────────────┘  │
│            │                        │                                    │
│            ▼                        ▼                                    │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                        CLIENTS LAYER                              │  │
│   │  yahoo.client.js    |    fundsExplorer.client.js    |   (TODO)   │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                        SERVICES LAYER                             │  │
│   │  investments.service.js    |    fiiSync.service.js               │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                        DATABASE LAYER                             │  │
│   │  Asset  |  Investment  |  Dividend  |  FIIData  |  Snapshot      │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                        API LAYER                                  │  │
│   │  /api/investments/portfolio  |  /api/investments/dividends       │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                      │
│  PortfolioTable  |  AssetRowExpanded  |  MagicNumber  |  Charts         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estratégia de Fontes de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESTRATÉGIA DE DY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. AÇÕES (PETR4, ITUB4, VALE3...)                              │
│     └──▶ Yahoo Finance API (trailingAnnualDividendYield)        │
│                                                                  │
│  2. FIIs (MXRF11, HGLG11, XPML11...)                            │
│     └──▶ Funds Explorer Scraper (cacheado em FIIData)           │
│                                                                  │
│  3. FALLBACK                                                     │
│     └──▶ Dividend table (histórico local)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lógica de Negócio (Foco no Investidor)

### Por que esses Dados são Importantes?

O investidor de renda passiva precisa:

#### 1. **Renda Mensal Recorrente**
- Saber quanto receberá por mês
- Planejar gastos com base em proventos
- **Dados necessários:** `lastDividend`, `dividendHistory`

#### 2. **Projeção de Renda Futura**
- Estimar ganhos anuais
- Comparar com metas financeiras
- **Dados necessários:** `dividendYield`, `annualDividendSum`

#### 3. **Comparação entre FIIs**
- Escolher o melhor ativo para comprar
- Avaliar consistência de pagamentos
- **Dados necessários:** DY, histórico, P/VP

#### 4. **Acompanhamento de Constância**
- Identificar FIIs que pagam regularmente
- Detectar quedas nos proventos
- **Dados necessários:** `dividendHistory` com datas

#### 5. **Magic Number (Número Mágico)**
- Quantidade de cotas para atingir meta de renda
- **Fórmula:** `Meta Mensal ÷ Último Dividendo por Cota`
- **Dados necessários:** `lastDividendPerShare`, `currentPrice`

### Regras de Negócio Implementadas

```javascript
// 1. DY é calculado nos últimos 12 MESES MÓVEIS (não ano calendário)
const twelveMonthsAgo = new Date();
twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

// 2. FIIs: Scraper do Funds Explorer (mais confiável)
if (position.type === 'FII') {
    dy = fiiData.dividendYield;
}

// 3. Ações: Yahoo Finance
if (position.type === 'STOCK') {
    dy = quote.trailingAnnualDividendYield * 100;
}

// 4. Fallback: Calcula do histórico local
if (dy === 0 && dividendsByTicker[ticker]) {
    dy = (dividendsByTicker[ticker].total / price) * 100;
}
```

---

## Fluxo de Dados

### 1. Boot do Servidor

```
1. Servidor inicia
2. CRON jobs são agendados (06:00 e 18:00 BRT)
3. Após 10s, executa sync inicial dos FIIs da carteira
4. Scraper busca cada FII no Funds Explorer
5. Dados são salvos na tabela FIIData
```

### 2. Requisição de Portfolio

```
1. Frontend chama GET /api/investments/portfolio
2. Backend busca cotações Yahoo (ações)
3. Backend busca FIIData cacheado (FIIs)
4. Monta posições com DY de cada fonte
5. Retorna para frontend
```

### 3. Atualização Automática (Cron)

```
1. 06:00 BRT - Sync matinal
2. 18:00 BRT - Sync vespertino
3. Para cada FII nas carteiras:
   a. Scrape Funds Explorer
   b. Atualiza FIIData
   c. Log de sucesso/erro
```

---

## Dados Disponíveis Atualmente

### ✅ O que JÁ temos

| Dado | Ações | FIIs | Fonte |
|------|-------|------|-------|
| Preço atual | ✅ | ✅ | Yahoo / Scraper |
| Variação diária | ✅ | ✅ | Yahoo |
| Dividend Yield (12m) | ✅ | ✅ | Yahoo / Scraper |
| Último dividendo | ✅ | ✅ | API / Scraper |
| Histórico dividendos | ✅ | ✅ | Dividend table / Scraper |
| Quantidade possuída | ✅ | ✅ | Investment table |
| Preço médio | ✅ | ✅ | Calculado |
| Lucro/Prejuízo | ✅ | ✅ | Calculado |

---

## Dados Faltantes para Web Scraping

### ❌ O que NÃO temos (e precisamos)

Abaixo está a lista de dados importantes para análise de investimentos que **não vêm de APIs gratuitas** e precisam de web scraping:

---

### 1. **P/VP (Preço sobre Valor Patrimonial)**
- **O que é:** Indica se o FII está caro ou barato
- **Por que importa:** Investidores buscam P/VP < 1 para "barganhas"
- **Onde scrappear:** Status Invest, Fundamentus, Funds Explorer
- **Formato esperado:**
```json
{
  "ticker": "MXRF11",
  "pvp": 0.95
}
```

---

### 2. **Vacância Física e Financeira (FIIs)**
- **O que é:** % de imóveis/contratos vagos
- **Por que importa:** Alta vacância = risco de queda de rendimentos
- **Onde scrappear:** Status Invest, Clubefii
- **Formato esperado:**
```json
{
  "ticker": "HGLG11",
  "vacancyPhysical": 5.2,
  "vacancyFinancial": 3.8
}
```

---

### 3. **Número de Cotistas**
- **O que é:** Quantidade de investidores no fundo
- **Por que importa:** Mais cotistas = mais líquido
- **Onde scrappear:** Status Invest
- **Formato esperado:**
```json
{
  "ticker": "MXRF11",
  "shareholders": 850000
}
```

---

### 4. **Patrimônio Líquido**
- **O que é:** Valor total dos ativos do fundo
- **Por que importa:** Fundos maiores são mais estáveis
- **Onde scrappear:** Status Invest, Funds Explorer
- **Formato esperado:**
```json
{
  "ticker": "HGLG11",
  "netWorth": 3500000000
}
```

---

### 5. **Liquidez Diária Média**
- **O que é:** Volume médio negociado por dia
- **Por que importa:** Facilidade de comprar/vender
- **Onde scrappear:** Status Invest, B3
- **Formato esperado:**
```json
{
  "ticker": "XPML11",
  "avgDailyLiquidity": 15000000
}
```

---

### 6. **Segmento/Setor do FII**
- **O que é:** Tipo de imóveis (Logística, Shopping, Papel, etc)
- **Por que importa:** Diversificação da carteira
- **Onde scrappear:** Funds Explorer
- **Formato esperado:**
```json
{
  "ticker": "HGLG11",
  "segment": "Logística"
}
```

---

### 7. **Taxa de Administração**
- **O que é:** % cobrado pelo gestor
- **Por que importa:** Afeta rentabilidade líquida
- **Onde scrappear:** Funds Explorer, Status Invest
- **Formato esperado:**
```json
{
  "ticker": "MXRF11",
  "adminFee": 1.0,
  "performanceFee": 20.0
}
```

---

### 8. **Indicadores Fundamentalistas (Ações)**
- **O que é:** P/L, ROE, Margem Líquida, Dívida/EBITDA
- **Por que importa:** Análise fundamentalista completa
- **Onde scrappear:** Status Invest, Fundamentus
- **Formato esperado:**
```json
{
  "ticker": "PETR4",
  "pe": 4.5,
  "roe": 25.3,
  "netMargin": 18.2,
  "debtToEbitda": 1.5
}
```

---

### 9. **Agenda de Dividendos**
- **O que é:** Próximos pagamentos anunciados
- **Por que importa:** Planejamento de caixa
- **Onde scrappear:** Status Invest, Funds Explorer
- **Formato esperado:**
```json
{
  "ticker": "MXRF11",
  "nextDividends": [
    { "exDate": "2025-01-10", "paymentDate": "2025-01-15", "amount": 0.10 }
  ]
}
```

---

### 10. **Histórico de Cotações**
- **O que é:** Preços históricos para gráficos
- **Por que importa:** Gráficos de evolução patrimonial
- **Onde scrappear:** Yahoo (já temos), Brapi (se pago)
- **Status:** ✅ Parcialmente disponível

---

## Fontes de Dados Recomendadas

### Para Web Scraping

| Fonte | URL | Dados Disponíveis |
|-------|-----|-------------------|
| Funds Explorer | fundsexplorer.com.br | FIIs: DY, P/VP, vacância, segmento |
| Status Invest | statusinvest.com.br | Ações e FIIs: indicadores completos |
| Fundamentus | fundamentus.com.br | Ações: P/L, ROE, margens |
| Clubefii | clubefii.com.br | FIIs: vacância, patrimônio |

### Estrutura Sugerida para Novos Scrapers

```
/src/features/investments/
├── fundsExplorer.client.js   ✅ (Implementado)
├── statusInvest.client.js    🔜 (A fazer)
├── fundamentus.client.js     🔜 (A fazer)
└── scrapers/
    ├── fiiIndicators.js      🔜 (P/VP, vacância)
    ├── stockIndicators.js    🔜 (P/L, ROE)
    └── dividendCalendar.js   🔜 (Agenda)
```

---

## Próximos Passos

### Fase 1: Expandir Scraper de FIIs (Prioridade Alta)
- [ ] Adicionar P/VP ao Funds Explorer scraper
- [ ] Adicionar Vacância
- [ ] Adicionar Segmento

### Fase 2: Criar Scraper Status Invest (Prioridade Média)
- [ ] Ações: P/L, ROE, Dívida
- [ ] FIIs: Número de cotistas, Patrimônio

### Fase 3: Dashboard de Análise (Prioridade Média)
- [ ] Comparador de FIIs
- [ ] Ranking por DY real
- [ ] Gráficos de histórico

### Fase 4: Alertas Inteligentes (Prioridade Baixa)
- [ ] Notificação de dividendos anunciados
- [ ] Alerta de P/VP abaixo de X
- [ ] Alerta de vacância acima de Y%

---

## Exemplo de Uso do Scraper

### Testar no Node.js

```javascript
const fundsExplorer = require('./fundsExplorer.client');

// Buscar dados de um FII
const data = await fundsExplorer.getFIIData('MXRF11');

console.log(data);
// {
//   ticker: 'MXRF11',
//   price: 9.55,
//   dividendYield: 12.25,
//   lastDividend: 0.10,
//   dividendHistory: [...]
// }
```

### Forçar Sync Manual

```javascript
const fiiSyncService = require('./fiiSync.service');

// Sync de um FII específico
await fiiSyncService.syncFII('HGLG11');

// Sync de todos os FIIs da carteira
await fiiSyncService.syncAllUserFIIs();
```

---

## Considerações de Performance

### Rate Limiting
- 1 requisição por segundo para Funds Explorer
- Retry com backoff exponencial (2s, 4s, 6s)

### Caching
- Dados cacheados em FIIData table
- Refresh automático se > 7 dias
- Sync forçado via cron 2x/dia

### Resiliência
- Fallback para dados antigos se scrape falhar
- Contador de erros por ticker
- Logs detalhados para debugging

---

## Conclusão

O sistema agora possui:
1. ✅ Dividend Yield confiável para FIIs (via scraping)
2. ✅ Dividend Yield para Ações (via Yahoo)
3. ✅ Caching inteligente no banco
4. ✅ Atualização automática (cron)
5. ✅ Magic Number funcionando

Para completar a análise de investimentos, precisamos implementar scrapers adicionais para:
- P/VP
- Vacância
- Indicadores fundamentalistas
- Agenda de dividendos

Esta documentação serve como guia para as próximas implementações.
