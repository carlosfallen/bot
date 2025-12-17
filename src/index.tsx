import { initWhatsApp } from './server/whatsapp';
import { initDatabase } from './server/db';
import { handler } from './server/api';

const PORT = Number(process.env.PORT) || 3210;

await initDatabase();
console.log('✅ Database inicializado');

const server = Bun.serve({
  port: PORT,

  fetch(req, server) {  // ← server está disponível aqui
    // Upgrade WebSocket
    if (server.upgrade(req)) return;

    // ✅ CORRETO: passa o server como 2º argumento
    return handler(req, server);
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