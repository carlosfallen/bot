// FILE: src/database/d1.js
/**
 * CLOUDFLARE D1 DATABASE CLIENT - CORRIGIDO PARA SCHEMA REAL
 */

class CloudflareD1 {
    constructor(config) {
        this.accountId = config.accountId;
        this.databaseId = config.databaseId;
        this.apiToken = config.apiToken;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}`;
        
        if (!this.accountId || !this.databaseId || !this.apiToken) {
            console.log('⚠️ Cloudflare D1 não configurado completamente');
        }
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
                throw new Error(error);
            }

            return data.result?.[0]?.results || [];
        } catch (e) {
            console.error('❌ D1 Query Error:', e.message);
            throw e;
        }
    }

    async run(sql, params = []) {
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
                throw new Error(error);
            }

            return data.result?.[0]?.meta || {};
        } catch (e) {
            console.error('❌ D1 Run Error:', e.message);
            throw e;
        }
    }

    // ==================== LEADS ====================

    async saveLead(data) {
        const { phone, name, email, company, tags } = data;
        
        const existing = await this.query(
            'SELECT id, name, email, company FROM leads WHERE phone = ?',
            [phone]
        );

        if (existing.length > 0) {
            const lead = existing[0];
            const updates = [];
            const params = [];
            
            if (name && !lead.name) {
                updates.push('name = ?');
                params.push(name);
            }
            if (email && !lead.email) {
                updates.push('email = ?');
                params.push(email);
            }
            if (company && !lead.company) {
                updates.push('company = ?');
                params.push(company);
            }
            
            // Sempre atualiza last_interaction
            updates.push('last_interaction = CURRENT_TIMESTAMP');
            updates.push('updated_at = CURRENT_TIMESTAMP');
            
            if (updates.length > 0) {
                params.push(phone);
                await this.run(
                    `UPDATE leads SET ${updates.join(', ')} WHERE phone = ?`,
                    params
                );
            }
            
            return lead.id;
        }

        await this.run(
            `INSERT INTO leads (phone, name, email, company, tags) VALUES (?, ?, ?, ?, ?)`,
            [phone, name || null, email || null, company || null, tags ? JSON.stringify(tags) : null]
        );

        const newLead = await this.query('SELECT id FROM leads WHERE phone = ?', [phone]);
        return newLead[0]?.id;
    }

    async getLeads(limit = 50, offset = 0) {
        return this.query(
            `SELECT * FROM leads 
             WHERE is_active = 1
             ORDER BY last_interaction DESC 
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
    }

    async getLeadByPhone(phone) {
        const leads = await this.query('SELECT * FROM leads WHERE phone = ?', [phone]);
        return leads[0] || null;
    }

    async updateLead(id, data) {
        const fields = [];
        const params = [];
        
        for (const [key, value] of Object.entries(data)) {
            if (['name', 'email', 'company', 'tags', 'notes', 'is_active'].includes(key)) {
                fields.push(`${key} = ?`);
                params.push(key === 'tags' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return;
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);
        
        await this.run(
            `UPDATE leads SET ${fields.join(', ')} WHERE id = ?`,
            params
        );
    }

    // ==================== CONVERSATIONS ====================

    async getOrCreateConversation(chatId, leadId, chatType = 'private') {
        const existing = await this.query(
            'SELECT * FROM conversations WHERE chat_id = ?',
            [chatId]
        );

        if (existing.length > 0) {
            return existing[0];
        }

        await this.run(
            `INSERT INTO conversations (chat_id, lead_id, chat_type) VALUES (?, ?, ?)`,
            [chatId, leadId, chatType]
        );

        const newConv = await this.query('SELECT * FROM conversations WHERE chat_id = ?', [chatId]);
        return newConv[0];
    }

    async getConversations(limit = 50, offset = 0) {
        return this.query(
            `SELECT c.id, c.chat_id, c.chat_type, c.is_bot_active, c.last_message_at, 
                    c.message_count, c.created_at, c.lead_id,
                    l.name, l.phone, l.email
             FROM conversations c
             LEFT JOIN leads l ON c.lead_id = l.id
             ORDER BY c.last_message_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
    }

    async getConversationByChatId(chatId) {
        const convs = await this.query('SELECT * FROM conversations WHERE chat_id = ?', [chatId]);
        return convs[0] || null;
    }

    async updateConversation(chatId, data) {
        const fields = [];
        const params = [];
        
        for (const [key, value] of Object.entries(data)) {
            if (['is_bot_active', 'chat_type'].includes(key)) {
                fields.push(`${key} = ?`);
                params.push(value);
            }
        }
        
        if (fields.length === 0) return;
        
        params.push(chatId);
        
        await this.run(
            `UPDATE conversations SET ${fields.join(', ')} WHERE chat_id = ?`,
            params
        );
    }

    async setBotActiveForChat(chatId, isActive) {
        await this.run(
            `UPDATE conversations SET is_bot_active = ? WHERE chat_id = ?`,
            [isActive ? 1 : 0, chatId]
        );
    }

    async isBotActiveForChat(chatId) {
        const conv = await this.query(
            'SELECT is_bot_active FROM conversations WHERE chat_id = ?',
            [chatId]
        );
        return conv[0]?.is_bot_active !== 0;
    }

    // ==================== MESSAGES ====================

    async saveMessage(conversationId, data) {
        const { messageId, direction, text, intent, confidence, entities, isBot, method } = data;
        
        await this.run(
            `INSERT INTO messages (conversation_id, message_id, direction, message_text, intent, confidence, entities, is_bot_response)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

        // Atualiza contagem e última mensagem na conversa
        await this.run(
            `UPDATE conversations 
             SET message_count = message_count + 1, 
                 last_message_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [conversationId]
        );

        // Atualiza estatísticas do dia
        await this.updateDailyStats(isBot);
    }

    async getMessages(conversationId, limit = 100) {
        return this.query(
            `SELECT id, conversation_id, message_id, direction, message_text as text, 
                    intent, confidence, entities, is_bot_response as is_bot, created_at
             FROM messages 
             WHERE conversation_id = ? 
             ORDER BY created_at ASC 
             LIMIT ?`,
            [conversationId, limit]
        );
    }

    async getMessagesByChatId(chatId, limit = 100) {
        return this.query(
            `SELECT m.id, m.conversation_id, m.message_id, m.direction, 
                    m.message_text as text, m.intent, m.confidence, m.entities, 
                    m.is_bot_response as is_bot, m.created_at
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE c.chat_id = ?
             ORDER BY m.created_at ASC
             LIMIT ?`,
            [chatId, limit]
        );
    }

    async getRecentMessages(conversationId, limit = 10) {
        const messages = await this.query(
            `SELECT direction, message_text as text, intent, created_at 
             FROM messages 
             WHERE conversation_id = ? 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [conversationId, limit]
        );
        return messages.reverse();
    }

    // ==================== STATS ====================

    async updateDailyStats(isBot = false) {
        const today = new Date().toISOString().split('T')[0];
        
        // Cria ou atualiza registro do dia
        await this.run(`
            INSERT INTO statistics (date, total_messages, bot_responses)
            VALUES (?, 1, ?)
            ON CONFLICT(date) DO UPDATE SET 
                total_messages = total_messages + 1,
                bot_responses = bot_responses + ?
        `, [today, isBot ? 1 : 0, isBot ? 1 : 0]);
    }

    async getTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        
        // Busca estatísticas da tabela statistics
        const statsRow = await this.query(
            `SELECT * FROM statistics WHERE date = ?`,
            [today]
        );

        // Conta novos leads de hoje
        const leadsCount = await this.query(
            `SELECT COUNT(*) as count FROM leads WHERE date(created_at) = ?`,
            [today]
        );

        // Conta conversas ativas hoje
        const convsCount = await this.query(
            `SELECT COUNT(DISTINCT conversation_id) as count 
             FROM messages 
             WHERE date(created_at) = ?`,
            [today]
        );

        const stats = statsRow[0] || {};
        
        return {
            total_messages: stats.total_messages || 0,
            total_conversations: convsCount[0]?.count || 0,
            new_leads: leadsCount[0]?.count || 0,
            bot_responses: stats.bot_responses || 0
        };
    }

    async getStats(days = 7) {
        return this.query(`
            SELECT date, total_messages, total_conversations, new_leads, bot_responses
            FROM statistics
            WHERE date >= date('now', '-' || ? || ' days')
            ORDER BY date DESC
        `, [days]);
    }

    // ==================== CONFIG ====================

    async getConfig(key) {
        const configs = await this.query('SELECT value FROM bot_config WHERE key = ?', [key]);
        if (!configs.length) return null;
        
        const value = configs[0].value;
        if (value === 'true') return true;
        if (value === 'false') return false;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    async setConfig(key, value) {
        const strValue = typeof value === 'boolean' ? String(value) : 
                         typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        await this.run(
            `INSERT INTO bot_config (key, value, updated_at) 
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
            [key, strValue, strValue]
        );
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

    // ==================== IGNORED CHATS ====================

    async isIgnoredChat(chatId) {
        const result = await this.query(
            'SELECT id FROM ignored_chats WHERE chat_id = ?',
            [chatId]
        );
        return result.length > 0;
    }

    async ignoreChat(chatId, chatName, reason) {
        await this.run(
            `INSERT OR IGNORE INTO ignored_chats (chat_id, chat_name, reason) VALUES (?, ?, ?)`,
            [chatId, chatName || null, reason || null]
        );
    }

    async unignoreChat(chatId) {
        await this.run('DELETE FROM ignored_chats WHERE chat_id = ?', [chatId]);
    }
}

module.exports = CloudflareD1;