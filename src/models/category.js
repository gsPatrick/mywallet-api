/**
 * Model Category
 * ========================================
 * CATEGORIAS DE TRANSAÇÕES
 * ========================================
 * 
 * - Categorias personalizadas do usuário
 * - Categorias padrão do sistema
 * - Separadas por tipo (INCOME/EXPENSE)
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Category = sequelize.define('Category', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Null = categoria do sistema, UUID = categoria do usuário
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Nome da categoria
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                notEmpty: { msg: 'Nome da categoria é obrigatório' }
            }
        },
        // Tipo da categoria
        type: {
            type: DataTypes.ENUM('INCOME', 'EXPENSE', 'BOTH'),
            allowNull: false,
            defaultValue: 'EXPENSE'
        },
        // Ícone (nome do ícone react-icons)
        icon: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'FiFolder'
        },
        // Cor da categoria (hex)
        color: {
            type: DataTypes.STRING(7),
            allowNull: false,
            defaultValue: '#6366f1'
        },
        // Categoria padrão do sistema
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // Ordem de exibição
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        tableName: 'categories',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['type'] },
            { fields: ['is_default'] }
        ]
    });

    return Category;
};
