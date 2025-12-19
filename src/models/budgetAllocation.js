/**
 * Model BudgetAllocation
 * Alocações individuais de orçamento do usuário
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BudgetAllocation = sequelize.define('BudgetAllocation', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Perfil ao qual a alocação pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Nome da alocação (ex: "Gastos Essenciais", "Investimentos")
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Nome da alocação é obrigatório' }
            }
        },
        // Porcentagem da renda alocada (ex: 50.00)
        percentage: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 100
            }
        },
        // Valor em R$ calculado baseado na renda
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Cor hex para exibição
        color: {
            type: DataTypes.STRING(7),
            allowNull: false,
            defaultValue: '#3b82f6'
        },
        // Ícone (nome do react-icon)
        icon: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'dollar'
        },
        // Mês (1-12)
        month: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            }
        },
        // Ano
        year: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 2020,
                max: 2100
            }
        }
    }, {
        tableName: 'budget_allocations',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['user_id', 'month', 'year'] },
            { fields: ['month', 'year'] }
        ]
    });

    /**
     * Calcula o valor gasto vinculado a esta alocação
     * @param {Object} models - Models do Sequelize
     * @returns {Promise<number>} Valor gasto
     */
    BudgetAllocation.prototype.getSpent = async function (models) {
        const { ManualTransaction, CardTransaction, Category, Goal, GoalHistory } = models;
        const { Op } = require('sequelize');

        const startDate = `${this.year}-${String(this.month).padStart(2, '0')}-01`;
        const endDate = new Date(this.year, this.month, 0).toISOString().split('T')[0];

        // Buscar categorias vinculadas a esta alocação
        const linkedCategories = await Category.findAll({
            where: { budgetAllocationId: this.id },
            attributes: ['id', 'name']
        });

        const categoryIds = linkedCategories.map(c => c.id);
        const categoryNames = linkedCategories.map(c => c.name);

        // Soma de gastos manuais por categoryId
        const manualSpent = await ManualTransaction.sum('amount', {
            where: {
                userId: this.userId,
                type: 'EXPENSE',
                date: { [Op.between]: [startDate, endDate] },
                categoryId: { [Op.in]: categoryIds }
            }
        });

        // Soma de gastos de cartão por category (nome)
        const cardSpent = await CardTransaction.sum('amount', {
            where: {
                userId: this.userId,
                date: { [Op.between]: [startDate, endDate] },
                category: { [Op.in]: categoryNames }
            }
        });

        // Buscar metas vinculadas e somar aportes
        const linkedGoals = await Goal.findAll({
            where: { budgetAllocationId: this.id },
            attributes: ['id']
        });

        // Calcular soma de aportes (DEPOSIT) nas metas
        let goalSpent = 0;
        if (linkedGoals.length > 0) {
            goalSpent = await GoalHistory.sum('amount', {
                where: {
                    goalId: { [Op.in]: linkedGoals.map(g => g.id) },
                    date: { [Op.between]: [startDate, endDate] },
                    type: 'DEPOSIT'
                }
            });
        }

        return (parseFloat(manualSpent) || 0) + (parseFloat(cardSpent) || 0) + (parseFloat(goalSpent) || 0);
    };

    return BudgetAllocation;
};
