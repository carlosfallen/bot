require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

const nlpAnalyzer = require('./src/nlp/analyzer.js');
const CloudflareD1 = require('./src/database/d1.js');
const BotAPI = require('./src/api/server.js');
const config = require('./src/config/index.js');

const logger = P({ level: 'silent' });

let rl = null;

const question = (text) => new Promise((resolve) => {
    if (!rl || rl.closed) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    rl.question(text, resolve);
});

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.nlp = nlpAnalyzer;
        this.db = null;
        this.api = null;
        this.isConnecting = false;
        this.isFirstConnection = true;
        this.connectionAttempts = 0;
        this.maxAttempts = 3;
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
        if (this.isConnecting) {
            console.log('⚠️  Já há uma tentativa de conexão em andamento...');
            return;
        }

        this.isConnecting = true;

        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');

            // Criar o socket
            this.sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                logger,
                printQRInTerminal: false,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000, // 60 segundos de timeout
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            // Configurar eventos ANTES de solicitar o código
            this.setupEventHandlers(saveCreds);

            // Aguardar um pouco para o socket estabilizar
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Solicitar código apenas na primeira vez e se não registrado
            if (this.isFirstConnection && !state.creds.registered) {
                console.log('\n⚠️  Você tem 60 segundos para inserir o código no WhatsApp!\n');
                
                const phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
                
                try {
                    const code = await this.sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
                    console.log(`\n✅ CÓDIGO DE PAREAMENTO: ${code}`);
                    console.log('📱 Abra o WhatsApp > Aparelhos conectados > Conectar aparelho');
                    console.log('📝 Digite o código acima\n');
                    console.log('⏳ Aguardando conexão...\n');
                } catch (error) {
                    console.error('❌ Erro ao solicitar código:', error.message);
                    this.isConnecting = false;
                    
                    // Tentar novamente
                    if (this.connectionAttempts < this.maxAttempts) {
                        this.connectionAttempts++;
                        console.log(`\n🔄 Tentativa ${this.connectionAttempts}/${this.maxAttempts}...\n`);
                        setTimeout(() => this.connectToWhatsApp(), 3000);
                    } else {
                        console.log('\n❌ Máximo de tentativas atingido. Reinicie o bot.\n');
                        process.exit(1);
                    }
                }
            }

        } catch (error) {
            this.isConnecting = false;
            console.error('❌ Erro ao conectar:', error.message);
            
            if (this.connectionAttempts < this.maxAttempts) {
                this.connectionAttempts++;
                console.log(`\n🔄 Nova tentativa em 5 segundos... (${this.connectionAttempts}/${this.maxAttempts})\n`);
                setTimeout(() => this.connectToWhatsApp(), 5000);
            } else {
                console.log('\n❌ Não foi possível conectar após várias tentativas.\n');
                process.exit(1);
            }
        }
    }

    setupEventHandlers(saveCreds) {
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'close') {
                this.isConnecting = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`\n⚠️  Conexão fechada. Status: ${statusCode}`);
                
                if (shouldReconnect) {
                    console.log('🔄 Reconectando em 5 segundos...\n');
                    
                    setTimeout(() => {
                        this.isFirstConnection = false;
                        this.connectionAttempts = 0; // Reset tentativas em reconexão
                        this.connectToWhatsApp();
                    }, 5000);
                } else {
                    console.log('❌ Sessão encerrada. Delete a pasta "auth_info" e reinicie o bot.\n');
                    process.exit(0);
                }
            } 
            else if (connection === 'open') {
                console.log('\n✅ CONECTADO COM SUCESSO!\n');
                this.isConnecting = false;
                this.isFirstConnection = false;
                this.connectionAttempts = 0;
                
                if (rl && !rl.closed) {
                    rl.close();
                    rl = null;
                }
            }
            else if (connection === 'connecting') {
                console.log('🔌 Conectando...');
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

// Tratamento de sinais para fechar gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Encerrando bot...\n');
    if (rl && !rl.closed) rl.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Encerrando bot...\n');
    if (rl && !rl.closed) rl.close();
    process.exit(0);
});

const bot = new WhatsAppBot();

bot.initialize().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    if (rl && !rl.closed) rl.close();
    process.exit(1);
});