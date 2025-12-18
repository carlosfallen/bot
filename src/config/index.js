// Configurações do Bot
require('dotenv').config();

module.exports = {
    // Cloudflare D1 Database
    cloudflare: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || 'f19932f2396bfc72bd1f3d6be3c68c9f',
        databaseId: process.env.CLOUDFLARE_DATABASE_ID || '9af902f9-f64d-447f-91f4-fd31a0682f0a',
        apiToken: process.env.CLOUDFLARE_API_TOKEN || 'Is9BNvZbDoUUmYiWzKvtejp1CPqa69RMWzbBEvKV'
    },

    // Servidor Web
    server: {
        port: process.env.PORT || 3000
    },

    // WhatsApp
    whatsapp: {
        authFolder: 'auth_info',
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false
    },

    // Bot
    bot: {
        defaultEnabled: true,
        autoSaveLeads: true,
        respondToGroups: false,
        respondToChannels: false
    }
};
