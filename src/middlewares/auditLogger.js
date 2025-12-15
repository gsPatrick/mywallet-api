/**
 * Middleware de Auditoria LGPD
 * Registra operações sensíveis para conformidade
 */

const { AuditLog } = require('../models');
const { logger } = require('../config/logger');

/**
 * Extrai o IP real do cliente (considerando proxies)
 */
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || null;
};

/**
 * Middleware de auditoria automática
 * Registra operações em rotas sensíveis
 */
const auditLogger = (resource) => {
    return async (req, res, next) => {
        // Salvar referência ao método original res.json
        const originalJson = res.json.bind(res);

        // Capturar o início da requisição
        const startTime = Date.now();

        // Interceptar res.json para capturar a resposta
        res.json = async (data) => {
            // Apenas logar se a operação foi bem sucedida
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const action = getActionFromMethod(req.method);

                if (action && process.env.AUDIT_LOG_ENABLED !== 'false') {
                    try {
                        await AuditLog.log({
                            userId: req.userId || null,
                            action: action,
                            resource: resource,
                            resourceId: req.params.id || data?.id || null,
                            details: {
                                method: req.method,
                                path: req.path,
                                query: req.query,
                                duration: Date.now() - startTime
                            },
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent']
                        });
                    } catch (error) {
                        // Não bloquear a resposta por erro de auditoria
                        logger.error('Erro ao registrar auditoria:', error);
                    }
                }
            }

            return originalJson(data);
        };

        next();
    };
};

/**
 * Mapeia método HTTP para ação de auditoria
 */
const getActionFromMethod = (method) => {
    const mapping = {
        'POST': '_CREATE',
        'PUT': '_UPDATE',
        'PATCH': '_UPDATE',
        'DELETE': '_DELETE'
    };
    return mapping[method] || null;
};

/**
 * Função para log manual de auditoria
 * Usar para ações específicas como login, logout, etc.
 */
const logAudit = async (params) => {
    try {
        if (process.env.AUDIT_LOG_ENABLED === 'false') {
            return null;
        }

        return await AuditLog.log(params);
    } catch (error) {
        logger.error('Erro ao registrar auditoria:', error);
        return null;
    }
};

/**
 * Middleware específico para Open Finance
 * Logs mais detalhados para operações com dados bancários
 */
const openFinanceAudit = async (req, res, next) => {
    // Para Open Finance, sempre logar a tentativa
    const startTime = Date.now();

    res.on('finish', async () => {
        try {
            if (process.env.AUDIT_LOG_ENABLED === 'false') return;

            const success = res.statusCode >= 200 && res.statusCode < 300;

            await AuditLog.log({
                userId: req.userId || null,
                action: success ? AuditLog.ACTIONS?.DATA_IMPORT : 'DATA_IMPORT_FAILED',
                resource: 'OPEN_FINANCE',
                details: {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration: Date.now() - startTime,
                    success
                },
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent']
            });
        } catch (error) {
            logger.error('Erro ao registrar auditoria Open Finance:', error);
        }
    });

    next();
};

module.exports = {
    auditLogger,
    logAudit,
    openFinanceAudit,
    getClientIp
};
