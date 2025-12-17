// FILE: src/server/db.ts

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

const db = new Database(process.env.DB_PATH || './data/imperio.db');
const drizzleDb = drizzle(db);

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
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      phone TEXT PRIMARY KEY,
      state TEXT DEFAULT 'initial',
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
  const hasTemplates = db.prepare('SELECT COUNT(*) as count FROM message_templates').get() as { count: number };
  
  if (hasTemplates.count === 0) {
    insertDefaultTemplates(db);
  }
}

function insertDefaultTemplates(db: Database.Database) {
  const templates = [
    {
      intent: 'saudacao',
      variations: JSON.stringify([
        'Oi {nome}! Tudo bem? 👋',
        'Olá {nome}! Como vai? 😊',
        'E aí {nome}! Tudo certo? 🙂'
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
      intent: 'coleta_empresa',
      variations: JSON.stringify([
        'Legal! E qual o nome da sua empresa?',
        'Show! Nome da empresa?',
        'Perfeito! Qual empresa?'
      ]),
      requires_data: 'nome',
      priority: 5
    },
    {
      intent: 'confirma_dados',
      variations: JSON.stringify([
        'Entendi! Vou resumir:\n\n{dados}\n\nEstá correto?',
        'Show! Deixa eu confirmar:\n\n{dados}\n\nTá certo?',
        'Boa! Então temos:\n\n{dados}\n\nConfirma?'
      ]),
      requires_data: 'nome,empresa',
      priority: 4
    },
    {
      intent: 'agendamento',
      variations: JSON.stringify([
        'Perfeito! Vamos agendar uma call de 15min?\n\n📅 Amanhã 10h\n📅 Depois de amanhã 14h\n📅 Outro horário',
        'Ótimo! Quando podemos conversar?\n\n- Amanhã de manhã\n- Amanhã à tarde\n- Me fala um horário',
        'Show! Qual horário é melhor pra você?\n\n• Manhã (9h-12h)\n• Tarde (14h-17h)\n• Me sugere'
      ]),
      requires_data: 'nome,servico_interesse',
      priority: 3
    },
    {
      intent: 'fora_horario',
      variations: JSON.stringify([
        'Opa! Estamos fora do horário agora (seg-sex, 8h-18h). Já anotei tudo e te retorno amanhã! 😊',
        'Recebido! Estamos fechados agora, mas amanhã de manhã já te dou retorno! 👍',
        'Olá! Fora do expediente no momento. Anotei sua mensagem e retorno no próximo dia útil! 🙂'
      ]),
      requires_data: null,
      priority: 2
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

export { db, drizzleDb };

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
  const stmt = db.prepare('SELECT * FROM sessions WHERE phone = ?');
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
  const stmt = db.prepare('SELECT * FROM message_templates WHERE intent = ? AND active = 1');
  return stmt.all(intent);
}

export function getAllConversations(limit = 50) {
  const stmt = db.prepare(`
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
  const stmt = db.prepare(`
    SELECT * FROM interactions
    WHERE phone = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(phone, limit).reverse();
}