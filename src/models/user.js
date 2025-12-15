/**
 * Model User
 * Representa um usuário do sistema
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
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    };

    return User;
};
