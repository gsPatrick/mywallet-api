/**
 * Categories Controller
 * CRUD para categorias de transações
 */

const { Category } = require('../../models');
const { Op } = require('sequelize');

// Categorias padrão do sistema
// Categorias padrão do sistema com UUIDs FIXOS para evitar quebra de vínculos após resets
const DEFAULT_CATEGORIES = [
    // Despesas
    { id: '11111111-1111-4111-a111-111111111111', name: 'Alimentação', type: 'EXPENSE', icon: 'FiCoffee', color: '#f97316', order: 1 },
    { id: '22222222-2222-4222-a222-222222222222', name: 'Transporte', type: 'EXPENSE', icon: 'FiTruck', color: '#3b82f6', order: 2 },
    { id: '33333333-3333-4333-a333-333333333333', name: 'Moradia', type: 'EXPENSE', icon: 'FiHome', color: '#8b5cf6', order: 3 },
    { id: '44444444-4444-4444-a444-444444444444', name: 'Saúde', type: 'EXPENSE', icon: 'FiHeart', color: '#ef4444', order: 4 },
    { id: '55555555-5555-4555-a555-555555555555', name: 'Educação', type: 'EXPENSE', icon: 'FiBook', color: '#06b6d4', order: 5 },
    { id: '66666666-6666-4666-a666-666666666666', name: 'Lazer', type: 'EXPENSE', icon: 'FiMusic', color: '#ec4899', order: 6 },
    { id: '77777777-7777-4777-a777-777777777777', name: 'Compras', type: 'EXPENSE', icon: 'FiShoppingCart', color: '#f59e0b', order: 7 },
    { id: '88888888-8888-4888-a888-888888888888', name: 'Assinaturas', type: 'EXPENSE', icon: 'FiRepeat', color: '#6366f1', order: 8 },
    { id: '99999999-9999-4999-a999-999999999999', name: 'Serviços', type: 'EXPENSE', icon: 'FiTool', color: '#14b8a6', order: 9 },
    { id: '00000000-0000-4000-a000-000000000000', name: 'Outros', type: 'EXPENSE', icon: 'FiMoreHorizontal', color: '#64748b', order: 99 },
    // Receitas
    { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', name: 'Salário', type: 'INCOME', icon: 'FiDollarSign', color: '#22c55e', order: 1 },
    { id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', name: 'Freelance', type: 'INCOME', icon: 'FiBriefcase', color: '#10b981', order: 2 },
    { id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc', name: 'Investimentos', type: 'INCOME', icon: 'FiTrendingUp', color: '#059669', order: 3 },
    { id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd', name: 'Vendas', type: 'INCOME', icon: 'FiTag', color: '#34d399', order: 4 },
    { id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee', name: 'Outros', type: 'INCOME', icon: 'FiMoreHorizontal', color: '#64748b', order: 99 },
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
        const { name, type, icon, color, budgetAllocationId } = req.body;

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
            type,
            icon: icon || 'FiFolder',
            color: color || '#6366f1',
            isDefault: false,
            budgetAllocationId: budgetAllocationId || null
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
        const { name, icon, color, budgetAllocationId } = req.body;

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
        if (budgetAllocationId !== undefined) category.budgetAllocationId = budgetAllocationId;

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
