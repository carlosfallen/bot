// FILE: bot.js
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

const nlpAnalyzer = require('./src/nlp/analyzer.js');
const llmRouter = require('./src/nlp/llm-router.js');
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

// CACHE DE MENSAGENS (EVITA DUPLICIDADE)
const processedMessages = new Set();

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
            printQRInTerminal: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ['Império Lord', 'Chrome', '22.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 500,
            qrTimeout: 60000,
            getMessage: async () => undefined
        });

        sock.ev.on('creds.update', async () => {
            try { await saveCreds(); } catch (e) { console.error('❌ Erro ao salvar creds:', e.message); }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !pairingRequested) {
                console.log('\n📱 ESCANEIE O QR CODE:');
                qrcode.generate(qr, { small: true });
                if (!isRegistered && !pairingRequested) offerPairingCode();
            }

            if (connection === 'connecting') console.log('🔄 Conectando...');

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`❌ Desconectado: ${statusCode}`);
                pairingRequested = false;

                switch (statusCode) {
                    case DisconnectReason.loggedOut:
                        fullClearSession();
                        setTimeout(() => process.exit(0), 1000);
                        break;
                    case DisconnectReason.badSession:
                        clearSession();
                        retryCount = 0;
                        setTimeout(connectToWhatsApp, 2000);
                        break;
                    case DisconnectReason.connectionClosed:
                    case DisconnectReason.connectionLost:
                    case DisconnectReason.timedOut:
                        retryCount++;
                        setTimeout(connectToWhatsApp, Math.min(retryCount * 2000, 30000));
                        break;
                    case DisconnectReason.restartRequired:
                        setTimeout(connectToWhatsApp, 1000);
                        break;
                    case DisconnectReason.multideviceMismatch:
                        fullClearSession();
                        setTimeout(connectToWhatsApp, 3000);
                        break;
                    default:
                        retryCount++;
                        if (retryCount < MAX_RETRY) setTimeout(connectToWhatsApp, 3000);
                        else { clearSession(); retryCount = 0; setTimeout(connectToWhatsApp, 5000); }
                }
            }

            if (connection === 'open') {
                console.log('\n' + '━'.repeat(50));
                console.log('✅ CONECTADO AO WHATSAPP!');
                console.log(`🤖 Gemini: ${config.gemini.enabled && llmRouter.enabled ? 'ATIVO' : 'DESATIVADO'}`);
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

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify' || !messages?.length) return;

            for (const msg of messages) {
                // FILTRO ANTI-DUPLICIDADE
                if (processedMessages.has(msg.key.id)) return;
                processedMessages.add(msg.key.id);
                // Limpa o ID da memória depois de 2 minutos para não vazar memória
                setTimeout(() => processedMessages.delete(msg.key.id), 120000);

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

        async function offerPairingCode() {
            if (pairingRequested || isRegistered) return;
            
            console.log('━'.repeat(50));
            console.log('📲 PAREAMENTO POR CÓDIGO (alternativa ao QR)');
            console.log('━'.repeat(50));
            
            createRl();
            
            rl.question('\nDigite seu número (ex: 5511999999999) ou ENTER para QR: ', async (phone) => {
                if (!phone?.trim()) return console.log('📱 Ok! Use o QR code.');

                const cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.length < 10) return console.log('❌ Número inválido.');

                pairingRequested = true;

                try {
                    console.log('\n⏳ Gerando código...\n');
                    await new Promise(r => setTimeout(r, 3000));
                    
                    const code = await sock.requestPairingCode(cleanPhone);
                    
                    console.log('━'.repeat(50));
                    console.log(`🔑 CÓDIGO: ${code}`);
                    console.log('━'.repeat(50));
                    console.log('📱 WhatsApp > Dispositivos > Conectar com número');
                    console.log('⏰ Expira em 60 segundos!');
                } catch (e) {
                    console.error('❌ Erro:', e.message);
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

function handleDecryptError() {
    const now = Date.now();
    if (now - lastDecryptError > DECRYPT_ERROR_WINDOW) {
        decryptErrorCount = 0;
    }
    
    decryptErrorCount++;
    lastDecryptError = now;
    
    console.log(`⚠️  Erro de Criptografia (Bad MAC) (${decryptErrorCount}/${MAX_DECRYPT_ERRORS})`);

    if (decryptErrorCount > 3) {
        console.log('☢️  Sessão corrompida detectada. Iniciando Auto-Reparo...');
        if (sock) sock.end(undefined);
        
        const fs = require('fs');
        if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log('🗑️  Sessão antiga removida.');
        }

        decryptErrorCount = 0;
        console.log('🔄 Reiniciando bot do zero em 3 segundos...');
        setTimeout(connectToWhatsApp, 3000);
    }
}

async function initBackend() {
    const useEmbeddings = config.nlp?.useEmbeddings || false;
    
    if (useEmbeddings) {
        try {
            console.log('\n🧠 Inicializando NLP...');
            await nlpAnalyzer.initializeEmbeddings();
            nlpReady = true;
            console.log('✅ NLP ativo');
        } catch (e) {
            console.log('⚠️  NLP fallback (Full Gemini)');
            nlpReady = true;
        }
    } else {
        console.log('\n🤖 Full Gemini Mode (embeddings desabilitados)');
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

// ==================== PROCESSAR MENSAGEM (COM LLM ROUTER) ====================

async function handleMessage(msg) {
    if (msg.key.fromMe) return;
    if (!msg.message) return;
    if (msg.key.remoteJid?.includes('@newsletter')) return;
    if (msg.key.remoteJid === 'status@broadcast') return;

    const jid = msg.key.remoteJid;
    const text = extractText(msg);
    const type = jid.endsWith('@g.us') ? 'group' : 'private';

    if (!text?.trim()) return;

    console.log(`\n📨 [${type}] ${jid.split('@')[0]}`);
    console.log(`   💬 "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

    if (type === 'group') {
        console.log('   ⏭️ Grupo ignorado');
        return;
    }

    if (!nlpReady) await new Promise(r => setTimeout(r, 1000));

    try {
        const nlpResult = config.bot?.mode === 'full_gemini' 
            ? { intent: 'unknown', confidence: 0, action: 'GEMINI', entities: {}, state: {} }
            : await nlpAnalyzer.analyze(text, jid, sock);

        if (config.bot?.mode !== 'full_gemini') {
            console.log(`   🎯 ${nlpResult.intent} (${Math.round(nlpResult.confidence * 100)}%) → ${nlpResult.action}`);
        }

        const { response: finalResponse, method, crmUpdate } = await llmRouter.route(
            text, 
            nlpResult, 
            nlpResult.state, 
            jid
        );

        console.log(`   📤 Method: ${method.used}${method.geminiCalled ? ' (Gemini chamado)' : ''}`);

        // 3) Processar CRM Update
        if (crmUpdate && db) {
            try {
                const phone = jid.split('@')[0];
                console.log(`   📊 CRM Update:`, JSON.stringify(crmUpdate));
                
                await db.saveLead({
                    phone,
                    name: crmUpdate.nome || null,
                    email: crmUpdate.email || null,
                    company: crmUpdate.empresa || null,
                    tags: crmUpdate.dor ? [crmUpdate.dor] : null,
                    notes: crmUpdate.dor || null
                });

                if (crmUpdate.status) {
                    const conv = await db.getConversationByChatId(jid);
                    if (conv) {
                        await db.updateConversation(jid, { stage: crmUpdate.status });
                    }
                }
                
                console.log(`   💾 CRM atualizado`);
            } catch (e) {
                console.log(`   ⚠️ Erro CRM: ${e.message}`);
            }
        }

// 4) Enviar resposta com SIMULAÇÃO DE DIGITAÇÃO INDIVIDUAL (REALISTA)
            if (finalResponse) {
                const parts = finalResponse.split('<split>');

                for (const part of parts) {
                    const cleanPart = part.trim();
                    if (cleanPart) {
                        
                        // --- CÁLCULO DE TEMPO DESTA MENSAGEM ESPECÍFICA ---
                        // Reação inicial (pensar antes de digitar): 1 a 2 segundos
                        const thinkingTime = 1000 + Math.random() * 1000;
                        
                        // Velocidade de digitação: 50ms a 80ms por letra
                        const typingSpeed = 50 + Math.random() * 30; 
                        
                        // Tempo total digitando ESTA parte
                        const typingTime = cleanPart.length * typingSpeed;
                        
                        // Tempo total do delay (Teto máximo de 12s para não travar)
                        const totalDelay = Math.min(thinkingTime + typingTime, 12000);

                        // --- SEQUÊNCIA DE AÇÕES ---
                        
                        // 1. Avisa que está digitando (específico para esta parte)
                        await sock.sendPresenceUpdate('composing', jid);

                        // 2. Espera o tempo simulado de digitação
                        await new Promise(r => setTimeout(r, totalDelay));

                        // 3. Envia a mensagem
                        await sock.sendMessage(jid, { text: cleanPart });

                        // 4. Pausa o "digitando"
                        await sock.sendPresenceUpdate('paused', jid);
                        
                        // 5. Pequeno respiro entre mensagens (se tiver mais de uma)
                        // Isso evita que a segunda mensagem cole instantaneamente na primeira
                        await new Promise(r => setTimeout(r, 500)); 
                    }
                }
                
                console.log(`   ✅ Enviado (${parts.length} partes sequenciais)`);
            }

        // 5) Salvar no banco
        if (db) {
            try {
                const phone = jid.split('@')[0];
                const leadId = await db.saveLead({
                    phone,
                    name: nlpResult.entities?.name || nlpResult.state?.cliente?.nome || null,
                    email: nlpResult.entities?.email || null,
                    company: nlpResult.entities?.company || null
                });
                
                const conv = await db.getOrCreateConversation(jid, leadId, type);
                
                if (nlpResult.state?.stage || nlpResult.state?.assunto) {
                    await db.updateConversation(jid, {
                        stage: nlpResult.state.stage,
                        assunto: nlpResult.state.assunto,
                        plano: nlpResult.state.plano
                    });
                }
                
                await db.saveMessage(conv.id, { 
                    messageId: msg.key.id, 
                    direction: 'incoming', 
                    text, 
                    intent: nlpResult.intent, 
                    confidence: nlpResult.confidence, 
                    entities: nlpResult.entities, 
                    isBot: false 
                });
                
                if (finalResponse) {
                    await db.saveMessage(conv.id, { 
                        messageId: null, 
                        direction: 'outgoing', 
                        text: finalResponse, 
                        intent: nlpResult.intent,
                        isBot: true,
                        method: method.used
                    });
                }
                console.log(`   💾 Salvo no banco (conv: ${conv.id})`);
            } catch (e) {
                console.log(`   ⚠️ Erro banco: ${e.message}`);
            }
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

// ==================== SHUTDOWN MUITO SEGURO ====================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n🛑 Recebido ${signal}. Salvando sessão e desconectando...`);

    try {
        if (sock) {
            sock.end(undefined);
            console.log('🔌 Socket fechado.');
        }
        console.log('💾 Aguardando gravação dos arquivos de sessão (3s)...');
        await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
        console.error('Erro ao desligar:', e.message);
    } finally {
        console.log('✅ Pronto. Pode reiniciar.');
        process.exit(0);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));   
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); 
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); 

process.on('uncaughtException', (err) => {
    console.error('❌ Erro Fatal (Uncaught):', err);
    gracefulShutdown('FATAL_ERROR');
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Erro de Promise (Unhandled):', reason);
});

// ==================== INICIAR ====================

console.log('━'.repeat(50));
console.log('🤖 IMPÉRIO LORD - WhatsApp Bot');
console.log('━'.repeat(50));
console.log('');

connectToWhatsApp();