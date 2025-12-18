// WhatsApp Bot - Conexão via QR Code (MAIS CONFIÁVEL)

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');

const logger = P({ level: 'silent' });
let sock = null;

// Respostas NLP
const responses = {
    'oi': 'Olá! 👋 Como posso ajudar?',
    'olá': 'Oi! Tudo bem?',
    'bom dia': 'Bom dia! ☀️',
    'boa tarde': 'Boa tarde! 🌤️',
    'boa noite': 'Boa noite! 🌙',
    'tráfego': 'Temos soluções de tráfego pago! Quer saber mais?',
    'anúncio': 'Criamos campanhas otimizadas. Interessado?',
    'instagram': 'Gestão profissional de Instagram!',
    'site': 'Desenvolvemos sites modernos!',
    'preço': 'Para orçamento: (85) 99943-3316',
    'valor': 'Entre em contato: (85) 99943-3316',
    'obrigado': 'De nada! 😊',
    'tchau': 'Até logo! 👋',
};

function analyzeMessage(text) {
    const normalized = text.toLowerCase().trim();
    for (const [keyword, response] of Object.entries(responses)) {
        if (normalized.includes(keyword)) {
            return response;
        }
    }
    return 'Oi! Como posso ajudar?';
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Exibir QR Code no terminal
        if (qr) {
            console.log('\n📱 ESCANEIE O QR CODE ABAIXO:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n📱 Abra WhatsApp > Dispositivos Conectados > Escanear QR Code\n');
        }

        if (connection === 'connecting') {
            console.log('🔄 Conectando...');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log('\n❌ Conexão fechada');

            if (shouldReconnect) {
                console.log('⏳ Reconectando em 5s...\n');
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log('⚠️  Execute novamente: node bot-qr.js\n');
                process.exit(1);
            }
        }

        if (connection === 'open') {
            console.log('\n━'.repeat(60));
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('━'.repeat(60));
            console.log('\n🤖 Bot ativo. Aguardando mensagens...\n');
        }
    });

    // Processar mensagens
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            const msg = messages[0];
            if (msg.key.fromMe || msg.key.remoteJid.includes('@newsletter')) return;

            const remoteJid = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            if (!text) return;
            if (!remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.endsWith('@g.us')) return;

            console.log(`📨 ${remoteJid.split('@')[0]}: ${text}`);

            const response = analyzeMessage(text);
            await sock.sendMessage(remoteJid, { text: response });

            console.log(`✅ Bot: ${response}\n`);

        } catch (error) {
            console.error('❌ Erro:', error.message);
        }
    });
}

console.log('\n' + '='.repeat(60));
console.log('   WHATSAPP BOT - QR CODE');
console.log('='.repeat(60) + '\n');

connectToWhatsApp().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});
