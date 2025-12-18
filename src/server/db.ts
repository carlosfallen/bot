// src/server/db.ts - CORRIGIDO COM CRIAÇÃO DE DIRETÓRIO

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Criar diretório data se não existir
const dbPath = process.env.DB_PATH || './data/imperio.db';
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
  console.log(`📁 Diretório criado: ${dbDir}`);
}

const db = new Database(dbPath, { create: true });

export async function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      nome TEXT,
      empresa TEXT,
      cidade TEXT,
      servico_interesse TEXT,
      objetivo TEXT,
      orcamento TEXT,
      prazo TEXT,
      qualification TEXT DEFAULT 'frio',
      status TEXT DEFAULT 'novo',
      origem TEXT DEFAULT 'whatsapp',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      intent TEXT,
      confidence REAL,
      sentiment TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      phone TEXT PRIMARY KEY,
      state TEXT DEFAULT 'initial',
      qualification TEXT DEFAULT 'frio',
      context TEXT DEFAULT '{}',
      last_interaction INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intent TEXT NOT NULL,
      variations TEXT NOT NULL,
      requires_data TEXT,
      priority INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_interactions_phone ON interactions(phone, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_last ON sessions(last_interaction DESC);
  `);

  // Inserir templates padrão
  const hasTemplates = db.query('SELECT COUNT(*) as count FROM message_templates').get() as { count: number };

  if (hasTemplates.count === 0) {
    insertDefaultTemplates();
  }
}

function insertDefaultTemplates() {
  const templates = [
    {
      intent: 'saudacao',
      variations: JSON.stringify([
        'Oi! Tudo bem? 👋',
        'Olá! Como vai? 😊',
        'E aí! Tudo certo? 🙂'
      ]),
      requires_data: null,
      priority: 10
    },
    {
      intent: 'apresentacao',
      variations: JSON.stringify([
        'Sou da Império Lorde, agência completa de marketing digital. Como posso te ajudar?',
        'Aqui é da Império Lorde! Trabalhamos com tráfego pago, criativos, social media e muito mais. Em que posso ajudar?',
        'Império Lorde - especialistas em performance digital. Me conta, o que você precisa?'
      ]),
      requires_data: null,
      priority: 9
    },
    {
      intent: 'menu',
      variations: JSON.stringify([
        '📋 *O que você precisa?*\n\n1️⃣ Tráfego Pago\n2️⃣ Criativos\n3️⃣ Social Media\n4️⃣ Site/Landing Page\n5️⃣ Consultoria\n\nDigita o número ou me conta o que precisa! 😊'
      ]),
      requires_data: null,
      priority: 8
    },
    {
      intent: 'trafego_interesse',
      variations: JSON.stringify([
        'Show! Tráfego pago é nosso forte. Você já anuncia hoje ou vai começar do zero?',
        'Perfeito! Meta Ads, Google Ads ou TikTok? Ou quer saber de todas?',
        'Boa! Qual plataforma te interessa: Facebook/Instagram, Google ou TikTok?'
      ]),
      requires_data: 'servico:trafego',
      priority: 7
    },
    {
      intent: 'coleta_nome',
      variations: JSON.stringify([
        'Qual seu nome?',
        'Me conta seu nome?',
        'Como você se chama?'
      ]),
      requires_data: null,
      priority: 6
    },
    {
      intent: 'handoff',
      variations: JSON.stringify([
        'Entendi! Vou transferir você para um atendente humano. Aguarde um momento! 👤',
        'Sem problemas! Já vou te conectar com nosso time. Só um minutinho! ⏱️',
        'Claro! Um de nossos especialistas vai te atender agora. Aguarde! 🙋‍♂️'
      ]),
      requires_data: null,
      priority: 11
    },
    {
      intent: 'nao_entendi',
      variations: JSON.stringify([
        'Desculpa, não entendi bem. Pode reformular? 😅',
        'Hmm, não captei. Pode explicar de outro jeito? 🤔',
        'Opa, não peguei. Me fala de outra forma? 😊'
      ]),
      requires_data: null,
      priority: 1
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO message_templates (intent, variations, requires_data, priority, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  for (const template of templates) {
    stmt.run(template.intent, template.variations, template.requires_data, template.priority);
  }
}

export { db };

export function saveLead(data: any) {
  const stmt = db.prepare(`
    INSERT INTO leads (phone, nome, empresa, cidade, servico_interesse, objetivo, orcamento, prazo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      nome = COALESCE(?, nome),
      empresa = COALESCE(?, empresa),
      cidade = COALESCE(?, cidade),
      servico_interesse = COALESCE(?, servico_interesse),
      objetivo = COALESCE(?, objetivo),
      orcamento = COALESCE(?, orcamento),
      prazo = COALESCE(?, prazo),
      status = COALESCE(?, status),
      updated_at = strftime('%s', 'now')
  `);

  stmt.run(
    data.phone, data.nome, data.empresa, data.cidade, data.servico_interesse,
    data.objetivo, data.orcamento, data.prazo, data.status || 'novo',
    data.nome, data.empresa, data.cidade, data.servico_interesse,
    data.objetivo, data.orcamento, data.prazo, data.status
  );
}

export function saveInteraction(phone: string, direction: 'in' | 'out', message: string, intent?: string, confidence?: number) {
  const stmt = db.prepare(`
    INSERT INTO interactions (phone, direction, message, intent, confidence)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(phone, direction, message, intent || null, confidence || null);
}

export function getSession(phone: string) {
  const stmt = db.query('SELECT * FROM sessions WHERE phone = ?');
  return stmt.get(phone);
}

export function updateSession(phone: string, state: string, context: any) {
  const stmt = db.prepare(`
    INSERT INTO sessions (phone, state, context, last_interaction)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(phone) DO UPDATE SET
      state = ?,
      context = ?,
      last_interaction = strftime('%s', 'now')
  `);

  const contextStr = JSON.stringify(context);
  stmt.run(phone, state, contextStr, state, contextStr);
}

export function getTemplatesByIntent(intent: string) {
  const stmt = db.query('SELECT * FROM message_templates WHERE intent = ? AND active = 1');
  return stmt.all(intent);
}

export function getAllConversations(limit = 50) {
  const stmt = db.query(`
    SELECT
      l.phone,
      l.nome,
      l.empresa,
      l.status,
      s.state,
      s.last_interaction,
      (SELECT message FROM interactions WHERE phone = l.phone ORDER BY created_at DESC LIMIT 1) as last_message
    FROM leads l
    LEFT JOIN sessions s ON l.phone = s.phone
    ORDER BY s.last_interaction DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

export function getConversationHistory(phone: string, limit = 100) {
  const stmt = db.query(`
    SELECT * FROM interactions
    WHERE phone = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const results = stmt.all(phone, limit) as any[];
  return results.reverse();
}