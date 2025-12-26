// FILE: bot.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// ==================== CONFIGURAÇÃO ====================
const SESSION_DIR = './sessions';
const logger = pino({ level: 'silent' });

// Estado global
let sock = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 5000;

// Configurações do bot (cache local)
let botConfig = {
    bot_enabled: true,
    respond_to_groups: false,
    respond_to_channels: false,
    use_whitelist_groups: false,
    use_blacklist_numbers: false,
    auto_save_leads: true,
    typing_simulation: true,
    typing_speed: 50,
    min_response_delay: 1000,
    max_response_delay: 3000,
    gemini_enabled: false,
    gemini_api_key: '',
    gemini_model: 'gemini-1.5-flash',
    business_hours_only: false,
    business_hours_start: '08:00',
    business_hours_end: '18:00',
    bot_only_business: false
};

// ==================== INICIALIZAÇÃO ====================
async function startBot() {
    if (isConnecting) {
        console.log('⏳ Já está conectando...');
        return;
    }

    isConnecting = true;
    console.log('\n📱 Iniciando bot...');

    try {
        // Garantir pasta de sessão
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }

        // Carregar estado de autenticação
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        // Buscar versão do Baileys
        const { version } = await fetchLatestBaileysVersion();
        console.log(`📦 Baileys v${version.join('.')}`);

        // Criar socket
        sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger,
            browser: ['Império Lord Bot', 'Chrome', '120.0.0'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 2000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            getMessage: async () => ({ conversation: '' })
        });

        // ==================== EVENTOS ====================
        
        // Atualização de conexão
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR CODE - Exibir manualmente
            if (qr) {
                console.log('\n' + '━'.repeat(50));
                console.log('📱 ESCANEIE O QR CODE ABAIXO:');
                console.log('━'.repeat(50) + '\n');
                qrcode.generate(qr, { small: true });
                console.log('\n' + '━'.repeat(50));
                console.log('⏳ Aguardando conexão...');
                console.log('━'.repeat(50) + '\n');
            }

            if (connection === 'close') {
                isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = DisconnectReason[statusCode] || statusCode;
                
                console.log(`\n❌ Desconectado: ${reason} (${statusCode})`);

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log('🗑️ Sessão encerrada. Limpando dados...');
                    await clearSession();
                    reconnectAttempts = 0;
                    setTimeout(startBot, 3000);
                } else if (statusCode === 500 || statusCode === 515) {
                    reconnectAttempts++;
                    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                        const waitTime = Math.min(reconnectAttempts * RECONNECT_INTERVAL, 60000);
                        console.log(`🔄 Reconectando em ${waitTime/1000}s... (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                        setTimeout(startBot, waitTime);
                    } else {
                        console.log('❌ Máximo de tentativas atingido. Limpando sessão...');
                        await clearSession();
                        reconnectAttempts = 0;
                        setTimeout(startBot, 10000);
                    }
                } else if (statusCode !== DisconnectReason.loggedOut) {
                    reconnectAttempts++;
                    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                        const waitTime = Math.min(reconnectAttempts * 2000, 30000);
                        console.log(`🔄 Reconectando em ${waitTime/1000}s...`);
                        setTimeout(startBot, waitTime);
                    } else {
                        console.log('❌ Máximo de tentativas. Aguardando 5 minutos...');
                        reconnectAttempts = 0;
                        setTimeout(startBot, 300000);
                    }
                }
            }

            if (connection === 'connecting') {
                console.log('🔄 Conectando ao WhatsApp...');
            }

            if (connection === 'open') {
                isConnecting = false;
                reconnectAttempts = 0;
                console.log('\n' + '━'.repeat(50));
                console.log('✅ CONECTADO AO WHATSAPP!');
                console.log(`👤 ${sock.user?.name || 'Bot'}`);
                console.log(`📞 ${sock.user?.id?.split(':')[0] || ''}`);
                console.log('━'.repeat(50) + '\n');

                await loadBotConfig();
            }
        });

        // Salvar credenciais
        sock.ev.on('creds.update', saveCreds);

        // ==================== MENSAGENS ====================
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const msg of messages) {
                try {
                    await handleMessage(msg);
                } catch (err) {
                    console.error('❌ Erro ao processar mensagem:', err.message);
                }
            }
        });

    } catch (err) {
        console.error('❌ Erro ao iniciar:', err.message);
        isConnecting = false;
        
        if (err.message?.includes('Unexpected end of JSON')) {
            console.log('🗑️ Sessão corrompida. Limpando...');
            await clearSession();
        }
        
        setTimeout(startBot, 5000);
    }
}

// ==================== LIMPAR SESSÃO ====================
async function clearSession() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            const files = fs.readdirSync(SESSION_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(SESSION_DIR, file));
            }
            console.log('✅ Sessão limpa');
        }
    } catch (err) {
        console.error('Erro ao limpar sessão:', err.message);
    }
}

// ==================== CARREGAR CONFIG ====================
async function loadBotConfig() {
    try {
        const res = await fetch('http://localhost:3512/api/config');
        if (res.ok) {
            const data = await res.json();
            for (const [key, cfg] of Object.entries(data)) {
                if (botConfig.hasOwnProperty(key)) {
                    botConfig[key] = cfg.value;
                }
            }
            console.log('✅ Configurações carregadas do banco');
        }
    } catch (err) {
        console.log('⚠️ Usando configurações padrão');
    }
}

// ==================== PROCESSAR MENSAGEM ====================
async function handleMessage(msg) {
    if (msg.key.fromMe) return;
    if (msg.key.remoteJid === 'status@broadcast') return;

    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const isChannel = chatId.endsWith('@newsletter');
    const sender = msg.key.participant || chatId;
    const pushName = msg.pushName || '';

    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text ||
                 msg.message?.imageMessage?.caption ||
                 msg.message?.videoMessage?.caption ||
                 msg.message?.documentMessage?.caption ||
                 '';

    if (!text) return;

    const chatType = isGroup ? '👥' : isChannel ? '📢' : '👤';
    console.log(`\n${chatType} [${new Date().toLocaleTimeString()}] ${pushName || sender.split('@')[0]}`);
    console.log(`   💬 ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    if (!await shouldProcess(chatId, isGroup, isChannel, sender, text)) {
        console.log('   ⏭️ Ignorado (filtros)');
        return;
    }

    if (!botConfig.bot_enabled) {
        console.log('   ⏭️ Bot desativado');
        return;
    }

    try {
        await sock.readMessages([msg.key]);

        if (botConfig.typing_simulation) {
            await sock.sendPresenceUpdate('composing', chatId);
            const typingTime = Math.min(text.length * botConfig.typing_speed, 5000);
            await delay(Math.max(typingTime, botConfig.min_response_delay));
        }

        const response = await generateResponse(text, { chatId, sender, pushName, isGroup });

        if (response) {
            await sock.sendMessage(chatId, { text: response });
            console.log(`   ✅ Respondido: ${response.substring(0, 50)}...`);
        }

    } catch (err) {
        console.error(`   ❌ Erro: ${err.message}`);
    }
}

// ==================== VERIFICAR SE DEVE PROCESSAR ====================
async function shouldProcess(chatId, isGroup, isChannel, sender, text) {
    if (isChannel && !botConfig.respond_to_channels) return false;

    if (isGroup) {
        if (!botConfig.respond_to_groups) return false;

        if (botConfig.use_whitelist_groups) {
            try {
                const res = await fetch(`http://localhost:3512/api/filters?chat_id=${encodeURIComponent(chatId)}`);
                const filters = await res.json();
                const allowed = filters.find(f => f.chat_id === chatId && f.is_allowed);
                if (!allowed) return false;
            } catch {
                return false;
            }
        }
    }

    if (botConfig.use_blacklist_numbers && !isGroup) {
        try {
            const res = await fetch(`http://localhost:3512/api/filters?chat_id=${encodeURIComponent(chatId)}`);
            const filters = await res.json();
            const blocked = filters.find(f => f.chat_id === chatId && !f.is_allowed);
            if (blocked) return false;
        } catch {}
    }

    if (botConfig.business_hours_only) {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const current = hour * 60 + minute;

        const [startH, startM] = botConfig.business_hours_start.split(':').map(Number);
        const [endH, endM] = botConfig.business_hours_end.split(':').map(Number);
        const start = startH * 60 + startM;
        const end = endH * 60 + endM;

        if (current < start || current > end) return false;
    }

    return true;
}

// ==================== GERAR RESPOSTA ====================
async function generateResponse(text, context) {
    const lowerText = text.toLowerCase().trim();

    if (/^(oi|olá|ola|hey|eai|e ai|bom dia|boa tarde|boa noite|hello|hi)\b/i.test(lowerText)) {
        const greetings = [
            `Olá${context.pushName ? ', ' + context.pushName : ''}! 👋 Seja bem-vindo(a) à Império Lord!`,
            `Oi${context.pushName ? ', ' + context.pushName : ''}! 😊 Como posso ajudar?`,
            `Olá! Tudo bem? Sou o assistente da Império Lord. Em que posso ajudar?`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (/pre[cç]o|valor|quanto custa|tabela|pacote/i.test(lowerText)) {
        return `💰 *Nossos Pacotes:*

🥉 *Essencial* - R$ 543/mês
   Landing page + Setup básico

🥈 *Profissional* - R$ 1.043/mês
   Site completo + Integração IA

🥇 *Premium* - R$ 2.543/mês
   E-commerce + CRM + Automação

Qual pacote te interessa? 😊`;
    }

    if (/servi[cç]o|faz|trabalh|oferece/i.test(lowerText)) {
        return `🚀 *Nossos Serviços:*

- Sites e Landing Pages
- E-commerce completo
- Gestão de Tráfego Pago
- Automação com IA
- CRM e Chatbots
- Marketing Digital

Quer saber mais sobre algum? 😊`;
    }

    if (/humano|atendente|pessoa|falar com|suporte/i.test(lowerText)) {
        return `👨‍💼 Entendi! Vou chamar um atendente para você.

Enquanto isso, pode me contar mais sobre o que precisa?

Um membro da equipe irá te responder em breve! 🙏`;
    }

    if (/obrigad|valeu|thanks|vlw/i.test(lowerText)) {
        return `De nada! 😊 Estou aqui se precisar de mais alguma coisa!`;
    }

    if (botConfig.gemini_enabled && botConfig.gemini_api_key) {
        try {
            return await callGemini(text, context);
        } catch (err) {
            console.error('Erro Gemini:', err.message);
        }
    }

    return `Recebi sua mensagem! 😊

Para melhor atendê-lo, você poderia me dizer:

1️⃣ Quer conhecer nossos *serviços*?
2️⃣ Quer ver nossa *tabela de preços*?
3️⃣ Precisa falar com um *atendente*?

Digite o número ou escreva sua dúvida!`;
}

// ==================== CHAMAR GEMINI ====================
async function callGemini(text, context) {
    const systemPrompt = `Você é o assistente virtual da Império Lord, uma agência de marketing digital.
Seja simpático, profissional e objetivo. Use emojis moderadamente.
Serviços: Sites, Landing Pages, E-commerce, Tráfego Pago, Automação IA, CRM.
Preços: Essencial R$543, Profissional R$1.043, Premium R$2.543.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${botConfig.gemini_model}:generateContent?key=${botConfig.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nCliente: ${text}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        })
    });

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ==================== EXPORTAR ====================
module.exports = { sock: () => sock, startBot };

// ==================== INICIAR ====================
console.log('\n' + '═'.repeat(50));
console.log('   🏰 IMPÉRIO LORD - WhatsApp Bot');
console.log('═'.repeat(50));

startBot();