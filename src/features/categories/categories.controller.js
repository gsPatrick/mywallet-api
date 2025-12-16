/**
 * Categories Controller
 * CRUD para categorias de transações
 */

const { Category } = require('../../models');
const { Op } = require('sequelize');

// Categorias padrão do sistema
const DEFAULT_CATEGORIES = [
    // Despesas
    { name: 'Alimentação', type: 'EXPENSE', icon: 'FiCoffee', color: '#f97316', order: 1 },
    { name: 'Transporte', type: 'EXPENSE', icon: 'FiTruck', color: '#3b82f6', order: 2 },
    { name: 'Moradia', type: 'EXPENSE', icon: 'FiHome', color: '#8b5cf6', order: 3 },
    { name: 'Saúde', type: 'EXPENSE', icon: 'FiHeart', color: '#ef4444', order: 4 },
    { name: 'Educação', type: 'EXPENSE', icon: 'FiBook', color: '#06b6d4', order: 5 },
    { name: 'Lazer', type: 'EXPENSE', icon: 'FiMusic', color: '#ec4899', order: 6 },
    { name: 'Compras', type: 'EXPENSE', icon: 'FiShoppingCart', color: '#f59e0b', order: 7 },
    { name: 'Assinaturas', type: 'EXPENSE', icon: 'FiRepeat', color: '#6366f1', order: 8 },
    { name: 'Serviços', type: 'EXPENSE', icon: 'FiTool', color: '#14b8a6', order: 9 },
    { name: 'Outros', type: 'EXPENSE', icon: 'FiMoreHorizontal', color: '#64748b', order: 99 },
    // Receitas
    { name: 'Salário', type: 'INCOME', icon: 'FiDollarSign', color: '#22c55e', order: 1 },
    { name: 'Freelance', type: 'INCOME', icon: 'FiBriefcase', color: '#10b981', order: 2 },
    { name: 'Investimentos', type: 'INCOME', icon: 'FiTrendingUp', color: '#059669', order: 3 },
    { name: 'Vendas', type: 'INCOME', icon: 'FiTag', color: '#34d399', order: 4 },
    { name: 'Outros', type: 'INCOME', icon: 'FiMoreHorizontal', color: '#64748b', order: 99 },
];

/**
 * Seed default categories (run on app start)
 */
const seedDefaultCategories = async () => {
    try {
        for (const cat of DEFAULT_CATEGORIES) {
            await Category.findOrCreate({
                where: {
                    name: cat.name,
                    type: cat.type,
                    userId: null,
                    isDefault: true
                },
                defaults: { ...cat, isDefault: true }
            });
        }
        console.log('✅ Default categories seeded');
    } catch (error) {
        console.error('❌ Error seeding default categories:', error.message);
    }
};

/**
 * GET /categories
 * Lista categorias do usuário + padrões do sistema
 */
const list = async (req, res) => {
    try {
        const { type } = req.query;

        const where = {
            [Op.or]: [
                { userId: null, isDefault: true },
                { userId: req.user.id }
            ]
        };

        if (type && ['INCOME', 'EXPENSE', 'BOTH'].includes(type)) {
            where.type = { [Op.in]: [type, 'BOTH'] };
        }

        const categories = await Category.findAll({
            where,
            order: [['type', 'ASC'], ['order', 'ASC'], ['name', 'ASC']]
        });

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error listing categories:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar categorias'
        });
    }
};

/**
 * POST /categories
 * Cria categoria personalizada do usuário
 */
const create = async (req, res) => {
    try {
        const { name, type, icon, color } = req.body;

        if (!name || !type) {
            return res.status(400).json({
                success: false,
                message: 'Nome e tipo são obrigatórios'
            });
        }

        // Verifica se já existe categoria com esse nome para o usuário
        const existing = await Category.findOne({
            where: {
                userId: req.user.id,
                name: name.trim(),
                type
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Já existe uma categoria com esse nome'
            });
        }

        const category = await Category.create({
            userId: req.user.id,
            name: name.trim(),
            type,
            icon: icon || 'FiFolder',
            color: color || '#6366f1',
            isDefault: false
        });

        res.status(201).json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar categoria'
        });
    }
};

/**
 * PUT /categories/:id
 * Atualiza categoria do usuário (não pode editar padrões)
 */
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon, color } = req.body;

        const category = await Category.findOne({
            where: {
                id,
                userId: req.user.id,
                isDefault: false
            }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada ou não pode ser editada'
            });
        }

        if (name) category.name = name.trim();
        if (icon) category.icon = icon;
        if (color) category.color = color;

        await category.save();

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar categoria'
        });
    }
};

/**
 * DELETE /categories/:id
 * Remove categoria do usuário (não pode remover padrões)
 */
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findOne({
            where: {
                id,
                userId: req.user.id,
                isDefault: false
            }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Categoria não encontrada ou não pode ser removida'
            });
        }

        await category.destroy();

        res.json({
            success: true,
            message: 'Categoria removida com sucesso'
        });
    } catch (error) {
        console.error('Error removing category:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover categoria'
        });
    }
};

module.exports = {
    seedDefaultCategories,
    list,
    create,
    update,
    remove
};
