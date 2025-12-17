/**
 * WhatsApp Service
 * Integração com wppconnect para bot de transações
 * Multi-tenant: cada usuário tem sua própria sessão
 */

const wppconnect = require('@wppconnect-team/wppconnect');
const { logger } = require('../../config/logger');
const groqService = require('../ai/groq.service');
const transactionsService = require('../transactions/transactions.service');
const { Category } = require('../../models');
const path = require('path');
const fs = require('fs');

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
 */
const findOrCreateGroup = async (client, userId) => {
    try {
        // Buscar grupos existentes
        const chats = await client.getAllChats();
        const existingGroup = chats.find(chat =>
            chat.isGroup && chat.name === GROUP_NAME
        );

        if (existingGroup) {
            logger.info(`📌 Grupo encontrado: ${GROUP_NAME}`);
            const session = activeSessions.get(userId);
            if (session) session.groupId = existingGroup.id._serialized;
            return existingGroup;
        }

        // Criar grupo (precisa do número do usuário)
        logger.info(`📝 Criando grupo: ${GROUP_NAME}`);
        const hostDevice = await client.getHostDevice();
        const myNumber = hostDevice.wid._serialized;

        // Criar grupo só com o próprio usuário
        const group = await client.createGroup(GROUP_NAME, [myNumber]);

        if (group && group.gid) {
            const session = activeSessions.get(userId);
            if (session) session.groupId = group.gid._serialized;

            // Enviar mensagem de boas-vindas
            await client.sendText(group.gid._serialized,
                `🎉 *Bem-vindo ao MyWallet AI!*\n\n` +
                `Envie suas transações aqui:\n` +
                `• Texto: "gastei 50 no uber"\n` +
                `• Áudio: grave e envie!\n\n` +
                `Vou registrar automaticamente ✨`
            );

            logger.info(`✅ Grupo criado com sucesso`);
        }

        return group;
    } catch (error) {
        logger.error('❌ Erro ao criar grupo:', error.message);
    }
};

/**
 * Configura o listener de mensagens
 */
const setupMessageListener = (client, userId) => {
    client.onMessage(async (message) => {
        try {
            // Ignorar mensagens do próprio bot
            if (message.fromMe) return;

            // Verificar se é do grupo correto ou mensagem direta
            const session = activeSessions.get(userId);
            const isFromGroup = message.isGroupMsg &&
                session?.groupId &&
                message.chatId === session.groupId;

            // Aceitar mensagens do grupo ou diretas
            if (!isFromGroup && message.isGroupMsg) {
                return; // Ignorar outros grupos
            }

            logger.info(`📩 Mensagem recebida [${userId}]: ${message.type}`);

            let textContent = '';

            // Processar áudio
            if (message.type === 'ptt' || message.type === 'audio') {
                textContent = await processAudio(client, message);
                if (!textContent) {
                    await client.sendText(message.chatId,
                        '❌ Não consegui transcrever o áudio. Tente novamente.'
                    );
                    return;
                }
            }
            // Processar texto
            else if (message.type === 'chat' && message.body) {
                textContent = message.body;
            } else {
                return; // Ignorar outros tipos
            }

            // Buscar categorias do usuário
            const categories = await Category.findAll({
                where: { userId: userId },
                order: [['name', 'ASC']]
            });

            // Parsear transação com IA
            const parsed = await groqService.parseTransaction(textContent, categories);

            if (parsed.error) {
                await client.sendText(message.chatId,
                    `❓ ${parsed.error}\n\nTente algo como: "gastei 50 no uber"`
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

            // Enviar confirmação
            const emoji = parsed.type === 'INCOME' ? '💵' : '💸';
            const sign = parsed.type === 'INCOME' ? '+' : '-';

            await client.sendText(message.chatId,
                `✅ *Transação registrada!*\n\n` +
                `${emoji} ${sign}R$ ${parsed.amount.toFixed(2)}\n` +
                `📝 ${parsed.description}\n` +
                `📁 ${parsed.category}\n` +
                `${parsed.fallback ? '⚠️ _Processado via fallback_' : ''}`
            );

            logger.info(`✅ Transação criada via WhatsApp: ${transaction.id}`);

        } catch (error) {
            logger.error('❌ Erro ao processar mensagem:', error);
            try {
                await client.sendText(message.chatId,
                    '❌ Erro ao processar. Tente novamente.'
                );
            } catch (e) { }
        }
    });
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
