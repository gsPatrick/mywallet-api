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

module.exports = {
    parseOFX,
    processImport
};
