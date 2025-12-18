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
let botConfig = {};

async function initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('   WHATSAPP BOT - SISTEMA COMPLETO');
    console.log('='.repeat(60) + '\n');

    // Inicializar banco de dados
    console.log('📦 Conectando ao banco de dados...');
    db = new CloudflareD1({
        accountId: config.cloudflare.accountId,
        databaseId: config.cloudflare.databaseId,
        apiToken: config.cloudflare.apiToken
    });

    // Carregar configurações do banco
    try {
        botConfig = await db.getAllConfig();
        console.log('✅ Banco de dados conectado');
        console.log(`✅ ${Object.keys(botConfig).length} configurações carregadas\n`);
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco:', error.message);
        console.log('\n💡 Execute primeiro: npm run init-db\n');
        process.exit(1);
    }

    // Inicializar API
    console.log('🌐 Iniciando servidor web...');
    api = new BotAPI(db, { getSocket: () => sock });
    api.start();

    // Conectar ao WhatsApp
    await connectToWhatsApp();
}

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

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexão fechada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 3000);
            }
        } else if (connection === 'open') {
            console.log('\n━'.repeat(50));
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('━'.repeat(50));
            console.log('\n🤖 Bot rodando... Aguardando mensagens.\n');
            rl.close();
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

    // Pairing code DEPOIS de registrar os eventos
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Digite seu número do WhatsApp (com DDI, ex: 5511999999999): ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n✅ Código de pareamento: ${code}\n`);
    }
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
        // Salvar ou atualizar lead
        let leadId = null;
        if (botConfig.auto_save_leads && chatType === 'private') {
            leadId = await db.saveLead({
                phone,
                name: null,
                email: null,
                company: null,
                tags: []
            });

            await db.incrementStat('new_leads');
        }

        // Obter ou criar conversa
        const conversation = await db.getOrCreateConversation(remoteJid, leadId, chatType);

        // Verificar se bot está ativo para esta conversa
        if (!conversation.is_bot_active) {
            console.log('   ⏸️  Bot desativado para esta conversa');

            // Salvar mensagem mesmo sem responder
            await db.saveMessage(conversation.id, {
                messageId: msg.key.id,
                direction: 'incoming',
                text: messageText,
                intent: null,
                confidence: 0,
                entities: {},
                isBot: false
            });

            return;
        }

        // Verificar horário comercial
        if (botConfig.business_hours_only && !isBusinessHours()) {
            const response = botConfig.away_message;

            await sock.sendMessage(remoteJid, { text: response });

            console.log(`   🕐 Fora do horário: ${response}\n`);

            // Salvar mensagens
            await db.saveMessage(conversation.id, {
                messageId: msg.key.id,
                direction: 'incoming',
                text: messageText,
                intent: 'away_hours',
                confidence: 1,
                entities: {},
                isBot: false
            });

            await db.saveMessage(conversation.id, {
                messageId: null,
                direction: 'outgoing',
                text: response,
                intent: 'away_hours',
                confidence: 1,
                entities: {},
                isBot: true
            });

            await db.incrementStat('bot_responses');

            return;
        }

        // Processar com NLP
        const nlpResult = await nlpAnalyzer.analyze(messageText, remoteJid);

        console.log(`   🧠 Intent: ${nlpResult.intent} (${(nlpResult.confidence * 100).toFixed(1)}%)`);

        // Salvar mensagem recebida
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

        // Enviar resposta
        const response = nlpResult.response;

        await sock.sendMessage(remoteJid, { text: response });

        console.log(`   ✅ Resposta: ${response.substring(0, 50)}...`);

        // Salvar resposta do bot
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

        // Se deve coletar dados do lead
        if (nlpResult.shouldCollectData && Object.keys(nlpResult.entities).length > 0) {
            // Atualizar lead com entidades extraídas
            if (leadId) {
                await db.saveLead({
                    phone,
                    name: nlpResult.entities.name || null,
                    email: nlpResult.entities.email || null,
                    company: null,
                    tags: []
                });

                console.log('   💾 Lead atualizado com dados extraídos');
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
initialize().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada:', error.message);
});
