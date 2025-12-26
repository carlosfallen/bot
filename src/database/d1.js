
const _fetch = globalThis.fetch || require('node-fetch');

class CloudflareD1 {
  constructor(config = {}) {
    this.accountId = config.accountId || '';
    this.databaseId = config.databaseId || '';
    this.apiToken = config.apiToken || '';
    this.enabled = Boolean(this.accountId && this.databaseId && this.apiToken);
    this.ready = false;
    this.initError = null;
    this.configCache = new Map();

    this.baseUrl = this.enabled
      ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`
      : null;

    if (!this.enabled) {
      console.error('⚠️ D1 não configurado');
      this.initPromise = Promise.resolve();
      return;
    }

    this.initPromise = this.init()
      .then(() => { this.ready = true; })
      .catch(e => { this.initError = e; console.error('⚠️ D1 init falhou:', e.message); });
  }

  isReady() { return Boolean(this.enabled && this.ready && !this.initError); }
  async ensureReady() { await this.initPromise; if (this.initError) throw this.initError; return true; }

  async query(sql, params = []) {
    if (!this.enabled) throw new Error('D1 desabilitado');
    const response = await _fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    const data = await response.json().catch(() => null);
    if (!data?.success) throw new Error(data?.errors?.[0]?.message || `HTTP ${response.status}`);
    return data.result?.[0]?.results || [];
  }

  async run(sql, params = []) { return this.query(sql, params); }

  async init() {
    console.log('📦 Inicializando D1...');
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      const statements = schema.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
      for (const stmt of statements) {
        try { await this.run(stmt); } catch (e) { /* ignore */ }
      }
    }
    console.log('✅ D1 pronto');
  }

  // ==================== CONFIG ====================
  
  async getConfig(key) {
    if (this.configCache.has(key)) return this.configCache.get(key);
    const res = await this.query('SELECT value, type FROM bot_config WHERE key = ? LIMIT 1', [key]);
    if (!res.length) return null;
    const val = this.parseConfigValue(res[0].value, res[0].type);
    this.configCache.set(key, val);
    return val;
  }

  async setConfig(key, value) {
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await this.run(
      `UPDATE bot_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`,
      [strValue, key]
    );
    this.configCache.delete(key);
  }

  async getAllConfig() {
    const configs = await this.query('SELECT key, value, type, category, label, description FROM bot_config ORDER BY category, key');
    const result = {};
    for (const c of configs) {
      result[c.key] = {
        value: this.parseConfigValue(c.value, c.type),
        type: c.type,
        category: c.category,
        label: c.label,
        description: c.description
      };
    }
    return result;
  }

  async getConfigByCategory(category) {
    return this.query('SELECT * FROM bot_config WHERE category = ? ORDER BY key', [category]);
  }

  parseConfigValue(value, type) {
    if (type === 'boolean') return value === 'true';
    if (type === 'number') return Number(value);
    if (type === 'json') try { return JSON.parse(value); } catch { return value; }
    return value;
  }

  // ==================== LEADS ====================
  
  async saveLead(data) {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO leads (phone, name, email, company, segment, source, status, heat, tags, notes, created_at, updated_at, last_interaction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = COALESCE(NULLIF(excluded.name, ''), leads.name),
        email = COALESCE(NULLIF(excluded.email, ''), leads.email),
        company = COALESCE(NULLIF(excluded.company, ''), leads.company),
        segment = COALESCE(NULLIF(excluded.segment, ''), leads.segment),
        tags = COALESCE(excluded.tags, leads.tags),
        notes = COALESCE(excluded.notes, leads.notes),
        updated_at = excluded.updated_at,
        last_interaction = excluded.last_interaction
    `;
    await this.run(sql, [
      data.phone, data.name || null, data.email || null, data.company || null,
      data.segment || null, data.source || 'whatsapp', data.status || 'new', data.heat || 'cold',
      Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || null),
      data.notes || null, now, now, now
    ]);
    const res = await this.query('SELECT id FROM leads WHERE phone = ? LIMIT 1', [data.phone]);
    return res[0]?.id || null;
  }

  async getLeadByPhone(phone) {
    const res = await this.query('SELECT * FROM leads WHERE phone = ? LIMIT 1', [phone]);
    return res[0] || null;
  }

  async getLeadById(id) {
    const res = await this.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [id]);
    return res[0] || null;
  }

  async getLeads(limit = 50, offset = 0, filters = {}) {
    let sql = 'SELECT * FROM leads WHERE is_active = 1';
    const params = [];
    
    if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters.heat) { sql += ' AND heat = ?'; params.push(filters.heat); }
    if (filters.search) { 
      sql += ' AND (name LIKE ? OR phone LIKE ? OR company LIKE ? OR email LIKE ?)'; 
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }
    
    sql += ' ORDER BY last_interaction DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return this.query(sql, params);
  }

  async updateLead(id, data) {
    const fields = [];
    const params = [];
    const allowed = ['name', 'email', 'company', 'segment', 'status', 'heat', 'score', 'assigned_to', 'notes', 'tags', 'custom_fields'];
    
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    
    if (!fields.length) return;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await this.run(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async deleteLead(id) {
    await this.run('UPDATE leads SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  async getLeadStats() {
    const total = await this.query('SELECT COUNT(*) as count FROM leads WHERE is_active = 1');
    const byStatus = await this.query('SELECT status, COUNT(*) as count FROM leads WHERE is_active = 1 GROUP BY status');
    const byHeat = await this.query('SELECT heat, COUNT(*) as count FROM leads WHERE is_active = 1 GROUP BY heat');
    const today = new Date().toISOString().split('T')[0];
    const newToday = await this.query('SELECT COUNT(*) as count FROM leads WHERE date(created_at) = ?', [today]);
    
    return {
      total: total[0]?.count || 0,
      newToday: newToday[0]?.count || 0,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
      byHeat: Object.fromEntries(byHeat.map(r => [r.heat, r.count]))
    };
  }

  // ==================== CONVERSATIONS ====================
  
  async getOrCreateConversation(chatId, leadId = null, chatType = 'private', chatName = null) {
    const existing = await this.query('SELECT * FROM conversations WHERE chat_id = ? LIMIT 1', [chatId]);
    if (existing.length) return existing[0];

    await this.run(
      `INSERT INTO conversations (chat_id, lead_id, chat_type, chat_name, stage) VALUES (?, ?, ?, ?, 'inicio')`,
      [chatId, leadId, chatType, chatName]
    );
    const res = await this.query('SELECT * FROM conversations WHERE chat_id = ? LIMIT 1', [chatId]);
    return res[0] || null;
  }

  async updateConversation(chatId, data) {
    const fields = [];
    const params = [];
    const allowed = ['is_bot_active', 'is_blocked', 'is_favorite', 'stage', 'assunto', 'plano', 'chat_name', 'unread_count', 'last_message'];
    
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (!fields.length) return;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(chatId);
    
    await this.run(`UPDATE conversations SET ${fields.join(', ')} WHERE chat_id = ?`, params);
  }

  async getConversations(limit = 50, offset = 0, filters = {}) {
    let sql = `
      SELECT c.*, l.name, l.phone, l.email, l.company, l.heat, l.status as lead_status
      FROM conversations c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.type) { sql += ' AND c.chat_type = ?'; params.push(filters.type); }
    if (filters.stage) { sql += ' AND c.stage = ?'; params.push(filters.stage); }
    if (filters.blocked !== undefined) { sql += ' AND c.is_blocked = ?'; params.push(filters.blocked ? 1 : 0); }
    if (filters.favorite) { sql += ' AND c.is_favorite = 1'; }
    if (filters.unread) { sql += ' AND c.unread_count > 0'; }
    if (filters.search) {
      sql += ' AND (l.name LIKE ? OR l.phone LIKE ? OR c.chat_id LIKE ? OR c.chat_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }
    
    sql += ' ORDER BY c.last_message_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return this.query(sql, params);
  }

  async getConversationByChatId(chatId) {
    const res = await this.query(`
      SELECT c.*, l.name, l.phone, l.email, l.company, l.heat
      FROM conversations c
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.chat_id = ? LIMIT 1
    `, [chatId]);
    return res[0] || null;
  }

  // ==================== MESSAGES ====================
  
  async saveMessage(conversationId, data) {
    await this.run(`
      INSERT INTO messages (conversation_id, message_id, direction, message_text, message_type, intent, confidence, method, entities, is_bot_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      conversationId, data.messageId || null, data.direction, data.text || '',
      data.type || 'text', data.intent || null, data.confidence || null, data.method || null,
      data.entities ? JSON.stringify(data.entities) : null, data.isBot ? 1 : 0
    ]);

    await this.run(`
      UPDATE conversations 
      SET message_count = message_count + 1, 
          last_message = ?, 
          last_message_at = CURRENT_TIMESTAMP,
          unread_count = CASE WHEN ? = 'incoming' THEN unread_count + 1 ELSE unread_count END
      WHERE id = ?
    `, [data.text?.substring(0, 100), data.direction, conversationId]);

    await this.updateDailyStats(data.isBot, data.direction);
  }

  async getMessages(conversationId, limit = 100, offset = 0) {
    return this.query(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [conversationId, limit, offset]);
  }

  async getMessagesByChatId(chatId, limit = 100) {
    const conv = await this.getConversationByChatId(chatId);
    if (!conv) return [];
    return this.getMessages(conv.id, limit);
  }

  async markMessagesRead(conversationId) {
    await this.run('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND is_read = 0', [conversationId]);
    await this.run('UPDATE conversations SET unread_count = 0 WHERE id = ?', [conversationId]);
  }

  // ==================== DEALS ====================
  
  async createDeal(data) {
    const valorFinal = (data.valor || 0) * (1 - (data.desconto || 0) / 100);
    await this.run(`
      INSERT INTO deals (chat_id, lead_id, title, status, stage, produto, plano, valor, desconto, valor_final, pagamento, parcelas, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.chat_id, data.lead_id || null, data.title || 'Novo Negócio',
      data.status || 'open', data.stage || 'prospecting',
      data.produto || null, data.plano || null, data.valor || 0, data.desconto || 0, valorFinal,
      data.pagamento || null, data.parcelas || null, data.notes || null
    ]);
    const res = await this.query('SELECT * FROM deals WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [data.chat_id]);
    return res[0] || null;
  }

  async updateDeal(id, data) {
    const fields = [];
    const params = [];
    const allowed = ['title', 'status', 'stage', 'produto', 'plano', 'valor', 'desconto', 'pagamento', 'parcelas', 'contrato_url', 'pagamento_url', 'expected_close_date', 'notes', 'won'];
    
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (data.valor !== undefined || data.desconto !== undefined) {
      const deal = await this.query('SELECT valor, desconto FROM deals WHERE id = ?', [id]);
      const v = data.valor ?? deal[0]?.valor ?? 0;
      const d = data.desconto ?? deal[0]?.desconto ?? 0;
      fields.push('valor_final = ?');
      params.push(v * (1 - d / 100));
    }
    
    if (data.status === 'won' || data.won === 1) {
      fields.push('closed_at = CURRENT_TIMESTAMP');
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await this.run(`UPDATE deals SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async getDeals(limit = 50, offset = 0, filters = {}) {
    let sql = `
      SELECT d.*, l.name, l.phone, l.company
      FROM deals d
      LEFT JOIN leads l ON d.lead_id = l.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) { sql += ' AND d.status = ?'; params.push(filters.status); }
    if (filters.stage) { sql += ' AND d.stage = ?'; params.push(filters.stage); }
    
    sql += ' ORDER BY d.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return this.query(sql, params);
  }

  async getDealsByChatId(chatId) {
    return this.query('SELECT * FROM deals WHERE chat_id = ? ORDER BY id DESC', [chatId]);
  }

  async getOpenDeal(chatId) {
    const res = await this.query(`
      SELECT * FROM deals WHERE chat_id = ? AND status IN ('open', 'waiting_payment') ORDER BY id DESC LIMIT 1
    `, [chatId]);
    return res[0] || null;
  }

  async getDealStats() {
    const total = await this.query('SELECT COUNT(*) as count, SUM(valor_final) as total FROM deals');
    const byStatus = await this.query('SELECT status, COUNT(*) as count, SUM(valor_final) as total FROM deals GROUP BY status');
    const byStage = await this.query('SELECT stage, COUNT(*) as count FROM deals WHERE status = "open" GROUP BY stage');
    
    return {
      total: total[0]?.count || 0,
      totalValue: total[0]?.total || 0,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, { count: r.count, total: r.total }])),
      byStage: Object.fromEntries(byStage.map(r => [r.stage, r.count]))
    };
  }

  // ==================== APPOINTMENTS ====================
  
  async createAppointment(data) {
    const endAt = data.end_at || new Date(new Date(data.start_at).getTime() + (data.duration_min || 30) * 60000).toISOString();
    await this.run(`
      INSERT INTO appointments (chat_id, lead_id, title, description, start_at, end_at, duration_min, status, type, location, meet_link, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.chat_id || null, data.lead_id || null, data.title || 'Reunião',
      data.description || null, data.start_at, endAt, data.duration_min || 30,
      data.status || 'scheduled', data.type || 'call', data.location || null,
      data.meet_link || null, data.notes || null
    ]);
    const res = await this.query('SELECT * FROM appointments ORDER BY id DESC LIMIT 1');
    return res[0] || null;
  }

  async updateAppointment(id, data) {
    const fields = [];
    const params = [];
    const allowed = ['title', 'description', 'start_at', 'end_at', 'duration_min', 'status', 'type', 'location', 'meet_link', 'notes', 'reminder_sent'];
    
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await this.run(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async getAppointments(filters = {}) {
    let sql = `
      SELECT a.*, l.name, l.phone
      FROM appointments a
      LEFT JOIN leads l ON a.lead_id = l.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) { sql += ' AND a.status = ?'; params.push(filters.status); }
    if (filters.from) { sql += ' AND a.start_at >= ?'; params.push(filters.from); }
    if (filters.to) { sql += ' AND a.start_at <= ?'; params.push(filters.to); }
    if (filters.chat_id) { sql += ' AND a.chat_id = ?'; params.push(filters.chat_id); }
    
    sql += ' ORDER BY a.start_at ASC';
    
    return this.query(sql, params);
  }

  async getTodayAppointments() {
    const today = new Date().toISOString().split('T')[0];
    return this.getAppointments({ from: `${today}T00:00:00`, to: `${today}T23:59:59` });
  }

  async deleteAppointment(id) {
    await this.run('DELETE FROM appointments WHERE id = ?', [id]);
  }

  // ==================== CHAT FILTERS ====================
  
  async addChatFilter(data) {
    await this.run(`
      INSERT INTO chat_filters (chat_id, chat_name, chat_type, filter_type, is_allowed, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        chat_name = excluded.chat_name,
        filter_type = excluded.filter_type,
        is_allowed = excluded.is_allowed,
        reason = excluded.reason,
        updated_at = CURRENT_TIMESTAMP
    `, [
      data.chat_id, data.chat_name || null, data.chat_type || 'private',
      data.filter_type, data.is_allowed ? 1 : 0, data.reason || null, data.created_by || null
    ]);
  }

  async removeChatFilter(chatId) {
    await this.run('DELETE FROM chat_filters WHERE chat_id = ?', [chatId]);
  }

  async getChatFilters(type = null) {
    if (type) return this.query('SELECT * FROM chat_filters WHERE filter_type = ? ORDER BY created_at DESC', [type]);
    return this.query('SELECT * FROM chat_filters ORDER BY filter_type, created_at DESC');
  }

  async isChatAllowed(chatId, chatType) {
    const filter = await this.query('SELECT * FROM chat_filters WHERE chat_id = ? LIMIT 1', [chatId]);
    if (filter.length) return filter[0].is_allowed === 1;
    
    // Check config
    if (chatType === 'group') {
      const useWhitelist = await this.getConfig('use_whitelist_groups');
      if (useWhitelist) return false; // Not in whitelist
      return await this.getConfig('respond_to_groups');
    }
    
    if (chatType === 'private') {
      const useBlacklist = await this.getConfig('use_blacklist_numbers');
      return !useBlacklist; // If blacklist enabled, allow by default
    }
    
    return true;
  }

  // ==================== QUICK REPLIES ====================
  
  async getQuickReplies() {
    return this.query('SELECT * FROM quick_replies WHERE is_active = 1 ORDER BY use_count DESC');
  }

  async addQuickReply(data) {
    await this.run(`
      INSERT INTO quick_replies (shortcut, title, content, category)
      VALUES (?, ?, ?, ?)
    `, [data.shortcut, data.title, data.content, data.category || 'general']);
  }

  async updateQuickReply(id, data) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      if (['shortcut', 'title', 'content', 'category', 'is_active'].includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    await this.run(`UPDATE quick_replies SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async useQuickReply(id) {
    await this.run('UPDATE quick_replies SET use_count = use_count + 1 WHERE id = ?', [id]);
    const res = await this.query('SELECT content FROM quick_replies WHERE id = ?', [id]);
    return res[0]?.content || null;
  }

  async deleteQuickReply(id) {
    await this.run('DELETE FROM quick_replies WHERE id = ?', [id]);
  }

  // ==================== STATISTICS ====================
  
  async updateDailyStats(isBot = false, direction = 'incoming') {
    const today = new Date().toISOString().split('T')[0];
    await this.run(`
      INSERT INTO statistics (date, total_messages, incoming_messages, outgoing_messages, bot_responses)
      VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_messages = total_messages + 1,
        incoming_messages = incoming_messages + ?,
        outgoing_messages = outgoing_messages + ?,
        bot_responses = bot_responses + ?
    `, [
      today,
      direction === 'incoming' ? 1 : 0, direction === 'outgoing' ? 1 : 0, isBot ? 1 : 0,
      direction === 'incoming' ? 1 : 0, direction === 'outgoing' ? 1 : 0, isBot ? 1 : 0
    ]);
  }

  async getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const stats = await this.query('SELECT * FROM statistics WHERE date = ?', [today]);
    const convs = await this.query('SELECT COUNT(*) as count FROM conversations WHERE date(last_message_at) = ?', [today]);
    const leads = await this.query('SELECT COUNT(*) as count FROM leads WHERE date(created_at) = ?', [today]);
    
    return {
      date: today,
      total_messages: stats[0]?.total_messages || 0,
      incoming_messages: stats[0]?.incoming_messages || 0,
      outgoing_messages: stats[0]?.outgoing_messages || 0,
      bot_responses: stats[0]?.bot_responses || 0,
      total_conversations: convs[0]?.count || 0,
      new_leads: leads[0]?.count || 0
    };
  }

  async getStatsRange(from, to) {
    return this.query('SELECT * FROM statistics WHERE date >= ? AND date <= ? ORDER BY date', [from, to]);
  }

  async getPipelineStats() {
    const stages = await this.query(`
      SELECT stage, COUNT(*) as count 
      FROM conversations 
      WHERE stage IS NOT NULL 
      GROUP BY stage
    `);
    return Object.fromEntries(stages.map(s => [s.stage, s.count]));
  }

  // ==================== ACTIVITY LOG ====================
  
  async logActivity(entityType, entityId, action, details = null) {
    await this.run(`
      INSERT INTO activity_log (entity_type, entity_id, action, details)
      VALUES (?, ?, ?, ?)
    `, [entityType, entityId, action, details ? JSON.stringify(details) : null]);
  }

  async getActivityLog(limit = 100, filters = {}) {
    let sql = 'SELECT * FROM activity_log WHERE 1=1';
    const params = [];
    
    if (filters.entity_type) { sql += ' AND entity_type = ?'; params.push(filters.entity_type); }
    if (filters.entity_id) { sql += ' AND entity_id = ?'; params.push(filters.entity_id); }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    return this.query(sql, params);
  }
}

module.exports = CloudflareD1;