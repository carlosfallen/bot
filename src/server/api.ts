// FILE: src/server/api.ts

import { 
  getAllConversations, 
  getConversationHistory,
  getTemplatesByIntent,
  db 
} from './db';
import { getQRCode, getConnectionStatus } from './whatsapp';
import { disconnectWhatsApp, restartWhatsApp, requestPairingCode } from './whatsapp';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

export async function handler(req: Request, server: any): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }

  if (pathname === '/api/pairing-code' && req.method === 'POST') {
  try {
    const { phone } = await req.json();
    
    if (!phone || phone.length < 10) {
      return errorResponse('Número inválido', 400);
    }

    const code = await requestPairingCode(phone);
    
    if (code) {
      return jsonResponse({ success: true, code });
    } else {
      return errorResponse('Erro ao gerar código');
    }
  } catch (error) {
    console.error('Erro ao gerar pairing code:', error);
    return errorResponse('Erro interno');
  }
}

if (pathname === '/api/disconnect' && req.method === 'POST') {
  try {
    await disconnectWhatsApp();
    return jsonResponse({ success: true, message: 'Desconectado com sucesso' });
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    return errorResponse('Erro ao desconectar');
  }
}

if (pathname === '/api/restart' && req.method === 'POST') {
  try {
    await restartWhatsApp();
    return jsonResponse({ success: true, message: 'Reiniciado com sucesso' });
  } catch (error) {
    console.error('Erro ao reiniciar:', error);
    return errorResponse('Erro ao reiniciar');
  }
}

  if (pathname === '/api/health') {
    return jsonResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      runtime: 'bun',
    });
  }

  if (pathname === '/api/status') {
    const status = getConnectionStatus();
    const qr = getQRCode();
    
    let qrDataUrl = null;
    if (qr) {
      try {
        const QRCode = await import('qrcode');
        qrDataUrl = await QRCode.toDataURL(qr);
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
      }
    }
    
    return jsonResponse({
      status,
      connected: status === 'connected',
      qr: qrDataUrl,
    });
  }

  if (pathname === '/api/qr') {
    const qr = getQRCode();
    if (qr) {
      try {
        const QRCode = await import('qrcode');
        const qrDataUrl = await QRCode.toDataURL(qr);
        return jsonResponse({ qr: qrDataUrl });
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
        return errorResponse('Erro ao gerar QR Code');
      }
    }
    return jsonResponse({ 
      qr: null, 
      message: 'Aguardando QR Code ou já conectado' 
    });
  }

  if (pathname === '/api/conversations') {
    const conversations = getAllConversations();
    return jsonResponse(conversations);
  }

  if (pathname.startsWith('/api/conversation/')) {
    const phone = pathname.split('/').pop();
    if (phone) {
      const history = getConversationHistory(phone);
      return jsonResponse(history);
    }
    return errorResponse('Telefone não informado', 400);
  }

  if (pathname === '/api/templates') {
    const templates = db.prepare(
      'SELECT * FROM message_templates WHERE active = 1 ORDER BY priority DESC'
    ).all();
    return jsonResponse(templates);
  }

  if (pathname === '/api/stats') {
    const totalLeads = db.query(
      'SELECT COUNT(*) as count FROM leads'
    ).get() as { count: number };
    
    const totalInteractions = db.query(
      'SELECT COUNT(*) as count FROM interactions'
    ).get() as { count: number };
    
    const activeConversations = db.query(`
      SELECT COUNT(*) as count FROM sessions
      WHERE last_interaction > strftime('%s', 'now') - 86400
    `).get() as { count: number };
    
    const hotLeads = db.query(`
      SELECT COUNT(*) as count FROM leads WHERE qualification = 'quente'
    `).get() as { count: number };
    
    const todayMessages = db.query(`
      SELECT COUNT(*) as count FROM interactions
      WHERE created_at > strftime('%s', 'now', 'start of day')
    `).get() as { count: number };

    return jsonResponse({
      totalLeads: totalLeads.count,
      activeConversations: activeConversations.count,
      todayMessages: todayMessages.count,
      hotLeads: hotLeads.count,
    });
  }

  if (pathname === '/api/test-message' && req.method === 'POST') {
    try {
      const { phone, message } = await req.json();

      if (!phone || !message) {
        return errorResponse('phone e message são obrigatórios', 400);
      }

      const { analyzeMessage } = await import('../lib/nlp-engine-advanced');
      const { buildMessage } = await import('../lib/message-builder');

      const nlp = analyzeMessage(message);

      let session = db.query('SELECT * FROM sessions WHERE phone = ?').get(phone) as any;
      
      if (!session) {
        db.prepare(`
          INSERT INTO sessions (phone, state, qualification, created_at, last_interaction)
          VALUES (?, 'inicial', 'frio', strftime('%s', 'now'), strftime('%s', 'now'))
        `).run(phone);
        session = db.query('SELECT * FROM sessions WHERE phone = ?').get(phone) as any;
      }

      db.prepare(`
        INSERT INTO interactions (phone, direction, message, intent, confidence, sentiment, created_at)
        VALUES (?, 'incoming', ?, ?, ?, ?, strftime('%s', 'now'))
      `).run(phone, message, nlp.intent, nlp.confidence, nlp.sentiment);

      const context = {
        state: session.state,
        nome: session.nome,
        empresa: session.empresa,
        orcamento: session.orcamento,
      };

      const response = buildMessage(nlp.intent, context);

      db.prepare(`
        INSERT INTO interactions (phone, direction, message, created_at)
        VALUES (?, 'outgoing', ?, strftime('%s', 'now'))
      `).run(phone, response);

      db.prepare(`
        UPDATE sessions SET last_interaction = strftime('%s', 'now') WHERE phone = ?
      `).run(phone);

      server.publish('dashboard', JSON.stringify({
        type: 'new_message',
        phone,
        message: response,
        intent: nlp.intent,
      }));

      return jsonResponse({
        success: true,
        response,
        nlp: {
          intent: nlp.intent,
          confidence: nlp.confidence,
          sentiment: nlp.sentiment,
          entities: nlp.entities,
          keywords: nlp.keywords,
        },
      });
    } catch (error) {
      console.error('Erro no test-message:', error);
      return errorResponse('Erro interno do servidor');
    }
  }

  if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
    const file = Bun.file('./public/favicon.svg');
    const exists = await file.exists();
    
    if (exists) {
      return new Response(file, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }
    return new Response(null, { status: 204 });
  }

  if (pathname === '/' || pathname === '/index.html') {
    return new Response(getIndexHTML(), {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders(),
      },
    });
  }

  return new Response('Not Found', { status: 404 });
}

function getIndexHTML() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Império Lorde - WhatsApp Bot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 { color: #667eea; margin-bottom: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
    .stat-label { opacity: 0.9; font-size: 0.9em; }
    
    .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
    
    .panel {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .panel h2 { margin-bottom: 15px; color: #333; }
    
    #qrcode-container {
      text-align: center;
      padding: 20px;
    }
    #qrcode-container img { max-width: 100%; border-radius: 8px; }
    
    .status {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.9em;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .status.connected { background: #10b981; color: white; }
    .status.connecting { background: #f59e0b; color: white; }
    .status.disconnected { background: #ef4444; color: white; }
    
    .conversations { max-height: 600px; overflow-y: auto; }
    .conversation-item {
      padding: 12px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background 0.2s;
    }
    .conversation-item:hover { background: #f9fafb; }
    .conversation-item.active { background: #eef2ff; border-left: 3px solid #667eea; }
    
    .conv-phone { font-weight: 600; color: #333; margin-bottom: 5px; }
    .conv-name { color: #666; font-size: 0.9em; }
    .conv-last { color: #999; font-size: 0.85em; margin-top: 5px; }
    
    .messages { 
      height: 400px; 
      overflow-y: auto; 
      background: #f9fafb; 
      padding: 15px; 
      border-radius: 8px;
      margin-top: 15px;
    }
    .message {
      margin-bottom: 10px;
      padding: 10px 15px;
      border-radius: 8px;
      max-width: 70%;
      word-wrap: break-word;
    }
    .message.in {
      background: white;
      margin-right: auto;
      border: 1px solid #e5e7eb;
    }
    .message.out {
      background: #667eea;
      color: white;
      margin-left: auto;
    }
    .message-meta {
      font-size: 0.75em;
      opacity: 0.7;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Império Lorde - WhatsApp Bot NLP</h1>
      <p>Atendimento automatizado inteligente com análise de linguagem natural</p>
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-value" id="stat-leads">0</div>
          <div class="stat-label">Leads Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-messages">0</div>
          <div class="stat-label">Mensagens</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-active">0</div>
          <div class="stat-label">Conversas Ativas</div>
        </div>
      </div>
    </div>
    
    <div class="grid">
      <div>
        <div class="panel">
          <h2>📱 Conexão WhatsApp</h2>
          <div class="status disconnected" id="status">Desconectado</div>
          <div id="qrcode-container">
            <p>Aguardando conexão...</p>
          </div>
        </div>
        
        <div class="panel" style="margin-top: 20px;">
          <h2>💬 Conversas</h2>
          <div class="conversations" id="conversations"></div>
        </div>
      </div>
      
      <div class="panel">
        <h2>📨 Chat em Tempo Real</h2>
        <div id="current-phone" style="color: #666; margin-bottom: 10px;">Selecione uma conversa</div>
        <div class="messages" id="messages"></div>
      </div>
    </div>
  </div>

  <script>
    const ws = new WebSocket('ws://localhost:3210');
    let currentPhone = null;
    
    ws.onopen = () => {
      console.log('✅ WebSocket conectado');
      checkStatus();
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'status') {
        updateStatus(data.data);
      }
      
      if (data.type === 'qr') {
        document.getElementById('qrcode-container').innerHTML = 
          '<img src="' + data.data + '" alt="QR Code"><p style="margin-top: 10px;">Escaneie com WhatsApp</p>';
      }
      
      if (data.type === 'new_message') {
        if (data.data.phone === currentPhone) {
          addMessageToChat(data.data);
        }
        loadConversations();
      }
    };
    
    function updateStatus(status) {
      const el = document.getElementById('status');
      el.className = 'status ' + status;
      el.textContent = {
        'connected': '✅ Conectado',
        'connecting': '🔄 Conectando...',
        'disconnected': '❌ Desconectado',
        'logged_out': '⚠️ Deslogado'
      }[status] || status;
      
      if (status === 'connected') {
        document.getElementById('qrcode-container').innerHTML = '<p style="color: #10b981;">✅ WhatsApp Conectado!</p>';
      }
    }
    
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        document.getElementById('stat-leads').textContent = stats.totalLeads;
        document.getElementById('stat-messages').textContent = stats.todayMessages;
        document.getElementById('stat-active').textContent = stats.activeConversations;
      } catch (error) {
        console.error('Erro ao carregar stats:', error);
      }
    }
    
    async function loadConversations() {
      try {
        const res = await fetch('/api/conversations');
        const convs = await res.json();
        const container = document.getElementById('conversations');
        
        container.innerHTML = convs.map(c => \`
          <div class="conversation-item \${c.phone === currentPhone ? 'active' : ''}" onclick="loadChat('\${c.phone}')">
            <div class="conv-phone">\${c.phone}</div>
            <div class="conv-name">\${c.nome || 'Sem nome'} - \${c.status}</div>
            <div class="conv-last">\${c.last_message || 'Sem mensagens'}</div>
          </div>
        \`).join('');
      } catch (error) {
        console.error('Erro ao carregar conversas:', error);
      }
    }
    
    async function loadChat(phone) {
      try {
        currentPhone = phone;
        document.getElementById('current-phone').textContent = '📞 ' + phone;
        
        const res = await fetch('/api/conversation/' + phone);
        const history = await res.json();
        
        const container = document.getElementById('messages');
        container.innerHTML = history.map(m => \`
          <div class="message \${m.direction}">
            <div>\${m.message}</div>
            <div class="message-meta">
              \${m.intent ? '🎯 ' + m.intent : ''} 
              \${m.confidence ? ' (' + (m.confidence * 100).toFixed(0) + '%)' : ''}
            </div>
          </div>
        \`).join('');
        
        container.scrollTop = container.scrollHeight;
        loadConversations();
      } catch (error) {
        console.error('Erro ao carregar chat:', error);
      }
    }
    
    function addMessageToChat(data) {
      const container = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'message ' + data.direction;
      div.innerHTML = \`
        <div>\${data.text}</div>
        <div class="message-meta">
          \${data.intent ? '🎯 ' + data.intent : ''} 
          \${data.confidence ? ' (' + (data.confidence * 100).toFixed(0) + '%)' : ''}
        </div>
      \`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }
    
    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        updateStatus(data.status);
        
        if (data.qr) {
          document.getElementById('qrcode-container').innerHTML = 
            '<img src="' + data.qr + '" alt="QR Code"><p style="margin-top: 10px;">Escaneie com WhatsApp</p>';
        } else if (data.status === 'connecting') {
          document.getElementById('qrcode-container').innerHTML = 
            '<p>🔄 Aguardando QR Code...</p>';
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }
    
    loadStats();
    loadConversations();
    
    setInterval(checkStatus, 2000);
    setInterval(loadStats, 10000);
    setInterval(loadConversations, 5000);
  </script>
</body>
</html>
  `;
}