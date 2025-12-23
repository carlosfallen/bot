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
        respondToChannels: false,
        mode: 'full_gemini' // full_gemini ou hybrid
    },

    // ===== GEMINI CONFIG (FULL MODE) =====
    gemini: {
        enabled: process.env.GEMINI_ENABLED !== 'false',
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
        timeout: parseInt(process.env.GEMINI_TIMEOUT_MS) || 10000,
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.8,
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 300,
        // No full mode, não usamos confidence threshold (sempre usa Gemini)
        fullMode: true
    },

    // Embeddings agora são OPCIONAIS (desabilitados em full Gemini)
    nlp: {
        useEmbeddings: process.env.NLP_USE_EMBEDDINGS === 'true', // false por padrão
        embeddingsModel: 'Xenova/all-MiniLM-L6-v2'
    },

    // ===== TIMEOUTS DE RETOMADA =====
    timeouts: {
        active: 10 * 60 * 1000,       // 10 min
        pause: 2 * 60 * 60 * 1000,    // 2h
        cold: 24 * 60 * 60 * 1000     // 24h
    }
};