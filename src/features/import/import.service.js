const { BankAccount, CardTransaction, CreditCard, TransactionCategory } = require('../../models');
const { AppError } = require('../../middlewares/errorHandler');
const { v4: uuidv4 } = require('uuid');

/**
 * Service de Importação
 * =====================
 * Lida com parsing de arquivos (OFX) e processamento de dados bancários
 */

/**
 * Faz o parse simples de um conteúdo OFX (Texto)
 * Extrai: Banco, Conta, Transações
 */
const parseOFX = (content) => {
    try {
        // Regex patterns for OFX tags
        const bankIdMatch = content.match(/<BANKID>(\d+)/);
        const acctIdMatch = content.match(/<ACCTID>([\w\d-]+)/);
        const orgMatch = content.match(/<ORG>([\w\s]+)/);

        const bankId = bankIdMatch ? bankIdMatch[1] : null;
        const accountId = acctIdMatch ? acctIdMatch[1] : null;
        let bankName = orgMatch ? orgMatch[1].trim() : 'Banco Desconhecido';

        // Tentar inferir nome do banco pelo ID se não tiver ORG
        if (!bankName || bankName === 'Banco Desconhecido') {
            const banks = {
                '001': 'Banco do Brasil',
                '033': 'Santander',
                '104': 'Caixa Econômica',
                '237': 'Bradesco',
                '341': 'Itaú',
                '260': 'Nubank',
                '077': 'Inter',
                '336': 'C6 Bank',
                '290': 'PagBank'
            };
            if (bankId && banks[bankId]) bankName = banks[bankId];
        }

        // Extrair Transações (STMTTRN)
        const transactions = [];
        const transParts = content.split('<STMTTRN>');

        // Pular primeira parte (header)
        for (let i = 1; i < transParts.length; i++) {
            const block = transParts[i];

            const typeMatch = block.match(/<TRNTYPE>(\w+)/);
            const dateMatch = block.match(/<DTPOSTED>(\d+)/);
            const amountMatch = block.match(/<TRNAMT>([\d.-]+)/);
            const fitIdMatch = block.match(/<FITID>([\w\d-]+)/);
            const memoMatch = block.match(/<MEMO>(.+)/);

            if (amountMatch && dateMatch) {
                const rawDate = dateMatch[1].substring(0, 8); // YYYYMMDD
                const formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;

                let memo = memoMatch ? memoMatch[1].trim() : 'Sem descrição';
                // Clean memo (remove XML closing tags if present due to lazy matching)
                memo = memo.split('<')[0];

                transactions.push({
                    fitId: fitIdMatch ? fitIdMatch[1] : uuidv4(),
                    type: typeMatch ? typeMatch[1] : 'OTHER',
                    date: formattedDate,
                    amount: parseFloat(amountMatch[1]), // Pode ser negativo (débito) ou positivo (crédito)
                    description: memo,
                    category: 'Outros' // Categoria padrão, AI classificará depois
                });
            }
        }

        return {
            bank: {
                id: bankId,
                name: bankName,
                accountNumber: accountId
            },
            transactions,
            totalTransactions: transactions.length
        };

    } catch (error) {
        console.error('Error parsing OFX:', error);
        throw new AppError('Falha ao processar arquivo OFX. Verifique o formato.', 400);
    }
};

const detectSubscriptions = (transactions) => {
    const keywords = {
        'NETFLIX': { name: 'Netflix', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', color: '#E50914' },
        'SPOTIFY': { name: 'Spotify', icon: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg', color: '#1DB954' },
        'AMAZON': { name: 'Amazon Prime', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Amazon_Prime_Video_logo.svg', color: '#00A8E1' },
        'PRIME VIDEO': { name: 'Amazon Prime', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Amazon_Prime_Video_logo.svg', color: '#00A8E1' },
        'APPLE': { name: 'Apple Services', icon: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', color: '#000000' },
        'DISNEY': { name: 'Disney+', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', color: '#113CCF' },
        'HBO': { name: 'HBO Max', icon: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg', color: '#5D05B5' },
        'GLOBOPLAY': { name: 'Globoplay', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Globoplay_logo_2020.svg', color: '#FB4F00' },
        'YOUTUBE': { name: 'YouTube Premium', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg', color: '#FF0000' },
        'SMARTFIT': { name: 'Smart Fit', icon: '', color: '#F7A500' },
        'OPENAI': { name: 'ChatGPT', icon: '', color: '#10A37F' }
    };

    const potential = [];

    transactions.forEach(tx => {
        const desc = tx.description.toUpperCase();
        for (const [key, config] of Object.entries(keywords)) {
            if (desc.includes(key)) {
                // Check if already added (avoid duplicates from same import)
                // Note: Real logic might want to average amount if multiple found, but here we take the first/last
                if (!potential.find(p => p.name === config.name)) {
                    potential.push({
                        name: config.name,
                        amount: Math.abs(tx.amount), // Ensure positive value
                        icon: config.icon,
                        color: config.color,
                        billingCycle: 'MONTHLY', // Default assumption
                        startDate: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }
    });

    return potential;
};

/**
 * Processa a importação dos dados analisados
 * Salva ou atualiza conta e insere transações
 */
const processImport = async (userId, data, options = {}) => {
    const { bank, transactions } = data;
    const { profileId, type } = options; // type: 'CHECKING' or 'INVESTMENT'

    // 1. Encontrar ou criar Conta Bancária
    let bankAccount = await BankAccount.findOne({
        where: {
            userId,
            accountNumber: bank.accountNumber
        }
    });

    if (!bankAccount) {
        bankAccount = await BankAccount.create({
            userId,
            profileId,
            name: `${bank.name}${type === 'INVESTMENT' ? ' (Investimentos)' : ''} - Importada`,
            bankName: bank.name,
            accountNumber: bank.accountNumber,
            balance: 0, // Será ajustado pelas transações ou input do usuário
            type: type || 'CHECKING', // Padrão
            color: type === 'INVESTMENT' ? '#0ea5e9' : '#333333'
        });
        console.log(`✅ [IMPORT] Created new Bank Account: ${bankAccount.id}`);
    }

    // 2. Detectar Assinaturas
    const detectedSubscriptions = detectSubscriptions(transactions);

    // 3. Inserir Transações
    // TODO: Implement transaction insertion logic properly
    // For now we assume detection is the priority for this step

    return {
        bankAccount,
        detectedSubscriptions,
        success: true,
        message: 'Dados bancários processados com sucesso'
    };
};

const parseCSV = (content) => {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV inválido ou vazio');

    // Detect separator (comma or semicolon)
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';

    // Helper to normalize header names
    const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // Find headers
    // We look for specific keywords in the first few lines to identify the header row
    let headerIndex = -1;
    let headers = [];

    // Keywords for detection
    const dateKeys = ['data', 'date', 'dt', 'dia'];
    const amountKeys = ['valor', 'amount', 'value', 'quantia', 'saldo'];
    const descKeys = ['descricao', 'description', 'desc', 'historico', 'memo', 'estabelecimento'];

    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const cols = lines[i].split(separator).map(normalize);
        const hasDate = cols.some(c => dateKeys.find(k => c.includes(k)));
        const hasAmount = cols.some(c => amountKeys.find(k => c.includes(k)));

        if (hasDate && hasAmount) {
            headerIndex = i;
            headers = lines[i].split(separator).map(normalize);
            break;
        }
    }

    if (headerIndex === -1) {
        // Fallback: Assume simple columns if no header found? 
        // Dangerous. Let's error for safety or assume 0=Date, 1=Desc, 2=Value if 3 cols?
        // Let's throw for now to force standard exports.
        throw new Error('Não foi possível identificar as colunas (Data, Valor, Descrição) no CSV.');
    }

    // Map column indices
    const dateIdx = headers.findIndex(h => dateKeys.find(k => h.includes(k)));
    const amountIdx = headers.findIndex(h => amountKeys.find(k => h.includes(k)));
    const descIdx = headers.findIndex(h => descKeys.find(k => h.includes(k))); // Optional, might use remaining

    const transactions = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const cols = lines[i].split(separator);
        if (cols.length < 2) continue;

        const dateStr = cols[dateIdx]?.trim();
        let amountStr = cols[amountIdx]?.trim();
        let descStr = (descIdx !== -1 ? cols[descIdx] : 'Compra') || 'Sem descrição';

        if (!dateStr || !amountStr) continue;

        // Parse Amount (handle Brazilian R$ 1.000,00 or US 1,000.00)
        // Heuristic: if contains ',' and '.' check positions
        // Default Brazil: 1.000,00 -> remove '.', replace ',' with '.'
        // But some CSVs might be US. 
        // Simple check: create a cleaner
        amountStr = amountStr.replace(/[R$\s]/g, '');
        if (amountStr.includes(',') && !amountStr.includes('.')) {
            // 100,50 -> 100.50
            amountStr = amountStr.replace(',', '.');
        } else if (amountStr.includes('.') && amountStr.includes(',')) {
            // 1.000,50 -> 1000.50
            amountStr = amountStr.replace(/\./g, '').replace(',', '.');
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount)) continue;

        // Parse Date (DD/MM/YYYY or YYYY-MM-DD)
        let date = new Date(dateStr);
        if (isNaN(date.getTime()) || dateStr.includes('/')) {
            // Assume DD/MM/YYYY
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // DD/MM/YYYY -> YYYY-MM-DD
                date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        }

        if (isNaN(date.getTime())) continue;

        transactions.push({
            id: `CSV-${i}-${Math.random().toString(36).substr(2, 9)}`, // Temp ID
            date: date,
            amount: amount,
            description: descStr.replace(/"/g, '').trim(),
            type: amount < 0 ? 'DEBIT' : 'CREDIT'
        });
    }

    return {
        bank: {
            bankId: 'CSV',
            accountId: 'Importado',
            name: 'Conta CSV',
            org: 'CSV Import'
        },
        transactions
    };
};

const parseFile = (content) => {
    const isOFX = content.includes('<OFX') || content.includes('OFXHEADER');
    if (isOFX) return parseOFX(content);
    return parseCSV(content);
};

module.exports = {
    parseFile, // Exposed generic parser
    processImport,
    // parseOFX (internal now, or verified)
};
