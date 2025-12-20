// FILE: bot.js
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

const nlpAnalyzer = require('./src/nlp/analyzer.js');
const CloudflareD1 = require('./src/database/d1.js');
const BotAPI = require('./src/api/server.js');
const config = require('./src/config/index.js');

const logger = P({ level: 'silent' });
const AUTH_FOLDER = path.join(process.cwd(), 'auth_info');

let rl = null;
let sock = null;
let db = null;
let api = null;
let retryCount = 0;
let decryptErrorCount = 0;
let lastDecryptError = 0;
let backendReady = false;
let nlpReady = false;
let pairingRequested = false;

const MAX_RETRY = 5;
const MAX_DECRYPT_ERRORS = 10;
const DECRYPT_ERROR_WINDOW = 60000;

// ==================== GERENCIAMENTO DE SESSÃO ====================

function clearSession() {
    console.log('🗑️  Limpando sessão corrompida...');
    try {
        if (fs.existsSync(AUTH_FOLDER)) {
            const files = fs.readdirSync(AUTH_FOLDER);
            for (const file of files) {
                if (file !== 'creds.json') {
                    const filePath = path.join(AUTH_FOLDER, file);
                    fs.rmSync(filePath, { recursive: true, force: true });
                }
            }
            console.log('✅ Sessions limpas');
        }
    } catch (e) {
        console.error('❌ Erro ao limpar sessão:', e.message);
    }
}

function fullClearSession() {
    console.log('🗑️  Limpando sessão COMPLETA...');
    try {
        if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log('✅ Sessão removida');
        }
    } catch (e) {
        console.error('❌ Erro:', e.message);
    }
}

// ==================== READLINE ====================

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

// ==================== CONEXÃO PRINCIPAL ====================

async function connectToWhatsApp() {
    try {
        if (retryCount >= MAX_RETRY) {
            console.log('⚠️  Muitas tentativas, limpando sessão...');
            clearSession();
            retryCount = 0;
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version } = await fetchLatestBaileysVersion();
        const isRegistered = state.creds?.registered;

        console.log(`📱 Sessão: ${isRegistered ? 'Registrada' : 'Nova'}`);

        sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger,
            printQRInTerminal: true, // ATIVAR QR NO TERMINAL
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ['Império Lord', 'Chrome', '22.0'],
            connectTimeoutMs: 120000, // 2 minutos
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 500,
            qrTimeout: 60000, // 60 segundos por QR
            getMessage: async () => undefined
        });

        // ===== SALVAR CREDENCIAIS =====
        sock.ev.on('creds.update', async () => {
            try {
                await saveCreds();
            } catch (e) {
                console.error('❌ Erro ao salvar creds:', e.message);
            }
        });

        // ===== EVENTOS DE CONEXÃO =====
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR CODE - mostrar no terminal
            if (qr && !pairingRequested) {
                console.log('\n📱 ESCANEIE O QR CODE ABAIXO:');
                console.log('   (Ou use o código de pareamento)\n');
                qrcode.generate(qr, { small: true });
                console.log('\n');
                
                // Oferecer código de pareamento também
                if (!isRegistered && !pairingRequested) {
                    offerPairingCode();
                }
            }

            if (connection === 'connecting') {
                console.log('🔄 Conectando ao WhatsApp...');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.output?.payload?.error;
                
                console.log(`❌ Desconectado: ${statusCode} - ${reason || 'unknown'}`);
                pairingRequested = false;

                switch (statusCode) {
                    case DisconnectReason.loggedOut:
                        console.log('🚪 Logout. Limpando sessão...');
                        fullClearSession();
                        setTimeout(() => process.exit(0), 1000);
                        break;

                    case DisconnectReason.badSession:
                        console.log('🔧 Sessão corrompida. Limpando...');
                        clearSession();
                        retryCount = 0;
                        setTimeout(connectToWhatsApp, 2000);
                        break;

                    case DisconnectReason.connectionClosed:
                    case DisconnectReason.connectionLost:
                    case DisconnectReason.timedOut:
                        retryCount++;
                        const delay = Math.min(retryCount * 2000, 30000);
                        console.log(`🔄 Reconectando em ${delay/1000}s... (${retryCount}/${MAX_RETRY})`);
                        setTimeout(connectToWhatsApp, delay);
                        break;

                    case DisconnectReason.restartRequired:
                        console.log('🔄 Restart necessário...');
                        setTimeout(connectToWhatsApp, 1000);
                        break;

                    case DisconnectReason.multideviceMismatch:
                        console.log('📱 Conflito. Limpando sessão...');
                        fullClearSession();
                        setTimeout(connectToWhatsApp, 3000);
                        break;

                    default:
                        retryCount++;
                        if (retryCount < MAX_RETRY) {
                            setTimeout(connectToWhatsApp, 3000);
                        } else {
                            clearSession();
                            retryCount = 0;
                            setTimeout(connectToWhatsApp, 5000);
                        }
                }
            }

            if (connection === 'open') {
                console.log('\n' + '━'.repeat(50));
                console.log('✅ CONECTADO AO WHATSAPP!');
                console.log('━'.repeat(50));
                
                retryCount = 0;
                decryptErrorCount = 0;
                pairingRequested = false;
                closeRl();

                if (!backendReady) {
                    backendReady = true;
                    await initBackend();
                }
            }
        });

        // ===== RECEBER MENSAGENS =====
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify' || !messages?.length) return;

            for (const msg of messages) {
                try {
                    await handleMessage(msg);
                } catch (e) {
                    if (e.message?.includes('decrypt') || e.message?.includes('Bad MAC')) {
                        handleDecryptError();
                    } else {
                        console.error('❌ Erro:', e.message);
                    }
                }
            }
        });

        // ===== PAREAMENTO POR CÓDIGO =====
        async function offerPairingCode() {
            if (pairingRequested || isRegistered) return;
            
            console.log('━'.repeat(50));
            console.log('📲 OPÇÃO 2: PAREAMENTO POR CÓDIGO');
            console.log('━'.repeat(50));
            
            createRl();
            
            rl.question('\nDigite seu número com DDI (ex: 5511999999999)\nOu pressione ENTER para usar apenas QR: ', async (phone) => {
                if (!phone || phone.trim() === '') {
                    console.log('📱 Ok! Use o QR code acima.');
                    return;
                }

                const cleanPhone = phone.replace(/\D/g, '');
                
                if (cleanPhone.length < 10) {
                    console.log('❌ Número inválido. Use o QR code.');
                    return;
                }

                pairingRequested = true;

                try {
                    console.log('\n⏳ Gerando código de pareamento...\n');
                    
                    // Aguardar socket estar pronto
                    await new Promise(r => setTimeout(r, 3000));
                    
                    const code = await sock.requestPairingCode(cleanPhone);
                    
                    console.log('━'.repeat(50));
                    console.log('🔑 CÓDIGO DE PAREAMENTO:');
                    console.log('');
                    console.log(`   >>>  ${code}  <<<`);
                    console.log('');
                    console.log('━'.repeat(50));
                    console.log('');
                    console.log('📱 No celular, vá em:');
                    console.log('   WhatsApp > Menu (⋮) > Dispositivos conectados');
                    console.log('   > Conectar dispositivo > CONECTAR COM NÚMERO');
                    console.log('');
                    console.log('⏰ O código expira em 60 segundos!');
                    console.log('━'.repeat(50));
                    
                } catch (e) {
                    console.error('❌ Erro ao gerar código:', e.message);
                    console.log('📱 Use o QR code no lugar.');
                    pairingRequested = false;
                }
            });
        }

    } catch (e) {
        console.error('❌ Erro na conexão:', e.message);
        retryCount++;
        setTimeout(connectToWhatsApp, 5000);
    }
}

// ==================== TRATAMENTO DE ERRO DE DECRYPT ====================

function handleDecryptError() {
    const now = Date.now();
    
    if (now - lastDecryptError > DECRYPT_ERROR_WINDOW) {
        decryptErrorCount = 0;
    }
    
    decryptErrorCount++;
    lastDecryptError = now;
    
    console.log(`⚠️  Erro de decrypt (${decryptErrorCount}/${MAX_DECRYPT_ERRORS})`);

    if (decryptErrorCount >= MAX_DECRYPT_ERRORS) {
        console.log('🔧 Muitos erros. Limpando sessions...');
        clearSession();
        decryptErrorCount = 0;
        
        if (sock) sock.end();
        setTimeout(connectToWhatsApp, 3000);
    }
}

// ==================== BACKEND ====================

async function initBackend() {
    try {
        console.log('\n🧠 Inicializando NLP...');
        await nlpAnalyzer.initializeEmbeddings();
        nlpReady = true;
        console.log('✅ NLP ativo');
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

// ==================== PROCESSAR MENSAGEM ====================

async function handleMessage(msg) {
    if (msg.key.fromMe) return;
    if (!msg.message) return;
    if (msg.key.remoteJid?.includes('@newsletter')) return;
    if (msg.key.remoteJid === 'status@broadcast') return;

    const jid = msg.key.remoteJid;
    const text = extractText(msg);
    const type = jid.endsWith('@g.us') ? 'group' : 'private';

    if (!text?.trim()) return;

    console.log(`\n📨 [${type}] ${jid}`);
    console.log(`   💬 "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

    if (type === 'group') {
        console.log('   ⏭️ Grupo ignorado');
        return;
    }

    if (!nlpReady) {
        await new Promise(r => setTimeout(r, 1000));
    }

    try {
        const result = await nlpAnalyzer.analyze(text, jid, sock);
        console.log(`   🎯 ${result.intent}`);

        if (result.response) {
            await sock.sendMessage(jid, { text: result.response });
            console.log('   ✅ Enviado');
        }

        // Salvar no banco (silencioso)
        if (db) {
            try {
                const phone = jid.split('@')[0];
                const leadId = await db.saveLead({
                    phone,
                    name: result.entities?.name || null,
                    email: result.entities?.email || null,
                    company: result.entities?.company || null,
                    tags: []
                });
                const conv = await db.getOrCreateConversation(jid, leadId, type);
                await db.saveMessage(conv.id, { messageId: msg.key.id, direction: 'incoming', text, intent: result.intent, confidence: result.confidence, entities: result.entities, isBot: false });
                await db.saveMessage(conv.id, { messageId: null, direction: 'outgoing', text: result.response, intent: result.intent, isBot: true });
            } catch {}
        }

    } catch (e) {
        console.error('   ❌', e.message);
        try {
            await sock.sendMessage(jid, { text: 'Desculpa, tive um probleminha. Pode repetir?' });
        } catch {}
    }
}

function extractText(msg) {
    const m = msg.message;
    return m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption || m?.videoMessage?.caption || '';
}

// ==================== SHUTDOWN ====================

process.on('SIGINT', () => { closeRl(); process.exit(0); });
process.on('SIGTERM', () => { closeRl(); process.exit(0); });
process.on('uncaughtException', (e) => {
    console.error('❌ Exception:', e.message);
    if (e.message?.includes('decrypt')) handleDecryptError();
});

// ==================== INICIAR ====================

console.log('━'.repeat(50));
console.log('🤖 IMPÉRIO LORD - WhatsApp Bot');
console.log('━'.repeat(50));
console.log('');

connectToWhatsApp();