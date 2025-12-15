/**
 * Utilitários de Criptografia
 * Para dados sensíveis
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Obtém a chave de criptografia
 */
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
        throw new Error('ENCRYPTION_KEY deve ter no mínimo 32 caracteres');
    }
    return crypto.createHash('sha256').update(key).digest();
};

/**
 * Criptografa um texto
 * @param {string} text - Texto a criptografar
 * @returns {string} - Texto criptografado em base64
 */
const encrypt = (text) => {
    if (!text) return null;

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        // Formato: iv:tag:encrypted
        return Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]).toString('base64');
    } catch (error) {
        throw new Error('Erro ao criptografar dados');
    }
};

/**
 * Descriptografa um texto
 * @param {string} encryptedText - Texto criptografado em base64
 * @returns {string} - Texto original
 */
const decrypt = (encryptedText) => {
    if (!encryptedText) return null;

    try {
        const key = getEncryptionKey();
        const buffer = Buffer.from(encryptedText, 'base64');

        const iv = buffer.slice(0, IV_LENGTH);
        const tag = buffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = buffer.slice(IV_LENGTH + TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        throw new Error('Erro ao descriptografar dados');
    }
};

/**
 * Gera um hash SHA256
 * @param {string} text - Texto a hashear
 * @returns {string} - Hash em hexadecimal
 */
const hash = (text) => {
    return crypto.createHash('sha256').update(text).digest('hex');
};

/**
 * Gera um token aleatório
 * @param {number} length - Tamanho em bytes
 * @returns {string} - Token em hexadecimal
 */
const generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Mascara dados sensíveis
 * @param {string} text - Texto a mascarar
 * @param {number} visibleStart - Caracteres visíveis no início
 * @param {number} visibleEnd - Caracteres visíveis no final
 * @returns {string} - Texto mascarado
 */
const mask = (text, visibleStart = 3, visibleEnd = 3) => {
    if (!text || text.length <= visibleStart + visibleEnd) {
        return text;
    }

    const start = text.substring(0, visibleStart);
    const end = text.substring(text.length - visibleEnd);
    const middle = '*'.repeat(text.length - visibleStart - visibleEnd);

    return start + middle + end;
};

/**
 * Mascara CPF
 * @param {string} cpf - CPF a mascarar
 * @returns {string} - CPF mascarado (ex: 123.***.***-12)
 */
const maskCPF = (cpf) => {
    if (!cpf) return cpf;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return `${clean.substring(0, 3)}.***.***-${clean.substring(9)}`;
};

/**
 * Mascara número de cartão
 * @param {string} cardNumber - Número do cartão
 * @returns {string} - Cartão mascarado (ex: **** **** **** 1234)
 */
const maskCard = (cardNumber) => {
    if (!cardNumber) return cardNumber;
    const clean = cardNumber.replace(/\D/g, '');
    if (clean.length < 4) return cardNumber;
    return `**** **** **** ${clean.substring(clean.length - 4)}`;
};

module.exports = {
    encrypt,
    decrypt,
    hash,
    generateToken,
    mask,
    maskCPF,
    maskCard
};
