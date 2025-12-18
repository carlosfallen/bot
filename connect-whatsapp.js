// Script de Conexão WhatsApp Standalone
// Use este script para conectar via Pairing Code
// Depois de conectar, use: bun run dev

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
    console.log('\n🚀 Iniciando conexão WhatsApp...\n');

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    if (!sock.authState.creds.registered) {
        console.log('📱 CONECTAR WHATSAPP\n');
        const phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
        console.log('\n⏳ Gerando código de pareamento...\n');

        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log('━'.repeat(50));
            console.log(`\n✅ CÓDIGO DE PAREAMENTO: ${code}\n`);
            console.log('━'.repeat(50));
            console.log('\n📱 COMO USAR:\n');
            console.log('1. Abra o WhatsApp no seu celular');
            console.log('2. Vá em: Configurações > Dispositivos Conectados');
            console.log('3. Toque em: Conectar um Dispositivo');
            console.log('4. Escolha: Conectar com número de telefone');
            console.log(`5. Digite o código: ${code}`);
            console.log('\n⏳ Aguardando você digitar o código no WhatsApp...\n');
        } catch (error) {
            console.error('❌ Erro ao gerar código:', error.message);
            process.exit(1);
        }
    } else {
        console.log('✅ Dispositivo já registrado! Conectando...\n');
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
            console.log('🔄 Conectando...');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log('\n❌ Conexão fechada');
            console.log('   Status Code:', statusCode);
            console.log('   Reconectando:', shouldReconnect);

            if (shouldReconnect) {
                console.log('⏳ Tentando reconectar em 3s...\n');
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log('\n⚠️  Você foi desconectado. Execute novamente para reconectar.\n');
                process.exit(1);
            }
        }

        if (connection === 'open') {
            console.log('\n━'.repeat(50));
            console.log('\n✅ CONECTADO AO WHATSAPP COM SUCESSO!\n');
            console.log('━'.repeat(50));
            console.log('\n🎉 Você pode fechar este terminal agora.\n');
            console.log('💡 Para usar o bot, execute: bun run dev\n');
            console.log('   A sessão está salva em: auth_info/\n');

            setTimeout(() => {
                rl.close();
                process.exit(0);
            }, 2000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

console.log('\n' + '='.repeat(60));
console.log('   WHATSAPP BOT - CONEXÃO INICIAL');
console.log('='.repeat(60));

connectToWhatsApp().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});
