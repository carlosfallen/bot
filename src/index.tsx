// src/index.tsx - Bun Server Principal
import { connectToWhatsApp, disconnectWhatsApp, requestPairingCode, getQRCode, getConnectionStatus, sendMessage, setBroadcastFunction } from './server/whatsapp';
import { initDatabase, db } from './server/db';
import QRCode from 'qrcode';

const PORT = Number(process.env.PORT) || 3210;

// Inicializar database
await initDatabase();
console.log('✅ Database inicializado');

// Criar servidor Bun
const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);
    const { pathname } = url;

    // ========== API ENDPOINTS ==========

    // Status WhatsApp
    if (pathname === '/api/status') {
      const status = getConnectionStatus();
      const qr = getQRCode();

      let qrDataUrl = null;
      if (qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(qr);
        } catch (e) {
          console.error('Erro ao gerar QR:', e);
        }
      }

      return jsonResponse({
        status,
        connected: status === 'connected',
        qr: qrDataUrl,
      });
    }

    // Pairing Code
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
      } catch (e) {
        return errorResponse('Erro ao processar requisição');
      }
    }

    // Disconnect
    if (pathname === '/api/disconnect' && req.method === 'POST') {
      try {
        await disconnectWhatsApp();
        return jsonResponse({ success: true, message: 'Desconectado' });
      } catch (e) {
        return errorResponse('Erro ao desconectar');
      }
    }

    // Send Message
    if (pathname === '/api/send' && req.method === 'POST') {
      try {
        const { to, text } = await req.json();

        if (!to || !text) {
          return errorResponse('Campos to e text são obrigatórios', 400);
        }

        await sendMessage(to, text);
        return jsonResponse({ success: true, message: 'Mensagem enviada' });
      } catch (e: any) {
        return errorResponse(e.message || 'Erro ao enviar mensagem');
      }
    }

    // Stats
    if (pathname === '/api/stats') {
      try {
        const totalLeads = db.query('SELECT COUNT(*) as count FROM leads').get() as { count: number };
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
      } catch (e) {
        return errorResponse('Erro ao obter estatísticas');
      }
    }

    // Test NLP
    if (pathname === '/api/test-nlp' && req.method === 'POST') {
      try {
        const { message } = await req.json();

        if (!message) {
          return errorResponse('Campo message é obrigatório', 400);
        }

        const { analyzeMessage } = await import('./lib/nlp-engine');
        const analysis = analyzeMessage(message);

        return jsonResponse({
          success: true,
          analysis,
        });
      } catch (e: any) {
        return errorResponse(e.message || 'Erro ao processar NLP');
      }
    }

    // Frontend - Página principal
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(getIndexHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Favicon
    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#667eea"/><text x="50" y="70" font-size="60" text-anchor="middle" fill="white">💬</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    // WebSocket upgrade - verificar headers antes
    const upgradeHeader = req.headers.get('upgrade');
    if (upgradeHeader === 'websocket') {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return undefined; // Connection foi upgradada para WebSocket
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws) {
      ws.subscribe('dashboard');
      console.log('✅ Cliente WebSocket conectado');
      ws.send(JSON.stringify({ type: 'connected' }));
    },

    message(ws, message) {
      console.log('📨 WS message:', message.toString());
    },

    close(ws) {
      console.log('❌ Cliente WebSocket desconectado');
    }
  }
});

// Configurar broadcast function para WhatsApp
setBroadcastFunction((message: any) => {
  server.publish('dashboard', JSON.stringify(message));
});

// Inicializar WhatsApp
await connectToWhatsApp();
console.log('✅ WhatsApp inicializado');
console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);

// ========== HELPER FUNCTIONS ==========

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Bot - Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    h1 { font-size: 28px; color: #333; }
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 600;
    }
    .status.connected { background: #d4edda; color: #155724; }
    .status.connecting { background: #fff3cd; color: #856404; }
    .status.disconnected { background: #f8d7da; color: #721c24; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      border-left: 4px solid #667eea;
    }
    .card h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
    .card .value { font-size: 32px; font-weight: bold; color: #333; }
    .section {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .section h2 { font-size: 18px; margin-bottom: 15px; color: #333; }
    #qrcode {
      max-width: 300px;
      margin: 20px auto;
      display: block;
    }
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      margin-right: 10px;
    }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5568d3; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-danger:hover { background: #c82333; }
    input {
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      width: 100%;
      margin-bottom: 10px;
    }
    .log {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
    }
    .log-item { margin-bottom: 5px; }
    .log-incoming { color: #4ec9b0; }
    .log-outgoing { color: #ce9178; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 WhatsApp Bot Dashboard</h1>
      <div id="statusIndicator" class="status disconnected">
        <span id="statusText">Desconectado</span>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Total de Leads</h3>
        <div class="value" id="totalLeads">0</div>
      </div>
      <div class="card">
        <h3>Conversas Ativas</h3>
        <div class="value" id="activeConversations">0</div>
      </div>
      <div class="card">
        <h3>Mensagens Hoje</h3>
        <div class="value" id="todayMessages">0</div>
      </div>
      <div class="card">
        <h3>Leads Quentes</h3>
        <div class="value" id="hotLeads">0</div>
      </div>
    </div>

    <div class="section">
      <h2>📱 Conexão WhatsApp</h2>
      <div id="qrcodeContainer" style="display:none;">
        <img id="qrcode" alt="QR Code">
        <p style="text-align:center; color:#666;">Escaneie o QR Code com seu WhatsApp</p>
      </div>
      <div id="pairingContainer">
        <input type="text" id="phoneInput" placeholder="Digite seu número (ex: 5511999999999)">
        <button class="btn btn-primary" onclick="requestPairing()">Gerar Código de Pareamento</button>
        <div id="pairingCode" style="margin-top:15px; font-size:24px; font-weight:bold; text-align:center;"></div>
      </div>
      <div style="margin-top:15px;">
        <button class="btn btn-danger" onclick="disconnect()">Desconectar</button>
      </div>
    </div>

    <div class="section">
      <h2>📊 Log de Mensagens</h2>
      <div class="log" id="messageLog">
        <div class="log-item">Sistema iniciado...</div>
      </div>
    </div>
  </div>

  <script>
    let ws = null;

    function connectWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        addLog('WebSocket conectado', 'system');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'status') {
          updateStatus(data.data);
        } else if (data.type === 'qr') {
          showQRCode(data.data);
        } else if (data.type === 'message') {
          addLog(\`Recebido de \${data.data.from}: \${data.data.text}\`, 'incoming');
          addLog(\`Resposta: \${data.data.response}\`, 'outgoing');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addLog('Erro na conexão WebSocket', 'system');
      };

      ws.onclose = () => {
        addLog('WebSocket desconectado. Reconectando...', 'system');
        setTimeout(connectWebSocket, 3000);
      };
    }

    function updateStatus(status) {
      const indicator = document.getElementById('statusIndicator');
      const text = document.getElementById('statusText');

      indicator.className = 'status ' + status;
      text.textContent = status === 'connected' ? 'Conectado' :
                         status === 'connecting' ? 'Conectando...' : 'Desconectado';

      if (status === 'connected') {
        document.getElementById('qrcodeContainer').style.display = 'none';
      }
    }

    function showQRCode(dataUrl) {
      const img = document.getElementById('qrcode');
      const container = document.getElementById('qrcodeContainer');
      img.src = dataUrl;
      container.style.display = 'block';
    }

    function addLog(message, type) {
      const log = document.getElementById('messageLog');
      const item = document.createElement('div');
      item.className = 'log-item log-' + type;
      item.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
    }

    async function requestPairing() {
      const phone = document.getElementById('phoneInput').value;
      if (!phone) {
        alert('Digite um número válido');
        return;
      }

      try {
        const res = await fetch('/api/pairing-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });

        const data = await res.json();

        if (data.success) {
          document.getElementById('pairingCode').textContent = 'Código: ' + data.code;
          addLog(\`Código de pareamento gerado: \${data.code}\`, 'system');
        } else {
          alert('Erro ao gerar código');
        }
      } catch (e) {
        alert('Erro na requisição');
      }
    }

    async function disconnect() {
      try {
        const res = await fetch('/api/disconnect', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          addLog('Desconectado com sucesso', 'system');
        }
      } catch (e) {
        alert('Erro ao desconectar');
      }
    }

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        document.getElementById('totalLeads').textContent = data.totalLeads || 0;
        document.getElementById('activeConversations').textContent = data.activeConversations || 0;
        document.getElementById('todayMessages').textContent = data.todayMessages || 0;
        document.getElementById('hotLeads').textContent = data.hotLeads || 0;
      } catch (e) {
        console.error('Erro ao carregar stats:', e);
      }
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        updateStatus(data.status);
        if (data.qr) {
          showQRCode(data.qr);
        }
      } catch (e) {
        console.error('Erro ao verificar status:', e);
      }
    }

    // Inicializar
    connectWebSocket();
    checkStatus();
    loadStats();
    setInterval(loadStats, 5000);
    setInterval(checkStatus, 3000);
  </script>
</body>
</html>`;
}
