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

        // Return full data structure to ensure compatibility with processImport
        const preview = data;

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
        let { data, type, dryRun } = req.body;

        // Handle API Wrapping (req.body.data contains type/dryRun)
        if (data && !type && data.type) {
            type = data.type;
        }
        if (data && !dryRun && data.dryRun) {
            dryRun = data.dryRun;
        }

        // Handle Double Wrapping (data.data) - Robustness Fix
        if (data && data.data && (data.data.bank || data.data.bankName)) {
            console.log('⚠️ [IMPORT] Detected double-wrapped data. Unwrapping...');
            data = data.data;
        }

        // Backward Compatibility for Flat Payload (Legacy Frontend)
        if (!data && (req.body.bankName || req.body.bank || req.body.transactions)) {
            data = req.body;
            console.log('⚠️ [IMPORT] Using flat body as data (Legacy Frontend detected)');
        }

        const userId = req.user.id;
        const profileId = req.headers['x-profile-id'];

        const result = await importService.processImport(userId, data, { profileId, type, dryRun });

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
