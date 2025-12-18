# 🚀 Início Rápido - Conexão WhatsApp

## ⚠️ Problema Identificado

O Baileys tem problemas de compatibilidade com Bun quando usa Pairing Code via API web.

**Solução:** Use o **QR Code** (mais confiável) ou **Pairing Code via Terminal**.

---

## ✅ Opção 1: QR Code (RECOMENDADO)

```bash
# 1. Limpar sessão
rm -rf auth_info/

# 2. Rodar servidor
bun run dev

# 3. Abrir navegador
http://localhost:3210

# 4. Aguardar QR Code aparecer no dashboard

# 5. Escanear com WhatsApp:
#    - Abrir WhatsApp no celular
#    - Ir em: Dispositivos Conectados > Conectar um Dispositivo
#    - Escanear o QR Code
```

---

## ✅ Opção 2: Pairing Code via Terminal

Se o QR Code não aparecer, use pairing code direto no terminal:

```bash
# 1. Criar arquivo de conexão standalone
cat > connect-whatsapp.js << 'EOF'
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
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Digite seu número do WhatsApp (com DDI, ex: 5589994333316): ');
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n✅ Código de pareamento: ${code}\n`);
        console.log('📱 Digite este código no WhatsApp em:');
        console.log('   Dispositivos Conectados > Conectar com número de telefone\n');
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            } else {
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp!');
            console.log('🎉 Você pode fechar este terminal e rodar: bun run dev');
            setTimeout(() => process.exit(0), 2000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();
EOF

# 2. Rodar script de conexão
node connect-whatsapp.js

# 3. Digitar seu número quando pedido
# 4. Copiar o código gerado
# 5. Digitar no WhatsApp
# 6. Aguardar conectar
# 7. Depois rodar o servidor principal:
bun run dev
```

---

## 📝 Por que isso acontece?

O Bun ainda está em desenvolvimento e tem algumas incompatibilidades com bibliotecas Node.js como o `ws` (WebSocket) que o Baileys usa internamente.

Os warnings que aparecem:
```
[bun] Warning: ws.WebSocket 'upgrade' event is not implemented in bun
[bun] Warning: ws.WebSocket 'unexpected-response' event is not implemented in bun
```

Indicam que o Bun não implementa todos os eventos do WebSocket que o Baileys precisa para o Pairing Code via API.

---

## ✅ Após Conectar

Depois que conectar (por QR Code ou Pairing Code via terminal), a sessão fica salva em `auth_info/` e você pode usar normalmente:

```bash
bun run dev
```

O bot vai conectar automaticamente sem pedir QR Code ou Pairing Code novamente!

---

**Escolha a Opção 1 (QR Code) que é mais fácil!** 📱
