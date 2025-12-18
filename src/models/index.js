/**
 * Inicialização dos Models Sequelize
 * Configura todos os models e suas associações
 */

const { sequelize } = require('../config/database');

// Importar models - Fase 1
const User = require('./user')(sequelize);
const Consent = require('./consent')(sequelize);
const BankAccount = require('./bankAccount')(sequelize);
const CreditCard = require('./creditCard')(sequelize);
const OpenFinanceTransaction = require('./openFinanceTransaction')(sequelize);
const ManualTransaction = require('./manualTransaction')(sequelize);
const TransactionMetadata = require('./transactionMetadata')(sequelize);
const Asset = require('./asset')(sequelize);
const Investment = require('./investment')(sequelize);
const Budget = require('./budget')(sequelize);
const Goal = require('./goal')(sequelize);
const Message = require('./message')(sequelize);
const AuditLog = require('./auditLog')(sequelize);

// Importar models - Fase 2 (Expansão)
const CardTransaction = require('./cardTransaction')(sequelize);
const Subscription = require('./subscription')(sequelize);
const Dividend = require('./dividend')(sequelize);
const InvestmentSnapshot = require('./investmentSnapshot')(sequelize);
const FinancialProduct = require('./financialProduct')(sequelize);

// Importar models - Fase 3 (Gamificação)
const UserProfile = require('./userProfile')(sequelize);
const Medal = require('./medal')(sequelize);
const UserMedal = require('./userMedal')(sequelize);

// Importar models - Fase 4 (Transações Aprimoradas)
const Category = require('./category')(sequelize);
const Notification = require('./notification')(sequelize);
const GoalHistory = require('./goalHistory')(sequelize);

// Importar models - Fase 5 (Orçamentos Inteligentes)
const BudgetAllocation = require('./budgetAllocation')(sequelize);

// ===========================================
// ASSOCIAÇÕES - Fase 1
// ===========================================

// User -> Consents
User.hasMany(Consent, { foreignKey: 'userId', as: 'consents' });
Consent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> BankAccounts
User.hasMany(BankAccount, { foreignKey: 'userId', as: 'bankAccounts' });
BankAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Consent -> BankAccounts
Consent.hasMany(BankAccount, { foreignKey: 'consentId', as: 'bankAccounts' });
BankAccount.belongsTo(Consent, { foreignKey: 'consentId', as: 'consent' });

// User -> CreditCards
User.hasMany(CreditCard, { foreignKey: 'userId', as: 'creditCards' });
CreditCard.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Consent -> CreditCards
Consent.hasMany(CreditCard, { foreignKey: 'consentId', as: 'creditCards' });
CreditCard.belongsTo(Consent, { foreignKey: 'consentId', as: 'consent' });

// User -> OpenFinanceTransactions
User.hasMany(OpenFinanceTransaction, { foreignKey: 'userId', as: 'openFinanceTransactions' });
OpenFinanceTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Consent -> OpenFinanceTransactions
Consent.hasMany(OpenFinanceTransaction, { foreignKey: 'consentId', as: 'transactions' });
OpenFinanceTransaction.belongsTo(Consent, { foreignKey: 'consentId', as: 'consent' });

// CreditCard -> OpenFinanceTransactions
CreditCard.hasMany(OpenFinanceTransaction, { foreignKey: 'relatedCardId', as: 'openFinanceTransactions' });
OpenFinanceTransaction.belongsTo(CreditCard, { foreignKey: 'relatedCardId', as: 'creditCard' });

// BankAccount -> OpenFinanceTransactions
BankAccount.hasMany(OpenFinanceTransaction, { foreignKey: 'relatedAccountId', as: 'transactions' });
OpenFinanceTransaction.belongsTo(BankAccount, { foreignKey: 'relatedAccountId', as: 'bankAccount' });

// User -> ManualTransactions
User.hasMany(ManualTransaction, { foreignKey: 'userId', as: 'manualTransactions' });
ManualTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> TransactionMetadata
User.hasMany(TransactionMetadata, { foreignKey: 'userId', as: 'transactionMetadata' });
TransactionMetadata.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> Investments
User.hasMany(Investment, { foreignKey: 'userId', as: 'investments' });
Investment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Asset -> Investments
Asset.hasMany(Investment, { foreignKey: 'assetId', as: 'investments' });
Investment.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

// User -> Budgets
User.hasMany(Budget, { foreignKey: 'userId', as: 'budgets' });
Budget.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> Goals
User.hasMany(Goal, { foreignKey: 'userId', as: 'goals' });
Goal.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Goal -> GoalHistory
Goal.hasMany(GoalHistory, { foreignKey: 'goalId', as: 'history' });
GoalHistory.belongsTo(Goal, { foreignKey: 'goalId', as: 'goal' });

// User -> GoalHistory
User.hasMany(GoalHistory, { foreignKey: 'userId', as: 'goalHistory' });
GoalHistory.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> AuditLogs
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ===========================================
// ASSOCIAÇÕES - Fase 2 (Expansão)
// ===========================================

// User -> CardTransactions
User.hasMany(CardTransaction, { foreignKey: 'userId', as: 'cardTransactions' });
CardTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// CreditCard -> CardTransactions
CreditCard.hasMany(CardTransaction, { foreignKey: 'cardId', as: 'cardTransactions' });
CardTransaction.belongsTo(CreditCard, { foreignKey: 'cardId', as: 'card' });

// User -> Subscriptions
User.hasMany(Subscription, { foreignKey: 'userId', as: 'subscriptions' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// CreditCard -> Subscriptions
CreditCard.hasMany(Subscription, { foreignKey: 'cardId', as: 'subscriptions' });
Subscription.belongsTo(CreditCard, { foreignKey: 'cardId', as: 'card' });

// Subscription -> CardTransactions
Subscription.hasMany(CardTransaction, { foreignKey: 'subscriptionId', as: 'transactions' });
CardTransaction.belongsTo(Subscription, { foreignKey: 'subscriptionId', as: 'subscription' });

// Subscription -> ManualTransactions
Subscription.hasMany(ManualTransaction, { foreignKey: 'subscriptionId', as: 'manualTransactions' });
ManualTransaction.belongsTo(Subscription, { foreignKey: 'subscriptionId', as: 'subscription' });

// User -> Dividends
User.hasMany(Dividend, { foreignKey: 'userId', as: 'dividends' });
Dividend.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Asset -> Dividends
Asset.hasMany(Dividend, { foreignKey: 'assetId', as: 'dividends' });
Dividend.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

// User -> InvestmentSnapshots
User.hasMany(InvestmentSnapshot, { foreignKey: 'userId', as: 'investmentSnapshots' });
InvestmentSnapshot.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> FinancialProducts
User.hasMany(FinancialProduct, { foreignKey: 'userId', as: 'financialProducts' });
FinancialProduct.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> Messages
User.hasMany(Message, { foreignKey: 'userId', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ===========================================
// ASSOCIAÇÕES - Fase 3 (Gamificação)
// ===========================================

// User -> UserProfile
User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile' });
UserProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> UserMedals
User.hasMany(UserMedal, { foreignKey: 'userId', as: 'userMedals' });
UserMedal.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Medal -> UserMedals
Medal.hasMany(UserMedal, { foreignKey: 'medalId', as: 'userMedals' });
UserMedal.belongsTo(Medal, { foreignKey: 'medalId', as: 'medal' });

// ===========================================
// ASSOCIAÇÕES - Fase 4 (Transações Aprimoradas)
// ===========================================

// User -> Categories
User.hasMany(Category, { foreignKey: 'userId', as: 'categories' });
Category.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> Notifications
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Category -> ManualTransactions
Category.hasMany(ManualTransaction, { foreignKey: 'categoryId', as: 'transactions' });
ManualTransaction.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// ===========================================
// ASSOCIAÇÕES - Fase 5 (Orçamentos Inteligentes)
// ===========================================

// User -> BudgetAllocations
User.hasMany(BudgetAllocation, { foreignKey: 'userId', as: 'budgetAllocations' });
BudgetAllocation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// BudgetAllocation -> Categories (vínculo opcional)
BudgetAllocation.hasMany(Category, { foreignKey: 'budgetAllocationId', as: 'categories' });
Category.belongsTo(BudgetAllocation, { foreignKey: 'budgetAllocationId', as: 'budgetAllocation' });

// BudgetAllocation -> Goals (vínculo opcional)
BudgetAllocation.hasMany(Goal, { foreignKey: 'budgetAllocationId', as: 'goals' });
Goal.belongsTo(BudgetAllocation, { foreignKey: 'budgetAllocationId', as: 'budgetAllocation' });

// ===========================================
// EXPORTAÇÃO
// ===========================================

module.exports = {
    sequelize,
    // Fase 1
    User,
    Consent,
    BankAccount,
    CreditCard,
    OpenFinanceTransaction,
    ManualTransaction,
    TransactionMetadata,
    Asset,
    Investment,
    Budget,
    Goal,
    Message,
    AuditLog,
    // Fase 2
    CardTransaction,
    Subscription,
    Dividend,
    InvestmentSnapshot,
    FinancialProduct,
    // Fase 3 - Gamificação
    UserProfile,
    Medal,
    UserMedal,
    // Fase 4 - Transações Aprimoradas
    Category,
    Notification,
    GoalHistory,
    // Fase 5 - Orçamentos Inteligentes
    BudgetAllocation
};
