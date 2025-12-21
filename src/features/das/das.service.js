/**
 * DAS Service
 * ========================================
 * CENTRAL DO DAS - Lógica de Negócio
 * ========================================
 * 
 * Gerenciamento de guias DAS para MEI/ME
 * ✅ PROFILE ISOLATION: Todas as queries filtram por profileId
 * ✅ ACID: Pagamentos usam transações do Sequelize
 */

const { DasGuide, Profile, BankAccount, ManualTransaction, Category, sequelize } = require('../../models');
const bankAccountsService = require('../bankAccounts/bankAccounts.service');
const gamificationService = require('../gamification/gamification.service');
const { Op } = require('sequelize');

// Meses em português
const MONTH_NAMES = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Gera as 12 guias do ano para um perfil BUSINESS
 * @param {string} profileId - ID do perfil
 * @param {number} year - Ano de competência
 */
const generateYearlyGuides = async (profileId, year) => {
    try {
        // Buscar perfil e suas configurações
        const profile = await Profile.findByPk(profileId);

        if (!profile) {
            throw new Error('Perfil não encontrado');
        }

        if (profile.type !== 'BUSINESS') {
            throw new Error('Apenas perfis Business podem ter guias DAS');
        }

        // Ler configurações do perfil (dasValue e dasDueDay)
        const settings = profile.settings || {};
        const dasValue = parseFloat(settings.dasValue) || 0;
        const dasDueDay = parseInt(settings.dasDueDay) || 20; // Default: dia 20

        if (dasValue <= 0) {
            throw new Error('Valor do DAS não configurado no perfil');
        }

        // Verificar se já existem guias para este ano
        const existingCount = await DasGuide.count({
            where: { profileId, year }
        });

        if (existingCount > 0) {
            console.log(`⚠️ Guias DAS já existem para ${year}, pulando geração`);
            return { generated: 0, message: 'Guias já existem para este ano' };
        }

        // Gerar 12 guias (Janeiro a Dezembro)
        const guides = [];
        for (let month = 1; month <= 12; month++) {
            // Calcular data de vencimento (dia configurado do mês SEGUINTE)
            // Ex: Competência Janeiro/2024 vence em 20/02/2024
            let dueMonth = month + 1;
            let dueYear = year;
            if (dueMonth > 12) {
                dueMonth = 1;
                dueYear = year + 1;
            }

            // Ajustar dia para não passar do último dia do mês
            const lastDayOfMonth = new Date(dueYear, dueMonth, 0).getDate();
            const adjustedDay = Math.min(dasDueDay, lastDayOfMonth);

            const dueDate = new Date(dueYear, dueMonth - 1, adjustedDay);

            guides.push({
                profileId,
                month,
                year,
                baseValue: dasValue,
                dueDate,
                status: 'PENDING'
            });
        }

        await DasGuide.bulkCreate(guides);
        console.log(`✅ Geradas ${guides.length} guias DAS para ${year}`);

        return { generated: guides.length, year };
    } catch (error) {
        console.error('Erro ao gerar guias DAS:', error);
        throw error;
    }
};

/**
 * Lista as guias de um ano para um perfil
 * @param {string} profileId - ID do perfil
 * @param {number} year - Ano de competência
 */
const listGuides = async (profileId, year) => {
    try {
        const guides = await DasGuide.findAll({
            where: { profileId, year },
            order: [['month', 'ASC']],
            include: [
                { model: BankAccount, as: 'bankAccount', attributes: ['id', 'bankName', 'nickname', 'color', 'icon'] }
            ]
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calcular status dinâmico (OVERDUE se vencido e não pago)
        const enrichedGuides = guides.map(guide => {
            const g = guide.toJSON();
            g.monthName = MONTH_NAMES[g.month];

            // Status dinâmico
            if (g.status !== 'PAID') {
                const dueDate = new Date(g.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                if (today > dueDate) {
                    g.status = 'OVERDUE';
                }
            }

            return g;
        });

        return enrichedGuides;
    } catch (error) {
        console.error('Erro ao listar guias DAS:', error);
        throw error;
    }
};

/**
 * Paga uma guia DAS
 * @param {string} userId - ID do usuário (para gamificação)
 * @param {string} profileId - ID do perfil
 * @param {string} guideId - ID da guia
 * @param {object} paymentData - Dados do pagamento
 */
const payDas = async (userId, profileId, guideId, paymentData) => {
    const t = await sequelize.transaction();

    try {
        const { bankAccountId, finalAmount, paymentDate } = paymentData;

        // Buscar a guia
        const guide = await DasGuide.findOne({
            where: { id: guideId, profileId },
            transaction: t
        });

        if (!guide) {
            throw new Error('Guia DAS não encontrada');
        }

        if (guide.status === 'PAID') {
            throw new Error('Esta guia já foi paga');
        }

        // Verificar conta bancária
        const bankAccount = await BankAccount.findOne({
            where: { id: bankAccountId, profileId },
            transaction: t
        });

        if (!bankAccount) {
            throw new Error('Conta bancária não encontrada');
        }

        // Buscar ou criar categoria "Impostos"
        let category = await Category.findOne({
            where: {
                profileId,
                name: { [Op.iLike]: '%imposto%' }
            },
            transaction: t
        });

        if (!category) {
            category = await Category.create({
                userId,
                profileId,
                name: 'Impostos',
                type: 'EXPENSE',
                color: '#ef4444',
                icon: 'receipt'
            }, { transaction: t });
        }

        // Criar transação de despesa
        const description = `Pagamento DAS ${MONTH_NAMES[guide.month]}/${guide.year}`;
        const transaction = await ManualTransaction.create({
            userId,
            profileId,
            type: 'EXPENSE',
            description,
            amount: parseFloat(finalAmount),
            date: paymentDate || new Date(),
            status: 'COMPLETED',
            categoryId: category.id,
            bankAccountId,
            source: 'DAS'
        }, { transaction: t });

        // Subtrair valor da conta bancária
        await bankAccountsService.updateBalance(bankAccountId, -parseFloat(finalAmount), t);

        // Atualizar guia
        guide.status = 'PAID';
        guide.finalPaidValue = finalAmount;
        guide.paidAt = new Date();
        guide.bankAccountId = bankAccountId;
        guide.transactionId = transaction.id;
        await guide.save({ transaction: t });

        await t.commit();

        // Registrar gamificação (fora da transação)
        try {
            await gamificationService.registerActivity(userId, 'DAS_PAID', {
                guideId: guide.id,
                month: guide.month,
                year: guide.year,
                amount: finalAmount
            });
        } catch (gamError) {
            console.warn('Erro ao registrar gamificação DAS:', gamError.message);
        }

        console.log(`✅ DAS ${MONTH_NAMES[guide.month]}/${guide.year} pago com sucesso`);

        return {
            success: true,
            guide: guide.toJSON(),
            transaction: transaction.toJSON()
        };
    } catch (error) {
        await t.rollback();
        console.error('Erro ao pagar DAS:', error);
        throw error;
    }
};

/**
 * Obtém resumo do DAS para o dashboard
 * @param {string} profileId - ID do perfil
 */
const getDasSummary = async (profileId) => {
    try {
        const currentYear = new Date().getFullYear();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Buscar guias do ano atual
        const guides = await DasGuide.findAll({
            where: { profileId, year: currentYear },
            order: [['month', 'ASC']]
        });

        if (guides.length === 0) {
            return null; // Sem guias configuradas
        }

        // Calcular totais
        let totalPaid = 0;
        let pendingCount = 0;
        let overdueCount = 0;
        let nextDue = null;

        for (const guide of guides) {
            if (guide.status === 'PAID') {
                totalPaid += parseFloat(guide.finalPaidValue || guide.baseValue);
            } else {
                const dueDate = new Date(guide.dueDate);
                dueDate.setHours(0, 0, 0, 0);

                if (today > dueDate) {
                    overdueCount++;
                } else {
                    pendingCount++;
                    // Próximo vencimento
                    if (!nextDue || dueDate < new Date(nextDue.dueDate)) {
                        nextDue = {
                            month: guide.month,
                            monthName: MONTH_NAMES[guide.month],
                            dueDate: guide.dueDate,
                            value: guide.baseValue
                        };
                    }
                }
            }
        }

        return {
            year: currentYear,
            totalPaid,
            paidCount: guides.filter(g => g.status === 'PAID').length,
            pendingCount,
            overdueCount,
            nextDue
        };
    } catch (error) {
        console.error('Erro ao buscar resumo DAS:', error);
        throw error;
    }
};

/**
 * Verifica se deve gerar guias para o ano atual
 * Chamado automaticamente no login de perfis BUSINESS
 */
const ensureCurrentYearGuides = async (profileId) => {
    try {
        const currentYear = new Date().getFullYear();
        const existingCount = await DasGuide.count({
            where: { profileId, year: currentYear }
        });

        if (existingCount === 0) {
            await generateYearlyGuides(profileId, currentYear);
        }

        return { ensured: true };
    } catch (error) {
        console.warn('Erro ao garantir guias DAS:', error.message);
        return { ensured: false, error: error.message };
    }
};

module.exports = {
    generateYearlyGuides,
    listGuides,
    payDas,
    getDasSummary,
    ensureCurrentYearGuides
};
