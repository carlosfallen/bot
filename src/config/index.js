// FILE: src/config/index.js
require('dotenv').config();

module.exports = {
    cloudflare: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN
    },

    server: {
        port: process.env.PORT || 3512
    },

    whatsapp: {
        authFolder: 'auth_info',
        printQRInTerminal: true,
        syncFullHistory: false,
        markOnlineOnConnect: true
    },

    bot: {
        defaultEnabled: true,
        autoSaveLeads: true,
        respondToGroups: false,
        respondToChannels: false
    },

    // ===== GEMINI CONFIG =====
    gemini: {
        enabled: process.env.GEMINI_ENABLED !== 'false',
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        timeout: parseInt(process.env.GEMINI_TIMEOUT_MS) || 8000,
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 150,
        confidenceThreshold: parseFloat(process.env.GEMINI_CONFIDENCE_THRESHOLD) || 0.55
    },

    // ===== TIMEOUTS DE RETOMADA =====
    timeouts: {
        active: 10 * 60 * 1000,       // 10 min
        pause: 2 * 60 * 60 * 1000,    // 2h
        cold: 24 * 60 * 60 * 1000     // 24h
    }
};