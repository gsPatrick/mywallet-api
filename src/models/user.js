/**
 * Model User
 * ========================================
 * A CONTA (O JOGADOR)
 * ========================================
 * 
 * - Login, Dados Pessoais
 * - Gamificação é gerenciada no UserProfile
 * - Dados financeiros ficam no Profile
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Nome é obrigatório' },
                len: {
                    args: [2, 255],
                    msg: 'Nome deve ter entre 2 e 255 caracteres'
                }
            }
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: {
                msg: 'Este email já está em uso'
            },
            validate: {
                isEmail: { msg: 'Email inválido' },
                notEmpty: { msg: 'Email é obrigatório' }
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Senha é obrigatória' },
                len: {
                    args: [6, 255],
                    msg: 'Senha deve ter no mínimo 6 caracteres'
                }
            }
        },
        // CPF do usuário
        cpf: {
            type: DataTypes.STRING(14),
            allowNull: true,
            comment: 'CPF formatado: 000.000.000-00'
        },
        // Telefone do usuário
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: 'Telefone: (00) 00000-0000'
        },
        // Avatar URL
        avatar: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // ========================================
        // SUBSCRIPTION FIELDS (SaaS)
        // ========================================
        plan: {
            type: DataTypes.ENUM('FREE', 'MONTHLY', 'ANNUAL', 'LIFETIME', 'OWNER'),
            allowNull: false,
            defaultValue: 'FREE',
            comment: 'Plano do usuário'
        },
        subscriptionStatus: {
            type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'INACTIVE',
            comment: 'Status da assinatura no Mercado Pago'
        },
        subscriptionId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'ID da assinatura no Mercado Pago'
        },
        subscriptionExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Data de expiração da assinatura'
        },
        // ========================================
        // END SUBSCRIPTION FIELDS
        // ========================================
        // Onboarding
        onboardingComplete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        onboardingStep: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        // WhatsApp Bot - ID do grupo vinculado
        whatsappGroupId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // WhatsApp Bot - Perfil ativo para transações
        whatsappActiveProfileId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'profiles',
                key: 'id'
            },
            comment: 'Active profile focus for WhatsApp bot transactions'
        }
    }, {
        tableName: 'users',
        timestamps: true,
        hooks: {
            // Hash da senha antes de salvar
            beforeCreate: async (user) => {
                if (user.password) {
                    const salt = await bcrypt.genSalt(12);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    const salt = await bcrypt.genSalt(12);
                    user.password = await bcrypt.hash(user.password, salt);
                }
            }
        }
    });

    // Método para verificar senha
    User.prototype.checkPassword = async function (password) {
        return bcrypt.compare(password, this.password);
    };

    // Método para retornar dados seguros (sem senha)
    User.prototype.toSafeObject = function () {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            cpf: this.cpf,
            phone: this.phone,
            avatar: this.avatar,
            // Subscription fields
            plan: this.plan,
            subscriptionStatus: this.subscriptionStatus,
            subscriptionId: this.subscriptionId,
            subscriptionExpiresAt: this.subscriptionExpiresAt,
            // Onboarding
            onboardingComplete: this.onboardingComplete,
            onboardingStep: this.onboardingStep,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };

    return User;
};
