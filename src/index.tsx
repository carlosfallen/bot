// src/index.tsx - CORRIGIDO (função fetch como async)

import { initWhatsApp, disconnectWhatsApp, restartWhatsApp, requestPairingCode, getQRCode, getConnectionStatus } from './server/whatsapp';
import { initDatabase, db } from './server/db';
import QRCode from 'qrcode';

const PORT = Number(process.env.PORT) || 3210;

await initDatabase();
console.log('✅ Database inicializado');

const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {  // ← ADICIONAR async AQUI
    const url = new URL(req.url);
    const { pathname } = url;

    // ========== API ENDPOINTS ==========
    
    // Health check
    if (pathname === '/api/health') {
      return jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.0',
      });
    }

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

    // QR Code
    if (pathname === '/api/qr') {
      const qr = getQRCode();
      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          return jsonResponse({ qr: qrDataUrl });
        } catch (e) {
          return errorResponse('Erro ao gerar QR Code');
        }
      }
      return jsonResponse({ 
        qr: null, 
        message: 'Aguardando QR Code ou já conectado' 
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
        return jsonResponse({ success: true, message: 'Desconectado com sucesso' });
      } catch (e) {
        return errorResponse('Erro ao desconectar');
      }
    }

    // Restart
    if (pathname === '/api/restart' && req.method === 'POST') {
      try {
        await restartWhatsApp();
        return jsonResponse({ success: true, message: 'Reiniciado com sucesso' });
      } catch (e) {
        return errorResponse('Erro ao reiniciar');
      }
    }

    // Stats
    if (pathname === '/api/stats') {
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
    }

    // Test Message
    if (pathname === '/api/test-message' && req.method === 'POST') {
      try {
        const { phone, message } = await req.json();
        
        if (!phone || !message) {
          return errorResponse('phone e message são obrigatórios', 400);
        }

        const { analyzeMessage } = await import('./lib/nlp-engine-advanced');
        const { buildMessage } = await import('./lib/message-builder');

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

    // ========== FRONTEND ==========
    
    // Favicon
    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#667eea"/><text x="50" y="70" font-size="60" text-anchor="middle" fill="white">🚀</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }

    // Homepage
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(getIndexHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // WebSocket upgrade
    if (server.upgrade(req)) return;

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

await initWhatsApp(server);
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
  <title>Império Lorde - WhatsApp Bot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { 
      max-width: 500px; 
      width: 100%;
      background: white; 
      border-radius: 20px; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 30px;
    }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    h1 { font-size: 24px; color: #333; }
    .btn { 
      padding: 8px 16px; 
      border: none; 
      border-radius: 8px; 
      cursor: pointer; 
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn-red { background: #ef4444; color: white; }
    .btn-red:hover { background: #dc2626; }
    .btn-orange { background: #f97316; color: white; }
    .btn-orange:hover { background: #ea580c; }
    .btn-green { background: #10b981; color: white; width: 100%; margin-top: 15px; }
    .btn-green:hover { background: #059669; }
    .btn-purple { background: #8b5cf6; color: white; width: 100%; }
    .btn-purple:hover { background: #7c3aed; }
    .tabs { display: flex; gap: 10px; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px; }
    .tab { 
      padding: 12px 24px; 
      border: none; 
      background: none; 
      cursor: pointer; 
      font-weight: 600;
      color: #6b7280;
      border-bottom: 3px solid transparent;
    }
    .tab.active { color: #8b5cf6; border-bottom-color: #8b5cf6; }
    .content { display: none; }
    .content.active { display: block; }
    img { max-width: 300px; width: 100%; border-radius: 12px; margin: 0 auto; display: block; }
    input { 
      width: 100%; 
      padding: 12px; 
      border: 2px solid #e5e7eb; 
      border-radius: 8px; 
      font-size: 14px;
      margin-bottom: 15px;
    }
    input:focus { outline: none; border-color: #8b5cf6; }
    .success { background: #10b981; color: white; padding: 20px; border-radius: 12px; text-align: center; }
    .success-icon { font-size: 60px; margin-bottom: 10px; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; }
    .loading { text-align: center; padding: 40px; color: #6b7280; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📱 WhatsApp Bot</h1>
      <div id="buttons" class="hidden" style="display: flex; gap: 8px;">
        <button class="btn btn-red" onclick="disconnect()">Desconectar</button>
        <button class="btn btn-orange" onclick="restart()">Reiniciar</button>
      </div>
    </div>

    <div id="connected" class="hidden">
      <div class="success">
        <div class="success-icon">✅</div>
        <div style="font-size: 24px; font-weight: bold;">Conectado!</div>
        <div style="margin-top: 10px; opacity: 0.9;">WhatsApp pronto para uso</div>
      </div>
    </div>

    <div id="disconnected">
      <div class="tabs">
        <button class="tab active" onclick="showTab('qr')">QR Code</button>
        <button class="tab" onclick="showTab('pairing')">Código</button>
      </div>

      <div id="qr-content" class="content active">
        <div id="qr-loading" class="loading">
          <div style="font-size: 40px; margin-bottom: 10px;">⏳</div>
          <div>Gerando QR Code...</div>
        </div>
        <div id="qr-display" class="hidden">
          <img id="qr-image" src="" alt="QR Code">
          <button class="btn btn-green" onclick="checkStatus()">🔄 Atualizar QR</button>
        </div>
      </div>

      <div id="pairing-content" class="content">
        <input type="text" id="phone-input" placeholder="5585999999999" maxlength="13">
        <button class="btn btn-purple" onclick="requestPairing()" id="pairing-btn">
          🔑 Gerar Código
        </button>
        <div id="code-display" class="hidden" style="background: #dcfce7; border: 3px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin-top: 15px;">
          <div style="color: #065f46; font-weight: bold; margin-bottom: 10px;">✅ Código gerado!</div>
          <div class="code" id="pairing-code" style="color: #10b981;"></div>
          <div style="color: #065f46; font-size: 12px;">Digite no WhatsApp em 60s</div>
        </div>
      </div>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <button class="btn btn-orange" style="width: 100%;" onclick="restart()">
          🔄 Reiniciar Conexão
        </button>
      </div>
    </div>
  </div>

  <script>
    let connected = false;

    function showTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
      
      if (tab === 'qr') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('qr-content').classList.add('active');
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('pairing-content').classList.add('active');
      }
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        connected = data.connected;
        
        if (connected) {
          document.getElementById('connected').classList.remove('hidden');
          document.getElementById('disconnected').classList.add('hidden');
          document.getElementById('buttons').classList.remove('hidden');
        } else {
          document.getElementById('connected').classList.add('hidden');
          document.getElementById('disconnected').classList.remove('hidden');
          document.getElementById('buttons').classList.add('hidden');
          
          if (data.qr) {
            document.getElementById('qr-loading').classList.add('hidden');
            document.getElementById('qr-display').classList.remove('hidden');
            document.getElementById('qr-image').src = data.qr;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function requestPairing() {
      const phone = document.getElementById('phone-input').value.trim();
      if (!phone) {
        alert('Digite um número válido');
        return;
      }

      const btn = document.getElementById('pairing-btn');
      btn.textContent = '⏳ Gerando...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/pairing-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (data.success) {
          document.getElementById('code-display').classList.remove('hidden');
          document.getElementById('pairing-code').textContent = data.code;
        } else {
          alert('Erro: ' + (data.error || 'Desconhecido'));
        }
      } catch (e) {
        alert('Erro ao gerar código');
      } finally {
        btn.textContent = '🔑 Gerar Código';
        btn.disabled = false;
      }
    }

    async function disconnect() {
      if (!confirm('Desconectar WhatsApp?')) return;
      try {
        await fetch('/api/disconnect', { method: 'POST' });
        alert('Desconectado!');
        location.reload();
      } catch (e) {
        alert('Erro ao desconectar');
      }
    }

    async function restart() {
      if (!confirm('Reiniciar? Isso limpará a sessão.')) return;
      try {
        await fetch('/api/restart', { method: 'POST' });
        alert('Reiniciado! Aguarde...');
        location.reload();
      } catch (e) {
        alert('Erro ao reiniciar');
      }
    }

    checkStatus();
    setInterval(checkStatus, 3000);
  </script>
</body>
</html>`;
}