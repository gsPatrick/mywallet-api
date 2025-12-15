/**
 * Open Finance HTTP Client
 * Cliente com suporte a mTLS para APIs Open Finance Brasil
 */

const axios = require('axios');
const { createMtlsAgent, hasCertificates } = require('../../config/openFinance');
const { logger } = require('../../config/logger');

/**
 * Cria instância do axios com configuração mTLS
 */
const createOpenFinanceClient = (baseURL, accessToken = null) => {
    const config = {
        baseURL,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    // Adicionar token se disponível
    if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Adicionar agent mTLS se certificados disponíveis
    if (hasCertificates()) {
        config.httpsAgent = createMtlsAgent();
    }

    const client = axios.create(config);

    // Interceptor de request para logging
    client.interceptors.request.use(
        (request) => {
            logger.debug('Open Finance Request:', {
                method: request.method,
                url: request.url,
                baseURL: request.baseURL
            });
            return request;
        },
        (error) => {
            logger.error('Open Finance Request Error:', error);
            return Promise.reject(error);
        }
    );

    // Interceptor de response para logging e tratamento de erros
    client.interceptors.response.use(
        (response) => {
            logger.debug('Open Finance Response:', {
                status: response.status,
                url: response.config.url
            });
            return response;
        },
        (error) => {
            if (error.response) {
                logger.error('Open Finance Response Error:', {
                    status: error.response.status,
                    data: error.response.data,
                    url: error.config?.url
                });
            } else if (error.request) {
                logger.error('Open Finance No Response:', {
                    url: error.config?.url,
                    message: error.message
                });
            } else {
                logger.error('Open Finance Error:', error.message);
            }
            return Promise.reject(error);
        }
    );

    return client;
};

/**
 * Headers obrigatórios para API Open Finance
 */
const getOpenFinanceHeaders = (accessToken, options = {}) => {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'x-fapi-interaction-id': generateInteractionId(),
        'x-fapi-auth-date': new Date().toISOString()
    };

    if (options.customerIpAddress) {
        headers['x-fapi-customer-ip-address'] = options.customerIpAddress;
    }

    return headers;
};

/**
 * Gera um interaction ID único para rastreamento
 */
const generateInteractionId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Faz requisição às APIs Open Finance com retry
 */
const makeOpenFinanceRequest = async (client, method, url, data = null, options = {}) => {
    const maxRetries = options.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const config = {
                method,
                url,
                ...options
            };

            if (data) {
                config.data = data;
            }

            const response = await client(config);
            return response.data;

        } catch (error) {
            lastError = error;

            // Não tentar novamente em erros 4xx (exceto 429)
            if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
                throw error;
            }

            // Aguardar antes de tentar novamente
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                logger.warn(`Open Finance retry ${attempt}/${maxRetries} após ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
};

module.exports = {
    createOpenFinanceClient,
    getOpenFinanceHeaders,
    generateInteractionId,
    makeOpenFinanceRequest
};
