// scripts/init-db.js
const fs = require('fs');
const path = require('path');
const CloudflareD1 = require('../src/database/d1.js');
const config = require('../src/config/index.js');

async function initializeDatabase() {
  console.log('🔧 Inicializando banco de dados Cloudflare D1...\n');

  const db = new CloudflareD1({
    accountId: config.cloudflare.accountId,
    databaseId: config.cloudflare.databaseId,
    apiToken: config.cloudflare.apiToken
  });

  try {
    const schemaPath = path.resolve(__dirname, '../src/database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Lendo schema.sql...');
    await db.initialize(schemaSQL);

    console.log('\n✅ Banco de dados inicializado com sucesso!');
    console.log('\n📦 Tabelas esperadas:');
    console.log('  - leads');
    console.log('  - conversations');
    console.log('  - messages');
    console.log('  - bot_config');
    console.log('  - ignored_chats');
    console.log('  - statistics');

    const configData = await db.getAllConfig();
    console.log('\n⚙️  Configurações padrão:');
    console.log(JSON.stringify(configData, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao inicializar banco:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
