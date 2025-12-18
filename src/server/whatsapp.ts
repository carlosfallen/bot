// src/server/whatsapp.ts - WhatsApp Connection Handler
import { default as makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import P from 'pino';

const logger = P({ level: 'silent' });
const AUTH_DIR = 'auth_info';

let sock: any = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let qrCode: string | null = null;
let broadcastFn: ((msg: any) => void) | null = null;

export function setBroadcastFunction(fn: (msg: any) => void) {
  broadcastFn = fn;
}

function broadcast(message: any) {
  if (broadcastFn) {
    try {
      broadcastFn(message);
    } catch (error) {
      console.error('❌ Erro ao fazer broadcast:', error);
    }
  }
}

export async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

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

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        const QRCode = await import('qrcode');
        const qrDataUrl = await QRCode.toDataURL(qr);
        broadcast({ type: 'qr', data: qrDataUrl });
        console.log('📱 QR Code gerado');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        // Não reconectar em erros de autenticação
        const authErrors = [
          DisconnectReason.loggedOut,
          405, // Connection Failure
          428, // Connection Terminated (precisa autenticar)
          401, // Unauthorized
          403, // Forbidden
        ];

        const shouldReconnect = !authErrors.includes(statusCode);

        console.log('❌ Conexão fechada');
        console.log('   Status Code:', statusCode);
        console.log('   Erro:', lastDisconnect?.error?.message || 'Sem mensagem');
        console.log('   Reconectando:', shouldReconnect);

        connectionStatus = 'disconnected';
        sock = null;
        broadcast({ type: 'status', data: 'disconnected' });

        if (shouldReconnect) {
          console.log('⏳ Aguardando 5s para reconectar...');
          setTimeout(() => connectToWhatsApp(), 5000);
        } else {
          console.log('⚠️  Aguardando autenticação via QR Code ou Pairing Code');
          console.log('📱 Acesse http://localhost:3210 para conectar');
          // Manter QR Code se existir para o usuário escanear
          if (qrCode) {
            console.log('✅ QR Code disponível no dashboard');
          }
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        qrCode = null;
        broadcast({ type: 'status', data: 'connected' });
        console.log('✅ Conectado ao WhatsApp!');
      } else if (connection === 'connecting') {
        connectionStatus = 'connecting';
        broadcast({ type: 'status', data: 'connecting' });
        console.log('🔄 Conectando...');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
      try {
        if (type !== 'notify') return;

        const msg = messages[0];

        if (!msg.key.fromMe && msg.message && !msg.key.remoteJid.includes('@newsletter')) {
          const remoteJid = msg.key.remoteJid;
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

          if (!text) return;

          if (remoteJid.endsWith('@s.whatsapp.net') || remoteJid.endsWith('@g.us')) {
            console.log('📨 Mensagem recebida de', remoteJid, ':', text);

            // Processar com NLP
            const response = await processMessage(text);

            // Enviar resposta
            await sock.sendMessage(remoteJid, { text: response });
            console.log('✅ Resposta enviada para', remoteJid);

            // Broadcast para dashboard
            broadcast({
              type: 'message',
              data: {
                from: remoteJid,
                text,
                response,
                timestamp: Date.now()
              }
            });
          }
        }
      } catch (error) {
        console.log('❌ Erro ao processar mensagem:', error);
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao conectar WhatsApp');
    console.error('   Tipo:', error?.name || 'Desconhecido');
    console.error('   Mensagem:', error?.message || error);
    console.error('   Stack:', error?.stack);
    connectionStatus = 'disconnected';
    sock = null;
  }
}

export async function requestPairingCode(phoneNumber: string): Promise<string | null> {
  try {
    if (!sock) {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false
      });

      sock.ev.on('creds.update', saveCreds);

      // Aguardar socket estar pronto
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`✅ Código de pareamento: ${code}`);
      return code;
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao gerar código:', error);
    return null;
  }
}

export async function sendMessage(to: string, text: string) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp não conectado');
  }

  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    console.log('✅ Mensagem enviada para', jid);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    throw error;
  }
}

export async function disconnectWhatsApp() {
  if (sock) {
    try {
      await sock.logout();
      sock.end(undefined);
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
    }
    sock = null;
  }
  connectionStatus = 'disconnected';
  qrCode = null;
  console.log('🛑 WhatsApp desconectado');
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function getQRCode() {
  return qrCode;
}

async function processMessage(text: string): Promise<string> {
  try {
    // Importar NLP engine
    const { analyzeMessage } = await import('../lib/nlp-engine');
    const analysis = analyzeMessage(text);

    // Lógica de resposta baseada na intenção
    const responses: Record<string, string> = {
      saudacao: 'Olá! 👋 Como posso ajudar você hoje?',
      agradecimento: 'De nada! Estou aqui para ajudar. 😊',
      despedida: 'Até logo! Qualquer coisa, estou por aqui. 👋',
      valores: 'Para informações sobre valores, entre em contato com nossa equipe comercial pelo telefone (XX) XXXX-XXXX',
      trafego_interesse: 'Temos excelentes soluções de tráfego pago! Posso te enviar mais informações?',
      social_interesse: 'Gestão de redes sociais é nossa especialidade! Quer saber mais sobre nossos planos?',
      site_interesse: 'Criamos sites profissionais e modernos. Posso te enviar nosso portfólio?',
      menu: 'Menu:\n1. Tráfego Pago\n2. Social Media\n3. Sites\n4. Consultoria\n\nDigite o número da opção desejada.',
      handoff: 'Vou transferir você para um atendente humano. Aguarde um momento...',
    };

    const response = responses[analysis.intent] || 'Oi, tudo bem? Como posso ajudar?';

    return response;
  } catch (error) {
    console.error('❌ Erro ao processar com NLP:', error);
    return 'Oi, tudo bem? Como posso ajudar?';
  }
}

export { sock };
