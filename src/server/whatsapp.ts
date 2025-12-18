// src/server/whatsapp.ts - VERSÃO SIMPLIFICADA (SEM LOOPS)

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { existsSync, mkdirSync } from 'fs';
import fs from 'fs/promises';

const logger = pino({ level: 'silent' });
const SESSION_DIR = './sessions';

if (!existsSync(SESSION_DIR)) {
  mkdirSync(SESSION_DIR, { recursive: true });
}

let sock: WASocket | null = null;
let qrString: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let bunServer: any = null;

export async function initWhatsApp(server: any) {
  bunServer = server;
  await connectWhatsApp();
}

async function connectWhatsApp() {
  // NÃO RECONECTAR SE JÁ EXISTE SOCKET
  if (sock) {
    console.log('⚠️ Socket já existe');
    return;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      logger,
      printQRInTerminal: false
    });

    if (!sock.authState.creds.registered) {
      console.log('⚠️ Dispositivo não registrado - aguardando QR Code ou Pairing Code');
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

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
        broadcastToClients({ type: 'status', data: 'connected' });
        console.log('✅ WhatsApp conectado!');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log('❌ Conexão fechada. Código:', statusCode);
        
        connectionStatus = 'disconnected';
        sock = null;
        broadcastToClients({ type: 'status', data: 'disconnected' });

        // APENAS reconectar se for desconexão não intencional
        if (shouldReconnect) {
          console.log('🔄 Reconectando em 5s...');
          setTimeout(() => connectWhatsApp(), 5000);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      
      if (!msg.key.fromMe && msg.message) {
        const remoteJid = msg.key.remoteJid;
        
        if (!remoteJid?.endsWith('@s.whatsapp.net')) return;
        
        const phone = remoteJid.replace('@s.whatsapp.net', '');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!text) return;

        console.log('📨 Mensagem recebida:', phone, text);
        // handleIncomingMessage(phone, text);
      }
    });

  } catch (error) {
    sock = null;
    connectionStatus = 'disconnected';
    console.error('❌ Erro ao conectar:', error);
  }
}

function broadcastToClients(message: any) {
  if (!bunServer) return;
  try {
    bunServer.publish('dashboard', JSON.stringify(message));
  } catch {}
}

export function getQRCode() {
  return qrString;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export async function requestPairingCode(phoneNumber: string): Promise<string | null> {
  try {
    // Se não tem socket, criar primeiro
    if (!sock) {
      console.log('🔄 Criando socket para pairing...');
      
      // Limpar sessão antiga
      await clearSession();
      
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      
      sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false
      });

      // Aguardar socket estar pronto
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      sock.ev.on('creds.update', saveCreds);
    }

    // Gerar código
    console.log('📱 Gerando pairing code para:', phoneNumber);
    const code = await sock.requestPairingCode(phoneNumber);
    console.log('✅ Código gerado:', code);
    
    return code;
    
  } catch (error) {
    console.error('❌ Erro ao gerar pairing code:', error);
    return null;
  }
}

export async function disconnectWhatsApp() {
  console.log('🛑 Desconectando...');
  
  if (sock) {
    try {
      await sock.logout();
    } catch {}
    sock.end(undefined);
    sock = null;
  }

  connectionStatus = 'disconnected';
  console.log('✅ Desconectado');
}

export async function restartWhatsApp() {
  console.log('🔄 Reiniciando...');
  
  await disconnectWhatsApp();
  await clearSession();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await connectWhatsApp();
  
  console.log('✅ Reiniciado');
}

async function clearSession() {
  try {
    await fs.rm(SESSION_DIR, { recursive: true, force: true });
    await fs.mkdir(SESSION_DIR, { recursive: true });
    console.log('🧹 Sessão limpa');
  } catch {}
}

export { sock };