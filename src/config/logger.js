/**
 * Configuração do Logger
 * Winston logger com suporte a arquivo e console
 */

const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';
const logFilePath = process.env.LOG_FILE_PATH || './logs/app.log';

// Formato customizado para logs
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }

        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// Configuração dos transports
const transports = [
    // Console (sempre ativo)
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            customFormat
        )
    })
];

// Arquivo (apenas se não for test)
if (process.env.NODE_ENV !== 'test') {
    transports.push(
        new winston.transports.File({
            filename: logFilePath,
            format: customFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: path.join(path.dirname(logFilePath), 'error.log'),
            level: 'error',
            format: customFormat,
            maxsize: 5242880,
            maxFiles: 5
        })
    );
}

// Criar logger
const logger = winston.createLogger({
    level: logLevel,
    transports,
    exitOnError: false
});

module.exports = { logger };
