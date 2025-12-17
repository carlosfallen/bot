// FILE: src/index.tsx

import { createServer } from 'http';
import { parse } from 'url';
import { initWhatsApp } from './server/whatsapp';
import { initWebSocket } from './server/websocket';
import { initDatabase } from './server/db';
import { handler } from './server/api';

const PORT = process.env.PORT || 3000;

async function main() {
  console.log('🚀 Iniciando Império Baileys NLP...');

  await initDatabase();
  console.log('✅ Database inicializado');

  const wss = initWebSocket();
  console.log('✅ WebSocket inicializado');

  await initWhatsApp(wss);
  console.log('✅ WhatsApp inicializado');

  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url || '', true);
    await handler(req, res, parsedUrl, wss);
  });

  server.listen(PORT, () => {
    console.log(`\n🌐 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📱 Acesse para configurar o WhatsApp\n`);
  });
}

main().catch(console.error);