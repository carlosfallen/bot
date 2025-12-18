require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

const nlpAnalyzer = require('./src/nlp/analyzer.js');
const CloudflareD1 = require('./src/database/d1.js');
const BotAPI = require('./src/api/server.js');
const config = require('./src/config/index.js');

const logger = P({ level: 'silent' });

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.nlp = nlpAnalyzer;
        this.db = null;
        this.api = null;
        this.qrAttempts = 0;
        this.maxQrAttempts = 3;
        this.config = {
            bot_enabled: true,
            respond_to_groups: false,
            respond_to_channels: false,
            auto_save_leads: true,
            business_hours_only: false
        };
    }

    async initialize() {
        console.log('\n╔════════════════════════════════╗');
        console.log('║    🤖 WHATSAPP BOT QR CODE    ║');
        console.log('╚════════════════════════════════╝\n');

        await this.initializeDatabase();
        await this.initializeAPI();
        await this.connectToWhatsApp();
    }

    async initializeDatabase() {
        console.log('📦 Conectando ao banco...');
        
        try {
            this.db = new CloudflareD1({
                accountId: config.cloudflare.accountId,
                databaseId: config.cloudflare.databaseId,
                apiToken: config.cloudflare.apiToken
            });

            this.config = await this.db.getAllConfig();
            console.log('✅ Banco conectado\n');
        } catch (error) {
            console.log('⚠️  Banco não disponível, usando configs padrão\n');
        }
    }

    async initializeAPI() {
        try {
            console.log('🌐 Iniciando API...');
            this.api = new BotAPI(this.db, this);
            this.api.start();
        } catch (error) {
            console.log('⚠️  API não iniciada:', error.message);
        }
    }

    async connectToWhatsApp() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');

            console.log('🔌 Conectando ao WhatsApp...\n');

            this.sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                logger,
                printQRInTerminal: false, // Vamos usar qrcode-terminal
                browser: ['Bot', 'Chrome', '10.0'],
                syncFullHistory: false,
                markOnlineOnConnect: false
            });

            // Evento de QR Code
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // Mostrar QR Code quando disponível
                if (qr) {
                    this.qrAttempts++;
                    
                    console.log('\n╔════════════════════════════════╗');
                    console.log('║       📱 ESCANEIE O QR CODE    ║');
                    console.log('╚════════════════════════════════╝\n');
                    
                    qrcode.generate(qr, { small: true });
                    
                    console.log('\n📱 No seu WhatsApp:');
                    console.log('   1. Abra o WhatsApp no celular');
                    console.log('   2. Toque em Menu (⋮) ou Configurações');
                    console.log('   3. Toque em "Aparelhos conectados"');
                    console.log('   4. Toque em "Conectar aparelho"');
                    console.log('   5. Escaneie o QR Code acima\n');
                    console.log(`⏳ Tentativa ${this.qrAttempts}/${this.maxQrAttempts}...\n`);

                    if (this.qrAttempts >= this.maxQrAttempts) {
                        console.log('⚠️  Máximo de tentativas atingido. Reiniciando...\n');
                        this.qrAttempts = 0;
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log('\n⚠️  Conexão fechada');
                    console.log(`   Status: ${statusCode}\n`);

                    if (statusCode === DisconnectReason.loggedOut) {
                        console.log('❌ Você foi desconectado.');
                        console.log('💡 Delete: rm -rf auth_info && npm start\n');
                        process.exit(0);
                    } else if (shouldReconnect) {
                        console.log('🔄 Reconectando em 3 segundos...\n');
                        setTimeout(() => this.connectToWhatsApp(), 3000);
                    }
                } else if (connection === 'open') {
                    console.log('\n╔════════════════════════════════╗');
                    console.log('║   ✅ CONECTADO COM SUCESSO!   ║');
                    console.log('╚════════════════════════════════╝\n');
                    this.qrAttempts = 0;
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

        } catch (error) {
            console.error('\n❌ Erro ao conectar:', error.message);
            console.log('🔄 Tentando novamente em 5 segundos...\n');
            setTimeout(() => this.connectToWhatsApp(), 5000);
        }
    }

    async handleMessage(msg) {
        const remoteJid = msg.key.remoteJid;
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        if (!messageText) return;

        const chatType = remoteJid.endsWith('@g.us') ? 'group' : 'private';

        console.log(`\n📨 ${chatType}: ${messageText.substring(0, 50)}`);

        if (!this.config.bot_enabled || (chatType === 'group' && !this.config.respond_to_groups)) {
            return;
        }

        try {
            const nlpResult = await this.nlp.analyze(messageText, remoteJid);
            
            await this.sock.sendMessage(remoteJid, { text: nlpResult.response });

            console.log(`✅ Enviado: ${nlpResult.response.substring(0, 50)}...\n`);

            if (this.db) {
                const phone = remoteJid.split('@')[0];
                const leadId = await this.db.saveLead({ phone, name: null, email: null, company: null, tags: [] });
                const conversation = await this.db.getOrCreateConversation(remoteJid, leadId, chatType);
                
                await this.db.saveMessage(conversation.id, {
                    messageId: msg.key.id,
                    direction: 'incoming',
                    text: messageText,
                    intent: nlpResult.intent,
                    confidence: nlpResult.confidence,
                    entities: nlpResult.entities,
                    isBot: false
                });

                await this.db.saveMessage(conversation.id, {
                    messageId: null,
                    direction: 'outgoing',
                    text: nlpResult.response,
                    intent: nlpResult.intent,
                    confidence: nlpResult.confidence,
                    entities: nlpResult.entities,
                    isBot: true
                });
            }

        } catch (error) {
            console.error('❌ Erro ao processar:', error.message);
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

process.on('SIGINT', () => {
    console.log('\n\n👋 Encerrando bot...\n');
    process.exit(0);
});

const bot = new WhatsAppBot();

bot.initialize().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});