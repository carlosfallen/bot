// Dashboard App - WhatsApp Bot
class BotDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentConversation = null;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.checkConnection();
        this.loadDashboard();
        this.setupEventListeners();

        // Auto-refresh a cada 10 segundos
        setInterval(() => {
            this.checkConnection();
            if (this.currentPage === 'dashboard') {
                this.loadDashboard();
            }
        }, 10000);
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const page = item.dataset.page;

                // Update active nav
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Show page
                this.showPage(page);
            });
        });
    }

    showPage(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // Show selected page
        const pageElement = document.getElementById(`page-${page}`);
        if (pageElement) {
            pageElement.classList.add('active');
            this.currentPage = page;

            // Update title
            const titles = {
                'dashboard': 'Dashboard',
                'conversations': 'Conversas',
                'leads': 'Leads',
                'test': 'Testar Bot',
                'config': 'Configurações'
            };

            document.getElementById('page-title').textContent = titles[page];

            // Load page data
            this.loadPageData(page);
        }
    }

    async loadPageData(page) {
        switch (page) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'conversations':
                await this.loadConversations();
                break;
            case 'leads':
                await this.loadLeads();
                break;
            case 'config':
                await this.loadConfig();
                break;
        }
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();

            const statusDot = document.querySelector('.status-dot');
            const statusText = document.querySelector('.status-text');

            if (data.connected) {
                statusDot.classList.add('connected');
                statusDot.classList.remove('disconnected');
                statusText.textContent = `Conectado: ${data.user.name || 'Bot'}`;
            } else {
                statusDot.classList.add('disconnected');
                statusDot.classList.remove('connected');
                statusText.textContent = 'Desconectado';
            }
        } catch (error) {
            console.error('Error checking connection:', error);
        }
    }

    async loadDashboard() {
        try {
            // Load stats
            const statsResponse = await fetch('/api/stats');
            const stats = await statsResponse.json();

            document.getElementById('stat-messages').textContent = stats.total_messages || 0;
            document.getElementById('stat-leads').textContent = stats.new_leads || 0;
            document.getElementById('stat-conversations').textContent = stats.total_conversations || 0;
            document.getElementById('stat-bot-responses').textContent = stats.bot_responses || 0;

            // Load recent conversations
            const conversationsResponse = await fetch('/api/conversations?limit=5');
            const conversations = await conversationsResponse.json();

            const container = document.getElementById('recent-conversations');
            container.innerHTML = '';

            if (conversations.length === 0) {
                container.innerHTML = '<p class="placeholder">Nenhuma conversa ainda</p>';
                return;
            }

            conversations.forEach(conv => {
                const item = document.createElement('div');
                item.className = 'conversation-item';
                item.innerHTML = `
                    <div class="conversation-header">
                        <span class="conversation-name">${conv.name || conv.phone || 'Desconhecido'}</span>
                        <span class="conversation-time">${this.formatTime(conv.last_message_at)}</span>
                    </div>
                    <div class="conversation-preview">
                        ${conv.chat_type === 'group' ? '👥 Grupo' : '💬 Chat privado'} • ${conv.message_count} mensagens
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async loadConversations() {
        try {
            const response = await fetch('/api/conversations');
            const conversations = await response.json();

            const container = document.getElementById('conversations-list');
            container.innerHTML = '';

            if (conversations.length === 0) {
                container.innerHTML = '<p class="placeholder">Nenhuma conversa</p>';
                return;
            }

            conversations.forEach(conv => {
                const item = document.createElement('div');
                item.className = 'conversation-item';
                item.dataset.chatId = conv.chat_id;
                item.dataset.convId = conv.id;
                item.innerHTML = `
                    <div class="conversation-header">
                        <span class="conversation-name">${conv.name || conv.phone || 'Desconhecido'}</span>
                        <span class="conversation-time">${this.formatTime(conv.last_message_at)}</span>
                    </div>
                    <div class="conversation-preview">
                        ${conv.message_count} mensagens
                    </div>
                `;

                item.addEventListener('click', () => {
                    this.loadMessages(conv.id, conv.chat_id, conv.name || conv.phone);
                });

                container.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }

    async loadMessages(conversationId, chatId, name) {
        try {
            const response = await fetch(`/api/messages/${conversationId}`);
            const messages = await response.json();

            // Show chat area
            document.querySelector('.chat-empty').style.display = 'none';
            document.getElementById('chat-messages').classList.remove('hidden');

            // Update header
            document.getElementById('chat-contact-name').textContent = name;

            // Store current conversation
            this.currentConversation = { id: conversationId, chatId };

            // Render messages
            const container = document.getElementById('messages-container');
            container.innerHTML = '';

            messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.direction}`;
                messageDiv.innerHTML = `
                    <div class="message-bubble">
                        ${msg.message_text}
                        <div class="message-info">
                            ${this.formatTime(msg.created_at)}
                            ${msg.intent ? `• ${msg.intent}` : ''}
                        </div>
                    </div>
                `;
                container.appendChild(messageDiv);
            });

            container.scrollTop = container.scrollHeight;
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    async loadLeads() {
        try {
            const response = await fetch('/api/leads');
            const leads = await response.json();

            const tbody = document.getElementById('leads-tbody');
            tbody.innerHTML = '';

            if (leads.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="placeholder">Nenhum lead cadastrado</td></tr>';
                return;
            }

            leads.forEach(lead => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${lead.name || '-'}</td>
                    <td>${lead.phone}</td>
                    <td>${lead.email || '-'}</td>
                    <td>${lead.company || '-'}</td>
                    <td>${this.formatTime(lead.last_interaction)}</td>
                    <td>
                        <span class="badge ${lead.is_active ? 'badge-success' : 'badge-danger'}">
                            ${lead.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();

            // Set config values
            document.getElementById('config-bot-enabled').checked = config.bot_enabled;
            document.getElementById('config-auto-save-leads').checked = config.auto_save_leads;
            document.getElementById('config-respond-groups').checked = config.respond_to_groups;
            document.getElementById('config-respond-channels').checked = config.respond_to_channels;
            document.getElementById('config-business-hours').checked = config.business_hours_only;
            document.getElementById('config-hours-start').value = config.business_hours_start;
            document.getElementById('config-hours-end').value = config.business_hours_end;
            document.getElementById('config-welcome-message').value = config.welcome_message;
            document.getElementById('config-away-message').value = config.away_message;
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    async saveConfig() {
        try {
            const config = {
                bot_enabled: document.getElementById('config-bot-enabled').checked,
                auto_save_leads: document.getElementById('config-auto-save-leads').checked,
                respond_to_groups: document.getElementById('config-respond-groups').checked,
                respond_to_channels: document.getElementById('config-respond-channels').checked,
                business_hours_only: document.getElementById('config-business-hours').checked,
                business_hours_start: document.getElementById('config-hours-start').value,
                business_hours_end: document.getElementById('config-hours-end').value,
                welcome_message: document.getElementById('config-welcome-message').value,
                away_message: document.getElementById('config-away-message').value
            };

            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                alert('Configurações salvas com sucesso!');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Erro ao salvar configurações');
        }
    }

    setupEventListeners() {
        // Save config button
        const saveConfigBtn = document.getElementById('save-config-btn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => this.saveConfig());
        }

        // Toggle bot button
        const toggleBotBtn = document.getElementById('toggle-bot-btn');
        if (toggleBotBtn) {
            toggleBotBtn.addEventListener('click', () => this.toggleBotForChat());
        }

        // Test message
        const testInput = document.getElementById('test-message-input');
        const testBtn = document.getElementById('test-send-btn');

        if (testInput && testBtn) {
            testBtn.addEventListener('click', () => this.sendTestMessage());
            testInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendTestMessage();
            });
        }
    }

    async sendTestMessage() {
        const input = document.getElementById('test-message-input');
        const message = input.value.trim();

        if (!message) return;

        // Add user message
        const messagesContainer = document.getElementById('test-messages');
        const userDiv = document.createElement('div');
        userDiv.className = 'user-message';
        userDiv.innerHTML = `<p>${message}</p>`;
        messagesContainer.appendChild(userDiv);

        input.value = '';

        try {
            // Test NLP
            const response = await fetch('/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const result = await response.json();

            // Add bot response
            const botDiv = document.createElement('div');
            botDiv.className = 'bot-message';
            botDiv.innerHTML = `<p>${result.response}</p>`;
            messagesContainer.appendChild(botDiv);

            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // Show NLP analysis
            const nlpResult = document.getElementById('nlp-result');
            nlpResult.innerHTML = `
                <div class="nlp-item">
                    <strong>Intent:</strong> ${result.intent}<br>
                    <strong>Confidence:</strong> ${(result.confidence * 100).toFixed(1)}%
                </div>
                ${Object.keys(result.entities).length > 0 ? `
                    <div class="nlp-item">
                        <strong>Entidades:</strong><br>
                        ${Object.entries(result.entities).map(([key, value]) =>
                            `${key}: ${value}`
                        ).join('<br>')}
                    </div>
                ` : ''}
                ${result.context.isUrgent ? '<div class="nlp-item"><strong>⚠️ Mensagem urgente detectada</strong></div>' : ''}
            `;
        } catch (error) {
            console.error('Error testing message:', error);
        }
    }

    async toggleBotForChat() {
        if (!this.currentConversation) return;

        // Implementar toggle
        console.log('Toggle bot for chat:', this.currentConversation);
    }

    formatTime(timestamp) {
        if (!timestamp) return '-';

        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Menos de 1 minuto
        if (diff < 60000) {
            return 'Agora';
        }

        // Menos de 1 hora
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}m atrás`;
        }

        // Menos de 24 horas
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h atrás`;
        }

        // Formato de data
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new BotDashboard();
});
