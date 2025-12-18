// API REST para gerenciamento do bot
const http = require('http');
const url = require('url');
const fs = require('fs').promises;
const path = require('path');

class BotAPI {
    constructor(database, whatsappBot) {
        this.db = database;
        this.bot = whatsappBot;
        this.port = process.env.PORT || 3000;
    }

    // Iniciar servidor
    start() {
        const server = http.createServer(async (req, res) => {
            // CORS Headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            const parsedUrl = url.parse(req.url, true);
            const pathname = parsedUrl.pathname;

            try {
                // Servir arquivos estáticos
                if (pathname === '/' || pathname.startsWith('/index.html')) {
                    await this.serveFile(res, 'public/index.html', 'text/html');
                    return;
                }

                if (pathname.startsWith('/css/')) {
                    await this.serveFile(res, `public${pathname}`, 'text/css');
                    return;
                }

                if (pathname.startsWith('/js/')) {
                    await this.serveFile(res, `public${pathname}`, 'application/javascript');
                    return;
                }

                // API Routes
                if (pathname.startsWith('/api/')) {
                    await this.handleAPI(req, res, pathname, parsedUrl.query);
                } else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            } catch (error) {
                console.error('Server error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
            }
        });

        server.listen(this.port, () => {
            console.log(`\n🌐 Dashboard disponível em: http://localhost:${this.port}`);
        });
    }

    // Servir arquivo estático
    async serveFile(res, filePath, contentType) {
        try {
            const fullPath = path.join(process.cwd(), filePath);
            const content = await fs.readFile(fullPath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch (error) {
            res.writeHead(404);
            res.end('File not found');
        }
    }

    // Processar requisição da API
    async handleAPI(req, res, pathname, query) {
        const method = req.method;
        const parts = pathname.split('/').filter(p => p);

        // Remover 'api' do início
        parts.shift();

        const endpoint = parts[0];

        // Rotas
        if (endpoint === 'status' && method === 'GET') {
            return this.getStatus(res);
        }

        if (endpoint === 'config') {
            if (method === 'GET') return this.getConfig(res);
            if (method === 'POST') return this.updateConfig(req, res);
        }

        if (endpoint === 'leads') {
            if (method === 'GET') return this.getLeads(res, query);
        }

        if (endpoint === 'conversations') {
            if (method === 'GET') return this.getConversations(res, query);
        }

        if (endpoint === 'messages' && parts[1]) {
            if (method === 'GET') return this.getMessages(res, parts[1]);
        }

        if (endpoint === 'send' && method === 'POST') {
            return this.sendMessage(req, res);
        }

        if (endpoint === 'conversation') {
            const chatId = parts[1];
            if (method === 'PUT') return this.updateConversation(req, res, chatId);
        }

        if (endpoint === 'stats' && method === 'GET') {
            return this.getStats(res);
        }

        if (endpoint === 'test' && method === 'POST') {
            return this.testNLP(req, res);
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    // Obter status da conexão
    async getStatus(res) {
        const isConnected = this.bot && this.bot.sock && this.bot.sock.user;
        const user = isConnected ? this.bot.sock.user : null;

        this.sendJSON(res, 200, {
            connected: !!isConnected,
            user: user ? {
                id: user.id,
                name: user.name
            } : null,
            uptime: process.uptime()
        });
    }

    // Obter configurações
    async getConfig(res) {
        const config = await this.db.getAllConfig();
        this.sendJSON(res, 200, config);
    }

    // Atualizar configurações
    async updateConfig(req, res) {
        const body = await this.getBody(req);
        const data = JSON.parse(body);

        for (const [key, value] of Object.entries(data)) {
            await this.db.setConfig(key, value);
        }

        this.sendJSON(res, 200, { success: true });
    }

    // Obter leads
    async getLeads(res, query) {
        const limit = parseInt(query.limit) || 50;
        const offset = parseInt(query.offset) || 0;

        const leads = await this.db.getLeads(limit, offset);
        this.sendJSON(res, 200, leads);
    }

    // Obter conversas
    async getConversations(res, query) {
        const limit = parseInt(query.limit) || 50;
        const offset = parseInt(query.offset) || 0;

        const conversations = await this.db.getConversations(limit, offset);
        this.sendJSON(res, 200, conversations);
    }

    // Obter mensagens
    async getMessages(res, conversationId) {
        const messages = await this.db.getMessages(parseInt(conversationId));
        this.sendJSON(res, 200, messages);
    }

    // Enviar mensagem (teste)
    async sendMessage(req, res) {
        const body = await this.getBody(req);
        const { chatId, message } = JSON.parse(body);

        if (!this.bot || !this.bot.sock) {
            return this.sendJSON(res, 503, { error: 'Bot not connected' });
        }

        try {
            await this.bot.sock.sendMessage(chatId, { text: message });
            this.sendJSON(res, 200, { success: true });
        } catch (error) {
            this.sendJSON(res, 500, { error: error.message });
        }
    }

    // Atualizar conversa (ativar/desativar bot)
    async updateConversation(req, res, chatId) {
        const body = await this.getBody(req);
        const { is_bot_active } = JSON.parse(body);

        await this.db.setBotActiveForChat(chatId, is_bot_active);
        this.sendJSON(res, 200, { success: true });
    }

    // Obter estatísticas
    async getStats(res) {
        const stats = await this.db.getTodayStats();
        this.sendJSON(res, 200, stats);
    }

    // Testar NLP
    async testNLP(req, res) {
        const body = await this.getBody(req);
        const { message } = JSON.parse(body);

        if (!this.bot || !this.bot.nlp) {
            return this.sendJSON(res, 503, { error: 'NLP not available' });
        }

        const result = await this.bot.nlp.analyze(message, 'test_user');
        this.sendJSON(res, 200, result);
    }

    // Helpers
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
