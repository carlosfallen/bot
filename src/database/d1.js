// FILE: src/database/d1.js

// Node 18+ tem fetch global. Se estiver em Node < 18, instala node-fetch:
// npm i node-fetch
const _fetch = globalThis.fetch || require('node-fetch');

class CloudflareD1 {
  constructor(config = {}) {
    const { accountId, databaseId, apiToken } = config;

    this.accountId = accountId || '';
    this.databaseId = databaseId || '';
    this.apiToken = apiToken || '';

    this.enabled = Boolean(this.accountId && this.databaseId && this.apiToken);
    this.ready = false;
    this.initError = null;

    this.baseUrl = this.enabled
      ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`
      : null;

    if (!this.enabled) {
      console.error('Cloudflare D1 não configurado. Rodando sem banco.', {
        hasAccountId: !!this.accountId,
        hasDatabaseId: !!this.databaseId,
        hasApiToken: !!this.apiToken
      });
      this.initPromise = Promise.resolve();
      return;
    }

    // inicia schema e marca ready (sem unhandled rejection)
    this.initPromise = this.init()
      .then(() => {
        this.ready = true;
      })
      .catch((e) => {
        this.initError = e;
        this.ready = false;
        console.error('⚠️ Falha init D1:', e.message);
      });
  }

  isReady() {
    return Boolean(this.enabled && this.ready && !this.initError);
  }

  async ensureReady() {
    await this.initPromise;
    if (this.initError) throw this.initError;
    return true;
  }

  async query(sql, params = []) {
    if (!this.enabled) throw new Error('D1 desabilitado (config ausente)');

    const response = await _fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    });

    const data = await response.json().catch(() => null);

    if (!data?.success) {
      const error = data?.errors?.[0]?.message || `Erro D1 (HTTP ${response.status})`;
      throw new Error(error);
    }

    const first = Array.isArray(data.result) ? data.result[0] : null;
    return first?.results || [];
  }

  async run(sql, params = []) {
    return this.query(sql, params);
  }

  // ==================== SCHEMA ====================

  async init() {
    console.log('📦 Verificando Schema do D1...');

    const schema = [
      `CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        name TEXT,
        email TEXT,
        company TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_interaction TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        tags TEXT,
        notes TEXT
      );`,

      `CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        chat_id TEXT NOT NULL UNIQUE,
        chat_type TEXT DEFAULT 'private',
        is_bot_active INTEGER DEFAULT 1,
        stage TEXT DEFAULT 'inicio',
        assunto TEXT,
        plano TEXT,
        last_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        message_id TEXT,
        direction TEXT NOT NULL,
        message_text TEXT,
        intent TEXT,
        confidence REAL,
        entities TEXT,
        is_bot_response INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS bot_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_messages INTEGER DEFAULT 0,
        total_conversations INTEGER DEFAULT 0,
        new_leads INTEGER DEFAULT 0,
        bot_responses INTEGER DEFAULT 0,
        avg_response_time REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date)
      );`,

      `CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        lead_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        produto TEXT,
        plano TEXT,
        valor INTEGER,
        pagamento TEXT,
        parcelas INTEGER,
        contrato_url TEXT,
        pagamento_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
      );`,

      `CREATE INDEX IF NOT EXISTS idx_deals_chat ON deals(chat_id, status);`,

      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        lead_id INTEGER,
        start_at TEXT NOT NULL,
        duration_min INTEGER DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'proposed',
        meet_link TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
      );`,

      `CREATE INDEX IF NOT EXISTS idx_appt_chat ON appointments(chat_id, status);`
    ];

    for (const sql of schema) {
      await this.run(sql);
    }

    // MIGRAÇÕES suaves (ignora se já existir)
    try { await this.run("ALTER TABLE conversations ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"); } catch {}
    try { await this.run("ALTER TABLE leads ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"); } catch {}
    try { await this.run("ALTER TABLE leads ADD COLUMN last_interaction TEXT DEFAULT CURRENT_TIMESTAMP"); } catch {}

    await this.run(
      "INSERT OR IGNORE INTO bot_config (key, value, description) VALUES ('bot_enabled', 'true', 'Bot ativo')"
    );

    console.log('✅ D1 Schema sincronizado e atualizado.');
  }

  // ==================== LEADS ====================

  async saveLead(data) {
    const { phone, name, email, company, tags, notes } = data;
    const now = new Date().toISOString();
    const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null);

    const sql = `
      INSERT INTO leads (phone, name, email, company, tags, notes, created_at, updated_at, last_interaction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = COALESCE(excluded.name, leads.name),
        email = COALESCE(excluded.email, leads.email),
        company = COALESCE(excluded.company, leads.company),
        tags = COALESCE(excluded.tags, leads.tags),
        notes = COALESCE(excluded.notes, leads.notes),
        updated_at = excluded.updated_at,
        last_interaction = excluded.last_interaction
    `;

    await this.run(sql, [phone, name, email, company, tagsStr, notes, now, now, now]);
    const existing = await this.query('SELECT id FROM leads WHERE phone = ? LIMIT 1', [phone]);
    return existing.length > 0 ? existing[0].id : null;
  }

  async getLeadByPhone(phone) {
    const res = await this.query('SELECT * FROM leads WHERE phone = ? LIMIT 1', [phone]);
    return res[0] || null;
  }

  async getLeads(limit = 50, offset = 0) {
    return this.query(
      `SELECT * FROM leads WHERE is_active = 1 ORDER BY last_interaction DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  // ==================== CONVERSATIONS ====================

  async getOrCreateConversation(chatId, leadId, chatType = 'private') {
    const existing = await this.query('SELECT * FROM conversations WHERE chat_id = ? LIMIT 1', [chatId]);
    if (existing.length > 0) return existing[0];

    await this.run(`INSERT INTO conversations (chat_id, lead_id, chat_type, stage) VALUES (?, ?, ?, 'inicio')`, [
      chatId, leadId, chatType
    ]);

    const retry = await this.query('SELECT * FROM conversations WHERE chat_id = ? LIMIT 1', [chatId]);
    return retry[0] || null;
  }

  async updateConversation(chatId, data) {
    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(data || {})) {
      if (['is_bot_active', 'chat_type', 'stage', 'assunto', 'plano'].includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) return;

    params.push(chatId);
    await this.run(
      `UPDATE conversations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`,
      params
    );
  }

  async getConversationByChatId(chatId) {
    const res = await this.query('SELECT * FROM conversations WHERE chat_id = ? LIMIT 1', [chatId]);
    return res[0] || null;
  }

  // ==================== MESSAGES ====================

  async saveMessage(conversationId, data) {
    const { messageId, direction, text, intent, confidence, entities, isBot } = data;

    await this.run(
      `INSERT INTO messages (
        conversation_id, message_id, direction, message_text,
        intent, confidence, entities, is_bot_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversationId,
        messageId || null,
        direction,
        text || '',
        intent || null,
        confidence || null,
        entities ? JSON.stringify(entities) : null,
        isBot ? 1 : 0
      ]
    );

    await this.run(
      `UPDATE conversations
       SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [conversationId]
    );

    await this.updateDailyStats(isBot);
  }

  async getRecentMessages(conversationId, limit = 10) {
    const res = await this.query(
      `SELECT direction, message_text, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [conversationId, limit]
    );

    return (res || []).reverse();
  }

  // ==================== DEALS / APPOINTMENTS / STATS / CONFIG ===
  // (mantive o resto do seu código igual, pode colar a parte abaixo do seu arquivo sem mudanças)

  async getOpenDeal(chatId) {
    const res = await this.query(
      `SELECT * FROM deals
       WHERE chat_id = ?
         AND status IN ('open', 'waiting_payment')
       ORDER BY id DESC
       LIMIT 1`,
      [chatId]
    );
    return res[0] || null;
  }

  async upsertDeal(chatId, leadId, payload = {}) {
    const existing = await this.getOpenDeal(chatId);
    const now = new Date().toISOString();

    const clean = {
      status: payload.status || undefined,
      produto: payload.produto || undefined,
      plano: payload.plano || undefined,
      valor: (typeof payload.valor === 'number') ? payload.valor : (payload.valor ? Number(payload.valor) : undefined),
      pagamento: payload.pagamento || undefined,
      parcelas: (typeof payload.parcelas === 'number') ? payload.parcelas : (payload.parcelas ? Number(payload.parcelas) : undefined),
      contrato_url: payload.contrato_url || undefined,
      pagamento_url: payload.pagamento_url || undefined
    };

    if (existing?.id) {
      const fields = [];
      const params = [];

      for (const [k, v] of Object.entries(clean)) {
        if (v === undefined || v === null) continue;
        fields.push(`${k} = ?`);
        params.push(v);
      }

      fields.push(`updated_at = ?`);
      params.push(now);
      params.push(existing.id);

      await this.run(`UPDATE deals SET ${fields.join(', ')} WHERE id = ?`, params);

      const updated = await this.query('SELECT * FROM deals WHERE id = ? LIMIT 1', [existing.id]);
      return updated[0] || null;
    }

    await this.run(
      `INSERT INTO deals (chat_id, lead_id, status, produto, plano, valor, pagamento, parcelas, contrato_url, pagamento_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chatId,
        leadId || null,
        clean.status || 'open',
        clean.produto || null,
        clean.plano || null,
        (typeof clean.valor === 'number' ? clean.valor : null),
        clean.pagamento || null,
        (typeof clean.parcelas === 'number' ? clean.parcelas : null),
        clean.contrato_url || null,
        clean.pagamento_url || null,
        now,
        now
      ]
    );

    const res = await this.query(`SELECT * FROM deals WHERE chat_id = ? ORDER BY id DESC LIMIT 1`, [chatId]);
    return res[0] || null;
  }

  async createAppointment(chatId, leadId, payload = {}) {
    const startAt = payload.start_at;
    if (!startAt) throw new Error('createAppointment: start_at obrigatório');

    const duration = payload.duration_min ? Number(payload.duration_min) : 10;
    const status = payload.status || 'proposed';
    const notes = payload.notes || null;
    const meetLink = payload.meet_link || null;

    await this.run(
      `INSERT INTO appointments (chat_id, lead_id, start_at, duration_min, status, meet_link, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chatId, leadId || null, startAt, duration, status, meetLink, notes]
    );

    const res = await this.query(`SELECT * FROM appointments WHERE chat_id = ? ORDER BY id DESC LIMIT 1`, [chatId]);
    return res[0] || null;
  }

  async listAppointments(chatId, status = null, limit = 10) {
    if (status) {
      return this.query(
        `SELECT * FROM appointments WHERE chat_id = ? AND status = ? ORDER BY id DESC LIMIT ?`,
        [chatId, status, limit]
      );
    }
    return this.query(
      `SELECT * FROM appointments WHERE chat_id = ? ORDER BY id DESC LIMIT ?`,
      [chatId, limit]
    );
  }

  async updateDailyStats(isBot = false) {
    const today = new Date().toISOString().split('T')[0];
    await this.run(
      `INSERT INTO statistics (date, total_messages, bot_responses)
       VALUES (?, 1, ?)
       ON CONFLICT(date) DO UPDATE SET
         total_messages = total_messages + 1,
         bot_responses = bot_responses + ?`,
      [today, isBot ? 1 : 0, isBot ? 1 : 0]
    );
  }

  async setConfig(key, value) {
    const strValue =
      typeof value === 'boolean' ? String(value) :
      typeof value === 'object' ? JSON.stringify(value) :
      String(value);

    await this.run(
      `INSERT INTO bot_config (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, strValue]
    );
  }

  async getConfig(key) {
    const res = await this.query('SELECT value FROM bot_config WHERE key = ? LIMIT 1', [key]);
    if (!res.length) return null;

    const val = res[0].value;
    if (val === 'true') return true;
    if (val === 'false') return false;
    try { return JSON.parse(val); } catch { return val; }
  }

  async getAllConfig() {
    const configs = await this.query('SELECT key, value FROM bot_config');
    const result = {};

    for (const { key, value } of configs) {
      if (value === 'true') result[key] = true;
      else if (value === 'false') result[key] = false;
      else {
        try { result[key] = JSON.parse(value); } catch { result[key] = value; }
      }
    }
    return result;
  }
}

module.exports = CloudflareD1;
