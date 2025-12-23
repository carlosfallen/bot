// FILE: src/api/server.js
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const nlpAnalyzer = require('../nlp/analyzer.js');
const gemini = require('../llm/gemini.js');
const llmRouter = require('../nlp/llm-router.js');

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

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
            const pathname = parsedUrl.pathname;

            try {
                // Arquivos estáticos
                if (pathname === '/' || pathname === '/index.html') {
                    return this.serveFile(res, 'public/index.html', 'text/html');
                }
                if (pathname.startsWith('/css/')) {
                    return this.serveFile(res, `public${pathname}`, 'text/css');
                }
                if (pathname.startsWith('/js/')) {
                    return this.serveFile(res, `public${pathname}`, 'application/javascript');
                }

                // API
                if (pathname.startsWith('/api/')) {
                    return this.handleAPI(req, res, pathname, Object.fromEntries(parsedUrl.searchParams));
                }

                res.writeHead(404);
                res.end('Not Found');
            } catch (error) {
                console.error('Server error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
            }
        });

        server.listen(this.port, "0.0.0.0", () => {
            console.log(`\n🌐 Dashboard disponível em: http://localhost:${this.port}`);
        });
    }

    async serveFile(res, filePath, contentType) {
        try {
            const fullPath = path.join(process.cwd(), filePath);
            const content = await fs.readFile(fullPath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch {
            res.writeHead(404);
            res.end('File not found');
        }
    }

    async handleAPI(req, res, pathname, query) {
        const method = req.method;
        const parts = pathname.split('/').filter(p => p);
        parts.shift();
        const endpoint = parts[0];

        // ===== GEMINI =====
        if (endpoint === 'gemini-status' && method === 'GET') {
            return this.getGeminiStatus(res);
        }
        if (endpoint === 'gemini-models' && method === 'GET') {
            return this.listGeminiModels(res);
        }
        if (endpoint === 'gemini-test' && method === 'POST') {
            return this.testGemini(req, res);
        }
        if (endpoint === 'gemini-chat' && method === 'POST') {
            return this.chatGemini(req, res);
        }

        // ===== EXISTENTES =====
        if (endpoint === 'status' && method === 'GET') return this.getStatus(res);
        if (endpoint === 'health' && method === 'GET') return this.sendJSON(res, 200, { status: 'ok' });
        if (endpoint === 'config') {
            if (method === 'GET') return this.getConfig(res);
            if (method === 'POST') return this.updateConfig(req, res);
        }
        if (endpoint === 'leads' && method === 'GET') return this.getLeads(res, query);
        if (endpoint === 'conversations' && method === 'GET') return this.getConversations(res, query);
        if (endpoint === 'crm-stats' && method === 'GET') return this.getCRMStats(res);
        if (endpoint === 'migrate-schema' && method === 'POST') return this.migrateSchema(res);

            if (endpoint === 'messages' && parts[1]) {
        const chatId = decodeURIComponent(parts[1]);
        // Se for número, busca por conversation_id, senão por chat_id
        if (/^\d+$/.test(chatId)) {
            return this.getMessages(res, parseInt(chatId));
        } else {
            return this.getMessagesByChatId(res, chatId);
        }
    }
        if (endpoint === 'send' && method === 'POST') return this.sendMessage(req, res);
        if (endpoint === 'conversation' && parts[1] && method === 'PUT') return this.updateConversation(req, res, parts[1]);
        if (endpoint === 'stats' && method === 'GET') return this.getStats(res);
        if (endpoint === 'test' && method === 'POST') return this.testNLP(req, res);

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    // ===== GEMINI HANDLERS =====

    async getGeminiStatus(res) {
        const status = gemini.getStatus();
        status.routerEnabled = llmRouter.enabled;
        this.sendJSON(res, 200, status);
    }

    async listGeminiModels(res) {
        try {
            console.log('📋 Listando modelos Gemini...');
            const models = await gemini.listModels();
            console.log(`   ✅ ${models.length} modelos encontrados`);
            this.sendJSON(res, 200, { success: true, models });
        } catch (error) {
            console.log(`   ❌ Erro: ${error.message}`);
            this.sendJSON(res, 200, { success: false, error: error.message, models: [] });
        }
    }

    async testGemini(req, res) {
        try {
            const body = await this.getBody(req);
            const { model } = body ? JSON.parse(body) : {};
            
            // Usar modelo temporário se fornecido
            const originalModel = gemini.model;
            if (model) gemini.setModel(model);
            
            console.log(`🧪 Testando Gemini (${gemini.model})...`);
            const result = await gemini.testConnection();
            
            // Restaurar modelo original
            if (model) gemini.setModel(originalModel);
            
            console.log(`   ${result.success ? '✅' : '❌'} ${result.success ? 'OK' : result.error} (${result.latency}ms)`);
            this.sendJSON(res, 200, result);
        } catch (error) {
            this.sendJSON(res, 200, { success: false, error: error.message });
        }
    }

    async chatGemini(req, res) {
        try {
            const body = await this.getBody(req);
            const { message, model } = JSON.parse(body);

            if (!message) {
                return this.sendJSON(res, 400, { success: false, error: 'Mensagem não fornecida' });
            }

            // Usar modelo temporário se fornecido
            const originalModel = gemini.model;
            if (model) gemini.setModel(model);

            console.log(`🤖 Gemini Chat (${gemini.model}): "${message.substring(0, 40)}..."`);

            const systemPrompt = `Você é um atendente humano de uma agência de marketing digital chamada "Império Lord".

REGRAS:
1. Respostas CURTAS: 1 a 3 linhas
2. NO MÁXIMO 1 pergunta por mensagem
3. Seja natural, como um vendedor real
4. Conduza para conversão (site/landing/tráfego/redes)

SERVIÇOS:
- Site simples: R$ 2.500 | Completo: R$ 4.500 | Loja: R$ 5.500
- Landing page: R$ 997 a R$ 1.500
- Tráfego pago: R$ 1.500 a R$ 4.500/mês
- Gestão de redes: R$ 997 a R$ 3.500/mês

Responda de forma natural e direta.`;

            const startTime = Date.now();
            const result = await gemini.generate(systemPrompt, message);
            
            // Restaurar modelo original
            if (model) gemini.setModel(originalModel);

            console.log(`   ✅ OK (${Date.now() - startTime}ms)`);
            
            this.sendJSON(res, 200, {
                success: true,
                response: result.text,
                latency: Date.now() - startTime,
                model: model || originalModel
            });

        } catch (error) {
            console.error(`   ❌ Erro: ${error.message}`);
            this.sendJSON(res, 200, { success: false, error: error.message });
        }
    }

    // ===== HANDLERS EXISTENTES =====

    async getStatus(res) {
        const sock = this.bot?.getSocket?.();
        const isConnected = sock && sock.user;
        this.sendJSON(res, 200, {
            connected: !!isConnected,
            user: isConnected ? { id: sock.user.id, name: sock.user.name } : null,
            uptime: process.uptime(),
            gemini: gemini.getStatus()
        });
    }

    async getConfig(res) {
        if (!this.db) return this.sendJSON(res, 200, {});
        const config = await this.db.getAllConfig();
        this.sendJSON(res, 200, config);
    }

    async updateConfig(req, res) {
        if (!this.db) return this.sendJSON(res, 503, { error: 'Database not available' });
        const body = await this.getBody(req);
        const data = JSON.parse(body);
        for (const [key, value] of Object.entries(data)) {
            await this.db.setConfig(key, value);
        }
        this.sendJSON(res, 200, { success: true });
    }

    async getLeads(res, query) {
        if (!this.db) return this.sendJSON(res, 200, []);
        const leads = await this.db.getLeads(parseInt(query.limit) || 50, parseInt(query.offset) || 0);
        this.sendJSON(res, 200, leads);
    }

    async getConversations(res, query) {
        if (!this.db) return this.sendJSON(res, 200, []);
        const conversations = await this.db.query(`
            SELECT 
                c.id, c.chat_id, c.chat_type, c.is_bot_active, 
                c.stage, c.assunto, c.plano,
                c.last_message_at, c.message_count, c.created_at, c.lead_id,
                l.name, l.phone, l.email, l.company, l.tags, l.notes
            FROM conversations c
            LEFT JOIN leads l ON c.lead_id = l.id
            ORDER BY c.last_message_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(query.limit) || 50, parseInt(query.offset) || 0]);
        
        this.sendJSON(res, 200, conversations);
    }

    async getCRMStats(res) {
        if (!this.db) {
            return this.sendJSON(res, 200, {
                leads_total: 0,
                leads_today: 0,
                conversas_ativas: 0,
                pipeline: { inicio: 0, explorando: 0, negociando: 0, fechando: 0 }
            });
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            
            const leadsTotal = await this.db.query('SELECT COUNT(*) as count FROM leads');
            const leadsToday = await this.db.query(
                'SELECT COUNT(*) as count FROM leads WHERE date(created_at) = ?',
                [today]
            );
            const conversasAtivas = await this.db.query(
                `SELECT COUNT(*) as count FROM conversations 
                 WHERE datetime(last_message_at) > datetime('now', '-24 hours')`
            );
            const pipeline = await this.db.getPipelineStats();

            this.sendJSON(res, 200, {
                leads_total: leadsTotal[0]?.count || 0,
                leads_today: leadsToday[0]?.count || 0,
                conversas_ativas: conversasAtivas[0]?.count || 0,
                pipeline
            });
        } catch (e) {
            this.sendJSON(res, 500, { error: e.message });
        }
    }

    async migrateSchema(res) {
        if (!this.db) return this.sendJSON(res, 503, { error: 'Database not available' });

        try {
            // Adicionar colunas se não existirem
            await this.db.run(`
                ALTER TABLE conversations ADD COLUMN stage TEXT DEFAULT 'inicio'
            `).catch(() => {});
            
            await this.db.run(`
                ALTER TABLE conversations ADD COLUMN assunto TEXT
            `).catch(() => {});
            
            await this.db.run(`
                ALTER TABLE conversations ADD COLUMN plano TEXT
            `).catch(() => {});

            this.sendJSON(res, 200, { success: true, message: 'Schema atualizado' });
        } catch (e) {
            this.sendJSON(res, 200, { success: true, message: 'Colunas já existem ou erro: ' + e.message });
        }
    }

    async getMessages(res, conversationId) {
        if (!this.db) return this.sendJSON(res, 200, []);
        const messages = await this.db.getMessages(parseInt(conversationId));
        this.sendJSON(res, 200, messages);
    }

    async sendMessage(req, res) {
        const body = await this.getBody(req);
        const { chatId, message } = JSON.parse(body);
        const sock = this.bot?.getSocket?.();
        if (!sock) return this.sendJSON(res, 503, { error: 'Bot not connected' });
        try {
            await sock.sendMessage(chatId, { text: message });
            this.sendJSON(res, 200, { success: true });
        } catch (error) {
            this.sendJSON(res, 500, { error: error.message });
        }
    }

    async updateConversation(req, res, chatId) {
        if (!this.db) return this.sendJSON(res, 503, { error: 'Database not available' });
        const body = await this.getBody(req);
        const { is_bot_active } = JSON.parse(body);
        await this.db.setBotActiveForChat(chatId, is_bot_active);
        this.sendJSON(res, 200, { success: true });
    }

// Adicione o novo método:
    async getMessagesByChatId(res, chatId) {
        if (!this.db) return this.sendJSON(res, 200, []);
        try {
            const messages = await this.db.getMessagesByChatId(chatId);
            this.sendJSON(res, 200, messages);
        } catch (e) {
            this.sendJSON(res, 500, { error: e.message });
        }
    }

    // Modifique getStats para incluir pipeline:
    async getStats(res) {
        if (!this.db) {
            return this.sendJSON(res, 200, {
                total_messages: 0,
                total_conversations: 0,
                new_leads: 0,
                bot_responses: 0,
                pipeline: { inicio: 0, explorando: 0, negociando: 0, fechando: 0 }
            });
        }
        
        try {
            const stats = await this.db.getTodayStats();
            const pipeline = await this.db.getPipelineStats();
            stats.pipeline = pipeline;
            this.sendJSON(res, 200, stats);
        } catch (e) {
            this.sendJSON(res, 200, {
                total_messages: 0,
                total_conversations: 0,
                new_leads: 0,
                bot_responses: 0,
                pipeline: { inicio: 0, explorando: 0, negociando: 0, fechando: 0 }
            });
        }
    }

    async testNLP(req, res) {
        try {
            const body = await this.getBody(req);
            const { message } = JSON.parse(body);
            const result = await nlpAnalyzer.analyze(message, 'test_user_' + Date.now());
            this.sendJSON(res, 200, result);
        } catch (error) {
            this.sendJSON(res, 500, { error: error.message });
        }
    }

    async getBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    sendJSON(res, status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
}

module.exports = BotAPI;