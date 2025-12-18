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
        this.isConnecting = false;
        this.isFirstConnection = true;
        this.config = {
            bot_enabled: true,
            respond_to_groups: false,
            respond_to_channels: false,
            auto_save_leads: true,
            business_hours_only: false
        };
    }

    async initialize() {
        console.log('\n=== WHATSAPP BOT ===\n');

        // Inicializar database e API ANTES de conectar
        await this.initializeDatabase();
        await this.initializeAPI();

        // Conectar ao WhatsApp por último
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
        // Evitar múltiplas tentativas simultâneas
        if (this.isConnecting) {
            console.log('⚠️  Já há uma tentativa de conexão em andamento...');
            return;
        }

        this.isConnecting = true;

        try {
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

            // Solicitar código apenas na primeira conexão E se não estiver registrado
            if (this.isFirstConnection && !this.sock.authState.creds.registered) {
                const phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
                const code = await this.sock.requestPairingCode(phoneNumber);
                console.log(`\n✅ CÓDIGO: ${code}\n`);
            }

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'close') {
                    this.isConnecting = false;
                    
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    if (shouldReconnect) {
                        console.log('⚠️  Conexão fechada. Reconectando em 3 segundos...');
                        setTimeout(() => {
                            this.isFirstConnection = false; // Não solicitar código novamente
                            this.connectToWhatsApp();
                        }, 3000);
                    } else {
                        console.log('❌ Desconectado. Faça login novamente.');
                        process.exit(0);
                    }
                } else if (connection === 'open') {
                    console.log('\n✅ CONECTADO!\n');
                    this.isConnecting = false;
                    this.isFirstConnection = false;
                    
                    // Fechar readline apenas após primeira conexão bem-sucedida
                    if (rl && !rl.closed) {
                        rl.close();
                    }
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
            this.isConnecting = false;
            console.error('❌ Erro ao conectar:', error.message);
            
            // Tentar reconectar após erro
            setTimeout(() => {
                this.connectToWhatsApp();
            }, 5000);
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

const bot = new WhatsAppBot();

bot.initialize().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});