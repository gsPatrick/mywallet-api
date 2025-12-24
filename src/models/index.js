/**
 * Inicialização dos Models Sequelize
 * Configura todos os models e suas associações
 */

const { sequelize } = require('../config/database');

// Importar models - Fase 1
const User = require('./user')(sequelize);
const Profile = require('./profile')(sequelize); // Multi-Context Profile
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

// Importar models - Fase 6 (Central do DAS)
const DasGuide = require('./dasGuide')(sequelize);

// Importar models - Fase 7 (SaaS - Payment History)
const PaymentHistory = require('./paymentHistory')(sequelize);

// Importar models - Fase 8 (Settings/Config)
const Setting = require('./setting')(sequelize);

// Importar models - Fase 9 (Faturas de Cartão)
const CardInvoice = require('./cardInvoice')(sequelize);
const InvoicePayment = require('./invoicePayment')(sequelize);

// ===========================================
// ASSOCIAÇÕES - Fase 1
// ===========================================

// User -> Consents
User.hasMany(Consent, { foreignKey: 'userId', as: 'consents' });
Consent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ===========================================
// ASSOCIAÇÕES - Multi-Context Profiles
// ===========================================

// User -> Profiles
User.hasMany(Profile, { foreignKey: 'userId', as: 'profiles' });
Profile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Profile -> Financial Data (Profile Isolation)
Profile.hasMany(ManualTransaction, { foreignKey: 'profileId', as: 'manualTransactions' });
ManualTransaction.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(Category, { foreignKey: 'profileId', as: 'categories' });
Category.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(Goal, { foreignKey: 'profileId', as: 'goals' });
Goal.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(Budget, { foreignKey: 'profileId', as: 'budgets' });
Budget.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(CreditCard, { foreignKey: 'profileId', as: 'creditCards' });
CreditCard.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(BankAccount, { foreignKey: 'profileId', as: 'bankAccounts' });
BankAccount.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(Subscription, { foreignKey: 'profileId', as: 'subscriptions' });
Subscription.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(BudgetAllocation, { foreignKey: 'profileId', as: 'budgetAllocations' });
BudgetAllocation.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

Profile.hasMany(Investment, { foreignKey: 'profileId', as: 'investments' });
Investment.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

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

// BankAccount -> ManualTransactions (NEW)
BankAccount.hasMany(ManualTransaction, { foreignKey: 'bankAccountId', as: 'manualTransactions' });
ManualTransaction.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });

// BankAccount -> CreditCards (for invoice payment) (NEW)
BankAccount.hasMany(CreditCard, { foreignKey: 'bankAccountId', as: 'linkedCreditCards' });
CreditCard.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'paymentAccount' });

// ManualTransaction self-reference for INTERNAL_TRANSFER linking (NEW)
ManualTransaction.belongsTo(ManualTransaction, { foreignKey: 'linkedTransferId', as: 'linkedTransfer' });

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

// BankAccount -> Goals (goals linked to this account for "reserved balance")
BankAccount.hasMany(Goal, { foreignKey: 'bankAccountId', as: 'linkedGoals' });
Goal.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });

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
// ASSOCIAÇÕES - Fase 6 (Central do DAS)
// ===========================================

// Profile -> DasGuides
Profile.hasMany(DasGuide, { foreignKey: 'profileId', as: 'dasGuides' });
DasGuide.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

// BankAccount -> DasGuides
BankAccount.hasMany(DasGuide, { foreignKey: 'bankAccountId', as: 'dasGuides' });
DasGuide.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });

// ManualTransaction -> DasGuide (1:1 optional)
DasGuide.belongsTo(ManualTransaction, { foreignKey: 'transactionId', as: 'transaction' });

// ===========================================
// ASSOCIAÇÕES - Fase 9 (Faturas de Cartão)
// ===========================================

// User -> CardInvoices
User.hasMany(CardInvoice, { foreignKey: 'userId', as: 'cardInvoices' });
CardInvoice.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// CreditCard -> CardInvoices
CreditCard.hasMany(CardInvoice, { foreignKey: 'cardId', as: 'invoices' });
CardInvoice.belongsTo(CreditCard, { foreignKey: 'cardId', as: 'card' });

// Profile -> CardInvoices
Profile.hasMany(CardInvoice, { foreignKey: 'profileId', as: 'cardInvoices' });
CardInvoice.belongsTo(Profile, { foreignKey: 'profileId', as: 'profile' });

// CardInvoice -> InvoicePayments
CardInvoice.hasMany(InvoicePayment, { foreignKey: 'invoiceId', as: 'payments' });
InvoicePayment.belongsTo(CardInvoice, { foreignKey: 'invoiceId', as: 'invoice' });

// User -> InvoicePayments
User.hasMany(InvoicePayment, { foreignKey: 'userId', as: 'invoicePayments' });
InvoicePayment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// BankAccount -> InvoicePayments (conta usada para pagar)
BankAccount.hasMany(InvoicePayment, { foreignKey: 'bankAccountId', as: 'invoicePayments' });
InvoicePayment.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });

// ===========================================
// EXPORTAÇÃO
// ===========================================

module.exports = {
    sequelize,
    // Fase 1
    User,
    Profile,  // Multi-Context Profile
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
    BudgetAllocation,
    // Fase 6 - Central do DAS
    DasGuide,
    // Fase 7 - SaaS
    PaymentHistory,
    // Fase 8 - Settings
    Setting,
    // Fase 9 - Faturas de Cartão
    CardInvoice,
    InvoicePayment
};
