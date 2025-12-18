// Teste de conexão WhatsApp sem módulos extras
require('dotenv').config();

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const P = require('pino');

const logger = P({ level: 'silent' });

async function connectToWhatsApp() {
    console.log('🔄 Iniciando conexão...');

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('📊 Connection update:', connection);

        if (qr) {
            console.log('\n📱 QR Code disponível! Use qrcode-terminal ou similar para exibir');
            console.log('QR String:', qr.substring(0, 50) + '...');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Conexão fechada');
            console.log('   Status Code:', statusCode);
            console.log('   Erro:', lastDisconnect?.error?.message);

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 3000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ CONECTADO AO WHATSAPP!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;
            const msg = messages[0];

            if (!msg.key.fromMe && msg.message) {
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                console.log('\n📨 Mensagem recebida:', text);

                await sock.sendMessage(msg.key.remoteJid, {
                    text: 'Olá! Recebi sua mensagem: ' + text
                });
            }
        } catch (error) {
            console.log('❌ Erro:', error.message);
        }
    });
}

connectToWhatsApp();
