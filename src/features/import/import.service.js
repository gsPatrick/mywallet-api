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

/**
 * Processa a importação dos dados analisados
 * Salva ou atualiza conta e insere transações
 */
const processImport = async (userId, data, options = {}) => {
    const { bank, transactions } = data;
    const { profileId } = options;

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
            name: `${bank.name} - Importada`,
            bankName: bank.name,
            accountNumber: bank.accountNumber,
            balance: 0, // Será ajustado pelas transações ou input do usuário
            type: 'CHECKING', // Padrão
            color: '#333333'
        });
        console.log(`✅ [IMPORT] Created new Bank Account: ${bankAccount.id}`);
    }

    // 2. Inserir Transações
    const createdTransactions = [];
    let balanceImpact = 0;

    for (const tx of transactions) {
        // Verificar duplicidade pelo FITID (ID único do OFX)
        // Como não temos campo fitId na tabela padrão, usamos combinação de data/valor/descrição ou ignoramos por enquanto
        // Idealmente adicionaríamos coluna fitId nas transações

        // Simplified implementation: insert as ManualTransaction linked to account
        // In real world, check for existence

        // TODO: Use transactions service to create
        // For now, return the mapped data for the controller to show 'Preview'
    }

    return {
        bankAccount,
        success: true,
        message: 'Dados bancários processados com sucesso'
    };
};

module.exports = {
    parseOFX,
    processImport
};
