// FILE: public/js/app.js

// ==================== STATE ====================
let currentPage = 'dashboard';
let currentChatId = null;
let allConversations = [];
let allLeads = [];
let allDeals = [];
let allAppointments = [];
let allFilters = [];
let allQuickReplies = [];
let allConfig = {};

// ==================== NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

const pageTitles = {
    'dashboard': { title: 'Dashboard', subtitle: 'Visão geral do seu funil de vendas' },
    'conversations': { title: 'Conversas', subtitle: 'Gerencie suas conversas do WhatsApp' },
    'leads': { title: 'Leads', subtitle: 'Base de contatos e oportunidades' },
    'deals': { title: 'Negócios', subtitle: 'Pipeline de vendas' },
    'appointments': { title: 'Agenda', subtitle: 'Seus compromissos' },
    'filters': { title: 'Filtros', subtitle: 'Controle de grupos e números' },
    'quick-replies': { title: 'Respostas Rápidas', subtitle: 'Atalhos para mensagens' },
    'test-nlp': { title: 'Testar NLP', subtitle: 'Simule conversas' },
    'test-gemini': { title: 'Testar Gemini', subtitle: 'Configure e teste a IA' },
    'config': { title: 'Configurações', subtitle: 'Personalize o bot' },
    'activity': { title: 'Atividades', subtitle: 'Histórico de ações' }
};

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        navigateTo(page);
    });
});

function navigateTo(page) {
    currentPage = page;
    navItems.forEach(i => i.classList.toggle('active', i.dataset.page === page));
    pages.forEach(p => p.classList.toggle('active', p.id === `page-${page}`));
    
    const info = pageTitles[page] || { title: 'Página', subtitle: '' };
    pageTitle.textContent = info.title;
    pageSubtitle.textContent = info.subtitle;

    // Load page data
    if (page === 'conversations') loadConversations();
    if (page === 'leads') loadLeads();
    if (page === 'deals') loadDeals();
    if (page === 'appointments') loadAppointments();
    if (page === 'filters') loadFilters();
    if (page === 'quick-replies') loadQuickReplies();
    if (page === 'test-gemini') loadGeminiStatus();
    if (page === 'config') loadConfig();
    if (page === 'activity') loadActivity();
}

// ==================== API HELPERS ====================
async function api(endpoint, options = {}) {
    const res = await fetch(`/api/${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    return res.json();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
}

function formatTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

function formatMoney(value) {
    return `R$ ${(value || 0).toLocaleString('pt-BR')}`;
}

// ==================== STATUS ====================
async function checkStatus() {
    try {
        const data = await api('status');
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

// ==================== DASHBOARD ====================
async function loadDashboard() {
    try {
        const [stats, pipeline, deals] = await Promise.all([
            api('stats'),
            api('pipeline'),
            api('deals?status=open&limit=10')
        ]);

        document.getElementById('metric-messages').textContent = stats.total_messages || 0;
        document.getElementById('metric-leads').textContent = stats.new_leads || 0;
        document.getElementById('metric-conversion').textContent = 
            stats.total_messages > 0 
                ? Math.round((stats.bot_responses / stats.total_messages) * 100) + '%' 
                : '0%';

        // Calculate pipeline value
        const totalValue = deals.reduce((sum, d) => sum + (d.valor_final || 0), 0);
        document.getElementById('metric-revenue').textContent = formatMoney(totalValue);

        // Pipeline stages
        const stages = ['inicio', 'explorando', 'negociando', 'fechando'];
        const stagesHtml = stages.map(s => `
            <div class="pipeline-stage ${s}">
                <div class="stage-count">${pipeline[s] || 0}</div>
                <div class="stage-label">${s}</div>
            </div>
        `).join('');
        document.getElementById('pipeline-stages').innerHTML = stagesHtml;

        // Recent conversations
        const convs = await api('conversations?limit=5');
        document.getElementById('recent-conversations').innerHTML = convs.length ? convs.map(c => `
            <div class="conversation-item" onclick="navigateTo('conversations'); setTimeout(() => loadChat('${c.chat_id}'), 100)">
                <div class="conv-avatar">${(c.name || c.phone || '?')[0].toUpperCase()}</div>
                <div class="conv-info">
                    <div class="conv-name">${c.name || c.phone || 'Desconhecido'}</div>
                    <div class="conv-preview">${escapeHtml(c.last_message || '').substring(0, 40)}</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">${formatTime(c.last_message_at)}</div>
                    ${c.unread_count ? `<div class="conv-unread">${c.unread_count}</div>` : ''}
                </div>
            </div>
        `).join('') : '<div class="empty-state"><p>Nenhuma conversa</p></div>';

        // Today appointments
        const appts = await api('appointments?status=scheduled');
        const today = new Date().toISOString().split('T')[0];
        const todayAppts = appts.filter(a => a.start_at?.startsWith(today));
        document.getElementById('today-appointments').innerHTML = todayAppts.length ? todayAppts.map(a => `
            <div class="appointment-card">
                <div class="appointment-time">
                    <div class="time">${formatTime(a.start_at)}</div>
                </div>
                <div class="appointment-info">
                    <div class="appointment-title">${escapeHtml(a.title)}</div>
                    <div class="appointment-meta">${a.name || 'Sem contato'} • ${a.duration_min}min</div>
                </div>
                <span class="appointment-status ${a.status}">${a.status}</span>
            </div>
        `).join('') : '<div class="empty-state"><p>Nenhum compromisso hoje</p></div>';

    } catch (e) {
        console.error('Dashboard error:', e);
    }
}

// ==================== CONVERSATIONS ====================
async function loadConversations() {
    try {
        allConversations = await api('conversations?limit=100');
        renderConversations();
        loadQuickRepliesForSelect();
    } catch (e) {
        console.error('Conversations error:', e);
    }
}

function renderConversations(filter = 'all') {
    let convs = allConversations;
    const search = document.getElementById('search-conversations')?.value?.toLowerCase();
    
    if (search) {
        convs = convs.filter(c => 
            (c.name || '').toLowerCase().includes(search) ||
            (c.phone || '').includes(search) ||
            (c.chat_id || '').includes(search)
        );
    }
    
    if (filter === 'unread') convs = convs.filter(c => c.unread_count > 0);
    if (filter === 'favorite') convs = convs.filter(c => c.is_favorite);

    const totalUnread = allConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const badge = document.getElementById('unread-badge');
    if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }

    document.getElementById('conversations-list').innerHTML = convs.length ? convs.map(c => `
        <div class="conversation-item ${currentChatId === c.chat_id ? 'active' : ''}" onclick="loadChat('${c.chat_id}')">
            <div class="conv-avatar">${(c.name || c.phone || '?')[0].toUpperCase()}</div>
            <div class="conv-info">
                <div class="conv-name">
                    ${c.is_favorite ? '⭐ ' : ''}${c.name || c.phone || 'Desconhecido'}
                    ${c.is_blocked ? '🚫' : ''}
                </div>
                <div class="conv-preview">${escapeHtml(c.last_message || '').substring(0, 30)}</div>
            </div>
            <div class="conv-meta">
                <div class="conv-time">${formatTime(c.last_message_at)}</div>
                ${c.unread_count ? `<div class="conv-unread">${c.unread_count}</div>` : ''}
                ${c.heat ? `<span class="conv-stage ${c.heat}">${c.heat}</span>` : ''}
            </div>
        </div>
    `).join('') : '<div class="empty-state"><p>Nenhuma conversa</p></div>';
}

function filterConversations() { renderConversations(); }

function filterConversationType(filter) {
    document.querySelectorAll('#page-conversations .filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
    renderConversations(filter);
}

async function loadChat(chatId) {
    currentChatId = chatId;
    document.getElementById('chat-empty').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');

    const conv = allConversations.find(c => c.chat_id === chatId) || {};
    document.getElementById('chat-contact-name').textContent = conv.name || conv.phone || 'Contato';
    document.getElementById('chat-avatar').textContent = (conv.name || conv.phone || '?')[0].toUpperCase();
    document.getElementById('chat-contact-status').textContent = `${conv.stage || 'inicio'} • ${conv.is_bot_active ? '🤖 Bot ativo' : '👤 Manual'}`;
    document.getElementById('toggle-bot-btn').textContent = conv.is_bot_active ? '🤖 Bot Ativo' : '👤 Manual';

    // Mark as read
    await api(`mark-read/${encodeURIComponent(chatId)}`, { method: 'POST' });

    // Load messages
    const messages = await api(`messages/${encodeURIComponent(chatId)}`);
    const container = document.getElementById('chat-messages');
    
    container.innerHTML = messages.map(m => `
        <div class="message ${m.direction === 'incoming' ? 'incoming' : 'outgoing'}">
            ${escapeHtml(m.message_text || '')}
            <div class="message-time">${formatTime(m.created_at)}</div>
            ${m.intent ? `<div class="message-meta">${m.intent} • ${m.method || ''}</div>` : ''}
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;

    // Update list
    renderConversations();

    // Show lead panel
    if (conv.lead_id) {
        showLeadPanel(conv.lead_id);
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || !currentChatId) return;

    input.value = '';
    
    // Optimistic update
    const container = document.getElementById('chat-messages');
    container.innerHTML += `<div class="message outgoing">${escapeHtml(message)}<div class="message-time">agora</div></div>`;
    container.scrollTop = container.scrollHeight;

    await api('messages', { method: 'POST', body: { chatId: currentChatId, message } });
}

async function toggleBotForChat() {
    if (!currentChatId) return;
    const conv = allConversations.find(c => c.chat_id === currentChatId);
    if (!conv) return;

    const newState = !conv.is_bot_active;
    await api(`conversations/${encodeURIComponent(currentChatId)}`, { 
        method: 'PUT', 
        body: { is_bot_active: newState ? 1 : 0 } 
    });

    conv.is_bot_active = newState;
    document.getElementById('toggle-bot-btn').textContent = newState ? '🤖 Bot Ativo' : '👤 Manual';
    document.getElementById('chat-contact-status').textContent = `${conv.stage || 'inicio'} • ${newState ? '🤖 Bot ativo' : '👤 Manual'}`;
}

async function toggleFavorite() {
    if (!currentChatId) return;
    const conv = allConversations.find(c => c.chat_id === currentChatId);
    if (!conv) return;

    await api(`conversations/${encodeURIComponent(currentChatId)}`, { 
        method: 'PUT', 
        body: { is_favorite: conv.is_favorite ? 0 : 1 } 
    });

    conv.is_favorite = !conv.is_favorite;
    renderConversations();
}

async function blockChat() {
    if (!currentChatId) return;
    if (!confirm('Bloquear este chat?')) return;

    await api('filters', { 
        method: 'POST', 
        body: { chat_id: currentChatId, filter_type: 'blacklist', is_allowed: false, reason: 'Bloqueado manualmente' } 
    });

    await api(`conversations/${encodeURIComponent(currentChatId)}`, { 
        method: 'PUT', 
        body: { is_blocked: 1 } 
    });

    alert('Chat bloqueado');
    loadConversations();
}

async function showLeadPanel(leadId) {
    const panel = document.getElementById('lead-panel');
    panel.style.display = 'flex';

    const lead = await api(`leads/${leadId}`);
    
    document.getElementById('lead-panel-body').innerHTML = `
        <div class="lead-field">
            <div class="lead-field-label">Nome</div>
            <div class="lead-field-value">${lead.name || '-'}</div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Telefone</div>
            <div class="lead-field-value">${lead.phone || '-'}</div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Email</div>
            <div class="lead-field-value">${lead.email || '-'}</div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Empresa</div>
            <div class="lead-field-value">${lead.company || '-'}</div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Status</div>
            <div class="lead-field-value"><span class="lead-status ${lead.status}">${lead.status}</span></div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Temperatura</div>
            <div class="lead-field-value"><span class="lead-heat ${lead.heat}">${lead.heat}</span></div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Notas</div>
            <div class="lead-field-value">${lead.notes || '-'}</div>
        </div>
        <div class="lead-field">
            <div class="lead-field-label">Negócios</div>
            <div class="lead-field-value">${lead.deals?.length || 0}</div>
        </div>
        <button class="btn btn-secondary" style="width:100%;margin-top:16px" onclick="openLeadModal(${lead.id})">Editar Lead</button>
    `;
}

function closeLeadPanel() {
    document.getElementById('lead-panel').style.display = 'none';
}

async function loadQuickRepliesForSelect() {
    const replies = await api('quick-replies');
    const select = document.getElementById('quick-reply-select');
    select.innerHTML = '<option value="">⚡ Rápidas</option>' + 
        replies.map(r => `<option value="${r.id}">/${r.shortcut} - ${r.title}</option>`).join('');
}

async function insertQuickReply() {
    const select = document.getElementById('quick-reply-select');
    const id = select.value;
    if (!id) return;

    const replies = await api('quick-replies');
    const reply = replies.find(r => r.id == id);
    if (reply) {
        document.getElementById('chat-input').value = reply.content;
    }
    select.value = '';
}

// ==================== LEADS ====================
async function loadLeads() {
    allLeads = await api('leads?limit=100');
    renderLeads();
}

function renderLeads(statusFilter = 'all') {
    let leads = allLeads;
    const search = document.getElementById('search-leads')?.value?.toLowerCase();

    if (search) {
        leads = leads.filter(l => 
            (l.name || '').toLowerCase().includes(search) ||
            (l.phone || '').includes(search) ||
            (l.company || '').toLowerCase().includes(search)
        );
    }

    if (statusFilter !== 'all') {
        if (statusFilter === 'hot') leads = leads.filter(l => l.heat === 'hot');
        else leads = leads.filter(l => l.status === statusFilter);
    }

    document.getElementById('leads-tbody').innerHTML = leads.length ? leads.map(l => `
        <tr>
            <td>
                <div class="lead-name-cell">
                    <div class="lead-avatar">${(l.name || '?')[0].toUpperCase()}</div>
                    <div>
                        <div style="font-weight:500">${l.name || 'Sem nome'}</div>
                        <div style="font-size:11px;color:var(--text-muted)">${l.email || '-'}</div>
                    </div>
                </div>
            </td>
            <td>${l.phone || '-'}</td>
            <td>${l.company || '-'}</td>
            <td><span class="lead-status ${l.status}">${l.status || 'new'}</span></td>
            <td><span class="lead-heat ${l.heat}">${l.heat || 'cold'}</span></td>
            <td>${formatDateTime(l.last_interaction)}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openLeadModal(${l.id})">Ver</button>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="empty-state">Nenhum lead</td></tr>';
}

function filterLeads() { renderLeads(); }

function filterLeadStatus(status) {
    document.querySelectorAll('#page-leads .filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === status));
    renderLeads(status);
}

function openLeadModal(id = null) {
    const lead = id ? allLeads.find(l => l.id === id) : {};
    
    document.getElementById('modal-title').textContent = id ? 'Editar Lead' : 'Novo Lead';
    document.getElementById('modal-body').innerHTML = `
        <input type="hidden" id="lead-id" value="${id || ''}">
        <div class="form-group">
            <label class="form-label">Nome</label>
            <input type="text" class="form-input" id="lead-name" value="${lead.name || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Telefone</label>
            <input type="text" class="form-input" id="lead-phone" value="${lead.phone || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="lead-email" value="${lead.email || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Empresa</label>
            <input type="text" class="form-input" id="lead-company" value="${lead.company || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="lead-status">
                <option value="new" ${lead.status === 'new' ? 'selected' : ''}>Novo</option>
                <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contatado</option>
                <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualificado</option>
                <option value="proposal" ${lead.status === 'proposal' ? 'selected' : ''}>Proposta</option>
                <option value="won" ${lead.status === 'won' ? 'selected' : ''}>Ganho</option>
                <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Perdido</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Temperatura</label>
            <select class="form-select" id="lead-heat">
                <option value="cold" ${lead.heat === 'cold' ? 'selected' : ''}>Frio</option>
                <option value="warm" ${lead.heat === 'warm' ? 'selected' : ''}>Morno</option>
                <option value="hot" ${lead.heat === 'hot' ? 'selected' : ''}>Quente</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-textarea" id="lead-notes">${lead.notes || ''}</textarea>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveLead()">Salvar</button>
    `;
    openModal();
}

async function saveLead() {
    const id = document.getElementById('lead-id').value;
    const data = {
        name: document.getElementById('lead-name').value,
        phone: document.getElementById('lead-phone').value,
        email: document.getElementById('lead-email').value,
        company: document.getElementById('lead-company').value,
        status: document.getElementById('lead-status').value,
        heat: document.getElementById('lead-heat').value,
        notes: document.getElementById('lead-notes').value
    };

    if (id) {
        await api(`leads/${id}`, { method: 'PUT', body: data });
    } else {
        await api('leads', { method: 'POST', body: data });
    }

    closeModal();
    loadLeads();
}

// ==================== DEALS ====================
async function loadDeals() {
    allDeals = await api('deals?limit=100');
    renderDeals();
}

function renderDeals(statusFilter = 'all') {
    let deals = allDeals;
    if (statusFilter !== 'all') deals = deals.filter(d => d.status === statusFilter);

    document.getElementById('deals-grid').innerHTML = deals.length ? deals.map(d => `
        <div class="deal-card" onclick="openDealModal(${d.id})">
            <div class="deal-card-header">
                <div>
                    <div class="deal-card-title">${d.title || d.produto || 'Negócio'}</div>
                    <span class="deal-status ${d.status}">${d.status}</span>
                </div>
                <div class="deal-card-value">${formatMoney(d.valor_final)}</div>
            </div>
            <div class="deal-card-info">
                <div>👤 ${d.name || 'Sem nome'}</div>
                <div>📦 ${d.produto || '-'} / ${d.plano || '-'}</div>
                <div>📅 ${formatDate(d.created_at)}</div>
            </div>
        </div>
    `).join('') : '<div class="empty-state"><p>Nenhum negócio</p></div>';
}

function filterDeals(status) {
    document.querySelectorAll('#page-deals .filter-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(status)));
    renderDeals(status);
}

function openDealModal(id = null) {
    const deal = id ? allDeals.find(d => d.id === id) : {};
    
    document.getElementById('modal-title').textContent = id ? 'Editar Negócio' : 'Novo Negócio';
    document.getElementById('modal-body').innerHTML = `
        <input type="hidden" id="deal-id" value="${id || ''}">
        <div class="form-group">
            <label class="form-label">Título</label>
            <input type="text" class="form-input" id="deal-title" value="${deal.title || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Produto</label>
            <select class="form-select" id="deal-produto">
                <option value="">Selecione</option>
                <option value="site" ${deal.produto === 'site' ? 'selected' : ''}>Site</option>
                <option value="landing" ${deal.produto === 'landing' ? 'selected' : ''}>Landing Page</option>
                <option value="trafego" ${deal.produto === 'trafego' ? 'selected' : ''}>Tráfego</option>
                <option value="marketing" ${deal.produto === 'marketing' ? 'selected' : ''}>Marketing</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Plano</label>
            <input type="text" class="form-input" id="deal-plano" value="${deal.plano || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Valor</label>
            <input type="number" class="form-input" id="deal-valor" value="${deal.valor || 0}">
        </div>
        <div class="form-group">
            <label class="form-label">Desconto (%)</label>
            <input type="number" class="form-input" id="deal-desconto" value="${deal.desconto || 0}">
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="deal-status">
                <option value="open" ${deal.status === 'open' ? 'selected' : ''}>Aberto</option>
                <option value="waiting_payment" ${deal.status === 'waiting_payment' ? 'selected' : ''}>Aguardando Pagamento</option>
                <option value="won" ${deal.status === 'won' ? 'selected' : ''}>Ganho</option>
                <option value="lost" ${deal.status === 'lost' ? 'selected' : ''}>Perdido</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-textarea" id="deal-notes">${deal.notes || ''}</textarea>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveDeal()">Salvar</button>
    `;
    openModal();
}

async function saveDeal() {
    const id = document.getElementById('deal-id').value;
    const data = {
        title: document.getElementById('deal-title').value,
        produto: document.getElementById('deal-produto').value,
        plano: document.getElementById('deal-plano').value,
        valor: parseFloat(document.getElementById('deal-valor').value) || 0,
        desconto: parseFloat(document.getElementById('deal-desconto').value) || 0,
        status: document.getElementById('deal-status').value,
        notes: document.getElementById('deal-notes').value
    };

    if (id) {
        await api(`deals/${id}`, { method: 'PUT', body: data });
    } else {
        await api('deals', { method: 'POST', body: data });
    }

    closeModal();
    loadDeals();
}

// ==================== APPOINTMENTS ====================
async function loadAppointments() {
    allAppointments = await api('appointments');
    renderAppointments();
}

function renderAppointments() {
    document.getElementById('appointments-list').innerHTML = allAppointments.length ? allAppointments.map(a => `
        <div class="appointment-card">
            <div class="appointment-time">
                <div class="time">${formatTime(a.start_at)}</div>
                <div class="date">${formatDate(a.start_at)}</div>
            </div>
            <div class="appointment-info">
                <div class="appointment-title">${escapeHtml(a.title)}</div>
                <div class="appointment-meta">${a.name || 'Sem contato'} • ${a.duration_min}min • ${a.type}</div>
            </div>
            <span class="appointment-status ${a.status}">${a.status}</span>
            <button class="btn btn-secondary btn-sm" onclick="openAppointmentModal(${a.id})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAppointment(${a.id})">✕</button>
        </div>
    `).join('') : '<div class="empty-state"><p>Nenhum compromisso</p></div>';
}

function openAppointmentModal(id = null) {
    const appt = id ? allAppointments.find(a => a.id === id) : {};
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    
    document.getElementById('modal-title').textContent = id ? 'Editar Agendamento' : 'Novo Agendamento';
    document.getElementById('modal-body').innerHTML = `
        <input type="hidden" id="appt-id" value="${id || ''}">
        <div class="form-group">
            <label class="form-label">Título</label>
            <input type="text" class="form-input" id="appt-title" value="${appt.title || 'Reunião'}">
        </div>
        <div class="form-group">
            <label class="form-label">Data e Hora</label>
            <input type="datetime-local" class="form-input" id="appt-start" value="${appt.start_at?.slice(0, 16) || defaultStart}">
        </div>
        <div class="form-group">
            <label class="form-label">Duração (min)</label>
            <input type="number" class="form-input" id="appt-duration" value="${appt.duration_min || 30}">
        </div>
        <div class="form-group">
            <label class="form-label">Tipo</label>
            <select class="form-select" id="appt-type">
                <option value="call" ${appt.type === 'call' ? 'selected' : ''}>Ligação</option>
                <option value="meet" ${appt.type === 'meet' ? 'selected' : ''}>Reunião Online</option>
                <option value="visit" ${appt.type === 'visit' ? 'selected' : ''}>Visita</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="appt-status">
                <option value="scheduled" ${appt.status === 'scheduled' ? 'selected' : ''}>Agendado</option>
                <option value="confirmed" ${appt.status === 'confirmed' ? 'selected' : ''}>Confirmado</option>
                <option value="completed" ${appt.status === 'completed' ? 'selected' : ''}>Concluído</option>
                <option value="cancelled" ${appt.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Link da Reunião</label>
            <input type="text" class="form-input" id="appt-link" value="${appt.meet_link || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Notas</label>
            <textarea class="form-textarea" id="appt-notes">${appt.notes || ''}</textarea>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveAppointment()">Salvar</button>
    `;
    openModal();
}

async function saveAppointment() {
    const id = document.getElementById('appt-id').value;
    const data = {
        title: document.getElementById('appt-title').value,
        start_at: document.getElementById('appt-start').value,
        duration_min: parseInt(document.getElementById('appt-duration').value) || 30,
        type: document.getElementById('appt-type').value,
        status: document.getElementById('appt-status').value,
        meet_link: document.getElementById('appt-link').value,
        notes: document.getElementById('appt-notes').value
    };

    if (id) {
        await api(`appointments/${id}`, { method: 'PUT', body: data });
    } else {
        await api('appointments', { method: 'POST', body: data });
    }

    closeModal();
    loadAppointments();
}

async function deleteAppointment(id) {
    if (!confirm('Excluir este agendamento?')) return;
    await api(`appointments/${id}`, { method: 'DELETE' });
    loadAppointments();
}

// ==================== FILTERS ====================
async function loadFilters() {
    allFilters = await api('filters');
    
    // Load config values
    const config = await api('config');
    document.getElementById('filter-respond-groups').checked = config.respond_to_groups?.value || false;
    document.getElementById('filter-whitelist-groups').checked = config.use_whitelist_groups?.value || false;
    document.getElementById('filter-blacklist-numbers').checked = config.use_blacklist_numbers?.value || false;

    renderFilters();
}

function renderFilters() {
    const groups = allFilters.filter(f => f.chat_type === 'group' && f.is_allowed);
    const blocked = allFilters.filter(f => !f.is_allowed);

    document.getElementById('groups-list').innerHTML = groups.length ? groups.map(f => `
        <div class="filter-item">
            <div class="filter-item-info">
                <div class="filter-item-id">${f.chat_id}</div>
                <div class="filter-item-name">${f.chat_name || 'Sem nome'}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="removeFilter('${f.chat_id}')">Remover</button>
        </div>
    `).join('') : '<div class="empty-state" style="padding:20px"><p>Nenhum grupo liberado</p></div>';

    document.getElementById('numbers-list').innerHTML = blocked.length ? blocked.map(f => `
        <div class="filter-item">
            <div class="filter-item-info">
                <div class="filter-item-id">${f.chat_id}</div>
                <div class="filter-item-name">${f.reason || 'Sem motivo'}</div>
            </div>
            <button class="btn btn-success btn-sm" onclick="removeFilter('${f.chat_id}')">Desbloquear</button>
        </div>
    `).join('') : '<div class="empty-state" style="padding:20px"><p>Nenhum número bloqueado</p></div>';
}

async function saveFilterConfig() {
    await api('config', { method: 'POST', body: {
        respond_to_groups: document.getElementById('filter-respond-groups').checked,
        use_whitelist_groups: document.getElementById('filter-whitelist-groups').checked,
        use_blacklist_numbers: document.getElementById('filter-blacklist-numbers').checked
    }});
}

async function addGroupFilter() {
    const chatId = document.getElementById('new-group-id').value.trim();
    const name = document.getElementById('new-group-name').value.trim();
    if (!chatId) return alert('ID do grupo obrigatório');

    await api('filters', { method: 'POST', body: {
        chat_id: chatId,
        chat_name: name,
        chat_type: 'group',
        filter_type: 'whitelist',
        is_allowed: true
    }});

    document.getElementById('new-group-id').value = '';
    document.getElementById('new-group-name').value = '';
    loadFilters();
}

async function addNumberFilter() {
    const number = document.getElementById('new-number').value.trim().replace(/\D/g, '');
    const reason = document.getElementById('new-number-reason').value.trim();
    if (!number) return alert('Número obrigatório');

    const chatId = `${number}@s.whatsapp.net`;
    await api('filters', { method: 'POST', body: {
        chat_id: chatId,
        chat_type: 'private',
        filter_type: 'blacklist',
        is_allowed: false,
        reason
    }});

    document.getElementById('new-number').value = '';
    document.getElementById('new-number-reason').value = '';
    loadFilters();
}

async function removeFilter(chatId) {
    await api(`filters/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
    loadFilters();
}

// ==================== QUICK REPLIES ====================
async function loadQuickReplies() {
    allQuickReplies = await api('quick-replies');
    renderQuickReplies();
}

function renderQuickReplies() {
    document.getElementById('quick-replies-grid').innerHTML = allQuickReplies.length ? allQuickReplies.map(r => `
        <div class="quick-reply-card">
            <div class="quick-reply-header">
                <span class="quick-reply-shortcut">/${r.shortcut}</span>
                <span style="font-size:11px;color:var(--text-muted)">${r.use_count}x usado</span>
            </div>
            <div class="quick-reply-title">${r.title}</div>
            <div class="quick-reply-content">${escapeHtml(r.content).substring(0, 100)}${r.content.length > 100 ? '...' : ''}</div>
            <div class="quick-reply-footer">
                <button class="btn btn-secondary btn-sm" onclick="openQuickReplyModal(${r.id})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteQuickReply(${r.id})">Excluir</button>
            </div>
        </div>
    `).join('') : '<div class="empty-state"><p>Nenhuma resposta rápida</p></div>';
}

function openQuickReplyModal(id = null) {
    const reply = id ? allQuickReplies.find(r => r.id === id) : {};
    
    document.getElementById('modal-title').textContent = id ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida';
    document.getElementById('modal-body').innerHTML = `
        <input type="hidden" id="qr-id" value="${id || ''}">
        <div class="form-group">
            <label class="form-label">Atalho (sem /)</label>
            <input type="text" class="form-input" id="qr-shortcut" value="${reply.shortcut || ''}" placeholder="Ex: preco">
        </div>
        <div class="form-group">
            <label class="form-label">Título</label>
            <input type="text" class="form-input" id="qr-title" value="${reply.title || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Conteúdo</label>
            <textarea class="form-textarea" id="qr-content" style="min-height:150px">${reply.content || ''}</textarea>
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveQuickReply()">Salvar</button>
    `;
    openModal();
}

async function saveQuickReply() {
    const id = document.getElementById('qr-id').value;
    const data = {
        shortcut: document.getElementById('qr-shortcut').value,
        title: document.getElementById('qr-title').value,
        content: document.getElementById('qr-content').value
    };

    if (id) {
        await api(`quick-replies/${id}`, { method: 'PUT', body: data });
    } else {
        await api('quick-replies', { method: 'POST', body: data });
    }

    closeModal();
    loadQuickReplies();
}

async function deleteQuickReply(id) {
    if (!confirm('Excluir esta resposta rápida?')) return;
    await api(`quick-replies/${id}`, { method: 'DELETE' });
    loadQuickReplies();
}

// ==================== CONFIG ====================
async function loadConfig() {
    const [config, categories] = await Promise.all([
        api('config'),
        api('config-categories')
    ]);

    allConfig = config;

    const grouped = {};
    for (const [key, data] of Object.entries(config)) {
        const cat = data.category || 'general';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ key, ...data });
    }

    const container = document.getElementById('config-sections');
    container.innerHTML = categories.categories.map(cat => {
        const items = grouped[cat.id] || [];
        if (!items.length) return '';

        return `
            <div class="config-section">
                <div class="config-section-header"><h3>${cat.icon} ${cat.name}</h3></div>
                <div class="config-section-body">
                    ${items.map(item => {
                        if (item.type === 'boolean') {
                            return `
                                <div class="config-row">
                                    <div class="config-row-info">
                                        <h4>${item.label || item.key}</h4>
                                        <p>${item.description || ''}</p>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" data-key="${item.key}" ${item.value ? 'checked' : ''}>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            `;
                        } else if (item.type === 'text') {
                            return `
                                <div class="config-row" style="flex-direction:column;align-items:stretch">
                                    <div class="config-row-info">
                                        <h4>${item.label || item.key}</h4>
                                        <p>${item.description || ''}</p>
                                    </div>
                                    <textarea class="config-textarea" data-key="${item.key}">${item.value || ''}</textarea>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="config-row">
                                    <div class="config-row-info">
                                        <h4>${item.label || item.key}</h4>
                                        <p>${item.description || ''}</p>
                                    </div>
                                    <input type="${item.type === 'number' ? 'number' : 'text'}" class="config-input" data-key="${item.key}" value="${item.value || ''}" style="width:200px">
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function saveAllConfig() {
    const data = {};
    
    document.querySelectorAll('#config-sections [data-key]').forEach(el => {
        const key = el.dataset.key;
        if (el.type === 'checkbox') {
            data[key] = el.checked;
        } else {
            data[key] = el.value;
        }
    });

    await api('config', { method: 'POST', body: data });
    alert('Configurações salvas!');
}

// ==================== ACTIVITY ====================
async function loadActivity() {
    const activities = await api('activity?limit=50');
    
    const icons = {
        lead: '👤',
        deal: '💰',
        appointment: '📅',
        config: '⚙️',
        conversation: '💬'
    };

    document.getElementById('activity-list').innerHTML = activities.length ? activities.map(a => `
        <div class="activity-item">
            <div class="activity-icon">${icons[a.entity_type] || '📋'}</div>
            <div class="activity-info">
                <div class="activity-action">${a.action} - ${a.entity_type} ${a.entity_id || ''}</div>
                <div class="activity-details">${a.details ? JSON.stringify(JSON.parse(a.details)).substring(0, 100) : ''}</div>
            </div>
            <div class="activity-time">${formatDateTime(a.created_at)}</div>
        </div>
    `).join('') : '<div class="empty-state"><p>Nenhuma atividade</p></div>';
}

// ==================== NLP TEST ====================
async function testNLP() {
    const input = document.getElementById('nlp-input');
    const messages = document.getElementById('nlp-messages');
    const analysis = document.getElementById('nlp-analysis');
    const text = input.value.trim();
    if (!text) return;

    messages.innerHTML += `<div class="message outgoing">${escapeHtml(text)}</div>`;
    input.value = '';

    try {
        const data = await api('test-nlp', { method: 'POST', body: { message: text } });

        messages.innerHTML += `<div class="message incoming">${escapeHtml(data.response || 'Sem resposta')}</div>`;
        messages.scrollTop = messages.scrollHeight;

        analysis.innerHTML = `
            <div class="analysis-section">
                <div class="analysis-label">Intent</div>
                <div class="analysis-value">${data.intent || 'unknown'} (${Math.round((data.confidence || 0) * 100)}%)</div>
            </div>
            <div class="analysis-section">
                <div class="analysis-label">Action</div>
                <div class="analysis-value">${data.action || '-'}</div>
            </div>
            <div class="analysis-section">
                <div class="analysis-label">Estado</div>
                <div class="analysis-value">
                    Stage: ${data.state?.stage || '-'}<br>
                    Assunto: ${data.state?.assunto || '-'}<br>
                    Plano: ${data.state?.plano || '-'}
                </div>
            </div>
            <div class="analysis-section">
                <div class="analysis-label">Entities</div>
                <div class="analysis-value"><pre style="font-size:11px;margin:0">${JSON.stringify(data.entities || {}, null, 2)}</pre></div>
            </div>
        `;
    } catch (e) {
        messages.innerHTML += `<div class="message incoming" style="background:rgba(255,82,82,0.2)">Erro: ${e.message}</div>`;
    }
}

// ==================== GEMINI ====================
async function loadGeminiStatus() {
    try {
        const data = await api('gemini-status');
        
        document.getElementById('gemini-status-grid').innerHTML = `
            <div class="config-item">
                <div class="config-item-label">Status</div>
                <div class="config-item-value ${data.configured ? 'success' : 'error'}">${data.configured ? '✅ OK' : '❌ Não configurado'}</div>
            </div>
            <div class="config-item">
                <div class="config-item-label">Router</div>
                <div class="config-item-value ${data.routerEnabled ? 'success' : 'error'}">${data.routerEnabled ? 'Ativo' : 'Inativo'}</div>
            </div>
            <div class="config-item">
                <div class="config-item-label">Modelo</div>
                <div class="config-item-value">${data.model || '-'}</div>
            </div>
            <div class="config-item">
                <div class="config-item-label">API Key</div>
                <div class="config-item-value">${data.apiKeyPreview || '-'}</div>
            </div>
        `;

        document.getElementById('model-selector').innerHTML = `<option value="${data.model}">${data.model}</option>`;
    } catch (e) {
        console.error('Gemini status error:', e);
    }
}

async function testGeminiConnection() {
    const btn = document.querySelector('#page-test-gemini .btn-success');
    const result = document.getElementById('gemini-test-result');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Testando...';
    result.classList.remove('hidden', 'success', 'error');
    result.textContent = 'Testando...';

    try {
        const data = await api('gemini-test', { method: 'POST', body: {} });
        
        if (data.success) {
            result.classList.add('success');
            result.textContent = `✅ OK!\nLatência: ${data.latency}ms\n\n${data.response || ''}`;
        } else {
            result.classList.add('error');
            result.textContent = `❌ Erro: ${data.error}`;
        }
    } catch (e) {
        result.classList.add('error');
        result.textContent = `❌ Erro: ${e.message}`;
    }

    btn.disabled = false;
    btn.innerHTML = '🧪 Testar';
}

async function sendGeminiMessage() {
    const input = document.getElementById('gemini-input');
    const messages = document.getElementById('gemini-messages');
    const text = input.value.trim();
    if (!text) return;

    messages.innerHTML += `<div class="gemini-msg user">${escapeHtml(text)}</div>`;
    input.value = '';

    const loadingId = 'load-' + Date.now();
    messages.innerHTML += `<div class="gemini-msg bot" id="${loadingId}"><span class="loading-spinner"></span> Digitando...</div>`;
    messages.scrollTop = messages.scrollHeight;

    try {
        const data = await api('gemini-chat', { method: 'POST', body: { message: text } });
        
        document.getElementById(loadingId)?.remove();

        if (data.success) {
            messages.innerHTML += `<div class="gemini-msg bot">${escapeHtml(data.response)}<div class="meta">${data.latency}ms</div></div>`;
        } else {
            messages.innerHTML += `<div class="gemini-msg bot" style="background:rgba(255,82,82,0.2)">❌ ${data.error}</div>`;
        }
    } catch (e) {
        document.getElementById(loadingId)?.remove();
        messages.innerHTML += `<div class="gemini-msg bot" style="background:rgba(255,82,82,0.2)">❌ ${e.message}</div>`;
    }

    messages.scrollTop = messages.scrollHeight;
}

// ==================== MODAL ====================
function openModal() {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('modal').classList.remove('active');
}

// ==================== INIT ====================
async function loadAllData() {
    await Promise.all([
        checkStatus(),
        loadDashboard()
    ]);
}

// Start
loadAllData();
setInterval(checkStatus, 15000);
setInterval(() => {
    if (currentPage === 'dashboard') loadDashboard();
}, 60000);