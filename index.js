const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
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
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: true,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Digite seu número do WhatsApp (com DDI, ex: 5589994333316): ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`Código de pareamento: ${code}`);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;
            
            const msg = messages[0];
            
            if (!msg.key.fromMe && msg.message && !msg.key.remoteJid.includes('@newsletter')) {
                const remoteJid = msg.key.remoteJid;
                
                if (remoteJid.endsWith('@s.whatsapp.net') || remoteJid.endsWith('@g.us')) {
                    await sock.sendMessage(remoteJid, { 
                        text: 'Oi, tudo bem? Como posso ajudar?' 
                    });
                    
                    console.log(`✅ Mensagem enviada para ${remoteJid}`);
                }
            }
        } catch (error) {
            console.log('❌ Erro ao processar mensagem:', error.message);
        }
    });
}

connectToWhatsApp();