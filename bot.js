// WhatsApp Bot Completo - Com NLP, Dashboard e Banco de Dados
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

// Importar módulos do bot
const nlpAnalyzer = require('./src/nlp/analyzer.js');
const CloudflareD1 = require('./src/database/d1.js');
const BotAPI = require('./src/api/server.js');
const config = require('./src/config/index.js');

const logger = P({ level: 'silent' });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Variáveis globais
let sock = null;
let db = null;
let api = null;
let botConfig = {
    bot_enabled: true,
    respond_to_groups: false,
    respond_to_channels: false,
    auto_save_leads: true,
    business_hours_only: false,
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    away_message: 'No momento estamos fora do horário de atendimento.'
};
let backendInitialized = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Digite seu número do WhatsApp (com DDI, ex: 5511999999999): ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`Código de pareamento: ${code}`);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp!');

            // Inicializar backend APENAS uma vez
            if (!backendInitialized) {
                backendInitialized = true;
                initializeBackend();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            const msg = messages[0];

            if (!msg.key.fromMe && msg.message && !msg.key.remoteJid.includes('@newsletter')) {
                await handleMessage(msg);
            }
        } catch (error) {
            console.log('❌ Erro ao processar mensagem:', error.message);
        }
    });
}

async function initializeBackend() {
    try {
        // Inicializar banco de dados
        console.log('\n📦 Conectando ao banco de dados...');
        db = new CloudflareD1({
            accountId: config.cloudflare.accountId,
            databaseId: config.cloudflare.databaseId,
            apiToken: config.cloudflare.apiToken
        });

        // Carregar configurações do banco
        botConfig = await db.getAllConfig();
        console.log('✅ Banco de dados conectado');
        console.log(`✅ ${Object.keys(botConfig).length} configurações carregadas`);
    } catch (error) {
        console.error('⚠️  Erro ao conectar banco:', error.message);
        console.log('⚠️  Continuando sem banco de dados...');
    }

    try {
        // Inicializar API
        console.log('🌐 Iniciando servidor web...');
        api = new BotAPI(db, { getSocket: () => sock });
        api.start();
    } catch (error) {
        console.error('⚠️  Erro ao iniciar API:', error.message);
        console.log('⚠️  Continuando sem dashboard...');
    }

    console.log('\n🤖 Bot pronto! Aguardando mensagens...\n');
}

async function handleMessage(msg) {
    const remoteJid = msg.key.remoteJid;
    const messageText = msg.message?.conversation ||
                       msg.message?.extendedTextMessage?.text ||
                       '';

    if (!messageText) return;

    // Determinar tipo de chat
    const chatType = remoteJid.endsWith('@g.us') ? 'group' :
                    remoteJid.endsWith('@newsletter') ? 'channel' :
                    'private';

    console.log(`\n📨 Mensagem ${chatType} de ${remoteJid}`);
    console.log(`   Texto: ${messageText}`);

    // Verificar configurações globais
    if (!botConfig.bot_enabled) {
        console.log('   ⏸️  Bot desativado globalmente');
        return;
    }

    // Verificar se deve responder baseado no tipo de chat
    if (chatType === 'group' && !botConfig.respond_to_groups) {
        console.log('   ⏸️  Bot não responde em grupos');
        return;
    }

    if (chatType === 'channel' && !botConfig.respond_to_channels) {
        console.log('   ⏸️  Bot não responde em canais');
        return;
    }

    // Extrair número de telefone
    const phone = remoteJid.split('@')[0];

    try {
        // Salvar ou atualizar lead (somente se DB disponível)
        let leadId = null;
        if (db && botConfig.auto_save_leads && chatType === 'private') {
            try {
                leadId = await db.saveLead({
                    phone,
                    name: null,
                    email: null,
                    company: null,
                    tags: []
                });
                await db.incrementStat('new_leads');
            } catch (error) {
                console.log('   ⚠️  Erro ao salvar lead:', error.message);
            }
        }

        // Obter ou criar conversa (somente se DB disponível)
        let conversation = null;
        if (db) {
            try {
                conversation = await db.getOrCreateConversation(remoteJid, leadId, chatType);

                // Verificar se bot está ativo para esta conversa
                if (!conversation.is_bot_active) {
                    console.log('   ⏸️  Bot desativado para esta conversa');
                    return;
                }
            } catch (error) {
                console.log('   ⚠️  Erro ao buscar conversa:', error.message);
            }
        }

        // Verificar horário comercial
        if (botConfig.business_hours_only && !isBusinessHours()) {
            const response = botConfig.away_message;
            await sock.sendMessage(remoteJid, { text: response });
            console.log(`   🕐 Fora do horário: ${response}`);
            return;
        }

        // Processar com NLP
        const nlpResult = await nlpAnalyzer.analyze(messageText, remoteJid);
        console.log(`   🧠 Intent: ${nlpResult.intent} (${(nlpResult.confidence * 100).toFixed(1)}%)`);

        // Salvar mensagem recebida (somente se DB disponível)
        if (db && conversation) {
            try {
                await db.saveMessage(conversation.id, {
                    messageId: msg.key.id,
                    direction: 'incoming',
                    text: messageText,
                    intent: nlpResult.intent,
                    confidence: nlpResult.confidence,
                    entities: nlpResult.entities,
                    isBot: false
                });
                await db.incrementStat('total_messages');
            } catch (error) {
                console.log('   ⚠️  Erro ao salvar mensagem:', error.message);
            }
        }

        // Enviar resposta
        const response = nlpResult.response;
        await sock.sendMessage(remoteJid, { text: response });
        console.log(`   ✅ Resposta enviada`);

        // Salvar resposta do bot (somente se DB disponível)
        if (db && conversation) {
            try {
                await db.saveMessage(conversation.id, {
                    messageId: null,
                    direction: 'outgoing',
                    text: response,
                    intent: nlpResult.intent,
                    confidence: nlpResult.confidence,
                    entities: nlpResult.entities,
                    isBot: true
                });
                await db.incrementStat('bot_responses');
                await db.incrementStat('total_conversations');
            } catch (error) {
                console.log('   ⚠️  Erro ao salvar resposta:', error.message);
            }
        }

        // Atualizar lead com entidades extraídas (somente se DB disponível)
        if (db && leadId && nlpResult.shouldCollectData && Object.keys(nlpResult.entities).length > 0) {
            try {
                await db.saveLead({
                    phone,
                    name: nlpResult.entities.name || null,
                    email: nlpResult.entities.email || null,
                    company: null,
                    tags: []
                });
                console.log('   💾 Lead atualizado');
            } catch (error) {
                console.log('   ⚠️  Erro ao atualizar lead:', error.message);
            }
        }

    } catch (error) {
        console.error('   ❌ Erro ao processar:', error.message);
    }
}

function isBusinessHours() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = botConfig.business_hours_start.split(':').map(Number);
    const [endHour, endMinute] = botConfig.business_hours_end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    return currentTime >= startTime && currentTime <= endTime;
}

// Iniciar bot
connectToWhatsApp();
