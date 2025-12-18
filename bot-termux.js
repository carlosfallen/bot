// bot-termux.js - VERSÃO ESPECÍFICA TERMUX

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

const logger = P({ level: 'silent' });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    // IMPORTANTE: Buscar versão mais recente
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        // CONFIGS EXTRAS PARA TERMUX
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: false,
        getMessage: async () => undefined
    });

    if (!sock.authState.creds.registered) {
        console.log('\n📱 Digite seu número (ex: 5589994333316):');
        const phoneNumber = await question('> ');
        
        console.log('\n⏳ Aguarde...\n');
        
        try {
            const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
            console.log(`\n✅ CÓDIGO: ${code}\n`);
            console.log('Abra WhatsApp e digite este código\n');
        } catch (error) {
            console.error('❌ Erro:', error.message);
            process.exit(1);
        }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'connecting') {
            console.log('🔄 Conectando...');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log('\n❌ Conexão fechada');
            console.log('Motivo:', lastDisconnect?.error?.message || 'Desconhecido');
            console.log('Código:', statusCode);
            
            if (shouldReconnect) {
                console.log('\n⏳ Reconectando em 5s...\n');
                await new Promise(resolve => setTimeout(resolve, 5000));
                connectToWhatsApp();
            } else {
                console.log('\n⚠️  Execute novamente\n');
                process.exit(0);
            }
        }

        if (connection === 'open') {
            console.log('\n✅ CONECTADO!\n');
            rl.close();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            const msg = messages[0];

            if (msg.key.fromMe || !msg.message) return;

            const remoteJid = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            if (!text || remoteJid.includes('@newsletter')) return;

            console.log(`\n📨 De: ${remoteJid}`);
            console.log(`Texto: ${text}\n`);

            await sock.sendMessage(remoteJid, {
                text: 'Oi! Recebi sua mensagem 👍'
            });

            console.log('✅ Respondido\n');

        } catch (error) {
            console.error('❌ Erro:', error.message);
        }
    });
}

connectToWhatsApp().catch(err => {
    console.error('\n❌ ERRO FATAL:', err.message);
    console.error('\nDetalhes:', err);
    process.exit(1);
});