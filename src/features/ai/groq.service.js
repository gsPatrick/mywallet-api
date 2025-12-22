/**
 * Groq AI Service
 * ========================================
 * WHATSAPP BOT INTELLIGENCE ENGINE - GROQ EDITION
 * ========================================
 * 
 * SURGICAL AI STRATEGY:
 * - Whisper: Audio transcription only
 * - LLaMA: Intent parsing only
 * - Direct code: Shortcuts, formatting, UX
 * 
 * Features:
 * - API Key Rotation (round-robin)
 * - Auto-recovery on 429 (rate limit)
 * - Multi-parsing (multiple commands in one message)
 * - Smart entity mapping (banks, profiles, categories)
 */

const Groq = require('groq-sdk');
const { logger } = require('../../config/logger');

// ========================================
// KEY ROTATOR CLASS
// ========================================

class GroqKeyRotator {
    constructor() {
        const keysString = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
        this.keys = keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
        this.currentIndex = 0;
        this.clients = new Map();

        if (this.keys.length === 0) {
            logger.warn('⚠️ No GROQ_API_KEYS configured. Groq service will not work.');
        } else {
            logger.info(`🔑 Groq KeyRotator initialized with ${this.keys.length} key(s)`);
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
     * Get a Groq client for a key
     */
    getClient(apiKey) {
        if (!this.clients.has(apiKey)) {
            this.clients.set(apiKey, new Groq({ apiKey }));
        }
        return this.clients.get(apiKey);
    }

    /**
     * Get client with the next available key
     */
    getGroqClient() {
        const apiKey = this.getNextKey();
        if (!apiKey) {
            throw new Error('No Groq API keys available');
        }
        return { client: this.getClient(apiKey), apiKey };
    }
}

// Singleton instance
const keyRotator = new GroqKeyRotator();

// ========================================
// MODELS
// ========================================

const WHISPER_MODEL = 'whisper-large-v3';
const LLAMA_MODEL = 'llama-3.3-70b-versatile';

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
        `- "${c.name || c.bankName}" / "${c.bankName}" (ID: ${c.id}, Final: ${c.lastFourDigits || 'N/A'})`
    ).join('\n') || '(Nenhum cartão)';

    const categoriesList = categories.map(c =>
        `- "${c.name}" (ID: ${c.id}, Tipo: ${c.type})`
    ).join('\n') || '(Nenhuma categoria)';

    return `Você é o assistente financeiro MyWallet AI. Interprete mensagens naturais e retorne JSON estruturado.

## CONTEXTO
### Perfis: 
${profilesList}
### Contas bancárias: 
${banksList}
### Cartões: 
${cardsList}
### Categorias: 
${categoriesList}

## MAPEAMENTO DE BANCOS/CARTÕES
- "nubank", "nu", "roxinho" → busque "Nubank"
- "inter", "laranjinha" → busque "Inter"
- "itaú", "itau" → busque "Itaú"
- "bradesco" → busque "Bradesco"
- "caixa", "cef" → busque "Caixa"
- "bb", "brasil" → busque "Brasil"
- "santander" → busque "Santander"

## INTENÇÕES SUPORTADAS

1. **TRANSACTION** - Registrar transação
   Exemplos: "gastei 50 no uber", "recebi 100 de salário", "paguei 200 de luz"

2. **QUERY** - Consultar extrato/resumo
   Exemplos: "quanto gastei hoje?", "resumo do mês", "minhas receitas"

3. **EDIT** - Editar transação
   Exemplos: "editar #A1B2 para 75", "mudar #X1Y2 descrição para almoço"

4. **BALANCE** - Consultar saldo (total ou específico)
   Exemplos: "mostra meu saldo", "saldo do nubank", "quanto tenho no inter?"

5. **CARDS** - Ver cartões (todos ou específico)
   Exemplos: "meus cartões", "mostra o cartão nubank", "limite do inter"

6. **INVOICE** - Ver fatura do cartão
   Exemplos: "fatura do nubank", "mostra minha fatura", "gastos do cartão inter"

7. **PAY_INVOICE** - Pagar fatura do cartão
   Exemplos: "pagar fatura do nubank", "quitar cartão inter"

8. **PAY_DAS** - Pagar guia DAS
   Exemplos: "pagar das", "quitar das de dezembro", "pagar imposto mei"

## FORMATO JSON

Para TRANSACTION:
{"intent": "TRANSACTION", "entries": [{"type": "EXPENSE|INCOME", "amount": 50.00, "description": "Uber", "categoryId": null, "categoryName": "Transporte", "bankId": null, "cardId": null, "profileType": null, "isRecurring": false, "totalInstallments": null, "source": "PIX|CREDIT|DEBIT|CASH|OTHER"}]}

Para QUERY:
{"intent": "QUERY", "queryOptions": {"period": "day|week|month|year", "filter": "income|expense|all"}}

Para EDIT:
{"intent": "EDIT", "editData": {"shortId": "A1B2", "updates": {"amount": 75.00, "description": "Nova desc"}}}

Para BALANCE:
{"intent": "BALANCE", "filter": {"bankId": "uuid-ou-null", "bankName": "Nome informal do banco ou null para todos"}}

Para CARDS:
{"intent": "CARDS", "filter": {"cardId": "uuid-ou-null", "cardName": "Nome informal do cartão ou null para todos"}}

Para INVOICE:
{"intent": "INVOICE", "filter": {"cardId": "uuid-ou-null", "cardName": "Nome informal do cartão ou null para todos"}}

Para PAY_INVOICE:
{"intent": "PAY_INVOICE", "paymentData": {"cardId": "uuid-ou-null", "cardName": "Nome do cartão", "bankId": "uuid-ou-null", "bankName": "Banco para débito ou null"}}

Para PAY_DAS:
{"intent": "PAY_DAS", "paymentData": {"month": 12, "year": 2024, "bankId": "uuid-ou-null", "bankName": "Banco para débito ou null"}}

## REGRAS
1. Retorne APENAS JSON válido
2. Se não entender: {"intent": "UNKNOWN", "message": "Não entendi"}
3. Valores monetários sempre numéricos (50.00)
4. INCOME: recebi, ganhei, salário, entrada, pix recebido
5. EXPENSE: gastei, paguei, comprei, débito
6. Mapeie nomes informais de bancos/cartões para os IDs do contexto`;
};

// ========================================
// WHISPER: AUDIO TRANSCRIPTION
// ========================================

/**
 * Transcribe audio using Whisper
 * @param {Buffer} audioBuffer - Audio file buffer (OGG from WhatsApp)
 * @returns {Promise<string>} Transcribed text
 */
const transcribeAudio = async (audioBuffer) => {
    let lastError = null;
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Create temp file for audio
    const tempFile = path.join(os.tmpdir(), `whatsapp_audio_${Date.now()}.ogg`);

    try {
        // Write buffer to temp file
        fs.writeFileSync(tempFile, audioBuffer);

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const { client, apiKey } = keyRotator.getGroqClient();
                logger.info(`🎤 Whisper transcription attempt ${attempt + 1}/2 (key: ...${apiKey.slice(-4)})`);

                // Use fs.createReadStream for the file
                const transcription = await client.audio.transcriptions.create({
                    file: fs.createReadStream(tempFile),
                    model: WHISPER_MODEL,
                    language: 'pt',
                    response_format: 'text'
                });

                // Clean up temp file
                fs.unlinkSync(tempFile);

                logger.info(`✅ Whisper transcription: "${transcription.substring(0, 100)}..."`);
                return transcription;

            } catch (error) {
                lastError = error;
                const errorMessage = error.message || '';
                const statusCode = error.status || 0;

                logger.error(`❌ Whisper error (attempt ${attempt + 1}):`, errorMessage);

                // Rate limit - rotate and retry
                if (statusCode === 429 || errorMessage.includes('429') || errorMessage.includes('rate')) {
                    logger.warn('⚠️ Rate limit hit, rotating key...');
                    continue;
                }

                break;
            }
        }

        // Clean up on failure
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

        throw new Error(`Whisper transcription failed: ${lastError?.message}`);

    } catch (error) {
        // Clean up on any error
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        throw error;
    }
};

// ========================================
// LLAMA: INTENT PARSING
// ========================================

/**
 * Parse user message using LLaMA
 * @param {string} text - User message (or transcribed audio)
 * @param {Object} context - User context (profiles, banks, cards, categories)
 * @returns {Promise<Object>} Parsed intent and data
 */
const parseTransaction = async (text, context = {}) => {
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { client, apiKey } = keyRotator.getGroqClient();
            logger.info(`🧠 LLaMA parsing attempt ${attempt + 1}/2 (key: ...${apiKey.slice(-4)})`);

            const systemPrompt = buildSystemPrompt(context);

            const completion = await client.chat.completions.create({
                model: LLAMA_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.1,
                max_tokens: 1024,
                response_format: { type: 'json_object' }
            });

            const responseText = completion.choices[0]?.message?.content || '';
            logger.info(`✅ LLaMA response: ${responseText.substring(0, 200)}...`);

            // Parse JSON
            const parsed = JSON.parse(responseText);
            return parsed;

        } catch (error) {
            lastError = error;
            const errorMessage = error.message || '';
            const statusCode = error.status || 0;

            logger.error(`❌ LLaMA error (attempt ${attempt + 1}):`, errorMessage);

            // Rate limit - rotate and retry
            if (statusCode === 429 || errorMessage.includes('429') || errorMessage.includes('rate')) {
                logger.warn('⚠️ Rate limit hit, rotating key...');
                continue;
            }

            break;
        }
    }

    // Fallback response
    logger.error('❌ All LLaMA attempts failed:', lastError?.message);
    return {
        intent: 'UNKNOWN',
        message: 'Não consegui processar. Tente novamente.',
        error: lastError?.message
    };
};

// ========================================
// MAIN ANALYSIS FUNCTION
// ========================================

/**
 * Analyze user input (text or audio) and return structured data
 * @param {string|Buffer} input - Text message or audio buffer
 * @param {Object} context - User context
 * @param {boolean} isAudio - Whether input is audio buffer
 * @returns {Promise<Object>} Parsed intent and data
 */
const analyzeInput = async (input, context = {}, isAudio = false) => {
    let textContent = input;

    // Step 1: Transcribe audio if needed
    if (isAudio && Buffer.isBuffer(input)) {
        try {
            textContent = await transcribeAudio(input);
        } catch (error) {
            logger.error('❌ Audio transcription failed:', error.message);
            return {
                intent: 'UNKNOWN',
                message: 'Não consegui transcrever o áudio. Tente enviar como texto.',
                error: 'transcription_failed'
            };
        }
    }

    // Step 2: Parse intent with LLaMA
    return parseTransaction(String(textContent), context);
};

/**
 * Alias for audio analysis
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
    transcribeAudio,
    parseTransaction,
    analyzeInput,
    analyzeAudio,
    fallbackParse,
    keyRotator
};
