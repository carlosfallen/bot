// FILE: src/database/d1.js
class CloudflareD1 {
    constructor(config) {
        this.accountId = config.accountId;
        this.databaseId = config.databaseId;
        this.apiToken = config.apiToken;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
        
        if (!this.accountId || !this.databaseId || !this.apiToken) {
            console.error('⚠️ Cloudflare D1 não configurado completamente');
        }
        
        // Inicializa as tabelas ao arrancar
        this.init();
    }

    async query(sql, params = []) {
        try {
            const response = await fetch(`${this.baseUrl}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql, params })
            });

            const data = await response.json();
            
            if (!data.success) {
                const error = data.errors?.[0]?.message || 'Erro desconhecido';
                console.error(`❌ D1 Query Failed: ${error} | SQL: ${sql}`);
                throw new Error(error);
            }

            return data.result?.[0]?.results || [];
        } catch (e) {
            console.error('❌ D1 Network Error:', e.message);
            throw e;
        }
    }

    // Método auxiliar para execuções que não retornam linhas (INSERT/UPDATE sem returning)
    async run(sql, params = []) {
        return this.query(sql, params);
    }

    // ==================== INICIALIZAÇÃO (SCHEMA) ====================

// ... (início da classe mantém igual)

    // ==================== INICIALIZAÇÃO (SCHEMA & MIGRAÇÃO) ====================

    async init() {
        console.log('📦 Verificando Schema do D1...');
        
        // 1. Criação das tabelas (Se não existirem)
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
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Garante que exista na criação
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
            );`
        ];

        for (const sql of schema) {
            await this.run(sql);
        }

        // 2. MIGRAÇÕES (CORREÇÃO DE TABELAS EXISTENTES)
        // Isso vai adicionar a coluna 'updated_at' se ela estiver faltando no Cloudflare
        console.log('🔄 Verificando atualizações de colunas...');
        
        try {
            await this.run("ALTER TABLE conversations ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP");
            console.log('✅ Coluna updated_at adicionada em conversations.');
        } catch (e) {
            // Se der erro, é provável que a coluna já exista, então ignoramos.
        }

        try {
            await this.run("ALTER TABLE leads ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP");
        } catch (e) {}

        try {
            await this.run("ALTER TABLE leads ADD COLUMN last_interaction TEXT DEFAULT CURRENT_TIMESTAMP");
        } catch (e) {}

        // Configuração padrão
        await this.run("INSERT OR IGNORE INTO bot_config (key, value, description) VALUES ('bot_enabled', 'true', 'Bot ativo')");
        
        console.log('✅ D1 Schema sincronizado e atualizado.');
    }


    // ==================== LEADS ====================

    async saveLead(data) {
        const { phone, name, email, company, tags, notes } = data;
        const now = new Date().toISOString();
        const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null);

        // SQL OTIMIZADO: Upsert (Insere ou Atualiza)
        // Isso resolve o erro "UNIQUE constraint failed"
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
            RETURNING id;
        `;

        try {
            // AQUI ESTAVA O ERRO: Usamos this.query, não this.db.prepare
            const result = await this.query(sql, [
                phone, name, email, company, tagsStr, notes, now, now, now
            ]);
            
            return result.length > 0 ? result[0].id : null;
        } catch (e) {
            console.error('⚠️ Erro saveLead D1:', e.message);
            // Fallback: tenta buscar ID se o returning falhar
            const existing = await this.query('SELECT id FROM leads WHERE phone = ?', [phone]);
            return existing.length > 0 ? existing[0].id : null;
        }
    }

    async getLeads(limit = 50, offset = 0) {
        return this.query(
            `SELECT * FROM leads WHERE is_active = 1 ORDER BY last_interaction DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
    }

    // ==================== CONVERSATIONS ====================

    async getOrCreateConversation(chatId, leadId, chatType = 'private') {
        // 1. Tenta buscar existente
        const existing = await this.query(
            'SELECT * FROM conversations WHERE chat_id = ?',
            [chatId]
        );

        if (existing.length > 0) {
            return existing[0];
        }

        // 2. Se não existe, cria
        const sql = `
            INSERT INTO conversations (chat_id, lead_id, chat_type, stage) 
            VALUES (?, ?, ?, 'inicio') 
            RETURNING *
        `;
        
        try {
            const result = await this.query(sql, [chatId, leadId, chatType]);
            return result[0];
        } catch (e) {
            // Tratamento de concorrência (se criar duplicado muito rápido)
            const retry = await this.query('SELECT * FROM conversations WHERE chat_id = ?', [chatId]);
            return retry[0];
        }
    }

    async updateConversation(chatId, data) {
        const fields = [];
        const params = [];
        
        for (const [key, value] of Object.entries(data)) {
            // Filtro de segurança para colunas permitidas
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
        const res = await this.query('SELECT * FROM conversations WHERE chat_id = ?', [chatId]);
        return res[0] || null;
    }

    // ==================== MESSAGES ====================

    async saveMessage(conversationId, data) {
        const { messageId, direction, text, intent, confidence, entities, isBot, method } = data;
        
        // CORREÇÃO: Nome da coluna é message_text conforme seu schema
        const sql = `
            INSERT INTO messages (
                conversation_id, message_id, direction, message_text, 
                intent, confidence, entities, is_bot_response
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.run(sql, [
            conversationId,
            messageId || null,
            direction,
            text || '',
            intent || null,
            confidence || null,
            entities ? JSON.stringify(entities) : null,
            isBot ? 1 : 0
        ]);

        // Atualiza contadores na conversa
        await this.run(
            `UPDATE conversations 
             SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [conversationId]
        );

        // Atualiza stats
        await this.updateDailyStats(isBot);
    }

    // ==================== STATS & CONFIG ====================

    async updateDailyStats(isBot = false) {
        const today = new Date().toISOString().split('T')[0];
        const sql = `
            INSERT INTO statistics (date, total_messages, bot_responses)
            VALUES (?, 1, ?)
            ON CONFLICT(date) DO UPDATE SET 
                total_messages = total_messages + 1,
                bot_responses = bot_responses + ?
        `;
        await this.run(sql, [today, isBot ? 1 : 0, isBot ? 1 : 0]);
    }

    async getConfig(key) {
        const res = await this.query('SELECT value FROM bot_config WHERE key = ?', [key]);
        if (!res.length) return null;
        
        const val = res[0].value;
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
    }
// ... (restante do código anterior) ...

    // ==================== CONFIGURAÇÕES (O QUE ESTAVA FALTANDO) ====================

    async setConfig(key, value) {
        const strValue = typeof value === 'boolean' ? String(value) : 
                         typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        // Upsert da configuração
        const sql = `
            INSERT INTO bot_config (key, value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `;
        
        await this.run(sql, [key, strValue]);
    }

    async getConfig(key) {
        const res = await this.query('SELECT value FROM bot_config WHERE key = ?', [key]);
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
            if (value === 'true') {
                result[key] = true;
            } else if (value === 'false') {
                result[key] = false;
            } else {
                try {
                    result[key] = JSON.parse(value);
                } catch {
                    result[key] = value;
                }
            }
        }
        return result;
    }
} 

module.exports = CloudflareD1;