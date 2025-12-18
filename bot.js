// WhatsApp Bot - JavaScript Puro
// Conexão via terminal + Respostas automáticas com NLP

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const readline = require('readline');
const P = require('pino');

const logger = P({ level: 'silent' });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ========== NLP SIMPLES ==========

const responses = {
    'oi': 'Olá! 👋 Como posso ajudar você hoje?',
    'olá': 'Oi! Tudo bem? Em que posso ajudar?',
    'bom dia': 'Bom dia! ☀️ Como posso te ajudar?',
    'boa tarde': 'Boa tarde! 🌤️ Posso te ajudar com algo?',
    'boa noite': 'Boa noite! 🌙 No que posso ajudar?',

    'tráfego': 'Temos excelentes soluções de tráfego pago! Meta Ads, Google Ads e mais. Quer saber mais?',
    'anúncio': 'Criamos campanhas de anúncios otimizadas para Meta e Google. Posso te enviar mais informações?',
    'instagram': 'Gestão de Instagram profissional! Posts, stories e engajamento. Interessado?',
    'facebook': 'Gestão de Facebook com conteúdo estratégico. Quer conhecer nossos planos?',
    'site': 'Desenvolvemos sites modernos e responsivos. Posso te mostrar nosso portfólio?',
    'landing': 'Landing pages de alta conversão! Ideal para capturar leads. Quer um orçamento?',

    'preço': 'Para informações sobre valores, entre em contato: (XX) XXXX-XXXX',
    'valor': 'Entre em contato com nossa equipe comercial para orçamento: (XX) XXXX-XXXX',
    'quanto custa': 'Para orçamento personalizado, fale com nosso time: (XX) XXXX-XXXX',

    'obrigado': 'De nada! Estou aqui para ajudar. 😊',
    'valeu': 'Por nada! Precisando, é só chamar! 👍',
    'tchau': 'Até logo! Qualquer coisa, estou por aqui. 👋',
};

function analyzeMessage(text) {
    const normalized = text.toLowerCase().trim();

    // Buscar palavra-chave na mensagem
    for (const [keyword, response] of Object.entries(responses)) {
        if (normalized.includes(keyword)) {
            return response;
        }
    }

    // Resposta padrão
    return 'Oi! Como posso ajudar? Digite "menu" para ver as opções.';
}

// ========== WHATSAPP ==========

let sock = null;

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

    // Pairing Code se não registrado
    if (!sock.authState.creds.registered) {
        console.log('\n📱 CONECTAR WHATSAPP\n');
        const phoneNumber = await question('Digite seu número com DDI (ex: 5589994333316): ');
        console.log('\n⏳ Gerando código de pareamento...\n');

        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log('━'.repeat(50));
            console.log(`\n✅ CÓDIGO: ${code}\n`);
            console.log('━'.repeat(50));
            console.log('\n📱 Abra WhatsApp > Dispositivos Conectados');
            console.log('   > Conectar com número de telefone');
            console.log(`   > Digite: ${code}\n`);
        } catch (error) {
            console.error('❌ Erro ao gerar código:', error.message);
            process.exit(1);
        }
    }

    // Eventos de conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

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
                console.log('⚠️  Você foi desconectado. Execute novamente para reconectar.\n');
                process.exit(1);
            }
        }

        if (connection === 'open') {
            console.log('\n━'.repeat(50));
            console.log('✅ CONECTADO AO WHATSAPP!');
            console.log('━'.repeat(50));
            console.log('\n🤖 Bot rodando... Aguardando mensagens.\n');
            rl.close();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Processar mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;

            const msg = messages[0];

            // Ignorar mensagens próprias e newsletters
            if (msg.key.fromMe || msg.key.remoteJid.includes('@newsletter')) return;

            const remoteJid = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            if (!text) return;

            // Apenas mensagens privadas ou grupos
            if (!remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.endsWith('@g.us')) return;

            console.log(`\n📨 Mensagem de ${remoteJid}`);
            console.log(`   Texto: ${text}`);

            // Processar com NLP
            const response = analyzeMessage(text);

            // Enviar resposta
            await sock.sendMessage(remoteJid, { text: response });

            console.log(`✅ Resposta: ${response}\n`);

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error.message);
        }
    });
}

// ========== INICIAR ==========

console.log('\n' + '='.repeat(60));
console.log('   WHATSAPP BOT COM NLP');
console.log('='.repeat(60) + '\n');

connectToWhatsApp().catch((error) => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rejeitada:', error.message);
});
