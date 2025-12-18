// WhatsApp Bot Completo - Com NLP, Dashboard e Banco de Dados
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Importar módulos do bot
const nlpAnalyzer = require('./src/nlp/analyzer.js');
const CloudflareD1 = require('./src/database/d1.js');
const BotAPI = require('./src/api/server.js');
const config = require('./src/config/index.js');

const logger = P({ level: 'silent' });

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
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    // Pairing code se não estiver registrado
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Digite seu número do WhatsApp (com DDI, ex: 5589994333316): ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n🔑 Código de pareamento: ${code}\n`);
        console.log('Digite este código no seu WhatsApp: Dispositivos Conectados > Conectar Dispositivo > Código\n');
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        console.log('📊 Connection update:', connection);

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = Object.keys(DisconnectReason).find(
                key => DisconnectReason[key] === statusCode
            ) || statusCode;

            console.log('❌ Conexão fechada');
            console.log('   Motivo:', reason);
            console.log('   Status Code:', statusCode);
            console.log('   Erro:', lastDisconnect?.error?.message);

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('   Reconectar?', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 3000);
            }
        } else if (connection === 'open') {
            console.log('\n━'.repeat(50));
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('━'.repeat(50));

            // Inicializar backend APENAS uma vez
            if (!backendInitialized) {
                backendInitialized = true;
                initializeBackend();
            }
        }
    });

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
        console.log('\n📦 Conectando ao banco de dados...');
        db = new CloudflareD1({
            accountId: config.cloudflare.accountId,
            databaseId: config.cloudflare.databaseId,
            apiToken: config.cloudflare.apiToken
        });

        botConfig = await db.getAllConfig();
        console.log('✅ Banco de dados conectado');
        console.log(`✅ ${Object.keys(botConfig).length} configurações carregadas`);
    } catch (error) {
        console.error('⚠️  Erro ao conectar banco:', error.message);
        console.log('⚠️  Continuando sem banco de dados...');
    }

    try {
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

    const chatType = remoteJid.endsWith('@g.us') ? 'group' :
                    remoteJid.endsWith('@newsletter') ? 'channel' :
                    'private';

    console.log(`\n📨 Mensagem ${chatType} de ${remoteJid}`);
    console.log(`   Texto: ${messageText}`);

    if (!botConfig.bot_enabled) {
        console.log('   ⏸️  Bot desativado globalmente');
        return;
    }

    if (chatType === 'group' && !botConfig.respond_to_groups) {
        console.log('   ⏸️  Bot não responde em grupos');
        return;
    }

    if (chatType === 'channel' && !botConfig.respond_to_channels) {
        console.log('   ⏸️  Bot não responde em canais');
        return;
    }

    const phone = remoteJid.split('@')[0];

    try {
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

        let conversation = null;
        if (db) {
            try {
                conversation = await db.getOrCreateConversation(remoteJid, leadId, chatType);

                if (!conversation.is_bot_active) {
                    console.log('   ⏸️  Bot desativado para esta conversa');
                    return;
                }
            } catch (error) {
                console.log('   ⚠️  Erro ao buscar conversa:', error.message);
            }
        }

        if (botConfig.business_hours_only && !isBusinessHours()) {
            const response = botConfig.away_message;
            await sock.sendMessage(remoteJid, { text: response });
            console.log(`   🕐 Fora do horário: ${response}`);
            return;
        }

        const nlpResult = await nlpAnalyzer.analyze(messageText, remoteJid);
        console.log(`   🧠 Intent: ${nlpResult.intent} (${(nlpResult.confidence * 100).toFixed(1)}%)`);

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

        const response = nlpResult.response;
        await sock.sendMessage(remoteJid, { text: response });
        console.log(`   ✅ Resposta enviada`);

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
