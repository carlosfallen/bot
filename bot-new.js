require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');
const fs = require('fs');

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
        this.phoneNumber = null;
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
        
        // Verificar se já tem sessão salva
        const hasSession = await this.checkExistingSession();
        
        if (!hasSession) {
            console.log('📱 Primeira conexão detectada!\n');
            this.phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
            this.phoneNumber = this.phoneNumber.replace(/\D/g, '');
            console.log(`\n✅ Número configurado: ${this.phoneNumber}\n`);
        }
        
        await this.connectToWhatsApp();
    }

    async checkExistingSession() {
        try {
            const authPath = './auth_info';
            if (!fs.existsSync(authPath)) {
                return false;
            }
            
            const files = fs.readdirSync(authPath);
            const hasCreds = files.some(f => f === 'creds.json');
            
            if (hasCreds) {
                console.log('✅ Sessão existente encontrada!\n');
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
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
            return;
        }

        this.isConnecting = true;

        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');

            const needsPairing = !state.creds.registered;

            console.log('🔌 Criando conexão WebSocket...\n');

            this.sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                logger,
                printQRInTerminal: false,
                browser: ['Bot WhatsApp', 'Chrome', '10.0'],
                syncFullHistory: false,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: false,
                getMessage: async () => undefined
            });

            this.setupEventHandlers(saveCreds);

            // Se precisa parear E temos o número, solicitar código
            if (needsPairing && this.phoneNumber) {
                console.log('⏳ Aguardando conexão estabilizar...\n');
                
                // Aguardar o evento 'open' ou timeout
                await new Promise((resolve, reject) => {
                    let resolved = false;
                    
                    const timeout = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            reject(new Error('Timeout aguardando conexão'));
                        }
                    }, 20000);
                    
                    const checkConnection = () => {
                        if (this.sock.ws?.readyState === 1) { // OPEN
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timeout);
                                resolve();
                            }
                        } else {
                            setTimeout(checkConnection, 500);
                        }
                    };
                    
                    checkConnection();
                });
                
                console.log('✅ Conexão estabilizada! Solicitando código...\n');
                
                const code = await this.sock.requestPairingCode(this.phoneNumber);
                
                console.log('╔════════════════════════════════╗');
                console.log(`║  CÓDIGO: ${code}  ║`);
                console.log('╚════════════════════════════════╝\n');
                console.log('📱 No seu WhatsApp:');
                console.log('   1. Abra o WhatsApp');
                console.log('   2. Toque em ⋮ (menu)');
                console.log('   3. Aparelhos conectados');
                console.log('   4. Conectar aparelho');
                console.log(`   5. Digite: ${code}\n`);
                console.log('⏳ Aguardando pareamento...\n');
            }

        } catch (error) {
            this.isConnecting = false;
            console.error('❌ Erro na conexão:', error.message);
            
            if (error.message.includes('Timeout')) {
                console.log('\n💡 DICA: Problemas de conexão podem ser:');
                console.log('   • Firewall bloqueando portas');
                console.log('   • Internet instável');
                console.log('   • Muitas tentativas recentes\n');
                console.log('Tente novamente em 1 minuto...\n');
            }
            
            console.log('🔄 Tentando reconectar em 10 segundos...\n');
            setTimeout(() => this.connectToWhatsApp(), 10000);
        }
    }

    setupEventHandlers(saveCreds) {
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'connecting') {
                console.log('🔌 Conectando aos servidores WhatsApp...');
            }
            else if (connection === 'open') {
                console.log('\n╔════════════════════════════════╗');
                console.log('║   ✅ CONECTADO COM SUCESSO!   ║');
                console.log('╚════════════════════════════════╝\n');
                
                this.isConnecting = false;
                
                if (rl && !rl.closed) {
                    rl.close();
                    rl = null;
                }
            }
            else if (connection === 'close') {
                this.isConnecting = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMsg = lastDisconnect?.error?.message || 'Desconhecido';
                
                console.log('\n⚠️  Conexão fechada');
                console.log(`   Status: ${statusCode}`);
                console.log(`   Erro: ${errorMsg}\n`);
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('❌ Você foi desconectado do WhatsApp.');
                    console.log('💡 Delete a pasta auth_info e reinicie:\n');
                    console.log('   rm -rf auth_info && npm start\n');
                    process.exit(0);
                }
                else if (statusCode === 401) {
                    console.log('❌ Credenciais inválidas.');
                    console.log('💡 Delete a pasta auth_info e reinicie:\n');
                    console.log('   rm -rf auth_info && npm start\n');
                    process.exit(1);
                }
                else if (statusCode === 405) {
                    console.log('❌ ERRO 405 - WhatsApp recusou a conexão\n');
                    console.log('Possíveis causas:');
                    console.log('   1. Você tem 4+ dispositivos conectados');
                    console.log('   2. Sessão inválida/corrompida');
                    console.log('   3. Número banido temporariamente\n');
                    console.log('💡 Solução:');
                    console.log('   • Desconecte um dispositivo no WhatsApp');
                    console.log('   • OU delete: rm -rf auth_info && npm start\n');
                    process.exit(1);
                }
                else {
                    console.log('🔄 Reconectando em 5 segundos...\n');
                    setTimeout(() => this.connectToWhatsApp(), 5000);
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