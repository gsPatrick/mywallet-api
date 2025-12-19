/**
 * Model Subscription
 * Assinaturas e recorrências financeiras
 * ========================================
 * 
 * Gerencia:
 * - Streaming (Netflix, Spotify, etc.)
 * - Software (Adobe, Office, etc.)
 * - Serviços (Academia, Plano de Saúde, etc.)
 * - Qualquer gasto recorrente
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Subscription = sequelize.define('Subscription', {
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
        // Perfil ao qual a assinatura pertence (isolamento multi-contexto)
        profileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            }
        },
        // Cartão associado (opcional)
        cardId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'credit_cards',
                key: 'id'
            }
        },
        // Nome da assinatura
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // Descrição
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Valor
        amount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false
        },
        // Moeda
        currency: {
            type: DataTypes.STRING(3),
            allowNull: false,
            defaultValue: 'BRL'
        },
        // Frequência de cobrança
        frequency: {
            type: DataTypes.ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'),
            allowNull: false,
            defaultValue: 'MONTHLY'
        },
        // Categoria
        category: {
            type: DataTypes.ENUM(
                'STREAMING',
                'SOFTWARE',
                'GAMING',
                'EDUCATION',
                'HEALTH',
                'FITNESS',
                'NEWS',
                'STORAGE',
                'MUSIC',
                'UTILITIES',
                'INSURANCE',
                'OTHER'
            ),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        // Categoria dinâmica (vinculada a Category model)
        categoryId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'categories',
                key: 'id'
            }
        },
        // Data de início
        startDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Próxima cobrança
        nextBillingDate: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        // Data de término (se não for indefinida)
        endDate: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        // Status
        status: {
            type: DataTypes.ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'),
            allowNull: false,
            defaultValue: 'ACTIVE'
        },
        // Gerar lançamento automaticamente?
        autoGenerate: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        // Dias de antecedência para alerta
        alertDaysBefore: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 3
        },
        // URL do serviço (opcional)
        serviceUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Logo/Ícone (URL ou nome)
        icon: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Cor para UI
        color: {
            type: DataTypes.STRING(7),
            allowNull: true,
            defaultValue: '#6366F1'
        },
        // Observações
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'subscriptions',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['card_id'] },
            { fields: ['status'] },
            { fields: ['next_billing_date'] },
            { fields: ['category'] }
        ]
    });

    // Métodos de instância

    /**
     * Calcula o custo anual da assinatura
     */
    Subscription.prototype.getAnnualCost = function () {
        const amount = parseFloat(this.amount);
        const multipliers = {
            'WEEKLY': 52,
            'MONTHLY': 12,
            'QUARTERLY': 4,
            'SEMI_ANNUAL': 2,
            'YEARLY': 1
        };
        return amount * (multipliers[this.frequency] || 12);
    };

    /**
     * Calcula o custo mensal equivalente
     */
    Subscription.prototype.getMonthlyCost = function () {
        return this.getAnnualCost() / 12;
    };

    /**
     * Calcula próxima data de cobrança
     */
    Subscription.prototype.calculateNextBillingDate = function () {
        const current = new Date(this.nextBillingDate);
        const increments = {
            'WEEKLY': 7,
            'MONTHLY': 30,
            'QUARTERLY': 90,
            'SEMI_ANNUAL': 180,
            'YEARLY': 365
        };

        current.setDate(current.getDate() + (increments[this.frequency] || 30));
        return current.toISOString().split('T')[0];
    };

    return Subscription;
};
