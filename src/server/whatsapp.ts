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
import { saveInteraction, saveLead, getSession, updateSession } from './db';
import { analyzeMessage, getConfidenceLevel } from '../lib/nlp-engine';
import { buildMessage, getNextState, shouldCollectData } from '../lib/message-builder';
import type { WebSocketServer } from 'ws';

const logger = pino({ level: 'info' });
const SESSION_DIR = './sessions';

let sock: WASocket | null = null;
let qrString: string | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let wsServer: WebSocketServer | null = null;

export async function initWhatsApp(wss: WebSocketServer) {
  wsServer = wss;
  await connectWhatsApp();
}

async function connectWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Império Lorde', 'Chrome', '120.0'],
      printQRInTerminal: false,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrString = qr;
        const qrDataUrl = await QRCode.toDataURL(qr);
        broadcastToClients({ type: 'qr', data: qrDataUrl });
        logger.info('QR Code gerado');
      }

      if (connection === 'connecting') {
        connectionStatus = 'connecting';
        broadcastToClients({ type: 'status', data: 'connecting' });
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        qrString = null;
        broadcastToClients({ type: 'status', data: 'connected' });
        logger.info('✅ WhatsApp conectado');
      }

      if (connection === 'close') {
        connectionStatus = 'disconnected';
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        if (statusCode !== DisconnectReason.loggedOut) {
          logger.warn('Reconectando em 5s...');
          setTimeout(connectWhatsApp, 5000);
        } else {
          broadcastToClients({ type: 'status', data: 'logged_out' });
          logger.error('❌ Desconectado. Escaneie o QR novamente.');
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid || '';
        
        // Ignorar grupos, canais, status
        if (!jid.endsWith('@s.whatsapp.net')) continue;

        const phone = jid.replace('@s.whatsapp.net', '');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!text) continue;

        logger.info({ phone, text }, 'Mensagem recebida');
        await handleIncomingMessage(phone, text);
      }
    });

  } catch (error) {
    logger.error(error, 'Erro ao conectar WhatsApp');
    connectionStatus = 'disconnected';
  }
}

async function handleIncomingMessage(phone: string, text: string) {
  try {
    // Salvar mensagem recebida
    saveInteraction(phone, 'in', text);

    // Analisar com NLP
    const nlp = analyzeMessage(text);
    logger.info({ phone, intent: nlp.intent, confidence: nlp.confidence }, 'NLP análise');

    // Broadcast para dashboard
    broadcastToClients({
      type: 'new_message',
      data: { phone, text, intent: nlp.intent, confidence: nlp.confidence, direction: 'in' }
    });

    // Pegar sessão atual
    const session = getSession(phone) as any;
    const currentState = session?.state || 'initial';
    const context = session ? JSON.parse(session.context) : {};

    // Atualizar contexto com entidades extraídas
    Object.assign(context, nlp.entities);

    // Se mencionou serviço, salvar
    if (nlp.intent.includes('interesse')) {
      const servico = nlp.intent.replace('_interesse', '');
      context.servico_interesse = servico;
    }

    // Verificar se precisa coletar dados
    const collectData = shouldCollectData(context);
    
    let responseIntent = nlp.intent;
    
    if (collectData && currentState === 'coleta_dados') {
      responseIntent = collectData.intent;
    }

    // Se confiança baixa e não está em coleta, mostrar menu
    if (getConfidenceLevel(nlp.confidence) === 'low' && currentState === 'initial') {
      responseIntent = 'nao_entendi';
    }

    // Construir resposta
    const response = buildMessage(responseIntent, context);

    // Determinar próximo estado
    const nextState = getNextState(currentState, nlp.intent, context);

    // Atualizar sessão
    updateSession(phone, nextState, context);

    // Salvar lead se tiver dados suficientes
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
        status: nextState === 'finalizado' ? 'qualificado' : 'em_atendimento'
      });
    }

    // Enviar resposta
    await sendMessage(phone, response);

    // Salvar resposta
    saveInteraction(phone, 'out', response, responseIntent, nlp.confidence);

    // Broadcast resposta
    broadcastToClients({
      type: 'new_message',
      data: { phone, text: response, intent: responseIntent, direction: 'out' }
    });

  } catch (error) {
    logger.error(error, 'Erro ao processar mensagem');
    await sendMessage(phone, 'Desculpa, tive um problema aqui. Pode repetir? 😅');
  }
}

async function sendMessage(phone: string, text: string) {
  if (!sock || connectionStatus !== 'connected') {
    logger.warn('WhatsApp não conectado');
    return;
  }

  const jid = `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
  logger.info({ phone, text }, 'Mensagem enviada');
}

function broadcastToClients(message: any) {
  if (!wsServer) return;

  wsServer.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

export function getQRCode() {
  return qrString;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export { sendMessage };