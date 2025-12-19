
// FILE: bot.js
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

const nlpAnalyzer = require('./src/nlp/analyzer.js');
const CloudflareD1 = require('./src/database/d1.js');
const BotAPI = require('./src/api/server.js');
const config = require('./src/config/index.js');

const logger = P({ level: 'silent' });

let rl = null;
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
    away_message: 'No momento estamos fora do horário comercial. Retornamos em breve!'
};
let backendReady = false;
let nlpReady = false;

function createRl() {
    if (rl) try { rl.close(); } catch {}
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return rl;
}

function question(text) {
    return new Promise(resolve => {
        if (!rl) createRl();
        rl.question(text, resolve);
    });
}

function closeRl() {
    if (rl) try { rl.close(); } catch {}
    rl = null;
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();
    const isRegistered = state.creds?.registered;

    sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        getMessage: async () => undefined
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') console.log('🔄 Conectando...');

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Desconectado:', code);
            
            if (code !== DisconnectReason.loggedOut) {
                console.log('🔄 Reconectando...');
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log('⚠️  Delete auth_info e reinicie');
                process.exit(0);
            }
        }

        if (connection === 'open') {
            console.log('\n' + '━'.repeat(50));
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('━'.repeat(50));
            closeRl();
            if (!backendReady) {
                backendReady = true;
                await initBackend();
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' || !messages?.length) return;
        const msg = messages[0];
        if (msg.key.fromMe || !msg.message || msg.key.remoteJid?.includes('@newsletter')) return;
        await handleMessage(msg);
    });

    if (!isRegistered) {
        console.log('\n📱 Pareamento necessário\n');
        await new Promise(r => setTimeout(r, 2000));
        try {
            createRl();
            const phone = await question('Número (com DDI): ');
            const code = await sock.requestPairingCode(phone.replace(/\D/g, ''));
            console.log(`\n🔑 Código: ${code}\n`);
        } catch (e) {
            console.error('❌', e.message);
            closeRl();
            setTimeout(connectToWhatsApp, 5000);
        }
    }
}

async function initBackend() {
    try {
        console.log('\n🧠 Inicializando NLP...');
        await nlpAnalyzer.initializeEmbeddings();
        nlpReady = true;
    } catch (e) {
        console.log('⚠️  NLP fallback');
        nlpReady = true;
    }

    try {
        console.log('📦 Conectando banco...');
        db = new CloudflareD1({
            accountId: config.cloudflare.accountId,
            databaseId: config.cloudflare.databaseId,
            apiToken: config.cloudflare.apiToken
        });
        botConfig = { ...botConfig, ...(await db.getAllConfig()) };
        console.log('✅ Banco conectado');
    } catch (e) {
        console.log('⚠️  Sem banco:', e.message);
    }

    try {
        console.log('🌐 Iniciando API...');
        api = new BotAPI(db, { getSocket: () => sock });
        api.start();
    } catch (e) {
        console.log('⚠️  Sem API');
    }

    console.log('\n🤖 Bot pronto!\n');
}

async function handleMessage(msg) {
    const jid = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
    const type = jid.endsWith('@g.us') ? 'group' : 'private';

    console.log(`\n📨 [${type}] ${jid}`);
    console.log(`   💬 "${text}"`);

    if (!text.trim()) return console.log('   ⏭️ Vazia');
    if (!botConfig.bot_enabled) return console.log('   ⏸️ Bot off');
    if (type === 'group' && !botConfig.respond_to_groups) return console.log('   ⏸️ Grupos off');
    if (!nlpReady) await new Promise(r => setTimeout(r, 1000));

    const phone = jid.split('@')[0];

    try {
        // Salvar lead
        let leadId = null;
        if (db && botConfig.auto_save_leads && type === 'private') {
            try {
                leadId = await db.saveLead({ phone, name: null, email: null, company: null, tags: [] });
            } catch {}
        }

        // Verificar conversa
        let conv = null;
        if (db) {
            try {
                conv = await db.getOrCreateConversation(jid, leadId, type);
                if (!conv.is_bot_active) return console.log('   ⏸️ Bot off p/ conversa');
            } catch {}
        }

        // Horário comercial
        if (botConfig.business_hours_only && !isBusinessHours()) {
            await sock.sendMessage(jid, { text: botConfig.away_message });
            return console.log('   🕐 Fora do horário');
        }

        // Processar
        const result = await nlpAnalyzer.analyze(text, jid);
        console.log(`   ✨ ${result.intent} → enviando...`);

        // Salvar mensagem recebida
        if (db && conv) {
            try {
                await db.saveMessage(conv.id, {
                    messageId: msg.key.id,
                    direction: 'incoming',
                    text,
                    intent: result.intent,
                    confidence: result.confidence,
                    entities: result.entities,
                    isBot: false
                });
            } catch {}
        }

        // Enviar resposta
        await sock.sendMessage(jid, { text: result.response });
        console.log('   ✅ Enviado');

        // Salvar resposta
        if (db && conv) {
            try {
                await db.saveMessage(conv.id, {
                    messageId: null,
                    direction: 'outgoing',
                    text: result.response,
                    intent: result.intent,
                    confidence: result.confidence,
                    entities: result.entities,
                    isBot: true
                });
            } catch {}
        }

        // Atualizar lead
        if (db && leadId && Object.keys(result.entities).length > 0) {
            try {
                await db.saveLead({
                    phone,
                    name: result.entities.name || null,
                    email: result.entities.email || null,
                    company: result.entities.company || null,
                    tags: []
                });
                console.log('   💾 Lead atualizado');
            } catch {}
        }

    } catch (e) {
        console.error('   ❌', e);
    }
}

function isBusinessHours() {
    const now = new Date();
    const time = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = (botConfig.business_hours_start || '09:00').split(':').map(Number);
    const [eh, em] = (botConfig.business_hours_end || '18:00').split(':').map(Number);
    return time >= sh * 60 + sm && time <= eh * 60 + em;
}

process.on('uncaughtException', e => console.error('❌', e));
process.on('unhandledRejection', e => console.error('❌', e));
process.on('SIGINT', () => { closeRl(); process.exit(0); });

connectToWhatsApp();