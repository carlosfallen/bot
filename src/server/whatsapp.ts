// FILE: src/server/whatsapp.ts

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs/promises';
import { saveInteraction, saveLead, getSession, updateSession } from './db';
import { analyzeMessage, getConfidenceLevel, shouldHandoff, qualifyLead } from '../lib/nlp-engine-advanced';
import { buildMessage, getNextState, shouldCollectData } from '../lib/message-builder';
import { isBusinessHours, getNextBusinessHoursMessage } from '../lib/business-hours';

const logger = pino({ level: 'info' });
const SESSION_DIR = './sessions';

let sock: WASocket | null = null;
let qrString: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let bunServer: any = null;
let isConnecting = false;
let reconnectTimeout: Timer | null = null;
let lastQRTime = 0;
let qrRetryCount = 0;

export async function initWhatsApp(server: any) {
  bunServer = server;
  
  if (sock || isConnecting) {
    logger.warn('⚠️ WhatsApp já está iniciando/conectado');
    return;
  }
  
  await connectWhatsApp();
}

async function clearSession() {
  try {
    await fs.rm(SESSION_DIR, { recursive: true, force: true });
    logger.warn('🧹 Sessão limpa após logout');
  } catch {}
}

async function connectWhatsApp() {
  // ✅ CORREÇÃO: Atomic check-and-set para evitar race condition
  if (isConnecting || sock) {
    logger.warn('⚠️ Já existe uma tentativa de conexão em andamento');
    return;
  }

  // Marcar IMEDIATAMENTE como conectando ANTES de qualquer await
  isConnecting = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  qrRetryCount = 0;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    // ✅ CORREÇÃO CRÍTICA: Limpar socket anterior COMPLETAMENTE
    if (sock) {
      const oldSock: WASocket = sock;
      sock = null; // Limpar referência IMEDIATAMENTE

      try {
        // Remover TODOS os event listeners
        oldSock.ev.removeAllListeners('connection.update');
        oldSock.ev.removeAllListeners('creds.update');
        oldSock.ev.removeAllListeners('messages.upsert');

        // Tentar logout
        try {
          await oldSock.logout();
        } catch {}

        // Encerrar socket
        oldSock.end(undefined);
      } catch (err) {
        logger.error(err, 'Erro ao limpar socket');
      }

      // Aguardar limpeza completa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.192'],  // ✅ CORREÇÃO: Browser completo
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      qrTimeout: 60000,
      defaultQueryTimeoutMs: 60000,
      getMessage: async () => {
        return { conversation: '' };
      },
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const now = Date.now();
        
        if (now - lastQRTime < 20000) {
          logger.warn('⏳ Ignorando QR repetido (throttle 20s)');
          return;
        }

        if (qrRetryCount >= 3) {
          logger.error('❌ Máximo de tentativas de QR atingido');
          await clearSession();
          qrRetryCount = 0;
          lastQRTime = 0;
          
          if (sock) {
            try {
              sock.end(undefined);
            } catch {}
            sock = null;
          }
          
          isConnecting = false;
          connectionStatus = 'disconnected';
          qrString = null;
          broadcastToClients({ type: 'status', data: 'disconnected' });
          
          logger.info('🔄 Reiniciando em 10s...');
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connectWhatsApp();
          }, 10000);
          
          return;
        }

        qrRetryCount++;
        lastQRTime = now;
        qrString = qr;

        const qrDataUrl = await QRCode.toDataURL(qr);
        broadcastToClients({ type: 'qr', data: qrDataUrl });
        logger.info(`📱 QR Code gerado (tentativa ${qrRetryCount}/3)`);
      }

      if (connection === 'connecting') {
        connectionStatus = 'connecting';
        broadcastToClients({ type: 'status', data: 'connecting' });
        logger.info('🔄 Conectando...');
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        qrString = null;
        isConnecting = false;
        lastQRTime = 0;
        qrRetryCount = 0;
        broadcastToClients({ type: 'status', data: 'connected' });
        logger.info('✅ WhatsApp conectado com sucesso');
      }

      if (connection === 'close') {
        isConnecting = false;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        const isLoggedOut = 
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401;
        
        const isConflict = statusCode === 515;

        logger.warn({ statusCode }, '❌ Conexão fechada');

        if (isLoggedOut) {
          await clearSession();
          connectionStatus = 'disconnected';
          qrString = null;
          lastQRTime = 0;
          qrRetryCount = 0;
          broadcastToClients({ type: 'status', data: 'logged_out' });
          logger.error('🚫 Sessão inválida. Escaneie o QR novamente.');
          
          logger.info('🔄 Aguardando 10s para gerar novo QR...');
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connectWhatsApp();
          }, 10000);
          
          return;
        }

        if (isConflict) {
          await clearSession();
          connectionStatus = 'disconnected';
          qrString = null;
          lastQRTime = 0;
          qrRetryCount = 0;
          broadcastToClients({ type: 'status', data: 'conflict' });

          logger.error('🚫 Conflito 515 detectado. Limpando sessão e gerando novo QR...');

          logger.info('🔄 Aguardando 15s para gerar novo QR...');
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connectWhatsApp();
          }, 15000);

          return;
        }


        connectionStatus = 'disconnected';
        broadcastToClients({ type: 'status', data: 'disconnected' });

        logger.info('🔄 Reconectando em 10s...');
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectWhatsApp();
        }, 10000);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid || '';
        
        if (!jid.endsWith('@s.whatsapp.net')) continue;

        const phone = jid.replace('@s.whatsapp.net', '');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!text) continue;

        logger.info({ phone, text }, '📨 Mensagem recebida');
        await handleIncomingMessage(phone, text);
      }
    });

  } catch (error) {
    isConnecting = false;
    logger.error(error, '❌ Erro ao conectar WhatsApp');
    connectionStatus = 'disconnected';
    
    logger.info('🔄 Tentando novamente em 10s...');
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectWhatsApp();
    }, 10000);
  }
}

async function handleIncomingMessage(phone: string, text: string) {
  try {
    saveInteraction(phone, 'in', text);

    const session = getSession(phone) as any;
    const currentState = session?.state || 'initial';
    const context = session ? JSON.parse(session.context) : {};

    const inBusinessHours = isBusinessHours();

    if (!inBusinessHours && (currentState === 'initial' || !session)) {
      const response = getNextBusinessHoursMessage();
      await sendMessage(phone, response);
      saveInteraction(phone, 'out', response, 'fora_horario', 1.0);

      const nlp = analyzeMessage(text);
      Object.assign(context, nlp.entities);
      updateSession(phone, 'fora_horario', context);

      broadcastToClients({
        type: 'new_message',
        data: { phone, text, intent: 'fora_horario', confidence: 1.0, direction: 'in' }
      });

      return;
    }

    const nlp = analyzeMessage(text);
    logger.info({
      phone,
      intent: nlp.intent,
      confidence: nlp.confidence,
      entities: nlp.entities,
      sentiment: nlp.sentiment
    }, '🧠 NLP análise');

    broadcastToClients({
      type: 'new_message',
      data: {
        phone,
        text,
        intent: nlp.intent,
        confidence: nlp.confidence,
        sentiment: nlp.sentiment,
        direction: 'in'
      }
    });

    Object.assign(context, nlp.entities);

    if (nlp.intent === 'nao_entendi' || getConfidenceLevel(nlp.confidence) === 'low') {
      context.tentativas_nao_entendeu = (context.tentativas_nao_entendeu || 0) + 1;
    } else {
      context.tentativas_nao_entendeu = 0;
    }

    if (nlp.sentiment === 'negative') {
      context.mensagens_negativas = (context.mensagens_negativas || 0) + 1;
    }

    if (nlp.intent.includes('interesse')) {
      const servico = nlp.intent.replace('_interesse', '');
      context.servico_interesse = servico;
    }

    if (shouldHandoff(nlp, context)) {
      const response = buildMessage('handoff', context);
      await sendMessage(phone, response);
      saveInteraction(phone, 'out', response, 'handoff', 1.0);

      await notifyAdmin(phone, context, nlp);

      updateSession(phone, 'aguardando_humano', context);

      broadcastToClients({
        type: 'handoff',
        data: { phone, context, nlp }
      });

      return;
    }

    const collectData = shouldCollectData(context);

    let responseIntent = nlp.intent;

    if (collectData && currentState === 'coleta_dados') {
      responseIntent = collectData.intent;
    }

    if (getConfidenceLevel(nlp.confidence) === 'low' && currentState === 'initial') {
      responseIntent = 'nao_entendi';
    }

    const response = buildMessage(responseIntent, context);

    const nextState = getNextState(currentState, nlp.intent, context);

    let leadStatus = 'em_atendimento';
    if (context.nome && context.servico_interesse) {
      const qualification = qualifyLead(context);
      context.qualificacao = qualification;

      if (qualification === 'quente' && nextState === 'finalizado') {
        leadStatus = 'qualificado';
        await notifyAdmin(phone, context, nlp, 'Lead QUENTE qualificado!');
      } else if (nextState === 'finalizado') {
        leadStatus = 'qualificado';
      }
    }

    updateSession(phone, nextState, context);

    if (context.nome || context.empresa) {
      saveLead({
        phone,
        nome: context.nome,
        empresa: context.empresa,
        cidade: context.cidade,
        servico_interesse: context.servico_interesse,
        objetivo: context.objetivo,
        orcamento: context.orcamento,
        prazo: context.prazo,
        status: leadStatus
      });
    }

    await sendMessage(phone, response);

    saveInteraction(phone, 'out', response, responseIntent, nlp.confidence);

    broadcastToClients({
      type: 'new_message',
      data: { phone, text: response, intent: responseIntent, direction: 'out' }
    });

  } catch (error) {
    logger.error(error, '❌ Erro ao processar mensagem');
    await sendMessage(phone, 'Desculpa, tive um problema aqui. Pode repetir? 😅');
  }
}

async function notifyAdmin(phone: string, context: Record<string, any>, nlp: any, customMessage?: string) {
  const adminNumber = process.env.ADMIN_NUMBER;
  if (!adminNumber) return;

  const message = customMessage || '🔔 *Novo Handoff Solicitado*';

  const summary = `
${message}

📱 *Cliente:* ${phone}
👤 *Nome:* ${context.nome || 'Não informado'}
🏢 *Empresa:* ${context.empresa || 'Não informada'}
📍 *Cidade:* ${context.cidade || 'Não informada'}
🎯 *Serviço:* ${context.servico_interesse || 'Não especificado'}
💰 *Orçamento:* ${context.orcamento ? `R$ ${context.orcamento}` : 'Não informado'}
⏰ *Prazo:* ${context.prazo || 'Não informado'}
🔥 *Qualificação:* ${context.qualificacao || 'Não qualificado'}
💭 *Última mensagem:* ${nlp.normalized}

_Responda pelo WhatsApp ou acesse o dashboard_
  `.trim();

  await sendMessage(adminNumber, summary);
  logger.info({ adminNumber, phone }, '📧 Admin notificado');
}

async function sendMessage(phone: string, text: string) {
  if (!sock || connectionStatus !== 'connected') {
    logger.warn('⚠️ WhatsApp não conectado - mensagem não enviada');
    return;
  }

  try {
    const jid = `${phone}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    logger.info({ phone }, '✅ Mensagem enviada');
  } catch (error) {
    logger.error(error, '❌ Erro ao enviar mensagem');
  }
}

function broadcastToClients(message: any) {
  if (!bunServer) return;

  try {
    bunServer.publish('dashboard', JSON.stringify(message));
  } catch (error) {
    logger.error(error, '❌ Erro ao broadcast WebSocket');
  }
}

export function getQRCode() {
  return qrString;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export async function disconnectWhatsApp() {
  logger.info('🛑 Desconectando WhatsApp...');

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // ✅ CORREÇÃO: Limpar completamente antes de desconectar
  if (sock) {
    const oldSock: WASocket = sock;
    sock = null;

    try {
      // Remover event listeners
      oldSock.ev.removeAllListeners('connection.update');
      oldSock.ev.removeAllListeners('creds.update');
      oldSock.ev.removeAllListeners('messages.upsert');

      // Fazer logout
      await oldSock.logout();

      // Encerrar socket
      oldSock.end(undefined);
    } catch (err) {
      logger.error(err, 'Erro ao desconectar');
    }
  }

  isConnecting = false;
  connectionStatus = 'disconnected';
  qrRetryCount = 0;
  lastQRTime = 0;
  logger.info('✅ WhatsApp desconectado');
}

export { sendMessage };