// Cliente Cloudflare D1 Database

const https = require('https');

class CloudflareD1 {
    constructor({ accountId, databaseId, apiToken }) {
        this.accountId = String(accountId || '').trim();
        this.databaseId = String(databaseId || '').trim();
        this.apiToken = String(apiToken || '').trim();

        if (!this.accountId || !this.databaseId || !this.apiToken) {
            throw new Error('Cloudflare D1: credenciais inválidas ou vazias');
        }

        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
    }

    // Executar query
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                sql,
                params
            });

            const options = {
                hostname: 'api.cloudflare.com',
                path: `/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);

                        if (response.success) {
                            resolve(response.result?.[0] || {});
                        } else {
                            const errorMsg = response.errors?.[0]?.message || JSON.stringify(response.errors);
                            reject(new Error(errorMsg));
                        }
                    } catch (error) {
                        reject(new Error(`Parse error: ${error.message} | Body: ${body.substring(0, 200)}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    // Executar múltiplas queries em batch
    async batch(queries) {
        return new Promise((resolve, reject) => {
            const statements = queries.map(q => ({
                sql: q.sql,
                params: q.params || []
            }));

            const data = JSON.stringify({ statements });

            const options = {
                hostname: 'api.cloudflare.com',
                path: `/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);

                        if (response.success) {
                            resolve(response.result);
                        } else {
                            reject(new Error(response.errors?.[0]?.message || 'Batch query failed'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    // Métodos auxiliares

    // Salvar ou atualizar lead
    async saveLead(data) {
        const { phone, name, email, company, tags } = data;

        const result = await this.query(
            `INSERT INTO leads (phone, name, email, company, tags, last_interaction)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(phone) DO UPDATE SET
                name = COALESCE(?, name),
                email = COALESCE(?, email),
                company = COALESCE(?, company),
                tags = COALESCE(?, tags),
                last_interaction = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [phone, name, email, company, JSON.stringify(tags || []), name, email, company, JSON.stringify(tags || [])]
        );

        return result.results[0]?.id;
    }

    // Obter ou criar conversa
    async getOrCreateConversation(chatId, leadId, chatType = 'private') {
        let result = await this.query(
            'SELECT id, is_bot_active FROM conversations WHERE chat_id = ?',
            [chatId]
        );

        if (result.results.length > 0) {
            return result.results[0];
        }

        // Criar nova conversa
        result = await this.query(
            `INSERT INTO conversations (lead_id, chat_id, chat_type)
             VALUES (?, ?, ?)
             RETURNING id, is_bot_active`,
            [leadId, chatId, chatType]
        );

        return result.results[0];
    }

    // Salvar mensagem
    async saveMessage(conversationId, data) {
        const { messageId, direction, text, intent, confidence, entities, isBot } = data;

        await this.query(
            `INSERT INTO messages (conversation_id, message_id, direction, message_text, intent, confidence, entities, is_bot_response)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [conversationId, messageId, direction, text, intent, confidence, JSON.stringify(entities || {}), isBot ? 1 : 0]
        );

        // Atualizar contagem de mensagens
        await this.query(
            `UPDATE conversations
             SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [conversationId]
        );
    }

    // Verificar se bot está ativo para uma conversa
    async isBotActiveForChat(chatId) {
        const result = await this.query(
            'SELECT is_bot_active FROM conversations WHERE chat_id = ?',
            [chatId]
        );

        if (result.results.length === 0) {
            return true; // Ativo por padrão para novas conversas
        }

        return result.results[0].is_bot_active === 1;
    }

    // Ativar/Desativar bot para conversa
    async setBotActiveForChat(chatId, isActive) {
        await this.query(
            'UPDATE conversations SET is_bot_active = ? WHERE chat_id = ?',
            [isActive ? 1 : 0, chatId]
        );
    }

    // Obter configuração
    async getConfig(key) {
        const result = await this.query(
            'SELECT value FROM bot_config WHERE key = ?',
            [key]
        );

        if (result.results.length === 0) {
            return null;
        }

        const value = result.results[0].value;

        // Converter valores booleanos
        if (value === 'true') return true;
        if (value === 'false') return false;

        return value;
    }

    // Definir configuração
    async setConfig(key, value) {
        await this.query(
            `INSERT INTO bot_config (key, value, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
                value = ?,
                updated_at = CURRENT_TIMESTAMP`,
            [key, String(value), String(value)]
        );
    }

    // Obter todas as configurações
    async getAllConfig() {
        const result = await this.query('SELECT key, value FROM bot_config');

        const config = {};
        for (const row of result.results) {
            let value = row.value;
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            config[row.key] = value;
        }

        return config;
    }

    // Listar leads
    async getLeads(limit = 50, offset = 0) {
        const result = await this.query(
            `SELECT * FROM leads
             ORDER BY last_interaction DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return result.results;
    }

    // Obter conversas
    async getConversations(limit = 50, offset = 0) {
        const result = await this.query(
            `SELECT c.*, l.name, l.phone
             FROM conversations c
             LEFT JOIN leads l ON c.lead_id = l.id
             ORDER BY c.last_message_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return result.results;
    }

    // Obter mensagens de uma conversa
    async getMessages(conversationId, limit = 100) {
        const result = await this.query(
            `SELECT * FROM messages
             WHERE conversation_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [conversationId, limit]
        );

        return result.results.reverse();
    }

    // Obter estatísticas do dia
    async getTodayStats() {
        const result = await this.query(
            `SELECT * FROM statistics
             WHERE date = DATE('now')
             LIMIT 1`
        );

        if (result.results.length === 0) {
            // Criar entrada para hoje
            await this.query(
                `INSERT INTO statistics (date) VALUES (DATE('now'))`
            );
            return {
                total_messages: 0,
                total_conversations: 0,
                new_leads: 0,
                bot_responses: 0
            };
        }

        return result.results[0];
    }

    // Incrementar estatística
    async incrementStat(field) {
        await this.query(
            `INSERT INTO statistics (date, ${field})
             VALUES (DATE('now'), 1)
             ON CONFLICT(date) DO UPDATE SET
                ${field} = ${field} + 1`,
            []
        );
    }

    // Inicializar banco de dados (executar schema)
    async initialize(schemaSQL) {
        const statements = schemaSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`📤 Executando ${statements.length} statements no D1...`);

        // D1 API não aceita batch de statements muito grandes via HTTP
        // Vamos executar um por um
        const results = [];
        for (const sql of statements) {
            try {
                const result = await this.query(sql);
                results.push(result);
            } catch (error) {
                console.error(`❌ Erro no SQL: ${sql.substring(0, 60)}...`);
                throw error;
            }
        }

        console.log('✅ Database initialized successfully');
        return results;
    }
}

module.exports = CloudflareD1;
