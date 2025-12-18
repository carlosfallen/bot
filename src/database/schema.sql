CREATE TABLE IF NOT EXISTS leads (
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
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  chat_id TEXT NOT NULL UNIQUE,
  chat_type TEXT DEFAULT 'private',
  is_bot_active INTEGER DEFAULT 1,
  last_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
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
);

CREATE TABLE IF NOT EXISTS bot_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ignored_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL UNIQUE,
  chat_name TEXT,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  new_leads INTEGER DEFAULT 0,
  bot_responses INTEGER DEFAULT 0,
  avg_response_time REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date);

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('bot_enabled', 'true', 'Bot está ativo globalmente');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('respond_to_groups', 'false', 'Responder em grupos');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('respond_to_channels', 'false', 'Responder em canais');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('auto_save_leads', 'true', 'Salvar contatos automaticamente como leads');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('business_hours_only', 'false', 'Responder apenas em horário comercial');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('business_hours_start', '09:00', 'Início do horário comercial');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('business_hours_end', '18:00', 'Fim do horário comercial');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('welcome_message', 'Olá! 👋 Bem-vindo à nossa agência digital!', 'Mensagem de boas-vindas');

INSERT OR IGNORE INTO bot_config (key, value, description) VALUES
('away_message', 'No momento estamos fora do horário de atendimento. Retornaremos em breve!', 'Mensagem fora do horário');
