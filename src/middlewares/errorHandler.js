/**
 * Middleware Global de Tratamento de Erros
 */

const { logger } = require('../config/logger');

/**
 * Classe de erro customizada para a aplicação
 */
class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Erros comuns pré-definidos
 */
const Errors = {
    badRequest: (message = 'Requisição inválida') =>
        new AppError(message, 400, 'BAD_REQUEST'),

    unauthorized: (message = 'Não autorizado') =>
        new AppError(message, 401, 'UNAUTHORIZED'),

    forbidden: (message = 'Acesso negado') =>
        new AppError(message, 403, 'FORBIDDEN'),

    notFound: (message = 'Recurso não encontrado') =>
        new AppError(message, 404, 'NOT_FOUND'),

    conflict: (message = 'Conflito de dados') =>
        new AppError(message, 409, 'CONFLICT'),

    validation: (message = 'Erro de validação') =>
        new AppError(message, 422, 'VALIDATION_ERROR'),

    internal: (message = 'Erro interno do servidor') =>
        new AppError(message, 500, 'INTERNAL_ERROR')
};

/**
 * Handler de erros do Sequelize
 */
const handleSequelizeError = (error) => {
    // Erro de validação
    if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message).join(', ');
        return new AppError(messages, 422, 'VALIDATION_ERROR');
    }

    // Erro de unique constraint
    if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors[0]?.path || 'campo';
        return new AppError(`${field} já está em uso`, 409, 'DUPLICATE_ERROR');
    }

    // Erro de foreign key
    if (error.name === 'SequelizeForeignKeyConstraintError') {
        return new AppError('Referência inválida', 400, 'FOREIGN_KEY_ERROR');
    }

    // Erro de conexão
    if (error.name === 'SequelizeConnectionError') {
        return new AppError('Erro de conexão com banco de dados', 503, 'DB_CONNECTION_ERROR');
    }

    return null;
};

/**
 * Middleware de tratamento de erros
 */
const errorHandler = (error, req, res, next) => {
    // Log do erro
    logger.error('Error:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        path: req.path,
        method: req.method,
        userId: req.userId || null
    });

    // Verificar se é erro do Sequelize
    const sequelizeError = handleSequelizeError(error);
    if (sequelizeError) {
        return res.status(sequelizeError.statusCode).json({
            error: sequelizeError.message,
            code: sequelizeError.code
        });
    }

    // Erro operacional (conhecido)
    if (error.isOperational) {
        return res.status(error.statusCode).json({
            error: error.message,
            code: error.code
        });
    }

    // Erro de sintaxe JSON
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            error: 'JSON inválido',
            code: 'INVALID_JSON'
        });
    }

    // Erro desconhecido (500)
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'development'
        ? error.message
        : 'Erro interno do servidor';

    return res.status(statusCode).json({
        error: message,
        code: 'INTERNAL_ERROR'
    });
};

module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.Errors = Errors;
