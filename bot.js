require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

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
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: false,
        getMessage: async () => undefined
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
            console.log('🔄 Conectando ao WhatsApp...');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = Object.keys(DisconnectReason).find(
                key => DisconnectReason[key] === statusCode
            ) || statusCode;

            console.log('❌ Conexão fechada');
            console.log('   Motivo:', reason);

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('🔄 Reconectando em 3 segundos...');
                setTimeout(() => connectToWhatsApp(), 3000);
            } else {
                console.log('\n⚠️  Sessão encerrada. Delete a pasta auth_info e execute novamente.');
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log('\n' + '━'.repeat(50));
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('━'.repeat(50));
            rl.close();

            if (!backendInitialized) {
                backendInitialized = true;
                await initializeBackend();
            }
        }
    });

    if (!sock.authState.creds.registered) {
        console.log('\n📱 Aguardando conexão inicial...\n');

        await new Promise(resolve => setTimeout(resolve, 3000));

        const phoneNumber = await question('Digite seu número do WhatsApp (com DDI, ex: 5589994333316): ');

        try {
            const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
            console.log(`\n🔑 Código de pareamento: ${code}\n`);
            console.log('Digite este código no seu WhatsApp:');
            console.log('   Configurações > Aparelhos conectados > Conectar aparelho\n');
        } catch (error) {
            console.error('❌ Erro ao solicitar código:', error.message);
            console.log('🔄 Tentando novamente em 5 segundos...\n');
            setTimeout(() => connectToWhatsApp(), 5000);
        }
    }

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
        console.log('\n🧠 Inicializando NLP com embeddings...');
        await nlpAnalyzer.initializeEmbeddings();
    } catch (error) {
        console.log('⚠️  Embeddings não disponível:', error.message);
    }

    try {
        console.log('📦 Conectando ao banco de dados...');
        db = new CloudflareD1({
            accountId: config.cloudflare.accountId,
            databaseId: config.cloudflare.databaseId,
            apiToken: config.cloudflare.apiToken
        });

        botConfig = await db.getAllConfig();
        console.log('✅ Banco de dados conectado');
    } catch (error) {
        console.error('⚠️  Erro ao conectar banco:', error.message);
    }

    try {
        console.log('🌐 Iniciando servidor web...');
        api = new BotAPI(db, { getSocket: () => sock });
        api.start();
    } catch (error) {
        console.error('⚠️  Erro ao iniciar API:', error.message);
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
            console.log(`   🕐 Fora do horário`);
            return;
        }

        const nlpResult = await nlpAnalyzer.analyze(messageText, remoteJid);
        console.log(`   🧠 Intent: ${nlpResult.intent} (${(nlpResult.confidence * 100).toFixed(1)}%) [${nlpResult.method}]`);

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
                    company: nlpResult.entities.company || null,
                    tags: []
                });
                console.log('   💾 Lead atualizado com:', Object.keys(nlpResult.entities).join(', '));
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

connectToWhatsApp();