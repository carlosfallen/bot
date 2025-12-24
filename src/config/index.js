// FILE: src/config/index.js
const path = require('path');

// Carrega o .env do ROOT do projeto (ajuste se o .env estiver em outro lugar)
const ENV_PATH = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: ENV_PATH });

const env = (k, fallback = '') => (process.env[k] ?? fallback);
const envInt = (k, def) => {
  const n = Number.parseInt(env(k, ''), 10);
  return Number.isFinite(n) ? n : def;
};
const envFloat = (k, def) => {
  const n = Number.parseFloat(env(k, ''));
  return Number.isFinite(n) ? n : def;
};
const envBool = (k, def = false) => {
  const v = env(k, '');
  if (!v) return def;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(v).toLowerCase());
};

const config = {
  envFile: ENV_PATH,

  // === CLOUDFLARE / D1 ===
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    databaseId: process.env.CLOUDFLARE_DATABASE_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  },

  // (Opcional) alias, caso algum arquivo use config.d1.*
  d1: {
    accountId: env('CLOUDFLARE_ACCOUNT_ID', ''),
    databaseId: env('CLOUDFLARE_DATABASE_ID', ''),
    apiToken: env('CLOUDFLARE_API_TOKEN', ''),
  },

  server: {
    port: envInt('PORT', 3512),
  },

  whatsapp: {
    authFolder: 'auth_info',
    printQRInTerminal: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  },

  bot: {
    defaultEnabled: true,
    autoSaveLeads: true,
    respondToGroups: false,
    respondToChannels: false,
    mode: 'full_gemini',
  },

  gemini: {
    enabled: env('GEMINI_ENABLED', '') !== 'false',
    apiKey: env('GEMINI_API_KEY', ''),
    model: env('GEMINI_MODEL', 'gemini-2.0-flash-exp'),
    timeout: envInt('GEMINI_TIMEOUT_MS', 10000),
    temperature: envFloat('GEMINI_TEMPERATURE', 0.8),
    maxTokens: envInt('GEMINI_MAX_TOKENS', 300),
    fullMode: true,
  },

  nlp: {
    useEmbeddings: env('NLP_USE_EMBEDDINGS', '') === 'true',
    embeddingsModel: 'Xenova/all-MiniLM-L6-v2',
  },

  timeouts: {
    active: 10 * 60 * 1000,
    pause: 2 * 60 * 60 * 1000,
    cold: 24 * 60 * 60 * 1000,
  },
};

if (envBool('DEBUG_CONFIG', false)) {
  const ok = Boolean(config.cloudflare.accountId && config.cloudflare.databaseId && config.cloudflare.apiToken);
  console.log('[config] env file:', config.envFile);
  console.log('[config] d1 configured:', ok);
}

module.exports = config;
