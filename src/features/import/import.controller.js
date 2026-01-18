const importService = require('./import.service');

/**
 * Import Controller
 * =================
 */

/**
 * POST /import/ofx/preview
 * Recebe o texto do OFX e retorna os dados analisados para visualização antes de salvar
 */
const previewOFX = async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Conteúdo do arquivo não fornecido' });
        }

        const data = importService.parseFile(content);

        // Format transactions for frontend
        const preview = {
            bankName: data.bank.org || 'Banco Desconhecido',
            accountType: data.account.type || 'Tipo de Conta Desconhecido',
            accountNumber: data.account.number || 'Número de Conta Desconhecido',
            currency: data.currency || 'BRL',
            transactions: data.transactions.map(t => ({
                date: t.date,
                type: t.type,
                amount: t.amount,
                description: t.description,
                fitid: t.fitid
            }))
        };

        res.json({
            success: true,
            data: preview
        });

    } catch (error) {
        console.error('Erro no preview OFX:', error);
        res.status(400).json({ error: error.message });
    }
};

/**
 * POST /import/ofx/confirm
 * Confirma a importação dos dados para o usuário
 */
const confirmImport = async (req, res) => {
    try {
        const { data, type } = req.body; // Dados já estruturados do preview + type
        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        const result = await importService.processImport(userId, data, { profileId, type });

        res.json(result);

    } catch (error) {
        console.error('Erro na confirmação da importação:', error);
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    previewOFX,
    confirmImport
};
