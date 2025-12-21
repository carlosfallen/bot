

// ===== NAVIGATION =====
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

const pageTitles = {
    'dashboard': { title: 'Dashboard', subtitle: 'Visão geral do seu funil de vendas' },
    'conversations': { title: 'Conversas', subtitle: 'Gerencie suas conversas do WhatsApp' },
    'leads': { title: 'Leads', subtitle: 'Base de contatos e oportunidades' },
    'test-nlp': { title: 'Testar NLP', subtitle: 'Simule conversas com o sistema determinístico' },
    'test-gemini': { title: 'Testar Gemini', subtitle: 'Configure e teste a integração com IA' },
    'config': { title: 'Configurações', subtitle: 'Personalize o comportamento do bot' }
};

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        const info = pageTitles[page];
        pageTitle.textContent = info.title;
        pageSubtitle.textContent = info.subtitle;

        // Load specific data
        if (page === 'test-gemini') loadGeminiStatus();
        if (page === 'leads') loadLeads();
        if (page === 'conversations') loadConversations();
    });
});

// ===== STATUS CHECK =====
async function checkStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        
        if (data.connected) {
            dot.className = 'status-indicator online';
            text.textContent = data.user?.name || 'Conectado';
        } else {
            dot.className = 'status-indicator offline';
            text.textContent = 'Desconectado';
        }
    } catch {
        document.getElementById('status-dot').className = 'status-indicator offline';
        document.getElementById('status-text').textContent = 'Erro';
    }
}

// ===== DASHBOARD =====
async function loadStats() {
try {
const res = await fetch('/api/stats');
const data = await res.json();

document.getElementById('metric-messages').textContent = data.total_messages || 0;
document.getElementById('metric-leads').textContent = data.new_leads || 0;
document.getElementById('metric-conversion').textContent = 
    data.total_conversations > 0 
        ? Math.round((data.bot_responses / data.total_messages) * 100) + '%' 
        : '0%';

// Pipeline
if (data.pipeline) {
    document.getElementById('stage-inicio').textContent = data.pipeline.inicio || 0;
    document.getElementById('stage-explorando').textContent = data.pipeline.explorando || 0;
    document.getElementById('stage-negociando').textContent = data.pipeline.negociando || 0;
    document.getElementById('stage-fechando').textContent = data.pipeline.fechando || 0;
}
} catch (e) {
console.error('Erro ao carregar stats:', e);
}
}

// ===== LEADS =====
async function loadLeads() {
    try {
        const res = await fetch('/api/leads?limit=50');
        const leads = await res.json();
        const tbody = document.getElementById('leads-tbody');
        
        if (!leads.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum lead encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = leads.map(lead => `
            <tr>
                <td>
                    <div class="lead-name-cell">
                        <div class="lead-avatar">${(lead.name || '?')[0].toUpperCase()}</div>
                        <div>
                            <div style="font-weight: 500;">${lead.name || 'Sem nome'}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${lead.email || '-'}</div>
                        </div>
                    </div>
                </td>
                <td>${lead.phone || '-'}</td>
                <td>${lead.company || '-'}</td>
                <td><span class="lead-status new">Novo</span></td>
                <td>${lead.last_interaction ? new Date(lead.last_interaction).toLocaleDateString('pt-BR') : '-'}</td>
                <td>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Ver</button>
                </td>
            </tr>
        `).join('');
    } catch {
        document.getElementById('leads-tbody').innerHTML = '<tr><td colspan="6" class="empty-state">Erro ao carregar</td></tr>';
    }
}

// ===== CONVERSATIONS =====
async function loadConversations() {
    try {
        const res = await fetch('/api/conversations?limit=30');
        const convs = await res.json();
        const list = document.getElementById('conversations-list');
        
        if (!convs.length) {
            list.innerHTML = '<div class="empty-state"><p>Nenhuma conversa</p></div>';
            return;
        }

        list.innerHTML = convs.map(conv => `
            <div class="conversation-item" onclick="loadChat('${conv.chat_id}', '${conv.name || conv.phone}')">
                <div class="conv-avatar">${(conv.name || conv.phone || '?')[0].toUpperCase()}</div>
                <div class="conv-info">
                    <div class="conv-name">${conv.name || conv.phone || 'Desconhecido'}</div>
                    <div class="conv-preview">${conv.message_count} mensagens</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">${conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '-'}</div>
                </div>
            </div>
        `).join('');
    } catch {}
}

async function loadChat(chatId, name) {
document.getElementById('chat-empty').classList.add('hidden');
document.getElementById('chat-container').classList.remove('hidden');
document.getElementById('chat-contact-name').textContent = name;
document.getElementById('chat-avatar').textContent = (name || '?')[0].toUpperCase();

const messagesContainer = document.getElementById('chat-messages');
messagesContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Carregando...</div>';

try {
// Busca por chat_id (ex: 5511999999999@s.whatsapp.net)
const res = await fetch(`/api/messages/${encodeURIComponent(chatId)}`);
const messages = await res.json();

if (!messages.length) {
    messagesContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Nenhuma mensagem</div>';
    return;
}

messagesContainer.innerHTML = messages.map(msg => `
    <div class="message ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}">
        ${escapeHtml(msg.text || '')}
        <div class="message-time">
            ${new Date(msg.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
            ${msg.intent ? ` • ${msg.intent}` : ''}
            ${msg.method ? ` • ${msg.method}` : ''}
        </div>
    </div>
`).join('');

messagesContainer.scrollTop = messagesContainer.scrollHeight;

} catch (e) {
messagesContainer.innerHTML = `<div style="color: #ff6b6b; padding: 20px;">Erro: ${e.message}</div>`;
}
}

// ===== NLP TEST =====
async function testNLP() {
    const input = document.getElementById('nlp-input');
    const messages = document.getElementById('nlp-messages');
    const analysis = document.getElementById('nlp-analysis');
    const text = input.value.trim();
    
    if (!text) return;

    messages.innerHTML += `<div class="message outgoing">${escapeHtml(text)}</div>`;
    input.value = '';

    try {
        const res = await fetch('/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();

        messages.innerHTML += `<div class="message incoming">${escapeHtml(data.response || 'Sem resposta')}</div>`;
        messages.scrollTop = messages.scrollHeight;

        // Update analysis
        analysis.innerHTML = `
            <div class="analysis-section">
                <div class="analysis-label">Intent Detectada</div>
                <div class="analysis-value intent">
                    <span class="intent-name">${data.intent || 'unknown'}</span>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); margin-right: 8px;">${Math.round((data.confidence || 0) * 100)}%</span>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${(data.confidence || 0) * 100}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="analysis-section">
                <div class="analysis-label">Ação Executada</div>
                <div class="analysis-value">${data.action || '-'}</div>
            </div>
            <div class="analysis-section">
                <div class="analysis-label">Estado</div>
                <div class="analysis-value state-info">
                    Stage: <code>${data.state?.stage || '-'}</code><br>
                    Assunto: <code>${data.state?.assunto || '-'}</code><br>
                    Plano: <code>${data.state?.plano || '-'}</code><br>
                    Cliente: <code>${data.state?.cliente?.nome || '-'}</code>
                </div>
            </div>
            <div class="analysis-section">
                <div class="analysis-label">Entidades</div>
                <div class="analysis-value">
                    <pre style="font-size: 11px; margin: 0;">${JSON.stringify(data.entities || {}, null, 2)}</pre>
                </div>
            </div>
        `;
    } catch (e) {
        messages.innerHTML += `<div class="message incoming" style="background: rgba(255,82,82,0.2);">Erro: ${e.message}</div>`;
    }
}

// ===== GEMINI =====
let currentModel = 'gemini-pro';

async function loadGeminiStatus() {
    try {
        const res = await fetch('/api/gemini-status');
        const data = await res.json();
        
        document.getElementById('gemini-status').innerHTML = data.configured 
            ? '<span class="success">✅ Configurado</span>' 
            : '<span class="error">❌ Não configurado</span>';
        document.getElementById('gemini-router').innerHTML = data.routerEnabled 
            ? '<span class="success">Ativo</span>' 
            : '<span class="error">Inativo</span>';
        document.getElementById('gemini-model').textContent = data.model || '-';
        document.getElementById('gemini-apikey').textContent = data.apiKeyPreview || '-';
        
        currentModel = data.model;
        document.getElementById('model-selector').value = data.model;
    } catch {}
}

async function loadGeminiModels() {
    const list = document.getElementById('models-list');
    const selector = document.getElementById('model-selector');
    
    list.innerHTML = '<div style="text-align: center; padding: 20px;"><span class="loading-spinner"></span> Carregando...</div>';

    try {
        const res = await fetch('/api/gemini-models');
        const data = await res.json();

        if (!data.success || !data.models?.length) {
            list.innerHTML = `<div class="empty-state" style="padding: 20px;"><p style="color: var(--danger);">${data.error || 'Nenhum modelo encontrado'}</p></div>`;
            return;
        }

        list.innerHTML = data.models.map(m => `
            <div class="model-item" onclick="selectModel('${m.name}')">
                <div class="model-item-name">${m.name}</div>
                <div class="model-item-info">${m.displayName || ''} | In: ${m.inputTokenLimit} | Out: ${m.outputTokenLimit}</div>
            </div>
        `).join('');

        selector.innerHTML = data.models.map(m => 
            `<option value="${m.name}" ${m.name === currentModel ? 'selected' : ''}>${m.name}</option>`
        ).join('');
    } catch (e) {
        list.innerHTML = `<div class="empty-state" style="padding: 20px;"><p style="color: var(--danger);">Erro: ${e.message}</p></div>`;
    }
}

function selectModel(name) {
    document.getElementById('model-selector').value = name;
    currentModel = name;
}

async function testGeminiConnection() {
    const btn = document.getElementById('test-gemini-btn');
    const result = document.getElementById('gemini-test-result');
    const model = document.getElementById('model-selector').value || currentModel;

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Testando...';
    result.classList.remove('hidden', 'success', 'error');
    result.classList.add('loading');
    result.textContent = `Testando ${model}...`;

    try {
        const res = await fetch('/api/gemini-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });
        const data = await res.json();

        result.classList.remove('loading');
        if (data.success) {
            result.classList.add('success');
            result.textContent = `✅ SUCESSO!\n\nModelo: ${data.model}\nLatência: ${data.latency}ms\n\nResposta:\n${data.response}`;
        } else {
            result.classList.add('error');
            result.textContent = `❌ FALHA!\n\nErro: ${data.error}`;
        }
    } catch (e) {
        result.classList.remove('loading');
        result.classList.add('error');
        result.textContent = `❌ Erro: ${e.message}`;
    }

    btn.disabled = false;
    btn.innerHTML = '🧪 Testar Conexão';
}

async function sendGeminiMessage() {
    const input = document.getElementById('gemini-input');
    const messages = document.getElementById('gemini-messages');
    const btn = document.getElementById('gemini-send-btn');
    const text = input.value.trim();
    const model = document.getElementById('model-selector').value || currentModel;

    if (!text) return;

    messages.innerHTML += `<div class="gemini-msg user">${escapeHtml(text)}</div>`;
    input.value = '';
    btn.disabled = true;

    const loadingId = 'load-' + Date.now();
    messages.innerHTML += `<div class="gemini-msg bot" id="${loadingId}"><span class="loading-spinner"></span> Digitando...</div>`;
    messages.scrollTop = messages.scrollHeight;

    try {
        const res = await fetch('/api/gemini-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, model })
        });
        const data = await res.json();

        document.getElementById(loadingId)?.remove();

        if (data.success) {
            messages.innerHTML += `
                <div class="gemini-msg bot">
                    ${escapeHtml(data.response)}
                    <div class="meta">${data.latency}ms</div>
                </div>
            `;
        } else {
            messages.innerHTML += `<div class="gemini-msg bot" style="background: rgba(255,82,82,0.2);">❌ ${data.error}</div>`;
        }
    } catch (e) {
        document.getElementById(loadingId)?.remove();
        messages.innerHTML += `<div class="gemini-msg bot" style="background: rgba(255,82,82,0.2);">❌ ${e.message}</div>`;
    }

    btn.disabled = false;
    messages.scrollTop = messages.scrollHeight;
}

// ===== CONFIG =====
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        
        document.getElementById('config-bot-enabled').checked = config.bot_enabled === true || config.bot_enabled === 'true';
        document.getElementById('config-auto-save-leads').checked = config.auto_save_leads === true || config.auto_save_leads === 'true';
        document.getElementById('config-respond-groups').checked = config.respond_to_groups === true || config.respond_to_groups === 'true';
        document.getElementById('config-welcome-message').value = config.welcome_message || '';
        document.getElementById('config-away-message').value = config.away_message || '';
    } catch {}
}

async function saveConfig() {
    try {
        await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_enabled: document.getElementById('config-bot-enabled').checked,
                auto_save_leads: document.getElementById('config-auto-save-leads').checked,
                respond_to_groups: document.getElementById('config-respond-groups').checked,
                welcome_message: document.getElementById('config-welcome-message').value,
                away_message: document.getElementById('config-away-message').value
            })
        });
        alert('Configurações salvas!');
    } catch (e) {
        alert('Erro ao salvar: ' + e.message);
    }
}

// ===== UTILS =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadAllData() {
    checkStatus();
    loadStats();
    loadConfig();
}

// ===== INIT =====
loadAllData();
setInterval(checkStatus, 15000);
setInterval(loadStats, 60000);