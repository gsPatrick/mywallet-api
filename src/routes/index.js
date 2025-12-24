/**
 * Agregador de Rotas
 * Centraliza todas as rotas da API
 */

const { Router } = require('express');

// ===========================================
// ROTAS - FASE 1 (BASE)
// ===========================================
const authRoutes = require('../features/auth/auth.routes');
const openFinanceRoutes = require('../features/openFinance/openFinance.routes');
const transactionsRoutes = require('../features/transactions/transactions.routes');
const cardsRoutes = require('../features/cards/cards.routes');
const investmentsRoutes = require('../features/investments/investments.routes');
const budgetsRoutes = require('../features/budgets/budgets.routes');
const dashboardRoutes = require('../features/dashboard/dashboard.routes');

// ===========================================
// ROTAS - FASE 2 (EXPANSÃO)
// ===========================================
const investmentDashboardRoutes = require('../features/investmentDashboard/investmentDashboard.routes');
const subscriptionRoutes = require('../features/subscription/subscription.routes');
const manualCardRoutes = require('../features/manualCard/manualCard.routes');
const financialProductRoutes = require('../features/financialProduct/financialProduct.routes');

const reportsRoutes = require('../features/reports/reports.routes');
const goalsRoutes = require('../features/goals/goals.routes');
const messagesRoutes = require('../features/messages/messages.routes');

// ===========================================
// ROTAS - FASE 3 (GAMIFICAÇÃO)
// ===========================================
const gamificationRoutes = require('../features/gamification/gamification.routes');

// ===========================================
// ROTAS - FASE 4 (TRANSAÇÕES APRIMORADAS)
// ===========================================
const { categoriesRoutes } = require('../features/categories');
const { notificationsRoutes } = require('../features/notifications');

// ===========================================
// ROTAS - FASE 5 (WHATSAPP BOT)
// ===========================================
const { whatsappRoutes } = require('../features/whatsapp');

// ===========================================
// ROTAS - FASE 6 (MULTI-CONTEXT PROFILES)
// ===========================================
const { profilesRoutes } = require('../features/profiles');

// ===========================================
// ROTAS - FASE 7 (BANK ACCOUNTS)
// ===========================================
const bankAccountsRoutes = require('../features/bankAccounts/bankAccounts.routes');

// ===========================================
// ROTAS - FASE 8 (CENTRAL DO DAS)
// ===========================================
const dasRoutes = require('../features/das/das.routes');

// ===========================================
// ROTAS - FASE 9 (FATURAS DE CARTÃO)
// ===========================================
const invoicesRoutes = require('../features/invoices/invoices.routes');

const router = Router();

// Rotas públicas
router.get('/', (req, res) => {
    res.json({
        message: 'Open Finance API',
        version: '1.0.0',
        status: 'online'
    });
});

// ===========================================
// REGISTRAR ROTAS - FASE 1
// ===========================================
router.use('/auth', authRoutes);
router.use('/open-finance', openFinanceRoutes);
router.use('/transactions', transactionsRoutes);
router.use('/cards', cardsRoutes);
router.use('/investments', investmentsRoutes);
router.use('/budgets', budgetsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/goals', goalsRoutes);
router.use('/messages', messagesRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 2
// ===========================================
router.use('/investment-dashboard', investmentDashboardRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/manual-cards', manualCardRoutes);
router.use('/financial-products', financialProductRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 3
// ===========================================
router.use('/gamification', gamificationRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 4
// ===========================================
router.use('/categories', categoriesRoutes);
router.use('/notifications', notificationsRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 5 (WHATSAPP)
// ===========================================
router.use('/whatsapp', whatsappRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 6 (MULTI-CONTEXT PROFILES)
// ===========================================
router.use('/profiles', profilesRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 7 (BANK ACCOUNTS)
// ===========================================
router.use('/bank-accounts', bankAccountsRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 8 (CENTRAL DO DAS)
// ===========================================
router.use('/das', dasRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 9 (FATURAS DE CARTÃO)
// ===========================================
router.use('/invoices', invoicesRoutes);

// ===========================================
// REGISTRAR ROTAS - FASE 9 (SAAS - ADMIN)
// ===========================================
const adminRoutes = require('../features/admin/admin.routes');
router.use('/admin', adminRoutes);

// Webhook do Mercado Pago (rota separada)
router.post('/webhooks/mercadopago', (req, res, next) => {
    const webhookController = require('../features/subscription/webhook.controller');
    return webhookController.handleWebhook(req, res, next);
});

// ===========================================
// DOCUMENTAÇÃO DA API
// ===========================================
router.get('/', (req, res) => {
    res.json({
        name: 'Open Finance Brasil API',
        version: '2.0.0',
        description: 'Sistema Financeiro Completo com Open Finance Brasil',
        phases: {
            phase1: 'Base - Auth, Open Finance, Transactions, Investments, Dashboard',
            phase2: 'Expansão - Investment Dashboard, Subscriptions, Manual Cards'
        },
        endpoints: {
            // ===========================================
            // FASE 1
            // ===========================================
            auth: {
                'POST /auth/register': 'Registrar usuário',
                'POST /auth/login': 'Login',
                'POST /auth/refresh': 'Renovar tokens',
                'GET /auth/me': 'Dados do usuário'
            },
            openFinance: {
                'POST /open-finance/consents': 'Criar consentimento',
                'GET /open-finance/consents': 'Listar consentimentos',
                'DELETE /open-finance/consents/:id': 'Revogar consentimento',
                'POST /open-finance/import/accounts': 'Importar contas',
                'POST /open-finance/import/cards': 'Importar cartões',
                'POST /open-finance/import/transactions': 'Importar transações'
            },
            transactions: {
                'GET /transactions': 'Listar transações',
                'POST /transactions/manual': 'Criar transação manual',
                'PUT /transactions/:id': 'Atualizar transação',
                'DELETE /transactions/:id': 'Excluir transação manual'
            },
            investments: {
                'GET /investments': 'Listar investimentos',
                'POST /investments': 'Registrar investimento',
                'GET /investments/portfolio': 'Portfólio com cotações',
                'GET /investments/assets': 'Listar ativos'
            },
            budgets: {
                'GET /budgets': 'Listar orçamentos',
                'GET /budgets/current': 'Orçamento atual',
                'POST /budgets': 'Criar orçamento'
            },
            dashboard_financeiro: {
                'GET /dashboard/summary': 'Resumo financeiro (gastos)',
                'GET /dashboard/alerts': 'Alertas financeiros',
                'GET /dashboard/categories': 'Gastos por categoria'
            },
            // ===========================================
            // FASE 2 - EXPANSÃO
            // ===========================================
            investment_dashboard: {
                'GET /investment-dashboard/summary': 'Resumo do portfólio',
                'GET /investment-dashboard/performance/assets': 'Rentabilidade por ativo',
                'GET /investment-dashboard/performance/classes': 'Rentabilidade por classe',
                'GET /investment-dashboard/allocation': 'Análise de alocação',
                'GET /investment-dashboard/evolution': 'Evolução patrimonial',
                'GET /investment-dashboard/dividends': 'Proventos recebidos',
                'GET /investment-dashboard/alerts': 'Alertas de investimentos'
            },
            subscriptions: {
                'GET /subscriptions': 'Listar assinaturas',
                'POST /subscriptions': 'Criar assinatura',
                'PUT /subscriptions/:id': 'Atualizar assinatura',
                'DELETE /subscriptions/:id': 'Cancelar assinatura',
                'GET /subscriptions/summary': 'Resumo de assinaturas',
                'GET /subscriptions/upcoming': 'Próximas cobranças',
                'GET /subscriptions/alerts': 'Alertas de assinaturas'
            },
            manual_cards: {
                'GET /manual-cards': 'Listar cartões manuais',
                'POST /manual-cards': 'Criar cartão manual',
                'PUT /manual-cards/:id': 'Atualizar cartão',
                'DELETE /manual-cards/:id': 'Desativar cartão',
                'GET /manual-cards/:cardId/transactions': 'Transações do cartão',
                'POST /manual-cards/:cardId/transactions': 'Criar transação (com parcelamento)',
                'GET /manual-cards/:cardId/statement': 'Fatura do cartão'
            }
        },
        documentation: {
            openFinance: 'https://openfinancebrasil.atlassian.net/wiki/spaces/OF',
            brapi: 'https://brapi.dev/docs'
        }
    });
});

module.exports = router;
