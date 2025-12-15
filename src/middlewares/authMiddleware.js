/**
 * Middleware de Autenticação JWT
 * Protege rotas que requerem autenticação
 */

const { verifyAccessToken, extractTokenFromHeader } = require('../config/jwt');
const { User } = require('../models');
const { logger } = require('../config/logger');

/**
 * Middleware de autenticação
 * Verifica o token JWT e adiciona o usuário ao request
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Extrair token do header
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            return res.status(401).json({
                error: 'Token de autenticação não fornecido',
                code: 'MISSING_TOKEN'
            });
        }

        // Verificar token
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Token expirado',
                    code: 'TOKEN_EXPIRED'
                });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    error: 'Token inválido',
                    code: 'INVALID_TOKEN'
                });
            }
            throw error;
        }

        // Buscar usuário
        const user = await User.findByPk(decoded.userId);

        if (!user) {
            return res.status(401).json({
                error: 'Usuário não encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        // Adicionar usuário ao request
        req.user = user;
        req.userId = user.id;

        next();
    } catch (error) {
        logger.error('Erro no middleware de autenticação:', error);
        return res.status(500).json({
            error: 'Erro interno de autenticação',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Middleware opcional de autenticação
 * Tenta autenticar, mas não bloqueia se não houver token
 */
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);

        if (token) {
            const decoded = verifyAccessToken(token);
            const user = await User.findByPk(decoded.userId);
            if (user) {
                req.user = user;
                req.userId = user.id;
            }
        }

        next();
    } catch (error) {
        // Ignora erros de autenticação - é opcional
        next();
    }
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware
};
