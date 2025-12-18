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
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen p-4">
  <div id="root" class="max-w-md mx-auto"></div>
  
  <script type="module">
    import { render } from 'https://cdn.skypack.dev/solid-js/web';
    import { createSignal, Show, onMount } from 'https://cdn.skypack.dev/solid-js';
    
    function App() {
      const [connected, setConnected] = createSignal(false);
      const [qrCode, setQrCode] = createSignal('');
      const [mode, setMode] = createSignal('qr');
      const [phoneNumber, setPhoneNumber] = createSignal('');
      const [pairingCode, setPairingCode] = createSignal('');
      const [loading, setLoading] = createSignal(false);
      
      onMount(() => {
        checkStatus();
        setInterval(checkStatus, 3000);
      });
      
      const checkStatus = async () => {
        try {
          const res = await fetch('/api/status');
          const data = await res.json();
          setConnected(data.connected);
          if (data.qr) setQrCode(data.qr);
        } catch (e) {
          console.error(e);
        }
      };
      
      const requestPairing = async () => {
        if (!phoneNumber().trim()) {
          alert('Digite um número válido');
          return;
        }
        
        setLoading(true);
        try {
          const res = await fetch('/api/pairing-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneNumber() })
          });
          const data = await res.json();
          
          if (data.success) {
            setPairingCode(data.code);
            alert(\`Código: \${data.code}\\n\\nDigite no WhatsApp:\\nConfigurações > Aparelhos conectados > Conectar > Digite o código\`);
          } else {
            alert('Erro: ' + (data.error || 'Desconhecido'));
          }
        } catch (e) {
          alert('Erro ao gerar código');
        } finally {
          setLoading(false);
        }
      };
      
      const disconnect = async () => {
        if (!confirm('Desconectar WhatsApp?')) return;
        try {
          await fetch('/api/disconnect', { method: 'POST' });
          alert('Desconectado!');
          window.location.reload();
        } catch (e) {
          alert('Erro ao desconectar');
        }
      };
      
      const restart = async () => {
        if (!confirm('Reiniciar conexão? Isso limpará a sessão atual.')) return;
        try {
          await fetch('/api/restart', { method: 'POST' });
          alert('Reiniciado! Aguarde novo QR...');
          setQrCode('');
          setPairingCode('');
          setTimeout(checkStatus, 3000);
        } catch (e) {
          alert('Erro ao reiniciar');
        }
      };
      
      return (
        <div class="bg-white rounded-2xl shadow-2xl p-6">
          <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800">📱 WhatsApp Bot</h1>
            <Show when={connected()}>
              <div class="flex gap-2">
                <button onclick={disconnect} class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">
                  Desconectar
                </button>
                <button onclick={restart} class="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600">
                  Reiniciar
                </button>
              </div>
            </Show>
          </div>
          
          <Show when={connected()}>
            <div class="text-center py-12">
              <div class="text-6xl mb-4">✅</div>
              <div class="text-2xl font-bold text-green-600">Conectado!</div>
              <div class="text-gray-600 mt-2">WhatsApp pronto para uso</div>
            </div>
          </Show>
          
          <Show when={!connected()}>
            <div class="flex gap-2 border-b mb-4">
              <button
                onclick={() => setMode('qr')}
                class={\`px-4 py-2 font-medium \${mode() === 'qr' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600'}\`}
              >
                QR Code
              </button>
              <button
                onclick={() => setMode('pairing')}
                class={\`px-4 py-2 font-medium \${mode() === 'pairing' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600'}\`}
              >
                Código
              </button>
            </div>
            
            <Show when={mode() === 'qr'}>
              <Show when={qrCode()}>
                <div class="space-y-4">
                  <img src={qrCode()} class="w-full max-w-xs mx-auto border rounded-lg" alt="QR Code" />
                  <div class="text-sm text-gray-600 space-y-2">
                    <p class="font-medium">Como conectar:</p>
                    <ol class="list-decimal list-inside text-xs space-y-1">
                      <li>Abra WhatsApp no celular</li>
                      <li>Toque em Configurações</li>
                      <li>Aparelhos conectados</li>
                      <li>Conectar um aparelho</li>
                      <li>Escaneie este QR Code</li>
                    </ol>
                  </div>
                  <button onclick={checkStatus} class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    🔄 Atualizar QR
                  </button>
                </div>
              </Show>
              <Show when={!qrCode()}>
                <div class="text-center py-8">
                  <div class="text-4xl mb-4">⏳</div>
                  <div class="text-gray-600">Gerando QR Code...</div>
                </div>
              </Show>
            </Show>
            
            <Show when={mode() === 'pairing'}>
              <div class="space-y-4">
                <div class="bg-blue-50 p-3 rounded-lg text-sm">
                  <p class="font-medium text-blue-800 mb-1">💡 Como funciona:</p>
                  <ol class="list-decimal list-inside text-xs space-y-1">
                    <li>Digite seu número abaixo</li>
                    <li>Clique em Gerar Código</li>
                    <li>No WhatsApp: Aparelhos conectados → Digite o código</li>
                  </ol>
                </div>
                
                <div>
                  <label class="block text-sm font-medium mb-2">Número (com DDI)</label>
                  <input
                    type="text"
                    value={phoneNumber()}
                    oninput={(e) => setPhoneNumber(e.target.value)}
                    placeholder="5585999999999"
                    class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <div class="text-xs text-gray-500 mt-1">Ex: 55 + DDD + número</div>
                </div>
                
                <button
                  onclick={requestPairing}
                  disabled={loading()}
                  class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
                >
                  {loading() ? '⏳ Gerando...' : '🔑 Gerar Código'}
                </button>
                
                <Show when={pairingCode()}>
                  <div class="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                    <div class="text-sm text-green-800 mb-2">✅ Código gerado!</div>
                    <div class="text-3xl font-bold text-green-600 tracking-widest">{pairingCode()}</div>
                    <div class="text-xs text-green-700 mt-2">Digite no WhatsApp em 60s</div>
                  </div>
                </Show>
              </div>
            </Show>
            
            <div class="pt-4 border-t mt-4">
              <button onclick={restart} class="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">
                🔄 Reiniciar Conexão (Limpar Sessão)
              </button>
            </div>
          </Show>
        </div>
      );
    }
    
    render(() => <App />, document.getElementById('root'));
  </script>
</body>
</html>`;
}