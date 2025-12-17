// FILE: src/server/websocket.ts

import { WebSocketServer } from 'ws';

export function initWebSocket(): WebSocketServer {
  const wss = new WebSocketServer({ port: 3001 });

  wss.on('connection', (ws) => {
    console.log('✅ Cliente WebSocket conectado');

    ws.on('message', (message) => {
      console.log('📨 Mensagem recebida:', message.toString());
    });

    ws.on('close', () => {
      console.log('❌ Cliente WebSocket desconectado');
    });

    // Enviar status inicial
    ws.send(JSON.stringify({ type: 'connected', data: 'WebSocket ready' }));
  });

  return wss;
}