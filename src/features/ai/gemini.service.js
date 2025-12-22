/**
 * Gemini AI Service
 * ========================================
 * WHATSAPP BOT INTELLIGENCE ENGINE
 * ========================================
 * 
 * Features:
 * - API Key Rotation for high availability
 * - Auto-recovery on 429 errors
 * - Multimodal support (text + audio)
 * - Structured JSON output
 * - Intent detection (TRANSACTION, QUERY, EDIT)
 * - Multi-parsing for multiple commands
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logger } = require('../../config/logger');

// ========================================
// KEY ROTATOR CLASS
// ========================================

class KeyRotator {
    constructor() {
        const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        this.keys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
        this.currentIndex = 0;
        this.clients = new Map();

        if (this.keys.length === 0) {
            logger.warn('⚠️ No GEMINI_API_KEYS configured. Gemini service will not work.');
        } else {
            logger.info(`🔑 Gemini KeyRotator initialized with ${this.keys.length} key(s)`);
        }
    }

    /**
     * Get the next API key using round-robin
     */
    getNextKey() {
        if (this.keys.length === 0) return null;
        const key = this.keys[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        return key;
    }

    /**
     * Get a GenerativeAI client for a key
     */
    getClient(apiKey) {
        if (!this.clients.has(apiKey)) {
            this.clients.set(apiKey, new GoogleGenerativeAI(apiKey));
        }
        return this.clients.get(apiKey);
    }

    /**
     * Get the model with the next available key
     */
    getModel(modelName = 'gemini-1.5-flash') {
        const apiKey = this.getNextKey();
        if (!apiKey) {
            throw new Error('No Gemini API keys available');
        }
        const client = this.getClient(apiKey);
        return { model: client.getGenerativeModel({ model: modelName }), apiKey };
    }
}

// Singleton instance
const keyRotator = new KeyRotator();

// ========================================
// SYSTEM PROMPT
// ========================================

const buildSystemPrompt = (context) => {
    const { profiles = [], banks = [], cards = [], categories = [] } = context;

    const profilesList = profiles.map(p =>
        `- "${p.name}" (ID: ${p.id}, Tipo: ${p.type === 'PERSONAL' ? 'PF' : 'PJ'})`
    ).join('\n') || '(Nenhum perfil)';

    const banksList = banks.map(b =>
        `- "${b.bankName}" / "${b.nickname || b.bankName}" (ID: ${b.id})`
    ).join('\n') || '(Nenhuma conta)';

    const cardsList = cards.map(c =>
        `- "${c.name || c.bankName}" / "${c.bankName}" (ID: ${c.id})`
    ).join('\n') || '(Nenhum cartão)';

    const categoriesList = categories.map(c =>
        `- "${c.name}" (ID: ${c.id}, Tipo: ${c.type})`
    ).join('\n') || '(Nenhuma categoria)';

    return `Você é o assistente financeiro MyWallet AI. Analise mensagens do usuário e extraia informações financeiras.

## CONTEXTO DO USUÁRIO

### Perfis disponíveis:
${profilesList}

### Contas bancárias:
${banksList}

### Cartões de crédito:
${cardsList}

### Categorias:
${categoriesList}

## REGRAS DE MAPEAMENTO

1. **Bancos**: Mapeie termos informais para IDs:
   - "nubank", "nu", "roxinho" → busque conta com "Nubank" no nome
   - "inter", "laranjinha" → busque conta com "Inter" no nome
   - "itauzinho", "itaú", "itau" → busque conta com "Itaú" no nome
   - "bb", "banco do brasil" → busque conta com "Brasil" no nome
   - "caixa", "cef" → busque conta com "Caixa" no nome
   - "bradesco" → busque conta com "Bradesco" no nome
   - "santander" → busque conta com "Santander" no nome

2. **Perfis (PF/PJ)**: Identifique o tipo correto:
   - Tags [PF], [PJ], "pessoa física", "pessoal" → PERSONAL
   - "na firma", "da empresa", "pj", "mei", "cnpj" → BUSINESS
   - Se não especificado, use null (será usado o perfil ativo)

3. **Categorias**: Mapeie descrições para categorias existentes:
   - "mercado", "supermercado", "feira" → busque categoria de Alimentação/Mercado
   - "uber", "99", "taxi", "combustível" → busque categoria de Transporte
   - "salário", "pagamento" → busque categoria de Salário (tipo INCOME)

## INTENÇÕES

Identifique a intenção do usuário:
- **TRANSACTION**: Registrar uma ou mais transações
- **QUERY**: Consultar extrato/resumo (período: day, week, month, year)
- **EDIT**: Editar uma transação existente (usando shortId como #A1B2)

## FORMATO DE RESPOSTA (JSON)

Para TRANSACTION:
{
  "intent": "TRANSACTION",
  "entries": [
    {
      "type": "EXPENSE" | "INCOME",
      "amount": 50.00,
      "description": "Descrição curta",
      "categoryId": "uuid-ou-null",
      "categoryName": "Nome sugerido se não encontrar",
      "bankId": "uuid-ou-null",
      "cardId": "uuid-ou-null",
      "profileType": "PERSONAL" | "BUSINESS" | null,
      "isRecurring": false,
      "totalInstallments": null,
      "source": "PIX" | "CREDIT" | "DEBIT" | "CASH" | "OTHER"
    }
  ]
}

Para QUERY:
{
  "intent": "QUERY",
  "queryOptions": {
    "period": "day" | "week" | "month" | "year",
    "filter": "income" | "expense" | "all"
  }
}

Para EDIT:
{
  "intent": "EDIT",
  "editData": {
    "shortId": "A1B2",
    "updates": {
      "amount": 75.00,
      "description": "Nova descrição"
    }
  }
}

## REGRAS IMPORTANTES

1. Sempre retorne JSON válido
2. Para múltiplas transações em uma mensagem, retorne múltiplos objetos em entries
3. Valores monetários sempre em número (50.00, não "R$ 50,00")
4. Se não conseguir identificar, retorne: { "intent": "UNKNOWN", "message": "Não entendi" }
5. Palavras-chave de INCOME: recebi, ganhei, salário, pix recebido, entrada, rendimento
6. Palavras-chave de EXPENSE: gastei, paguei, comprei, saída, débito
7. Identifique parcelas: "em 3x", "parcelado em 12", "3 vezes"
8. Identifique recorrência: "todo mês", "mensalmente", "assinatura"`;
};

// ========================================
// MAIN ANALYSIS FUNCTION
// ========================================

/**
 * Analyze user input (text or audio) and return structured data
 * @param {string|Buffer} input - Text message or audio buffer
 * @param {Object} context - User context (profiles, banks, cards, categories)
 * @param {boolean} isAudio - Whether input is audio buffer
 * @returns {Promise<Object>} Parsed intent and data
 */
const analyzeInput = async (input, context = {}, isAudio = false) => {
    let lastError = null;
    const maxRetries = Math.min(keyRotator.keys.length, 3);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const { model, apiKey } = keyRotator.getModel('gemini-1.5-flash');

            logger.info(`🤖 Gemini attempt ${attempt + 1}/${maxRetries} (key: ...${apiKey.slice(-4)})`);

            const systemPrompt = buildSystemPrompt(context);

            // Build content parts
            const parts = [];

            if (isAudio && Buffer.isBuffer(input)) {
                // Multimodal: Audio input
                parts.push({
                    inlineData: {
                        mimeType: 'audio/ogg',
                        data: input.toString('base64')
                    }
                });
                parts.push({ text: 'Transcreva e analise este áudio de acordo com as instruções.' });
            } else {
                // Text input
                parts.push({ text: String(input) });
            }

            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: 'Entendido. Vou analisar as mensagens do usuário e retornar JSON estruturado conforme as regras.' }] },
                    { role: 'user', parts }
                ],
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                    maxOutputTokens: 1024
                }
            });

            const response = result.response;
            const text = response.text();

            logger.info(`✅ Gemini response: ${text.substring(0, 100)}...`);

            // Parse JSON response
            const parsed = JSON.parse(text);
            return parsed;

        } catch (error) {
            lastError = error;
            const errorMessage = error.message || '';
            const statusCode = error.status || error.code || 0;

            // Check for rate limit (429) or quota exceeded
            if (statusCode === 429 ||
                errorMessage.includes('429') ||
                errorMessage.includes('quota') ||
                errorMessage.includes('Too Many Requests') ||
                errorMessage.includes('RESOURCE_EXHAUSTED')) {

                logger.warn(`⚠️ Rate limit hit on attempt ${attempt + 1}, rotating key...`);
                continue; // Try next key
            }

            // For other errors, log and continue
            logger.error(`❌ Gemini error (attempt ${attempt + 1}):`, error.message);

            // If it's not a rate limit, might be a bad input - break early
            if (!errorMessage.includes('500') && !errorMessage.includes('503')) {
                break;
            }
        }
    }

    // All retries failed, return fallback
    logger.error('❌ All Gemini attempts failed:', lastError?.message);
    return {
        intent: 'UNKNOWN',
        message: 'Não consegui processar sua mensagem. Tente novamente.',
        error: lastError?.message
    };
};

/**
 * Parse natural language for transactions (compatibility wrapper)
 * @param {string} text - User message
 * @param {Object} context - User context
 */
const parseNaturalLanguage = async (text, context = {}) => {
    return analyzeInput(text, context, false);
};

/**
 * Analyze audio input
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {Object} context - User context
 */
const analyzeAudio = async (audioBuffer, context = {}) => {
    return analyzeInput(audioBuffer, context, true);
};

// ========================================
// FALLBACK REGEX PARSER
// ========================================

/**
 * Fallback parser using regex when AI fails
 * @param {string} text - User message
 * @param {Object} context - User context
 */
const fallbackParse = (text, context = {}) => {
    logger.info('⚠️ Using fallback regex parser...');

    const lowerText = text.toLowerCase();

    // Check for query intent
    const queryKeywords = ['quanto', 'extrato', 'resumo', 'gastei', 'recebi', 'saldo'];
    const hasQueryKeyword = queryKeywords.some(kw => lowerText.includes(kw));
    const hasQuestionMark = text.includes('?');

    if ((hasQueryKeyword && hasQuestionMark) || lowerText.includes('quanto gastei') || lowerText.includes('quanto recebi')) {
        let period = 'month';
        if (lowerText.includes('hoje') || lowerText.includes('dia')) period = 'day';
        else if (lowerText.includes('semana')) period = 'week';
        else if (lowerText.includes('ano')) period = 'year';

        let filter = 'all';
        if (lowerText.includes('gast') || lowerText.includes('despes')) filter = 'expense';
        else if (lowerText.includes('receb') || lowerText.includes('ganhe')) filter = 'income';

        return {
            intent: 'QUERY',
            queryOptions: { period, filter }
        };
    }

    // Extract monetary value
    const amountMatch = text.match(/R?\$?\s?(\d+(?:[.,]\d{1,2})?)/);
    const amount = amountMatch
        ? parseFloat(amountMatch[1].replace(',', '.'))
        : null;

    if (!amount) {
        return {
            intent: 'UNKNOWN',
            message: 'Não consegui identificar o valor da transação'
        };
    }

    // Determine type
    const incomeKeywords = ['recebi', 'ganhei', 'salario', 'salário', 'entrada', 'pix recebido'];
    const isIncome = incomeKeywords.some(kw => lowerText.includes(kw));
    const type = isIncome ? 'INCOME' : 'EXPENSE';

    // Determine source
    let source = 'OTHER';
    if (lowerText.includes('pix')) source = 'PIX';
    else if (lowerText.includes('credito') || lowerText.includes('crédito')) source = 'CREDIT';
    else if (lowerText.includes('debito') || lowerText.includes('débito')) source = 'DEBIT';
    else if (lowerText.includes('dinheiro') || lowerText.includes('espécie')) source = 'CASH';

    // Check for profile type
    let profileType = null;
    if (lowerText.includes('[pj]') || lowerText.includes('pj') ||
        lowerText.includes('empresa') || lowerText.includes('firma') || lowerText.includes('mei')) {
        profileType = 'BUSINESS';
    } else if (lowerText.includes('[pf]') || lowerText.includes('pessoal')) {
        profileType = 'PERSONAL';
    }

    // Check for installments
    let totalInstallments = null;
    const installmentMatch = text.match(/(\d+)\s*[xX]|parcelado?\s*em\s*(\d+)|(\d+)\s*vezes?/i);
    if (installmentMatch) {
        totalInstallments = parseInt(installmentMatch[1] || installmentMatch[2] || installmentMatch[3]);
    }

    // Check for recurring
    const isRecurring = lowerText.includes('todo mês') ||
        lowerText.includes('mensal') ||
        lowerText.includes('assinatura');

    // Extract description
    let description = text
        .replace(/R?\$?\s?\d+(?:[.,]\d{1,2})?/g, '')
        .replace(/\[P[FJ]\]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!description || description.length < 3) {
        description = type === 'INCOME' ? 'Receita' : 'Despesa';
    }

    return {
        intent: 'TRANSACTION',
        entries: [{
            type,
            amount,
            description: description.substring(0, 100),
            categoryId: null,
            categoryName: null,
            bankId: null,
            cardId: null,
            profileType,
            isRecurring,
            totalInstallments,
            source
        }],
        fallback: true
    };
};

// ========================================
// EXPORTS
// ========================================

module.exports = {
    analyzeInput,
    analyzeAudio,
    parseNaturalLanguage,
    fallbackParse,
    keyRotator
};
