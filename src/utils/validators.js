/**
 * Utilitários de Validação
 */

/**
 * Valida UUID
 */
const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

/**
 * Valida email
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Valida data no formato YYYY-MM-DD
 */
const isValidDate = (dateString) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};

/**
 * Valida mês (1-12)
 */
const isValidMonth = (month) => {
    const num = parseInt(month);
    return !isNaN(num) && num >= 1 && num <= 12;
};

/**
 * Valida ano (2020-2100)
 */
const isValidYear = (year) => {
    const num = parseInt(year);
    return !isNaN(num) && num >= 2020 && num <= 2100;
};

/**
 * Valida percentual (0-100)
 */
const isValidPercent = (percent) => {
    const num = parseFloat(percent);
    return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Valida valor monetário positivo
 */
const isValidAmount = (amount) => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
};

/**
 * Valida ticker de ativo (ex: PETR4, MXRF11)
 */
const isValidTicker = (ticker) => {
    const tickerRegex = /^[A-Z]{4}[0-9]{1,2}$/;
    return tickerRegex.test(ticker);
};

/**
 * Sanitiza string removendo caracteres perigosos
 */
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/[<>]/g, '') // Remove tags HTML
        .trim();
};

/**
 * Valida campos obrigatórios
 * @param {object} obj - Objeto a validar
 * @param {string[]} fields - Campos obrigatórios
 * @returns {string[]} - Array de campos faltantes
 */
const validateRequired = (obj, fields) => {
    const missing = [];
    for (const field of fields) {
        if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
            missing.push(field);
        }
    }
    return missing;
};

/**
 * Middleware de validação genérica
 */
const validate = (schema) => {
    return (req, res, next) => {
        const errors = [];

        // Validar body
        if (schema.body) {
            for (const [field, rules] of Object.entries(schema.body)) {
                const value = req.body[field];

                if (rules.required && (value === undefined || value === null || value === '')) {
                    errors.push(`${field} é obrigatório`);
                    continue;
                }

                if (value !== undefined && value !== null) {
                    if (rules.type === 'email' && !isValidEmail(value)) {
                        errors.push(`${field} deve ser um email válido`);
                    }
                    if (rules.type === 'uuid' && !isValidUUID(value)) {
                        errors.push(`${field} deve ser um UUID válido`);
                    }
                    if (rules.type === 'date' && !isValidDate(value)) {
                        errors.push(`${field} deve ser uma data válida (YYYY-MM-DD)`);
                    }
                    if (rules.min !== undefined && parseFloat(value) < rules.min) {
                        errors.push(`${field} deve ser maior ou igual a ${rules.min}`);
                    }
                    if (rules.max !== undefined && parseFloat(value) > rules.max) {
                        errors.push(`${field} deve ser menor ou igual a ${rules.max}`);
                    }
                    if (rules.minLength !== undefined && String(value).length < rules.minLength) {
                        errors.push(`${field} deve ter no mínimo ${rules.minLength} caracteres`);
                    }
                    if (rules.enum && !rules.enum.includes(value)) {
                        errors.push(`${field} deve ser um dos valores: ${rules.enum.join(', ')}`);
                    }
                }
            }
        }

        // Validar params
        if (schema.params) {
            for (const [field, rules] of Object.entries(schema.params)) {
                const value = req.params[field];

                if (rules.type === 'uuid' && !isValidUUID(value)) {
                    errors.push(`Parâmetro ${field} deve ser um UUID válido`);
                }
            }
        }

        if (errors.length > 0) {
            return res.status(422).json({
                error: 'Erro de validação',
                code: 'VALIDATION_ERROR',
                details: errors
            });
        }

        next();
    };
};

module.exports = {
    isValidUUID,
    isValidEmail,
    isValidDate,
    isValidMonth,
    isValidYear,
    isValidPercent,
    isValidAmount,
    isValidTicker,
    sanitizeString,
    validateRequired,
    validate
};
