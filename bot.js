// FILE: bot.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

require('dotenv').config();

// Imports
let gemini, db, r2, BotAPI;
try { gemini = require('./src/llm/gemini.js'); console.log('✅ Gemini loaded'); } catch (e) { console.log('⚠️ Gemini:', e.message); }
try { 
  const CloudflareD1 = require('./src/database/d1.js');
  db = new CloudflareD1({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN
  });
  console.log('✅ Database loaded');
} catch (e) { console.log('⚠️ Database:', e.message); }
try { r2 = require('./src/storage/r2.js'); } catch (e) { console.log('⚠️ R2:', e.message); }
try { BotAPI = require('./src/api/server.js'); } catch (e) { console.log('⚠️ API:', e.message); }

// Config
const SESSION_DIR = './sessions';
const logger = pino({ level: 'silent' });

// Imagens de exemplo (URLs ou paths)
const EXAMPLE_IMAGES = {
  site: 'https://pub-a440f87c823745bc855a21afc18c3f49.r2.dev/examples/site-exemplo.jpg',
  ecommerce: 'https://pub-a440f87c823745bc855a21afc18c3f49.r2.dev/examples/loja-exemplo.jpg',
  landing: 'https://pub-a440f87c823745bc855a21afc18c3f49.r2.dev/examples/landing-exemplo.jpg',
  trafego: 'https://pub-a440f87c823745bc855a21afc18c3f49.r2.dev/examples/trafego-exemplo.jpg'
};

let sock = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

const botConfig = {
  bot_enabled: true,
  respond_to_groups: false,
  respond_to_channels: false,
  typing_simulation: true,
  typing_speed: 40,
  min_response_delay: 800,
  max_response_delay: 2500,
  auto_save_leads: true,
  send_audio_responses: true,
  audio_chance: 0.15,
  audio_min_interval: 5,
  send_example_images: true
};

// ==================== START ====================
async function startBot() {
  if (isConnecting) return;
  isConnecting = true;

  console.log('\n📱 Iniciando bot...');

  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    if (db) await db.ensureReady().catch(() => {});

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`📦 Baileys v${version.join('.')}`);
    if (gemini) console.log(`🤖 Gemini: ${gemini.isConfigured() ? '✅ ' + gemini.getStatus().model : '❌'}`);
    if (db) console.log(`💾 Database: ${db.isReady() ? '✅' : '❌'}`);
    if (r2) console.log(`📁 R2 Storage: ${r2.isReady() ? '✅' : '❌'}`);

    sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger,
      browser: ['Império Lord Bot', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      getMessage: async () => ({ conversation: '' })
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n' + '━'.repeat(50));
        console.log('📱 ESCANEIE O QR CODE:');
        console.log('━'.repeat(50) + '\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        isConnecting = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`\n❌ Desconectado: ${code}`);

        if (code === DisconnectReason.loggedOut || code === 401) {
          await clearSession();
          reconnectAttempts = 0;
          setTimeout(startBot, 3000);
        } else if (reconnectAttempts++ < MAX_RECONNECT) {
          const wait = Math.min(reconnectAttempts * 5000, 60000);
          console.log(`🔄 Reconectando em ${wait / 1000}s...`);
          setTimeout(startBot, wait);
        } else {
          await clearSession();
          reconnectAttempts = 0;
          setTimeout(startBot, 10000);
        }
      }

      if (connection === 'connecting') console.log('🔄 Conectando...');

      if (connection === 'open') {
        isConnecting = false;
        reconnectAttempts = 0;
        console.log('\n' + '━'.repeat(50));
        console.log('✅ CONECTADO!');
        console.log(`👤 ${sock.user?.name || 'Bot'}`);
        console.log(`📞 ${sock.user?.id?.split(':')[0] || ''}`);
        console.log('━'.repeat(50) + '\n');
        
        await loadConfig();
        
        if (BotAPI && db) {
          const api = new BotAPI(db, { getSocket: () => sock });
          api.start();
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          await handleMessage(msg);
        } catch (err) {
          console.error('❌ Erro:', err.message);
        }
      }
    });

  } catch (err) {
    console.error('❌ Erro ao iniciar:', err.message);
    isConnecting = false;
    setTimeout(startBot, 5000);
  }
}

async function clearSession() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.readdirSync(SESSION_DIR).forEach(f => fs.unlinkSync(path.join(SESSION_DIR, f)));
      console.log('✅ Sessão limpa');
    }
  } catch (e) { console.error('Erro limpando sessão:', e.message); }
}

async function loadConfig() {
  try {
    const res = await fetch(`http://localhost:${process.env.PORT || 3512}/api/config`);
    if (res.ok) {
      const data = await res.json();
      for (const [key, cfg] of Object.entries(data)) {
        if (botConfig.hasOwnProperty(key)) botConfig[key] = cfg.value;
      }
      console.log('✅ Configurações carregadas');
    }
  } catch {
    if (db?.isReady()) {
      try {
        const configs = await db.getAllConfig();
        for (const [key, cfg] of Object.entries(configs)) {
          if (botConfig.hasOwnProperty(key)) botConfig[key] = cfg.value;
        }
        console.log('✅ Configurações do DB');
      } catch {}
    }
  }
}

// ==================== HANDLE MESSAGE ====================
async function handleMessage(msg) {
  if (msg.key.fromMe) return;
  if (msg.key.remoteJid === 'status@broadcast') return;

  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  const isChannel = chatId.endsWith('@newsletter');
  const pushName = msg.pushName || '';
  const phone = chatId.split('@')[0];

  const msgData = await parseMessage(msg);
  if (!msgData) return;

  const icon = isGroup ? '👥' : isChannel ? '📢' : '👤';
  console.log(`\n${icon} [${new Date().toLocaleTimeString()}] ${pushName || phone}`);
  console.log(`   📨 ${msgData.type}: ${(msgData.text || msgData.caption || '').substring(0, 60)}...`);

  if (isChannel && !botConfig.respond_to_channels) return;
  if (isGroup && !botConfig.respond_to_groups) return;
  if (!botConfig.bot_enabled) { console.log('   ⏭️ Bot desativado'); return; }

  try {
    let conversation = null;
    let lead = null;

    if (db?.isReady()) {
      if (!isGroup && botConfig.auto_save_leads) {
        lead = await db.getLeadByPhone(phone);
        if (!lead) {
          await db.saveLead({ phone, name: pushName, source: 'whatsapp' });
          lead = await db.getLeadByPhone(phone);
        }
      }

      conversation = await db.getOrCreateConversation(
        chatId,
        lead?.id || null,
        isGroup ? 'group' : 'private',
        pushName || null
      );

      await db.saveMessage(conversation.id, {
        messageId: msg.key.id,
        direction: 'incoming',
        text: msgData.text || msgData.caption || `[${msgData.type}]`,
        type: msgData.type,
        mediaUrl: msgData.mediaUrl,
        isBot: false
      });
    }

    await sock.readMessages([msg.key]);

    let responses = [];
    let shouldSendAudio = false;
    let exampleImage = null;
    
    if (gemini?.isConfigured()) {
      console.log(`   🤖 Processando ${msgData.type}...`);
      
      const options = {
        mediaType: msgData.type !== 'text' ? msgData.type : null,
        mediaData: msgData.mediaBuffer,
        mediaUrl: msgData.mediaUrl,
        mimetype: msgData.mimetype,
        transcription: msgData.transcription,
        contactInfo: msgData.contactInfo,
        locationInfo: msgData.locationInfo,
        pollInfo: msgData.pollInfo
      };

      responses = await gemini.generate(
        msgData.text || msgData.caption || '',
        chatId,
        pushName,
        options
      );

      // Verificar se deve enviar áudio
      if (botConfig.send_audio_responses && gemini.shouldSendAudio(chatId)) {
        shouldSendAudio = true;
      }

      // Verificar se deve enviar imagem de exemplo
      const text = (msgData.text || msgData.caption || '').toLowerCase();
      if (botConfig.send_example_images) {
        if (/exemplo|mostra|ver|como.*(fica|é)/.test(text)) {
          if (/loja|ecommerce|e-commerce/.test(text)) exampleImage = 'ecommerce';
          else if (/landing/.test(text)) exampleImage = 'landing';
          else if (/site/.test(text)) exampleImage = 'site';
          else if (/tráfego|trafego|ads/.test(text)) exampleImage = 'trafego';
        }
      }

    } else {
      responses = [generateFallback(msgData.text || msgData.caption || '', pushName)];
    }

    // Enviar respostas
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      
      if (botConfig.typing_simulation) {
        await sock.sendPresenceUpdate('composing', chatId);
        const typingTime = Math.min(response.length * botConfig.typing_speed, botConfig.max_response_delay);
        await delay(Math.max(typingTime, botConfig.min_response_delay));
      }

      // Decidir se envia como texto ou áudio
      if (shouldSendAudio && i === responses.length - 1) {
        const audio = await gemini.generateAudio(response);
        if (audio) {
          await sock.sendMessage(chatId, {
            audio: audio.buffer,
            mimetype: audio.mimetype,
            ptt: true
          });
          console.log(`   🔊 Áudio enviado (${audio.buffer.length} bytes)`);
          gemini.markAudioSent(chatId);
        } else {
          await sock.sendMessage(chatId, { text: response });
          console.log(`   ✅ ${response.substring(0, 50)}...`);
        }
      } else {
        await sock.sendMessage(chatId, { text: response });
        console.log(`   ✅ ${response.substring(0, 50)}...`);
      }

      if (db?.isReady() && conversation) {
        await db.saveMessage(conversation.id, {
          direction: 'outgoing',
          text: response,
          type: shouldSendAudio ? 'audio' : 'text',
          isBot: true
        });
      }

      if (i < responses.length - 1) {
        await delay(500 + Math.random() * 1000);
      }
    }

    // Enviar imagem de exemplo se detectado
    if (exampleImage && EXAMPLE_IMAGES[exampleImage]) {
      await delay(1000);
      await sock.sendPresenceUpdate('composing', chatId);
      await delay(500);
      
      try {
        const imageUrl = EXAMPLE_IMAGES[exampleImage];
        
        // Se for URL, baixar primeiro
        if (imageUrl.startsWith('http')) {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
            await sock.sendMessage(chatId, {
              image: imgBuffer,
              caption: `👆 Exemplo de ${exampleImage === 'ecommerce' ? 'loja virtual' : exampleImage}`
            });
            console.log(`   🖼️ Exemplo enviado: ${exampleImage}`);
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Erro enviando exemplo: ${e.message}`);
      }
    }

    // Gerar imagem sob demanda
    const userText = (msgData.text || msgData.caption || '').toLowerCase();
    if (/gerar? imagem|criar? imagem|faz (uma |um )?imagem/.test(userText)) {
      const prompt = userText.replace(/gerar? imagem|criar? imagem|faz (uma |um )?imagem/i, '').trim();
      if (prompt.length > 5) {
        await delay(1000);
        await sock.sendPresenceUpdate('composing', chatId);
        await sock.sendMessage(chatId, { text: 'deixa eu criar essa imagem pra vc...' });
        
        const generated = await gemini.generateImageWithFlash(prompt);
        if (generated) {
          await sock.sendMessage(chatId, {
            image: generated.buffer,
            caption: '🎨 pronto!'
          });
          console.log(`   🎨 Imagem gerada`);
        } else {
          await sock.sendMessage(chatId, { text: 'ops, não consegui gerar essa imagem agora...' });
        }
      }
    }

  } catch (err) {
    console.error(`   ❌ ${err.message}`);
    try {
      await sock.sendMessage(chatId, { text: 'opa, deu um probleminha... pode repetir?' });
    } catch {}
  }
}

// ==================== PARSE MESSAGE ====================
async function parseMessage(msg) {
  const m = msg.message;
  if (!m) return null;

  if (m.conversation) return { type: 'text', text: m.conversation };
  if (m.extendedTextMessage) return { type: 'text', text: m.extendedTextMessage.text };

  if (m.imageMessage) {
    const data = await downloadAndUpload(msg, 'image');
    return {
      type: 'image',
      caption: m.imageMessage.caption || '',
      mimetype: m.imageMessage.mimetype,
      mediaBuffer: data?.buffer,
      mediaUrl: data?.url
    };
  }

  if (m.videoMessage) {
    const data = await downloadAndUpload(msg, 'video');
    return {
      type: 'video',
      caption: m.videoMessage.caption || '',
      mimetype: m.videoMessage.mimetype,
      mediaBuffer: data?.buffer,
      mediaUrl: data?.url
    };
  }

  if (m.audioMessage) {
    const data = await downloadAndUpload(msg, 'audio');
    let transcription = null;
    
    if (data?.buffer && gemini?.isMediaConfigured()) {
      console.log('   🎤 Transcrevendo áudio...');
      try {
        transcription = await gemini.transcribeAudio(data.buffer, m.audioMessage.mimetype || 'audio/ogg');
        if (transcription) console.log(`   📝 Transcrição: ${transcription.substring(0, 50)}...`);
      } catch (e) {
        console.log('   ⚠️ Transcrição falhou:', e.message);
      }
    }
    
    return {
      type: 'audio',
      text: transcription || '',
      mimetype: m.audioMessage.mimetype,
      seconds: m.audioMessage.seconds,
      mediaBuffer: data?.buffer,
      mediaUrl: data?.url,
      transcription
    };
  }

  if (m.documentMessage) {
    const data = await downloadAndUpload(msg, 'document');
    return {
      type: 'document',
      text: `[Documento: ${m.documentMessage.fileName || 'arquivo'}]`,
      filename: m.documentMessage.fileName,
      mimetype: m.documentMessage.mimetype,
      mediaUrl: data?.url
    };
  }

  if (m.stickerMessage) return { type: 'sticker', text: '[sticker]', mimetype: m.stickerMessage.mimetype };

  if (m.contactMessage) {
    const vcard = m.contactMessage.vcard || '';
    const nameMatch = vcard.match(/FN:(.+)/);
    const telMatch = vcard.match(/TEL[^:]*:(.+)/);
    return {
      type: 'contact',
      text: '[contato]',
      contactInfo: { name: nameMatch?.[1] || 'Contato', number: telMatch?.[1]?.replace(/\D/g, '') || '' }
    };
  }

  if (m.contactsArrayMessage) {
    const contacts = m.contactsArrayMessage.contacts || [];
    return {
      type: 'contact',
      text: '[contatos]',
      contactInfo: { name: contacts.map(c => c.displayName).join(', '), number: 'múltiplos' }
    };
  }

  if (m.locationMessage) {
    return {
      type: 'location',
      text: '[localização]',
      locationInfo: {
        latitude: m.locationMessage.degreesLatitude,
        longitude: m.locationMessage.degreesLongitude,
        name: m.locationMessage.name || '',
        address: m.locationMessage.address || ''
      }
    };
  }

  if (m.liveLocationMessage) {
    return {
      type: 'location',
      text: '[localização ao vivo]',
      locationInfo: { latitude: m.liveLocationMessage.degreesLatitude, longitude: m.liveLocationMessage.degreesLongitude }
    };
  }

  if (m.pollCreationMessage) {
    return {
      type: 'poll',
      text: '[enquete]',
      pollInfo: { name: m.pollCreationMessage.name, options: m.pollCreationMessage.options?.map(o => o.optionName) || [] }
    };
  }

  if (m.pollUpdateMessage) return { type: 'poll', text: '[resposta enquete]' };
  if (m.reactionMessage) return null;
  if (m.protocolMessage || m.senderKeyDistributionMessage) return null;

  const msgType = Object.keys(m)[0];
  console.log(`   ⚠️ Tipo desconhecido: ${msgType}`);
  return { type: 'unknown', text: `[${msgType}]` };
}

// ==================== DOWNLOAD & UPLOAD ====================
async function downloadAndUpload(msg, type) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    
    let url = null;
    let key = null;

    if (r2?.isReady()) {
      const m = msg.message;
      const mediaMsg = m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage;
      const mimetype = mediaMsg?.mimetype || 'application/octet-stream';
      const filename = mediaMsg?.fileName || `${type}_${Date.now()}`;

      const result = await r2.upload(buffer, {
        prefix: `whatsapp/${type}`,
        filename,
        contentType: mimetype,
        metadata: { chatId: msg.key.remoteJid, messageId: msg.key.id }
      });

      url = result.url;
      key = result.key;
      
      if (url) console.log(`   📤 Uploaded: ${url}`);
    }

    return { buffer, url, key };
  } catch (e) {
    console.error(`   ⚠️ Download/upload: ${e.message}`);
    return null;
  }
}

// ==================== FALLBACK ====================
function generateFallback(text, pushName) {
  const t = (text || '').toLowerCase();

  if (/^(oi|olá|ola|hey|eai|bom dia|boa tarde|boa noite)\b/.test(t)) {
    const g = [`oi${pushName ? ' ' + pushName : ''}!`, `e aí${pushName ? ' ' + pushName : ''}!`, `opa!`];
    return g[Math.floor(Math.random() * g.length)];
  }

  if (/pre[cç]o|valor|quanto|tabela/.test(t)) {
    return `temos 3 pacotes:\n\nEssencial: R$ 543/mês\nProfissional: R$ 1.043/mês\nPremium: R$ 2.543/mês\n\nqual te interessa?`;
  }

  return `opa! me conta o que vc precisa`;
}

// ==================== EXPORT ====================
module.exports = { sock: () => sock, startBot, db };

// ==================== RUN ====================
console.log('\n' + '═'.repeat(50));
console.log('   🏰 IMPÉRIO LORD - WhatsApp Bot v2.0');
console.log('═'.repeat(50));

startBot();