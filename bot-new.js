require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
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

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.nlp = nlpAnalyzer;
        this.db = null;
        this.api = null;
        this.config = {};
    }

    async initialize() {
        console.log('\n' + '='.repeat(60));
        console.log('   WHATSAPP BOT - SISTEMA COMPLETO');
        console.log('='.repeat(60) + '\n');

        console.log('📦 Conectando ao banco de dados...');
        this.db = new CloudflareD1({
            accountId: config.cloudflare.accountId,
            databaseId: config.cloudflare.databaseId,
            apiToken: config.cloudflare.apiToken
        });

        try {
            this.config = await this.db.getAllConfig();
            console.log('✅ Banco de dados conectado');
            console.log(`✅ ${Object.keys(this.config).length} configurações carregadas\n`);
        } catch (error) {
            console.error('❌ Erro ao conectar ao banco:', error.message);
            console.log('\n💡 Execute primeiro: wrangler d1 execute bot --file=src/database/schema.sql --remote\n');
            process.exit(1);
        }

        console.log('🌐 Iniciando servidor web...');
        this.api = new BotAPI(this.db, this);
        this.api.start();

        await this.connectToWhatsApp();
    }

    async connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        this.sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger,
            printQRInTerminal: false,
            syncFullHistory: false,
            markOnlineOnConnect: false
        });

        if (!this.sock.authState.creds.registered) {
            const phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
            const code = await this.sock.requestPairingCode(phoneNumber);
            console.log(`\n✅ CÓDIGO: ${code}\n`);
            console.log('📱 Abra WhatsApp > Dispositivos Conectados');
            console.log('   > Conectar com número de telefone');
            console.log(`   > Digite: ${code}\n`);
        }

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Conexão fechada. Reconectando:', shouldReconnect);
                if (shouldReconnect) {
                    this.connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('\n✅ CONECTADO AO WHATSAPP!');
                console.log('🤖 Bot rodando... Aguardando mensagens.\n');
                rl.close();
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (type !== 'notify') return;

                const msg = messages[0];

                if (msg.key.fromMe || msg.key.remoteJid.includes('@newsletter')) return;

                await this.handleMessage(msg);

            } catch (error) {
                console.error('❌ Erro ao processar mensagem:', error.message);
            }
        });
    }

    async handleMessage(msg) {
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

        if (!this.config.bot_enabled) {
            console.log('   ⏸️  Bot desativado globalmente');
            return;
        }

        if (chatType === 'group' && !this.config.respond_to_groups) {
            console.log('   ⏸️  Bot não responde em grupos');
            return;
        }

        if (chatType === 'channel' && !this.config.respond_to_channels) {
            console.log('   ⏸️  Bot não responde em canais');
            return;
        }

        const phone = remoteJid.split('@')[0];

        try {
            let leadId = null;
            if (this.config.auto_save_leads && chatType === 'private') {
                leadId = await this.db.saveLead({
                    phone,
                    name: null,
                    email: null,
                    company: null,
                    tags: []
                });

                await this.db.incrementStat('new_leads');
            }

            const conversation = await this.db.getOrCreateConversation(remoteJid, leadId, chatType);

            if (!conversation.is_bot_active) {
                console.log('   ⏸️  Bot desativado para esta conversa');

                await this.db.saveMessage(conversation.id, {
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

            if (this.config.business_hours_only && !this.isBusinessHours()) {
                const response = this.config.away_message;

                await this.sock.sendMessage(remoteJid, { text: response });

                console.log(`   🕐 Fora do horário: ${response}\n`);

                await this.db.saveMessage(conversation.id, {
                    messageId: msg.key.id,
                    direction: 'incoming',
                    text: messageText,
                    intent: 'away_hours',
                    confidence: 1,
                    entities: {},
                    isBot: false
                });

                await this.db.saveMessage(conversation.id, {
                    messageId: null,
                    direction: 'outgoing',
                    text: response,
                    intent: 'away_hours',
                    confidence: 1,
                    entities: {},
                    isBot: true
                });

                await this.db.incrementStat('bot_responses');

                return;
            }

            const nlpResult = await this.nlp.analyze(messageText, remoteJid);

            console.log(`   🧠 Intent: ${nlpResult.intent} (${(nlpResult.confidence * 100).toFixed(1)}%)`);

            await this.db.saveMessage(conversation.id, {
                messageId: msg.key.id,
                direction: 'incoming',
                text: messageText,
                intent: nlpResult.intent,
                confidence: nlpResult.confidence,
                entities: nlpResult.entities,
                isBot: false
            });

            await this.db.incrementStat('total_messages');

            const response = nlpResult.response;

            await this.sock.sendMessage(remoteJid, { text: response });

            console.log(`   ✅ Resposta: ${response.substring(0, 50)}...\n`);

            await this.db.saveMessage(conversation.id, {
                messageId: null,
                direction: 'outgoing',
                text: response,
                intent: nlpResult.intent,
                confidence: nlpResult.confidence,
                entities: nlpResult.entities,
                isBot: true
            });

            await this.db.incrementStat('bot_responses');
            await this.db.incrementStat('total_conversations');

            if (nlpResult.shouldCollectData && Object.keys(nlpResult.entities).length > 0) {
                if (leadId) {
                    await this.db.saveLead({
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

    isBusinessHours() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        const [startHour, startMinute] = this.config.business_hours_start.split(':').map(Number);
        const [endHour, endMinute] = this.config.business_hours_end.split(':').map(Number);

        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        return currentTime >= startTime && currentTime <= endTime;
    }
}

const bot = new WhatsAppBot();

bot.initialize().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada:', error.message);
});