// FILE: src/api/server.js
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const nlpAnalyzer = require('../nlp/analyzer.js');
const llmRouter = require('../nlp/llm-router.js');

let gemini;
try { gemini = require('../llm/gemini.js'); } catch { gemini = null; }

class BotAPI {
  constructor(database, whatsappBot) {
    this.db = database;
    this.bot = whatsappBot;
    this.port = process.env.PORT || 3512;
  }

  start() {
    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') return res.writeHead(200).end();

      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;
      const query = Object.fromEntries(url.searchParams);

      try {
        // Static files
        if (pathname === '/' || pathname === '/index.html') return this.serveFile(res, 'public/index.html', 'text/html');
        if (pathname.startsWith('/css/')) return this.serveFile(res, `public${pathname}`, 'text/css');
        if (pathname.startsWith('/js/')) return this.serveFile(res, `public${pathname}`, 'application/javascript');

        // API
        if (pathname.startsWith('/api/')) return this.handleAPI(req, res, pathname.slice(4), query);

        res.writeHead(404).end('Not Found');
      } catch (e) {
        console.error('Server error:', e);
        res.writeHead(500).end(JSON.stringify({ error: e.message }));
      }
    });

    server.listen(this.port, '0.0.0.0', () => {
      console.log(`\n🌐 Dashboard: http://localhost:${this.port}`);
    });
  }

  async serveFile(res, filePath, contentType) {
    try {
      const content = await fs.readFile(path.join(process.cwd(), filePath));
      res.writeHead(200, { 'Content-Type': contentType }).end(content);
    } catch { res.writeHead(404).end('Not found'); }
  }

  async handleAPI(req, res, pathname, query) {
    const method = req.method;
    const parts = pathname.split('/').filter(p => p);
    const endpoint = parts[0];
    const id = parts[1];

    // ==================== STATUS ====================
    if (endpoint === 'status') return this.getStatus(res);
    if (endpoint === 'health') return this.json(res, { status: 'ok' });

    // ==================== CONFIG ====================
    if (endpoint === 'config') {
      if (method === 'GET') return this.getConfig(res, query);
      if (method === 'POST') return this.updateConfig(req, res);
    }
    if (endpoint === 'config-categories') return this.getConfigCategories(res);

    // ==================== LEADS ====================
    if (endpoint === 'leads') {
      if (method === 'GET' && !id) return this.getLeads(res, query);
      if (method === 'GET' && id) return this.getLead(res, id);
      if (method === 'POST') return this.createLead(req, res);
      if (method === 'PUT' && id) return this.updateLead(req, res, id);
      if (method === 'DELETE' && id) return this.deleteLead(res, id);
    }
    if (endpoint === 'leads-stats') return this.getLeadStats(res);

    // ==================== CONVERSATIONS ====================
    if (endpoint === 'conversations') {
      if (method === 'GET' && !id) return this.getConversations(res, query);
      if (method === 'GET' && id) return this.getConversation(res, id);
      if (method === 'PUT' && id) return this.updateConversation(req, res, id);
    }

    // ==================== MESSAGES ====================
    if (endpoint === 'messages') {
      if (method === 'GET' && id) return this.getMessages(res, id, query);
      if (method === 'POST') return this.sendMessage(req, res);
    }
    if (endpoint === 'mark-read' && id) return this.markRead(res, id);

    // ==================== DEALS ====================
    if (endpoint === 'deals') {
      if (method === 'GET' && !id) return this.getDeals(res, query);
      if (method === 'GET' && id) return this.getDeal(res, id);
      if (method === 'POST') return this.createDeal(req, res);
      if (method === 'PUT' && id) return this.updateDeal(req, res, id);
    }
    if (endpoint === 'deals-stats') return this.getDealStats(res);

    // ==================== APPOINTMENTS ====================
    if (endpoint === 'appointments') {
      if (method === 'GET') return this.getAppointments(res, query);
      if (method === 'POST') return this.createAppointment(req, res);
      if (method === 'PUT' && id) return this.updateAppointment(req, res, id);
      if (method === 'DELETE' && id) return this.deleteAppointment(res, id);
    }

    // ==================== CHAT FILTERS ====================
    if (endpoint === 'filters') {
      if (method === 'GET') return this.getFilters(res, query);
      if (method === 'POST') return this.addFilter(req, res);
      if (method === 'DELETE' && id) return this.removeFilter(res, id);
    }

    // ==================== QUICK REPLIES ====================
    if (endpoint === 'quick-replies') {
      if (method === 'GET') return this.getQuickReplies(res);
      if (method === 'POST') return this.addQuickReply(req, res);
      if (method === 'PUT' && id) return this.updateQuickReply(req, res, id);
      if (method === 'DELETE' && id) return this.deleteQuickReply(res, id);
    }

    // ==================== STATISTICS ====================
    if (endpoint === 'stats') return this.getStats(res, query);
    if (endpoint === 'pipeline') return this.getPipeline(res);
    if (endpoint === 'activity') return this.getActivity(res, query);

    // ==================== GEMINI ====================
    if (endpoint === 'gemini-status') return this.getGeminiStatus(res);
    if (endpoint === 'gemini-models') return this.getGeminiModels(res);
    if (endpoint === 'gemini-test') return this.testGemini(req, res);
    if (endpoint === 'gemini-chat') return this.chatGemini(req, res);

    // ==================== NLP TEST ====================
    if (endpoint === 'test-nlp') return this.testNLP(req, res);

    res.writeHead(404).end(JSON.stringify({ error: 'Endpoint not found' }));
  }

  // ==================== HELPERS ====================
  json(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data)); }
  async body(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); }); }

  // ==================== STATUS ====================
  async getStatus(res) {
    const sock = this.bot?.getSocket?.();
    const connected = sock && sock.user;
    this.json(res, {
      connected: !!connected,
      user: connected ? { id: sock.user.id, name: sock.user.name } : null,
      uptime: process.uptime(),
      database: this.db?.isReady() || false,
      gemini: gemini?.isConfigured() || false
    });
  }

  // ==================== CONFIG ====================
  async getConfig(res, query) {
    if (!this.db) return this.json(res, {});
    if (query.category) {
      const configs = await this.db.getConfigByCategory(query.category);
      return this.json(res, configs);
    }
    const all = await this.db.getAllConfig();
    this.json(res, all);
  }

  async getConfigCategories(res) {
    this.json(res, {
      categories: [
        { id: 'general', name: 'Geral', icon: '⚙️' },
        { id: 'filters', name: 'Filtros', icon: '🔒' },
        { id: 'ai', name: 'Inteligência Artificial', icon: '🤖' },
        { id: 'crm', name: 'CRM', icon: '👥' },
        { id: 'hours', name: 'Horário Comercial', icon: '🕐' },
        { id: 'messages', name: 'Mensagens', icon: '💬' },
        { id: 'behavior', name: 'Comportamento', icon: '🎭' },
        { id: 'notifications', name: 'Notificações', icon: '🔔' }
      ]
    });
  }

  async updateConfig(req, res) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    for (const [key, value] of Object.entries(data)) {
      await this.db.setConfig(key, value);
    }
    await this.db.logActivity('config', null, 'update', data);
    this.json(res, { success: true });
  }

  // ==================== LEADS ====================
  async getLeads(res, query) {
    if (!this.db) return this.json(res, []);
    const leads = await this.db.getLeads(
      parseInt(query.limit) || 50,
      parseInt(query.offset) || 0,
      { status: query.status, heat: query.heat, search: query.search }
    );
    this.json(res, leads);
  }

  async getLead(res, id) {
    if (!this.db) return this.json(res, null);
    const lead = await this.db.getLeadById(parseInt(id));
    if (!lead) return this.json(res, { error: 'Lead not found' }, 404);
    
    // Get related data
    const conversations = await this.db.query('SELECT * FROM conversations WHERE lead_id = ? ORDER BY last_message_at DESC', [id]);
    const deals = await this.db.query('SELECT * FROM deals WHERE lead_id = ? ORDER BY created_at DESC', [id]);
    const appointments = await this.db.query('SELECT * FROM appointments WHERE lead_id = ? ORDER BY start_at DESC', [id]);
    
    this.json(res, { ...lead, conversations, deals, appointments });
  }

  async createLead(req, res) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    const id = await this.db.saveLead(data);
    await this.db.logActivity('lead', id, 'create', data);
    this.json(res, { success: true, id });
  }

  async updateLead(req, res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.updateLead(parseInt(id), data);
    await this.db.logActivity('lead', parseInt(id), 'update', data);
    this.json(res, { success: true });
  }

  async deleteLead(res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    await this.db.deleteLead(parseInt(id));
    await this.db.logActivity('lead', parseInt(id), 'delete');
    this.json(res, { success: true });
  }

  async getLeadStats(res) {
    if (!this.db) return this.json(res, {});
    const stats = await this.db.getLeadStats();
    this.json(res, stats);
  }

  // ==================== CONVERSATIONS ====================
  async getConversations(res, query) {
    if (!this.db) return this.json(res, []);
    const convs = await this.db.getConversations(
      parseInt(query.limit) || 50,
      parseInt(query.offset) || 0,
      { type: query.type, stage: query.stage, blocked: query.blocked, favorite: query.favorite, unread: query.unread, search: query.search }
    );
    this.json(res, convs);
  }

  async getConversation(res, chatId) {
    if (!this.db) return this.json(res, null);
    const conv = await this.db.getConversationByChatId(decodeURIComponent(chatId));
    if (!conv) return this.json(res, { error: 'Conversation not found' }, 404);
    this.json(res, conv);
  }

  async updateConversation(req, res, chatId) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.updateConversation(decodeURIComponent(chatId), data);
    this.json(res, { success: true });
  }

  // ==================== MESSAGES ====================
  async getMessages(res, chatId, query) {
    if (!this.db) return this.json(res, []);
    const messages = await this.db.getMessagesByChatId(decodeURIComponent(chatId), parseInt(query.limit) || 100);
    this.json(res, messages.reverse());
  }

  async sendMessage(req, res) {
    const sock = this.bot?.getSocket?.();
    if (!sock) return this.json(res, { error: 'Bot not connected' }, 503);
    
    const { chatId, message, quickReplyId } = JSON.parse(await this.body(req));
    let text = message;
    
    if (quickReplyId && this.db) {
      text = await this.db.useQuickReply(parseInt(quickReplyId));
    }
    
    if (!text) return this.json(res, { error: 'Message required' }, 400);
    
    try {
      await sock.sendMessage(chatId, { text });
      
      // Save to DB
      if (this.db) {
        const conv = await this.db.getConversationByChatId(chatId);
        if (conv) {
          await this.db.saveMessage(conv.id, { direction: 'outgoing', text, isBot: false });
        }
      }
      
      this.json(res, { success: true });
    } catch (e) {
      this.json(res, { error: e.message }, 500);
    }
  }

  async markRead(res, chatId) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const conv = await this.db.getConversationByChatId(decodeURIComponent(chatId));
    if (conv) await this.db.markMessagesRead(conv.id);
    this.json(res, { success: true });
  }

  // ==================== DEALS ====================
  async getDeals(res, query) {
    if (!this.db) return this.json(res, []);
    const deals = await this.db.getDeals(parseInt(query.limit) || 50, 0, { status: query.status, stage: query.stage });
    this.json(res, deals);
  }

  async getDeal(res, id) {
    if (!this.db) return this.json(res, null);
    const deals = await this.db.query('SELECT d.*, l.name, l.phone FROM deals d LEFT JOIN leads l ON d.lead_id = l.id WHERE d.id = ?', [id]);
    this.json(res, deals[0] || null);
  }

  async createDeal(req, res) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    const deal = await this.db.createDeal(data);
    await this.db.logActivity('deal', deal?.id, 'create', data);
    this.json(res, deal);
  }

  async updateDeal(req, res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.updateDeal(parseInt(id), data);
    await this.db.logActivity('deal', parseInt(id), 'update', data);
    this.json(res, { success: true });
  }

  async getDealStats(res) {
    if (!this.db) return this.json(res, {});
    const stats = await this.db.getDealStats();
    this.json(res, stats);
  }

  // ==================== APPOINTMENTS ====================
  async getAppointments(res, query) {
    if (!this.db) return this.json(res, []);
    const appts = await this.db.getAppointments({ status: query.status, from: query.from, to: query.to, chat_id: query.chat_id });
    this.json(res, appts);
  }

  async createAppointment(req, res) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    const appt = await this.db.createAppointment(data);
    await this.db.logActivity('appointment', appt?.id, 'create', data);
    this.json(res, appt);
  }

  async updateAppointment(req, res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.updateAppointment(parseInt(id), data);
    this.json(res, { success: true });
  }

  async deleteAppointment(res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    await this.db.deleteAppointment(parseInt(id));
    this.json(res, { success: true });
  }

  // ==================== FILTERS ====================
  async getFilters(res, query) {
    if (!this.db) return this.json(res, []);
    const filters = await this.db.getChatFilters(query.type);
    this.json(res, filters);
  }

  async addFilter(req, res) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.addChatFilter(data);
    this.json(res, { success: true });
  }

  async removeFilter(res, chatId) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    await this.db.removeChatFilter(decodeURIComponent(chatId));
    this.json(res, { success: true });
  }

  // ==================== QUICK REPLIES ====================
  async getQuickReplies(res) {
    if (!this.db) return this.json(res, []);
    const replies = await this.db.getQuickReplies();
    this.json(res, replies);
  }

  async addQuickReply(req, res) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.addQuickReply(data);
    this.json(res, { success: true });
  }

  async updateQuickReply(req, res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    const data = JSON.parse(await this.body(req));
    await this.db.updateQuickReply(parseInt(id), data);
    this.json(res, { success: true });
  }

  async deleteQuickReply(res, id) {
    if (!this.db) return this.json(res, { error: 'Database not available' }, 503);
    await this.db.deleteQuickReply(parseInt(id));
    this.json(res, { success: true });
  }

  // ==================== STATISTICS ====================
  async getStats(res, query) {
    if (!this.db) return this.json(res, {});
    if (query.from && query.to) {
      const stats = await this.db.getStatsRange(query.from, query.to);
      return this.json(res, stats);
    }
    const stats = await this.db.getTodayStats();
    this.json(res, stats);
  }

  async getPipeline(res) {
    if (!this.db) return this.json(res, {});
    const pipeline = await this.db.getPipelineStats();
    this.json(res, pipeline);
  }

  async getActivity(res, query) {
    if (!this.db) return this.json(res, []);
    const activity = await this.db.getActivityLog(parseInt(query.limit) || 100, { entity_type: query.type });
    this.json(res, activity);
  }

  // ==================== GEMINI ====================
  async getGeminiStatus(res) {
    if (!gemini) return this.json(res, { configured: false });
    const status = gemini.getStatus();
    status.routerEnabled = llmRouter?.enabled || false;
    this.json(res, status);
  }

  async getGeminiModels(res) {
    if (!gemini?.isConfigured()) return this.json(res, { success: false, error: 'Gemini not configured', models: [] });
    try {
      const models = await gemini.listModels();
      this.json(res, { success: true, models });
    } catch (e) {
      this.json(res, { success: false, error: e.message, models: [] });
    }
  }

  async testGemini(req, res) {
    if (!gemini) return this.json(res, { success: false, error: 'Gemini not available' });
    try {
      const { model } = JSON.parse(await this.body(req) || '{}');
      if (model) gemini.setModel(model);
      const result = await gemini.testConnection();
      this.json(res, result);
    } catch (e) {
      this.json(res, { success: false, error: e.message });
    }
  }

  async chatGemini(req, res) {
    if (!gemini?.isConfigured()) return this.json(res, { success: false, error: 'Gemini not configured' });
    try {
      const { message, model } = JSON.parse(await this.body(req));
      if (model) gemini.setModel(model);
      const start = Date.now();
      const result = await gemini.generate(message, [], {}, 'dashboard-test');
      this.json(res, { success: true, response: result.text || result.messages?.join('\n'), latency: Date.now() - start });
    } catch (e) {
      this.json(res, { success: false, error: e.message });
    }
  }

  // ==================== NLP TEST ====================
  async testNLP(req, res) {
    try {
      const { message } = JSON.parse(await this.body(req));
      const result = await nlpAnalyzer.analyze(message, 'test_' + Date.now());
      this.json(res, result);
    } catch (e) {
      this.json(res, { error: e.message }, 500);
    }
  }
}

module.exports = BotAPI;