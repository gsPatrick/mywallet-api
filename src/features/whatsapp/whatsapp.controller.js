/**
 * WhatsApp Controller
 * Endpoints para gerenciar conexão WhatsApp
 */

const whatsappService = require('./whatsapp.service');

/**
 * POST /api/whatsapp/connect
 * Inicia conexão e retorna QR Code
 */
const connect = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await whatsappService.initSession(userId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Erro ao conectar WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao iniciar conexão com WhatsApp',
            error: error.message
        });
    }
};

/**
 * GET /api/whatsapp/status
 * Retorna status da conexão
 */
const getStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await whatsappService.getStatus(userId);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Erro ao obter status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status',
            error: error.message
        });
    }
};

/**
 * POST /api/whatsapp/disconnect
 * Desconecta a sessão
 */
const disconnect = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await whatsappService.disconnect(userId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Erro ao desconectar:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao desconectar',
            error: error.message
        });
    }
};

module.exports = {
    connect,
    getStatus,
    disconnect
};
