/**
 * Model Goal
 * Metas financeiras do usuário
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Goal = sequelize.define('Goal', {
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
        // Perfil ao qual a meta pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Nome da meta
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Nome da meta é obrigatório' }
            }
        },
        // Descrição
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Meta infinita (Caixinha) - sem valor alvo
        isInfinite: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Vinculação opcional com orçamento mensal
        budgetAllocationId: {
            type: DataTypes.UUID,
            allowNull: true, // Vínculo 100% OPCIONAL!
            references: {
                model: 'budget_allocations',
                key: 'id'
            }
        },
        // Valor alvo (pode ser null se isInfinite = true)
        targetAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true, // Permitir null para metas infinitas
            validate: {
                customValidator(value) {
                    if (!this.isInfinite && (!value || parseFloat(value) <= 0)) {
                        throw new Error('Valor alvo deve ser maior que zero para metas com valor fixo');
                    }
                }
            }
        },
        // Valor atual
        currentAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0
        },
        // Data limite
        deadline: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        // Categoria da meta
        category: {
            type: DataTypes.ENUM(
                'EMERGENCY_FUND',
                'TRAVEL',
                'EDUCATION',
                'PROPERTY',
                'VEHICLE',
                'RETIREMENT',
                'SHOPPING',
                'INVESTMENT',
                'OTHER'
            ),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        // Tipo de armazenamento
        storageType: {
            type: DataTypes.ENUM('manual', 'openfinance'),
            allowNull: false,
            defaultValue: 'manual'
        },
        // ID da conta vinculada (se openfinance)
        linkedAccountId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        // Nome do banco manual (se manual)
        manualBank: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Prioridade
        priority: {
            type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'),
            allowNull: false,
            defaultValue: 'MEDIUM'
        },
        // Status
        status: {
            type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'ACTIVE'
        },
        // Cor para exibição (hex)
        color: {
            type: DataTypes.STRING(7),
            allowNull: true,
            defaultValue: '#3B82F6'
        }
    }, {
        tableName: 'goals',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['status'] },
            { fields: ['deadline'] }
        ]
    });

    // Métodos de instância

    /**
     * Calcula o progresso percentual
     */
    Goal.prototype.getProgress = function () {
        const current = parseFloat(this.currentAmount);
        const target = parseFloat(this.targetAmount);
        if (target === 0) return 0;
        return Math.min(100, (current / target) * 100);
    };

    /**
     * Calcula quanto falta para atingir a meta
     */
    Goal.prototype.getRemainingAmount = function () {
        const current = parseFloat(this.currentAmount);
        const target = parseFloat(this.targetAmount);
        return Math.max(0, target - current);
    };

    /**
     * Calcula valor mensal necessário para atingir a meta
     */
    Goal.prototype.getMonthlyRequired = function () {
        if (!this.deadline || this.status !== 'ACTIVE') return null;

        const remaining = this.getRemainingAmount();
        const today = new Date();
        const deadline = new Date(this.deadline);

        const monthsLeft = (deadline.getFullYear() - today.getFullYear()) * 12 +
            (deadline.getMonth() - today.getMonth());

        if (monthsLeft <= 0) return remaining;
        return remaining / monthsLeft;
    };

    return Goal;
};
