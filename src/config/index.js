// FILE: src/config/index.js
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: ENV_PATH });

const env = (k, fallback = '') => process.env[k] ?? fallback;
const envInt = (k, def) => {
  const n = parseInt(env(k, ''), 10);
  return Number.isFinite(n) ? n : def;
};
const envBool = (k, def = false) => {
  const v = env(k, '');
  if (!v) return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

module.exports = {
  envFile: ENV_PATH,

  cloudflare: {
    accountId: env('CLOUDFLARE_ACCOUNT_ID'),
    databaseId: env('CLOUDFLARE_DATABASE_ID'),
    apiToken: env('CLOUDFLARE_API_TOKEN')
  },

  server: {
    port: envInt('PORT', 3512)
  },

  gemini: {
    enabled: envBool('GEMINI_ENABLED', true),
    apiKey: env('GEMINI_API_KEY'),
    model: env('GEMINI_MODEL', 'gemini-2.0-flash-exp'),
    timeout: envInt('GEMINI_TIMEOUT_MS', 15000)
  },

  bot: {
    defaultEnabled: true,
    respondToGroups: false,
    respondToChannels: false
  }
};