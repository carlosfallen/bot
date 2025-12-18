// WhatsApp Bot Completo - Com NLP, Dashboard e Banco de Dados
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');
const fs = require('fs');

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

        // Inicializar banco de dados
        console.log('📦 Conectando ao banco de dados...');
        this.db = new CloudflareD1({
            accountId: config.cloudflare.accountId,
            databaseId: config.cloudflare.databaseId,
            apiToken: config.cloudflare.apiToken
        });

        // Carregar configurações do banco
        try {
            this.config = await this.db.getAllConfig();
            console.log('✅ Banco de dados conectado');
            console.log(`✅ ${Object.keys(this.config).length} configurações carregadas\n`);
        } catch (error) {
            console.error('❌ Erro ao conectar ao banco:', error.message);
            console.log('\n💡 Execute primeiro: wrangler d1 execute bot --file=src/database/schema.sql --remote\n');
            process.exit(1);
        }

        // Inicializar API
        console.log('🌐 Iniciando servidor web...');
        this.api = new BotAPI(this.db, this);
        this.api.start();

        // Conectar ao WhatsApp
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

        // Pairing Code se não registrado
        if (!this.sock.authState.creds.registered) {
            console.log('\n📱 CONECTAR WHATSAPP\n');
            const phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
            console.log('\n⏳ Gerando código de pareamento...\n');

            try {
                const code = await this.sock.requestPairingCode(phoneNumber);
                console.log('━'.repeat(50));
                console.log(`\n✅ CÓDIGO: ${code}\n`);
                console.log('━'.repeat(50));
                console.log('\n📱 Abra WhatsApp > Dispositivos Conectados');
                console.log('   > Conectar com número de telefone');
                console.log(`   > Digite: ${code}\n`);
            } catch (error) {
                console.error('❌ Erro ao gerar código:', error.message);
                process.exit(1);
            }
        }

        // Eventos de conexão
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'connecting') {
                console.log('🔄 Conectando...');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log('\n❌ Conexão fechada');

                if (shouldReconnect) {
                    console.log('⏳ Reconectando em 5s...\n');
                    setTimeout(() => this.connectToWhatsApp(), 5000);
                } else {
                    console.log('⚠️  Você foi desconectado. Execute novamente para reconectar.\n');
                    process.exit(1);
                }
            }

            if (connection === 'open') {
                console.log('\n━'.repeat(50));
                console.log('✅ CONECTADO AO WHATSAPP!');
                console.log('━'.repeat(50));
                console.log('\n🤖 Bot rodando... Aguardando mensagens.\n');
                rl.close();
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        // Processar mensagens recebidas
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            try {
                if (type !== 'notify') return;

                const msg = messages[0];

                // Ignorar mensagens próprias e newsletters
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

        // Determinar tipo de chat
        const chatType = remoteJid.endsWith('@g.us') ? 'group' :
                        remoteJid.endsWith('@newsletter') ? 'channel' :
                        'private';

        console.log(`\n📨 Mensagem ${chatType} de ${remoteJid}`);
        console.log(`   Texto: ${messageText}`);

        // Verificar configurações globais
        if (!this.config.bot_enabled) {
            console.log('   ⏸️  Bot desativado globalmente');
            return;
        }

        // Verificar se deve responder baseado no tipo de chat
        if (chatType === 'group' && !this.config.respond_to_groups) {
            console.log('   ⏸️  Bot não responde em grupos');
            return;
        }

        if (chatType === 'channel' && !this.config.respond_to_channels) {
            console.log('   ⏸️  Bot não responde em canais');
            return;
        }

        // Extrair número de telefone
        const phone = remoteJid.split('@')[0];

        try {
            // Salvar ou atualizar lead
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

            // Obter ou criar conversa
            const conversation = await this.db.getOrCreateConversation(remoteJid, leadId, chatType);

            // Verificar se bot está ativo para esta conversa
            if (!conversation.is_bot_active) {
                console.log('   ⏸️  Bot desativado para esta conversa');

                // Salvar mensagem mesmo sem responder
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

            // Verificar horário comercial
            if (this.config.business_hours_only && !this.isBusinessHours()) {
                const response = this.config.away_message;

                await this.sock.sendMessage(remoteJid, { text: response });

                console.log(`   🕐 Fora do horário: ${response}\n`);

                // Salvar mensagens
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

            // Processar com NLP
            const nlpResult = await this.nlp.analyze(messageText, remoteJid);

            console.log(`   🧠 Intent: ${nlpResult.intent} (${(nlpResult.confidence * 100).toFixed(1)}%)`);

            // Salvar mensagem recebida
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

            // Enviar resposta
            const response = nlpResult.response;

            await this.sock.sendMessage(remoteJid, { text: response });

            console.log(`   ✅ Resposta: ${response.substring(0, 50)}...\n`);

            // Salvar resposta do bot
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

            // Se deve coletar dados do lead
            if (nlpResult.shouldCollectData && Object.keys(nlpResult.entities).length > 0) {
                // Atualizar lead com entidades extraídas
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

// Iniciar bot
const bot = new WhatsAppBot();

bot.initialize().catch((error) => {
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
