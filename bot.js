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

const { buildPolicy, guardrailMessages } = require('./src/policy/engine.js');

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

const processedMessages = new Set();

const MAX_RETRY = 5;
const MAX_DECRYPT_ERRORS = 10;
const DECRYPT_ERROR_WINDOW = 60000;

// ====== ANTI-SPAM / DEBOUNCE POR CHAT (responder 1x por rajada) ======
const pendingByJid = new Map(); // jid -> { texts: [], timer, lastMsg, type }
const lastReplyAt = new Map();  // jid -> timestamp

const REPLY_DEBOUNCE_MS = 2200;       // espera a pessoa “terminar de digitar”
const MIN_REPLY_INTERVAL_MS = 9000;   // evita responder em loop

// Se você usa WhatsApp pessoal, isso salva sua vida:
const RESPOND_ONLY_TO_BUSINESS = (process.env.BOT_ONLY_BUSINESS || 'true') === 'true';

// Heurística simples pra detectar “mensagem de negócio”
const BUSINESS_HINT_RE = /\b(site|landing|página|pagina|tráfego|trafego|anúncio|anuncio|automação|automacao|bot|whatsapp|orçamento|orcamento|preço|preco|valor|contrato|fechar|pix|cartão|cartao|parcel|agenda|agendar|call|reuni|demo)\b/i;

// Heurística simples pra detectar agressão/xingamento
const ABUSE_RE = /\b(tmnc|corno|mane|fdp|vsf|porra|caralho)\b/i;

function isBusinessLike(text) {
  const t = (text || '').trim();
  if (!t) return false;
  if (BUSINESS_HINT_RE.test(t)) return true;

  // “oi” sozinho pode ser lead novo — você escolhe:
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite)\b/i.test(t)) return true;

  return false;
}

function shouldIgnoreMessage({ jid, text, lead }) {
  // Se for contato pessoal zoando, você pode ignorar totalmente:
  if (RESPOND_ONLY_TO_BUSINESS) {
    const knownLead = !!(lead && (lead.name || lead.company || lead.email));
    if (!knownLead && !isBusinessLike(text)) return true;
  }
  return false;
}

function buildBoundaryReply(text) {
  // Resposta “comercial” e curta quando chega ofensa/zoeira
  // (não entra na pilha do Gemini)
  if (ABUSE_RE.test(text || '')) {
    return [
      "prefiro manter o respeito por aqui.",
      "se for sobre site, tráfego ou atendimento no WhatsApp, me diz rapidinho o que vc precisa."
    ];
  }
  return null;
}

async function enqueueIncomingMessage(msg, ctx) {
  const { jid, text, type } = ctx;

  const now = Date.now();
  const last = lastReplyAt.get(jid) || 0;

  // se já respondeu há pouco tempo, segura um pouco (evita loop)
  const tooSoon = (now - last) < MIN_REPLY_INTERVAL_MS;

  const entry = pendingByJid.get(jid) || { texts: [], timer: null, lastMsg: null, type };
  entry.texts.push(text);
  entry.lastMsg = msg;
  entry.type = type;

  if (entry.timer) clearTimeout(entry.timer);

  entry.timer = setTimeout(async () => {
    pendingByJid.delete(jid);

    const combined = entry.texts
      .map(t => String(t || '').trim())
      .filter(Boolean)
      .slice(-8) // não precisa mais que isso
      .join('\n');

    try {
      if (tooSoon) await new Promise(r => setTimeout(r, 1500));
      await handleMessageCombined(entry.lastMsg, combined, entry.type);
      lastReplyAt.set(jid, Date.now());
    } catch (e) {
      console.log('   ⚠️ debounce handler error:', e.message);
    }
  }, REPLY_DEBOUNCE_MS);

  pendingByJid.set(jid, entry);
}

// ==================== SESSÃO ====================

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

function closeRl() {
  if (rl) try { rl.close(); } catch {}
  rl = null;
}

// ==================== CONEXÃO ====================

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
        if (processedMessages.has(msg.key.id)) return;
        processedMessages.add(msg.key.id);
        setTimeout(() => processedMessages.delete(msg.key.id), 120000);

        try {
          const jid = msg.key.remoteJid;
            const text = extractText(msg);
            const type = jid.endsWith('@g.us') ? 'group' : 'private';

            if (!text?.trim()) return;

            // Em vez de responder msg a msg, junta em uma resposta só:
            await enqueueIncomingMessage(msg, { jid, text, type });

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

    await db.ensureReady(); // garante init concluído
    console.log(`✅ Banco: ${db.isReady() ? 'conectado' : 'desativado'}`);

} catch (e) {
  console.log('⚠️  Sem banco:', e.message, {
    hasAccountId: !!config.cloudflare.accountId,
    hasDatabaseId: !!config.cloudflare.databaseId,
    hasApiToken: !!config.cloudflare.apiToken
  });
  db = null;
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

// SUBSTITUA sua função handleMessage(msg) por esta versão:

const { evaluatePolicy } = require('./src/nlp/policy-engine.js');

async function runActions(db, jid, leadId, actions = []) {
  if (!db || !Array.isArray(actions) || actions.length === 0) return;

  for (const action of actions) {
    const type = action?.type;
    const payload = action?.payload || {};

    try {
      if (type === 'set_stage') {
        if (payload.stage) await db.updateConversation(jid, { stage: payload.stage });
      }

      if (type === 'upsert_deal') {
        await db.upsertDeal(jid, leadId, payload);
      }

      if (type === 'create_appointment') {
        await db.createAppointment(jid, leadId, payload);
      }
    } catch (e) {
      console.log(`   ⚠️ ActionRunner erro (${type}): ${e.message}`);
    }
  }
}

async function handleMessageCombined(msg, combinedText, type) {
  if (msg.key.fromMe) return;
  if (!msg.message) return;
  if (msg.key.remoteJid?.includes('@newsletter')) return;
  if (msg.key.remoteJid === 'status@broadcast') return;

  const jid = msg.key.remoteJid;

  console.log(`\n📨 [${type}] ${jid.split('@')[0]}`);
  console.log(`   💬 "${combinedText.substring(0, 80)}${combinedText.length > 80 ? '...' : ''}"`);

  if (type === 'group') {
    console.log('   ⏭️ Grupo ignorado');
    return;
  }

  // 1) Carrega memória (lead)
  let currentLead = null;
  if (db) {
    try {
      const phone = jid.split('@')[0];
      if (db.getLeadByPhone) currentLead = await db.getLeadByPhone(phone);
      else {
        const result = await db.run(`SELECT * FROM leads WHERE phone = ? LIMIT 1`, [phone]);
        currentLead = result?.results ? result.results[0] : null;
      }
    } catch (e) {
      console.log('   ⚠️ Erro ao ler memória:', e.message);
    }
  }

  // 2) Filtro “não comercial”
  if (shouldIgnoreMessage({ jid, text: combinedText, lead: currentLead })) {
    console.log('   ⏭️ Ignorado (não comercial / sem lead)');
    return;
  }

  // 3) Se veio agressão/xingamento: NÃO chama Gemini
  const boundary = buildBoundaryReply(combinedText);
  if (boundary) {
    for (const part of boundary) {
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
      await sock.sendMessage(jid, { text: part });
      await sock.sendPresenceUpdate('paused', jid);
      await new Promise(r => setTimeout(r, 650));
    }
    console.log('   ✅ Enviado (boundary)');
    return;
  }

  // 4) NLP (se você estiver em full_gemini, ele já cai pro Gemini)
  const nlpResult = config.bot?.mode === 'full_gemini'
    ? { intent: 'unknown', confidence: 0, action: 'GEMINI', entities: {}, state: {} }
    : await nlpAnalyzer.analyze(combinedText, jid, sock);

  // 5) Roteia com memória
  const { response: finalResponse, method, crmUpdate, actions } = await llmRouter.route(
    combinedText,
    nlpResult,
    nlpResult.state,
    jid,
    currentLead || {}
  );

  console.log(`   📤 Method: ${method.used}${method.geminiCalled ? ' (Gemini chamado)' : ''}`);

  // 6) Envia (1–2 bolhas)
  if (finalResponse) {
    const parts = finalResponse.split('<split>').map(x => x.trim()).filter(Boolean).slice(0, 2);

    for (const part of parts) {
      const reactionTime = 1400 + Math.random() * 900;
      const typingSpeed = 55 + Math.random() * 35;
      const typingTime = part.length * typingSpeed;
      const totalDelay = Math.min(reactionTime + typingTime, 11000);

      await sock.sendPresenceUpdate('composing', jid);
      await new Promise(r => setTimeout(r, totalDelay));
      await sock.sendMessage(jid, { text: part });
      await sock.sendPresenceUpdate('paused', jid);
      await new Promise(r => setTimeout(r, 700));
    }
    console.log(`   ✅ Enviado (${parts.length} partes)`);
  }

  // 7) CRM update (opcional)
  if (crmUpdate && db) {
    try {
      const phone = jid.split('@')[0];
      await db.saveLead({
        phone,
        name: crmUpdate.nome || null,
        email: crmUpdate.email || null,
        company: crmUpdate.empresa || null,
        tags: crmUpdate.dor ? [crmUpdate.dor] : null,
        notes: crmUpdate.dor || null
      });
      console.log('   💾 CRM atualizado');
    } catch (e) {
      console.log(`   ⚠️ Erro CRM: ${e.message}`);
    }
  }

  // 8) (se você estiver usando actions) execute aqui:
  if (Array.isArray(actions) && actions.length && db) {
    try {
      const phone = jid.split('@')[0];
      const leadId = currentLead?.id || await db.saveLead({ phone });
      await runActions(db, jid, leadId, actions);
    } catch (e) {
      console.log(`   ⚠️ Actions erro: ${e.message}`);
    }
  }
}


function extractText(msg) {
  const m = msg.message;
  return m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption || m?.videoMessage?.caption || '';
}

// ==================== SHUTDOWN ====================

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

// ==================== START ====================

console.log('━'.repeat(50));
console.log('🤖 IMPÉRIO LORD - WhatsApp Bot');
console.log('━'.repeat(50));
console.log('');

connectToWhatsApp();
