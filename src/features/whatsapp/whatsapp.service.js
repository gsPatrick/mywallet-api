/**
 * WhatsApp Service
 * Integração com wppconnect para bot de transações
 * Multi-tenant: cada usuário tem sua própria sessão
 */

const wppconnect = require('@wppconnect-team/wppconnect');
const { logger } = require('../../config/logger');
const groqService = require('../ai/groq.service');
const transactionsService = require('../transactions/transactions.service');
const { Category, User } = require('../../models');
const path = require('path');
const fs = require('fs');

// Número auxiliar para criar o grupo (OBRIGATÓRIO para criar grupo)
const AUXILIARY_NUMBER = '557182862912@c.us';

// Armazena clientes ativos por userId
const activeSessions = new Map();

// Nome do grupo padrão
const GROUP_NAME = '💰 MyWallet AI';

/**
 * Obtém o caminho da sessão para um usuário
 */
const getSessionPath = (userId) => {
    const sessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    return sessionsDir;
};

/**
 * Inicializa uma sessão do WhatsApp para um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<{qrCode: string, status: string}>}
 */
const initSession = async (userId) => {
    const sessionName = `session_${userId}`;

    // Se já existe sessão ativa, retorna status
    if (activeSessions.has(userId)) {
        const session = activeSessions.get(userId);
        if (session.client && session.isConnected) {
            return { status: 'connected', message: 'WhatsApp já conectado' };
        }
    }

    return new Promise((resolve, reject) => {
        let qrCodeData = null;
        let resolved = false;

        wppconnect.create({
            session: sessionName,
            folderNameToken: getSessionPath(userId),
            headless: true,
            useChrome: false, // Use Chromium instead
            debug: false,
            logQR: false,
            puppeteerOptions: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-extensions'
                ]
            },
            browserArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            catchQR: (base64Qr, asciiQR) => {
                logger.info(`📱 QR Code gerado para usuário ${userId}`);
                qrCodeData = base64Qr;

                if (!resolved) {
                    resolved = true;
                    resolve({
                        status: 'awaiting_scan',
                        qrCode: base64Qr
                    });
                }
            },
            statusFind: (statusSession, session) => {
                logger.info(`📊 Status WhatsApp [${userId}]: ${statusSession}`);

                if (statusSession === 'isLogged' || statusSession === 'inChat') {
                    const sessionData = activeSessions.get(userId);
                    if (sessionData) {
                        sessionData.isConnected = true;
                    }
                }
            }
        })
            .then(async (client) => {
                logger.info(`✅ WhatsApp conectado para usuário ${userId}`);

                // Armazenar sessão
                activeSessions.set(userId, {
                    client,
                    isConnected: true,
                    groupId: null
                });

                // Configurar listeners
                setupMessageListener(client, userId);

                // Tentar encontrar ou criar grupo
                await findOrCreateGroup(client, userId);

                // Se ainda não resolveu (conexão direta sem QR)
                if (!resolved) {
                    resolved = true;
                    resolve({ status: 'connected', message: 'WhatsApp conectado' });
                }
            })
            .catch((error) => {
                logger.error(`❌ Erro ao conectar WhatsApp [${userId}]:`, error);
                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            });

        // Timeout para evitar hang
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (qrCodeData) {
                    resolve({ status: 'awaiting_scan', qrCode: qrCodeData });
                } else {
                    reject(new Error('Timeout ao gerar QR Code'));
                }
            }
        }, 30000);
    });
};

/**
 * Busca ou cria o grupo MyWallet AI
 * Usa número auxiliar para criação pois é obrigatório ter 1 participante
 */
const findOrCreateGroup = async (client, userId) => {
    try {
        // Buscar usuário para verificar se já tem grupo vinculado
        const user = await User.findByPk(userId);

        // Se já tem grupo salvo no banco, usar esse
        if (user && user.whatsappGroupId) {
            logger.info(`📌 Grupo já vinculado: ${user.whatsappGroupId}`);
            const session = activeSessions.get(userId);
            if (session) session.groupId = user.whatsappGroupId;
            return { gid: { _serialized: user.whatsappGroupId } };
        }

        // Buscar grupos existentes
        const chats = await client.listChats ? await client.listChats() : await client.getAllChats();
        const existingGroup = chats.find(chat =>
            chat.isGroup && chat.name === GROUP_NAME
        );

        if (existingGroup) {
            const groupId = existingGroup.id._serialized;
            logger.info(`📌 Grupo encontrado: ${GROUP_NAME} (${groupId})`);

            // Salvar no banco
            if (user) {
                user.whatsappGroupId = groupId;
                await user.save();
            }

            const session = activeSessions.get(userId);
            if (session) session.groupId = groupId;
            return existingGroup;
        }

        // Criar grupo com número auxiliar (OBRIGATÓRIO ter pelo menos 1 participante)
        logger.info(`📝 Criando grupo: ${GROUP_NAME} com participante auxiliar`);

        const group = await client.createGroup(GROUP_NAME, [AUXILIARY_NUMBER]);

        if (group && group.gid) {
            const groupId = group.gid._serialized;

            // Salvar no banco de dados
            if (user) {
                user.whatsappGroupId = groupId;
                await user.save();
                logger.info(`💾 Grupo salvo no banco: ${groupId}`);
            }

            const session = activeSessions.get(userId);
            if (session) session.groupId = groupId;

            // Enviar mensagem de boas-vindas
            await client.sendText(groupId,
                `🎉 *Bem-vindo ao MyWallet AI!*\n\n` +
                `Envie suas transações aqui:\n` +
                `• Texto: "gastei 50 no uber"\n` +
                `• Áudio: grave e envie!\n\n` +
                `Vou registrar automaticamente ✨`
            );

            // Definir logo do grupo
            try {
                logger.info('⏳ Aguardando propagação do grupo...');
                await new Promise(r => setTimeout(r, 4000)); // Delay de segurança

                const logoUrl = 'https://i.imgur.com/MHJwgwz.jpeg';
                await client.setGroupIcon(groupId, logoUrl);
                logger.info('✅ Logo do MyWallet definida no grupo!');
            } catch (iconError) {
                logger.warn('⚠️ Não foi possível definir a foto do grupo:', iconError.message);
            }

            logger.info(`✅ Grupo criado com sucesso: ${groupId}`);
            return group;
        }

        return null;
    } catch (error) {
        logger.error('❌ Erro ao criar grupo:', error.message);
        return null;
    }
};

/**
 * Configura o listener de mensagens
 * USA onAnyMessage para capturar mensagens do próprio usuário (host)
 * BLINDAGEM COMPLETA + ANTI-LOOP
 */
const setupMessageListener = (client, userId) => {
    // IMPORTANTE: onAnyMessage captura mensagens do próprio usuário
    client.onAnyMessage(async (message) => {
        try {
            // ========================================
            // 1. BLOQUEIO TOTAL DE LIXO
            // Status, notificações de sistema, etc.
            // ========================================
            if (message.from === 'status@broadcast' ||
                message.isStatus ||
                message.type === 'e2e_notification' ||
                message.type === 'notification_template' ||
                message.type === 'protocol' ||
                message.type === 'revoked') {
                return;
            }

            // ========================================
            // 2. RECUPERAR USUÁRIO
            // ========================================
            const user = await User.findByPk(userId);
            if (!user || !user.whatsappGroupId) {
                return; // Sem grupo configurado
            }

            // ========================================
            // 3. VERIFICAÇÃO DE GRUPO (CRUCIAL)
            // Só processa mensagens do grupo oficial
            // ========================================
            const isFromGroup =
                message.chatId === user.whatsappGroupId ||
                message.from === user.whatsappGroupId ||
                message.to === user.whatsappGroupId;

            if (!isFromGroup) {
                return; // Bloqueia outros grupos e conversas privadas
            }

            // ========================================
            // 4. ANTI-LOOP (CRUCIAL)
            // Não processar respostas do próprio bot
            // ========================================
            if (message.body && (
                message.body.startsWith('🤖') ||
                message.body.startsWith('✅') ||
                message.body.startsWith('❌') ||
                message.body.startsWith('❓') ||
                message.body.startsWith('🎉')
            )) {
                return; // É resposta do bot, ignorar
            }

            // ========================================
            // 5. FILTRO DE TIPO DE MENSAGEM
            // Só processa texto e áudio
            // ========================================
            if (message.type !== 'chat' && message.type !== 'ptt' && message.type !== 'audio') {
                return;
            }

            logger.info(`📩 Mensagem do grupo [${userId}]: ${message.type} - fromMe: ${message.fromMe}`);

            let textContent = '';

            // Processar áudio
            if (message.type === 'ptt' || message.type === 'audio') {
                textContent = await processAudio(client, message);
                if (!textContent) {
                    await client.sendText(user.whatsappGroupId,
                        '🤖 ❌ Não consegui transcrever o áudio. Tente novamente.'
                    );
                    return;
                }
            }
            // Processar texto
            else if (message.type === 'chat' && message.body) {
                textContent = message.body;
            } else {
                return;
            }

            // VALIDAÇÃO: Ignorar mensagens que não parecem transações
            if (!looksLikeTransaction(textContent)) {
                logger.info(`⏭️ Ignorando (não parece transação): "${textContent.substring(0, 50)}..."`);
                return;
            }

            // Buscar categorias do usuário
            const categories = await Category.findAll({
                where: { userId: userId },
                order: [['name', 'ASC']]
            });

            // Parsear transação com IA
            const parsed = await groqService.parseTransaction(textContent, categories);

            if (parsed.error) {
                await client.sendText(user.whatsappGroupId,
                    `🤖 ❓ ${parsed.error}\n\nTente algo como: "gastei 50 no uber"`
                );
                return;
            }

            // Criar transação
            const transaction = await transactionsService.createManualTransaction(userId, {
                type: parsed.type,
                source: parsed.source || 'OTHER',
                description: parsed.description,
                amount: parsed.amount,
                date: new Date(),
                category: parsed.category
            });

            // Enviar confirmação COM IDENTIDADE VISUAL DO BOT
            const emoji = parsed.type === 'INCOME' ? '💵' : '💸';
            const sign = parsed.type === 'INCOME' ? '+' : '-';

            await client.sendText(user.whatsappGroupId,
                `🤖 ✅ *Transação registrada!*\n\n` +
                `${emoji} ${sign}R$ ${parsed.amount.toFixed(2)}\n` +
                `📝 ${parsed.description}\n` +
                `📁 ${parsed.category}` +
                `${parsed.fallback ? '\n⚠️ _Processado via fallback_' : ''}`
            );

            logger.info(`✅ Transação criada via WhatsApp: ${transaction.id}`);

        } catch (error) {
            logger.error('❌ Erro ao processar mensagem:', error);
            try {
                const user = await User.findByPk(userId);
                if (user && user.whatsappGroupId) {
                    await client.sendText(user.whatsappGroupId,
                        '🤖 ❌ Erro ao processar. Tente novamente.'
                    );
                }
            } catch (e) { }
        }
    });
};

/**
 * Verifica se o texto parece uma transação financeira
 */
const looksLikeTransaction = (text) => {
    if (!text || text.length < 5) return false;

    const lowerText = text.toLowerCase();

    // Ignorar URLs
    if (lowerText.includes('http://') || lowerText.includes('https://') ||
        lowerText.includes('.com') || lowerText.includes('.br') ||
        lowerText.includes('youtu.be') || lowerText.includes('tiktok') ||
        lowerText.includes('instagram')) {
        return false;
    }

    // Ignorar mensagens muito longas (provavelmente não são transações)
    if (text.length > 300) return false;

    // Deve ter pelo menos um padrão de valor monetário
    const hasMoneyPattern = /R?\$?\s?\d+([.,]\d{1,2})?/.test(text);

    // Ou palavras-chave financeiras
    const financialKeywords = [
        'gastei', 'paguei', 'comprei', 'recebi', 'ganhei', 'transferi',
        'pix', 'credito', 'crédito', 'debito', 'débito', 'boleto',
        'uber', 'ifood', '99', 'mercado', 'supermercado', 'farmácia',
        'salario', 'salário', 'pagamento', 'entrada', 'saída'
    ];
    const hasFinancialKeyword = financialKeywords.some(kw => lowerText.includes(kw));

    return hasMoneyPattern || hasFinancialKeyword;
};

/**
 * Processa mensagem de áudio
 */
const processAudio = async (client, message) => {
    try {
        // Baixar e descriptografar o áudio
        const buffer = await client.decryptFile(message);

        if (!buffer || buffer.length === 0) {
            logger.error('❌ Buffer de áudio vazio');
            return null;
        }

        logger.info(`🎤 Áudio recebido: ${buffer.length} bytes`);

        // Transcrever com Whisper
        const transcription = await groqService.transcribeAudio(buffer, 'audio.ogg');

        logger.info(`📝 Transcrição: "${transcription}"`);
        return transcription;

    } catch (error) {
        logger.error('❌ Erro ao processar áudio:', error.message);
        return null;
    }
};

/**
 * Obtém o status da sessão
 */
const getStatus = async (userId) => {
    const session = activeSessions.get(userId);

    if (!session || !session.client) {
        return {
            status: 'disconnected',
            connected: false
        };
    }

    try {
        const state = await session.client.getConnectionState();
        const isConnected = state === 'CONNECTED';

        return {
            status: isConnected ? 'connected' : state.toLowerCase(),
            connected: isConnected,
            groupId: session.groupId,
            groupName: GROUP_NAME
        };
    } catch (error) {
        return {
            status: 'error',
            connected: false,
            error: error.message
        };
    }
};

/**
 * Desconecta a sessão
 */
const disconnect = async (userId) => {
    const session = activeSessions.get(userId);

    if (!session || !session.client) {
        return { success: true, message: 'Nenhuma sessão ativa' };
    }

    try {
        await session.client.logout();
        await session.client.close();
        activeSessions.delete(userId);

        logger.info(`👋 WhatsApp desconectado para usuário ${userId}`);
        return { success: true, message: 'Desconectado com sucesso' };
    } catch (error) {
        logger.error('❌ Erro ao desconectar:', error);
        activeSessions.delete(userId);
        return { success: true, message: 'Sessão encerrada' };
    }
};

/**
 * Envia mensagem para o grupo do usuário (para notificações)
 */
const sendNotification = async (userId, message) => {
    const session = activeSessions.get(userId);

    if (!session?.client || !session.isConnected || !session.groupId) {
        logger.warn(`⚠️ Não foi possível enviar notificação para ${userId}: não conectado`);
        return false;
    }

    try {
        await session.client.sendText(session.groupId, message);
        return true;
    } catch (error) {
        logger.error('❌ Erro ao enviar notificação:', error);
        return false;
    }
};

module.exports = {
    initSession,
    getStatus,
    disconnect,
    sendNotification
};
