// FILE: src/database/schema.sql
-- =============================================
-- SCHEMA COMPLETO - IMPÉRIO LORD BOT
-- =============================================

-- LEADS (CRM)
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  company TEXT,
  segment TEXT,
  source TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'new',
  heat TEXT DEFAULT 'cold',
  score INTEGER DEFAULT 0,
  assigned_to TEXT,
  notes TEXT,
  tags TEXT,
  custom_fields TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_interaction TEXT DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  chat_id TEXT NOT NULL UNIQUE,
  chat_type TEXT DEFAULT 'private',
  chat_name TEXT,
  is_bot_active INTEGER DEFAULT 1,
  is_blocked INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  stage TEXT DEFAULT 'inicio',
  assunto TEXT,
  plano TEXT,
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  message_id TEXT,
  direction TEXT NOT NULL,
  message_text TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  intent TEXT,
  confidence REAL,
  method TEXT,
  entities TEXT,
  is_bot_response INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- DEALS (NEGÓCIOS)
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  lead_id INTEGER,
  title TEXT,
  status TEXT DEFAULT 'open',
  stage TEXT DEFAULT 'prospecting',
  produto TEXT,
  plano TEXT,
  valor REAL DEFAULT 0,
  desconto REAL DEFAULT 0,
  valor_final REAL DEFAULT 0,
  pagamento TEXT,
  parcelas INTEGER,
  contrato_url TEXT,
  pagamento_url TEXT,
  expected_close_date TEXT,
  closed_at TEXT,
  won INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

-- APPOINTMENTS (AGENDA)
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT,
  lead_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  duration_min INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled',
  type TEXT DEFAULT 'call',
  location TEXT,
  meet_link TEXT,
  reminder_sent INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

-- CHAT FILTERS (CONTROLE DE GRUPOS/NÚMEROS)
CREATE TABLE IF NOT EXISTS chat_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL UNIQUE,
  chat_name TEXT,
  chat_type TEXT DEFAULT 'private',
  filter_type TEXT NOT NULL,
  is_allowed INTEGER DEFAULT 1,
  reason TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- BOT CONFIG
CREATE TABLE IF NOT EXISTS bot_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string',
  category TEXT DEFAULT 'general',
  label TEXT,
  description TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- STATISTICS
CREATE TABLE IF NOT EXISTS statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  total_messages INTEGER DEFAULT 0,
  incoming_messages INTEGER DEFAULT 0,
  outgoing_messages INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  new_leads INTEGER DEFAULT 0,
  bot_responses INTEGER DEFAULT 0,
  human_responses INTEGER DEFAULT 0,
  deals_created INTEGER DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  avg_response_time REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ACTIVITY LOG
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- QUICK REPLIES (RESPOSTAS RÁPIDAS)
CREATE TABLE IF NOT EXISTS quick_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shortcut TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  use_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_heat ON leads(heat);
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_stage ON conversations(stage);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_chat_id ON deals(chat_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_chat_filters_chat_id ON chat_filters(chat_id);
CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date);

-- DEFAULT CONFIGS
INSERT OR IGNORE INTO bot_config (key, value, type, category, label, description) VALUES
('bot_enabled', 'true', 'boolean', 'general', 'Bot Ativo', 'Ativa ou desativa o bot globalmente'),
('respond_to_groups', 'false', 'boolean', 'filters', 'Responder em Grupos', 'Bot responde em grupos do WhatsApp'),
('respond_to_channels', 'false', 'boolean', 'filters', 'Responder em Canais', 'Bot responde em canais/newsletters'),
('use_whitelist_groups', 'false', 'boolean', 'filters', 'Usar Whitelist de Grupos', 'Só responde em grupos liberados'),
('use_blacklist_numbers', 'false', 'boolean', 'filters', 'Usar Blacklist de Números', 'Bloqueia números específicos'),
('auto_save_leads', 'true', 'boolean', 'crm', 'Salvar Leads Automaticamente', 'Cria lead ao receber mensagem'),
('gemini_enabled', 'true', 'boolean', 'ai', 'Gemini Ativo', 'Usa IA para respostas'),
('gemini_model', 'gemini-2.0-flash-exp', 'string', 'ai', 'Modelo Gemini', 'Modelo de IA utilizado'),
('business_hours_only', 'false', 'boolean', 'hours', 'Apenas Horário Comercial', 'Responde só em horário comercial'),
('business_hours_start', '09:00', 'string', 'hours', 'Início Expediente', 'Horário de início'),
('business_hours_end', '18:00', 'string', 'hours', 'Fim Expediente', 'Horário de término'),
('welcome_message', 'Olá! 👋 Seja bem-vindo à Império Lord!', 'text', 'messages', 'Mensagem de Boas-vindas', 'Primeira mensagem enviada'),
('away_message', 'Estamos fora do horário. Retornaremos em breve!', 'text', 'messages', 'Mensagem Ausente', 'Mensagem fora do horário'),
('typing_simulation', 'true', 'boolean', 'behavior', 'Simular Digitação', 'Mostra "digitando..." antes de enviar'),
('typing_speed', '60', 'number', 'behavior', 'Velocidade Digitação', 'Ms por caractere'),
('min_response_delay', '1500', 'number', 'behavior', 'Delay Mínimo', 'Tempo mínimo antes de responder (ms)'),
('max_response_delay', '4000', 'number', 'behavior', 'Delay Máximo', 'Tempo máximo antes de responder (ms)'),
('bot_only_business', 'false', 'boolean', 'filters', 'Só Mensagens Comerciais', 'Ignora mensagens pessoais/zoeira'),
('admin_whatsapp', '', 'string', 'notifications', 'WhatsApp Admin', 'Número para notificações'),
('notify_new_lead', 'true', 'boolean', 'notifications', 'Notificar Novo Lead', 'Avisa admin de novo lead'),
('notify_new_deal', 'true', 'boolean', 'notifications', 'Notificar Nova Venda', 'Avisa admin de nova venda'),
('notify_payment', 'true', 'boolean', 'notifications', 'Notificar Pagamento', 'Avisa admin de pagamento');
