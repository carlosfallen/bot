// src/server/whatsapp.ts - SUBSTITUIR connectWhatsApp COMPLETO

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

const logger = pino({ level: 'silent' });
const SESSION_DIR = './sessions';

let sock: WASocket | null = null;
let qrString: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let bunServer: any = null;
let isConnecting = false;
let reconnectTimeout: Timer | null = null;

export async function initWhatsApp(server: any) {
  bunServer = server;
  
  if (sock || isConnecting) {
    logger.warn('⚠️ WhatsApp já está iniciando/conectado');
    return;
  }
  
  await connectWhatsApp();
}

async function connectWhatsApp() {
  if (isConnecting || sock) {
    console.log('⚠️ Já existe uma tentativa de conexão');
    return;
  }

  isConnecting = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  try {
    // ✅ IGUAL AO TERMUX
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    // ✅ IGUAL AO TERMUX - Auth structure completa
    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      logger,
      printQRInTerminal: false
    });

    // ✅ PAIRING CODE (igual Termux) - mas via WebSocket
    if (!sock.authState.creds.registered) {
      console.log('⚠️ Dispositivo não registrado');
      console.log('💡 Para conectar, você precisa usar pairing code ou QR');
      
      // Gerar QR se não tiver pairing code configurado
      connectionStatus = 'connecting';
      broadcastToClients({ type: 'status', data: 'connecting' });
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // ✅ QR Code (backup se não usar pairing)
      if (qr) {
        qrString = qr;
        const QRCode = await import('qrcode');
        const qrDataUrl = await QRCode.toDataURL(qr);
        broadcastToClients({ type: 'qr', data: qrDataUrl });
        console.log('📱 QR Code gerado');
      }

      if (connection === 'connecting') {
        connectionStatus = 'connecting';
        broadcastToClients({ type: 'status', data: 'connecting' });
        console.log('🔄 Conectando...');
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        qrString = null;
        isConnecting = false;
        broadcastToClients({ type: 'status', data: 'connected' });
        console.log('✅ WhatsApp conectado com sucesso');
      }

      // ✅ IGUAL AO TERMUX - Reconnect logic
      if (connection === 'close') {
        isConnecting = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        console.log('❌ Conexão fechada. Reconectando:', shouldReconnect);
        
        connectionStatus = 'disconnected';
        broadcastToClients({ type: 'status', data: 'disconnected' });

        if (shouldReconnect) {
          console.log('🔄 Reconectando em 5s...');
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connectWhatsApp();
          }, 5000);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // ✅ IGUAL AO TERMUX
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      
      if (!msg.key.fromMe && msg.message) {
        const remoteJid = msg.key.remoteJid;
        
        if (!remoteJid?.endsWith('@s.whatsapp.net')) return;
        
        const phone = remoteJid.replace('@s.whatsapp.net', '');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!text) return;

        console.log('📨 Mensagem recebida:', phone, text);
        await handleIncomingMessage(phone, text);
      }
    });

  } catch (error) {
    isConnecting = false;
    console.error('❌ Erro ao conectar:', error);
    connectionStatus = 'disconnected';
    
    console.log('🔄 Tentando novamente em 5s...');
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectWhatsApp();
    }, 5000);
  }
}

async function handleIncomingMessage(phone: string, text: string) {
  // Seu código de NLP aqui...
  console.log('Processando:', phone, text);
}

function broadcastToClients(message: any) {
  if (!bunServer) return;
  try {
    bunServer.publish('dashboard', JSON.stringify(message));
  } catch (error) {
    console.error('❌ Erro ao broadcast:', error);
  }
}

// src/server/whatsapp.ts - ADICIONAR ESTAS FUNÇÕES

export async function requestPairingCode(phoneNumber: string): Promise<string | null> {
  try {
    if (!sock) {
      console.log('❌ Socket não inicializado');
      return null;
    }

    const code = await sock.requestPairingCode(phoneNumber);
    console.log('✅ Código de pareamento gerado:', code);
    return code;
  } catch (error) {
    console.error('❌ Erro ao gerar pairing code:', error);
    return null;
  }
}

export async function restartWhatsApp() {
  console.log('🔄 Reiniciando WhatsApp...');
  
  await disconnectWhatsApp();
  
  // Limpar sessão
  await clearSession();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await connectWhatsApp();
  
  console.log('✅ WhatsApp reiniciado');
}

async function clearSession() {
  try {
    await fs.rm(SESSION_DIR, { recursive: true, force: true });
    console.log('🧹 Sessão limpa');
  } catch {}
}

export function getQRCode() {
  return qrString;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export async function disconnectWhatsApp() {
  console.log('🛑 Desconectando...');
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (sock) {
    try {
      await sock.logout();
      sock.end(undefined);
    } catch {}
    sock = null;
  }

  isConnecting = false;
  connectionStatus = 'disconnected';
  console.log('✅ Desconectado');
}

export { sock };