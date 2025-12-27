/**
 * Enrichment Service
 * ========================================
 * Enriquece transações com branding automático
 * 
 * Usa o Brand Dictionary para:
 * - Detectar marcas no texto da transação
 * - Adicionar logo oficial
 * - Sugerir categoria padrão
 * ========================================
 */

const { BRAND_LIBRARY } = require('../data/brandDictionary');
const { logger } = require('../config/logger');

/**
 * Normaliza texto para matching
 * - Lowercase
 * - Remove acentos
 * - Remove caracteres especiais
 */
const normalizeText = (text) => {
    if (!text) return '';

    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\w\s*]/g, ' ')       // Remove chars especiais (mantém *)
        .replace(/\s+/g, ' ')            // Normaliza espaços
        .trim();
};

/**
 * Verifica se texto contém keyword
 * Suporta wildcards com *
 */
const matchesKeyword = (normalizedText, keyword) => {
    const normalizedKeyword = normalizeText(keyword);

    // Suporte a wildcard (ex: "uber*" casa com "uber trip")
    if (normalizedKeyword.includes('*')) {
        const pattern = normalizedKeyword.replace(/\*/g, '.*');
        const regex = new RegExp(pattern);
        return regex.test(normalizedText);
    }

    // Match exato ou como palavra (não substring de outra palavra)
    // Ex: "99" deve casar com "99" mas não com "199"
    const wordBoundaryRegex = new RegExp(`(^|\\s|[^a-z0-9])${normalizedKeyword}($|\\s|[^a-z0-9])`);
    return wordBoundaryRegex.test(` ${normalizedText} `);
};

/**
 * Enriquece dados da transação baseado na descrição
 * 
 * IMPORTANT: Retorna brandKey em vez de imageUrl
 * O frontend usa brandKey para buscar a imagem no seu próprio dicionário
 * Isso permite que mudanças no dicionário do frontend afetem TODAS as transações
 * 
 * @param {string} description - Descrição da transação
 * @returns {Object|null} - { brandKey, categoryName, brandName } ou null
 */
const enrichTransactionData = (description) => {
    if (!description || description.length < 2) {
        return null;
    }

    const normalizedDescription = normalizeText(description);

    if (!normalizedDescription) {
        return null;
    }

    // Iterar sobre todas as marcas
    for (const brand of BRAND_LIBRARY) {
        for (const keyword of brand.keywords) {
            if (matchesKeyword(normalizedDescription, keyword)) {
                logger.debug(`🏷️ Brand match: "${description}" → ${brand.name} (key: ${brand.brandKey})`);

                return {
                    brandKey: brand.brandKey, // Usa brandKey definido no dicionário
                    categoryName: brand.category,
                    brandName: brand.name
                };
            }
        }
    }

    // Nenhum match encontrado
    return null;
};

/**
 * Enriquece múltiplas transações em batch
 * 
 * @param {Array} transactions - Array de objetos com { description }
 * @returns {Array} - Array com dados de enriquecimento
 */
const enrichTransactionsBatch = (transactions) => {
    return transactions.map(tx => ({
        ...tx,
        enrichment: enrichTransactionData(tx.description)
    }));
};

/**
 * Busca marca por nome exato
 * 
 * @param {string} brandName - Nome da marca
 * @returns {Object|null} - Dados da marca ou null
 */
const getBrandByName = (brandName) => {
    if (!brandName) return null;

    const normalizedName = normalizeText(brandName);

    return BRAND_LIBRARY.find(brand =>
        normalizeText(brand.name) === normalizedName
    ) || null;
};

/**
 * Lista todas as marcas disponíveis
 * 
 * @returns {Array} - Array com { name, category, icon }
 */
const listAllBrands = () => {
    return BRAND_LIBRARY.map(brand => ({
        name: brand.name,
        category: brand.category,
        icon: brand.icon,
        color: brand.color
    }));
};

/**
 * Lista marcas por categoria
 * 
 * @param {string} category - Nome da categoria
 * @returns {Array} - Marcas da categoria
 */
const getBrandsByCategory = (category) => {
    if (!category) return [];

    const normalizedCategory = normalizeText(category);

    return BRAND_LIBRARY.filter(brand =>
        normalizeText(brand.category) === normalizedCategory
    );
};

module.exports = {
    enrichTransactionData,
    enrichTransactionsBatch,
    getBrandByName,
    listAllBrands,
    getBrandsByCategory,
    normalizeText
};
