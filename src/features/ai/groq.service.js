/**
 * Groq AI Service
 * Transcrição de áudio (Whisper) e parsing de transações (LLaMA)
 */

const Groq = require('groq-sdk');
const { logger } = require('../../config/logger');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Modelos
const TEXT_MODEL = 'llama3-8b-8192';
const AUDIO_MODEL = 'whisper-large-v3';

/**
 * Transcreve áudio para texto usando Whisper
 * @param {Buffer} audioBuffer - Buffer do arquivo de áudio (OGG/MP3/WAV)
 * @param {string} filename - Nome do arquivo para identificação
 */
const transcribeAudio = async (audioBuffer, filename = 'audio.ogg') => {
    try {
        logger.info(`🎤 Transcrevendo áudio: ${filename}`);

        // Criar um File-like object para o Groq SDK
        const file = new File([audioBuffer], filename, { type: 'audio/ogg' });

        const transcription = await groq.audio.transcriptions.create({
            file: file,
            model: AUDIO_MODEL,
            language: 'pt',
            response_format: 'text'
        });

        logger.info(`✅ Transcrição concluída: "${transcription.substring(0, 50)}..."`);
        return transcription;
    } catch (error) {
        logger.error('❌ Erro na transcrição:', error.message);
        throw error;
    }
};

/**
 * Extrai dados de transação a partir de texto usando LLaMA
 * @param {string} text - Texto da mensagem
 * @param {Array} categories - Lista de categorias do usuário
 */
const parseTransaction = async (text, categories = []) => {
    try {
        logger.info(`🧠 Parseando transação: "${text}"`);

        // Construir lista de categorias para o prompt
        const categoryList = categories.length > 0
            ? categories.map(c => `- ${c.name} (${c.type})`).join('\n')
            : `- Alimentação (EXPENSE)
- Transporte (EXPENSE)
- Moradia (EXPENSE)
- Saúde (EXPENSE)
- Lazer (EXPENSE)
- Compras (EXPENSE)
- Assinaturas (EXPENSE)
- Salário (INCOME)
- Freelance (INCOME)
- Outros (EXPENSE/INCOME)`;

        const systemPrompt = `Você é um assistente financeiro especializado em extrair informações de transações.
Analise a mensagem do usuário e extraia os dados da transação.

CATEGORIAS DISPONÍVEIS:
${categoryList}

REGRAS:
1. SEMPRE retorne um JSON válido.
2. O campo "amount" deve ser um número positivo.
3. O campo "type" deve ser "INCOME" para entradas ou "EXPENSE" para saídas.
4. O campo "category" deve ser EXATAMENTE uma das categorias listadas acima.
5. Se não conseguir identificar, use "Outros" como categoria.
6. Palavras-chave comuns:
   - uber, 99, taxi, onibus = Transporte
   - ifood, restaurante, cafe, almoco, jantar = Alimentação
   - netflix, spotify, hbo, amazon prime = Assinaturas
   - mercado, supermercado = Alimentação
   - salario, pagamento, deposito = Salário (INCOME)
   - pix recebido, transferencia recebida = INCOME

FORMATO DE RESPOSTA (JSON):
{
  "amount": 50.00,
  "description": "Descrição da transação",
  "category": "Nome da Categoria",
  "type": "EXPENSE ou INCOME",
  "source": "PIX, CREDIT, DEBIT ou OTHER",
  "confidence": 0.95
}

Se não conseguir extrair uma transação válida, retorne:
{ "error": "Não foi possível identificar uma transação" }`;

        const response = await groq.chat.completions.create({
            model: TEXT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 256
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error('Resposta vazia da IA');
        }

        const parsed = JSON.parse(content);
        logger.info(`✅ Transação parseada:`, parsed);

        return parsed;
    } catch (error) {
        logger.error('❌ Erro no parsing com IA:', error.message);
        // Fallback para regex
        return fallbackRegex(text, categories);
    }
};

/**
 * Fallback: Extrai dados usando Regex quando a IA falha
 * @param {string} text - Texto da mensagem
 * @param {Array} categories - Lista de categorias
 */
const fallbackRegex = (text, categories = []) => {
    logger.info('⚠️ Usando fallback regex...');

    const lowerText = text.toLowerCase();

    // Extrair valor monetário
    const amountMatch = text.match(/R?\$?\s?(\d+(?:[.,]\d{1,2})?)/);
    const amount = amountMatch
        ? parseFloat(amountMatch[1].replace(',', '.'))
        : null;

    if (!amount) {
        return { error: 'Não foi possível identificar o valor da transação' };
    }

    // Determinar tipo (INCOME ou EXPENSE)
    const incomeKeywords = ['recebi', 'ganhei', 'salario', 'salário', 'entrada', 'pix recebido', 'pagamento recebido'];
    const isIncome = incomeKeywords.some(kw => lowerText.includes(kw));
    const type = isIncome ? 'INCOME' : 'EXPENSE';

    // Categorização por palavras-chave
    const categoryMap = {
        'Transporte': ['uber', '99', 'taxi', 'táxi', 'onibus', 'ônibus', 'metro', 'metrô', 'combustivel', 'combustível', 'gasolina', 'etanol'],
        'Alimentação': ['ifood', 'restaurante', 'lanche', 'cafe', 'café', 'almoco', 'almoço', 'jantar', 'pizza', 'hamburger', 'mercado', 'supermercado', 'padaria'],
        'Assinaturas': ['netflix', 'spotify', 'hbo', 'disney', 'amazon prime', 'youtube', 'deezer', 'apple music'],
        'Moradia': ['aluguel', 'condominio', 'condomínio', 'luz', 'agua', 'água', 'gas', 'gás', 'internet', 'iptu'],
        'Saúde': ['farmacia', 'farmácia', 'medico', 'médico', 'consulta', 'exame', 'plano de saude', 'plano de saúde'],
        'Lazer': ['cinema', 'teatro', 'show', 'festa', 'bar', 'balada', 'jogo'],
        'Compras': ['roupa', 'sapato', 'loja', 'shopping', 'presente'],
        'Salário': ['salario', 'salário', 'pagamento', 'holerite'],
        'Freelance': ['freelance', 'projeto', 'consultoria', 'serviço']
    };

    let category = 'Outros';
    for (const [cat, keywords] of Object.entries(categoryMap)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
            category = cat;
            break;
        }
    }

    // Extrair descrição (remover valor)
    let description = text
        .replace(/R?\$?\s?\d+(?:[.,]\d{1,2})?/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!description || description.length < 3) {
        description = category;
    }

    // Detectar forma de pagamento
    let source = 'OTHER';
    if (lowerText.includes('pix')) source = 'PIX';
    else if (lowerText.includes('credito') || lowerText.includes('crédito')) source = 'CREDIT';
    else if (lowerText.includes('debito') || lowerText.includes('débito')) source = 'DEBIT';

    const result = {
        amount,
        description: description.substring(0, 100),
        category,
        type,
        source,
        confidence: 0.6, // Confiança menor por ser fallback
        fallback: true
    };

    logger.info('✅ Resultado do fallback:', result);
    return result;
};

module.exports = {
    transcribeAudio,
    parseTransaction,
    fallbackRegex
};
