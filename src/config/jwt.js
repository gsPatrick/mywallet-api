/**
 * Configuração JWT - Autenticação
 * Geração e validação de tokens JWT
 */

const jwt = require('jsonwebtoken');

const config = {
    secret: process.env.JWT_SECRET || 'desenvolvimento-inseguro-trocar-em-producao',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-inseguro-trocar-em-producao',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

/**
 * Gera um token de acesso JWT
 * @param {Object} payload - Dados do usuário
 * @returns {string} Token JWT
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, config.secret, {
        expiresIn: config.expiresIn,
        issuer: 'open-finance-api'
    });
};

/**
 * Gera um token de refresh
 * @param {Object} payload - Dados do usuário
 * @returns {string} Refresh Token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, config.refreshSecret, {
        expiresIn: config.refreshExpiresIn,
        issuer: 'open-finance-api'
    });
};

/**
 * Verifica e decodifica um token de acesso
 * @param {string} token - Token JWT
 * @returns {Object} Payload decodificado
 */
const verifyAccessToken = (token) => {
    return jwt.verify(token, config.secret);
};

/**
 * Verifica e decodifica um refresh token
 * @param {string} token - Refresh Token
 * @returns {Object} Payload decodificado
 */
const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.refreshSecret);
};

/**
 * Extrai o token do header Authorization
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} Token ou null
 */
const extractTokenFromHeader = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
};

module.exports = {
    config,
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    extractTokenFromHeader
};
