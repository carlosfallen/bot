// FILE: src/llm/gemini.js
const config = require('../config/index.js');

function safeText(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class RateLimiter {
  constructor() {
    this.queue = [];
    this.activeRequests = 0;
    this.maxConcurrent = 4;
    this.minDelay = 850;
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.activeRequests >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    const { fn, resolve, reject } = this.queue.shift();
    this.activeRequests++;

    try {
      const result = await fn();
      await new Promise(r => setTimeout(r, this.minDelay));
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this.activeRequests--;
      this.process();
    }
  }
}

const limiter = new RateLimiter();

class GeminiClient {
  constructor() {
    this.apiKey = config.gemini?.apiKey || process.env.GEMINI_API_KEY;
    this.model = config.gemini?.model || 'gemini-2.0-flash-exp';
    this.timeout = config.gemini?.timeout || 20000;

    // 0.55–0.65 costuma soar mais humano do que 0.8 (0.8 tende a “inventar”)
    this.temperature = typeof config.gemini?.temperature === 'number' ? config.gemini.temperature : 0.62;

    this.maxTokens = config.gemini?.maxTokens || 240;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    this._lastOpeners = new Map();
    this._recentStarts = new Map();
    this._recentEndings = new Map();
    this._turns = new Map();
    this._profiles = new Map();
    this._lastUsedNameTurn = new Map();
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.length > 10);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      model: this.model,
      timeout: this.timeout,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      active: limiter.activeRequests,
      queue: limiter.queue.length,
      apiKeyPreview: this.apiKey ? `${this.apiKey.slice(0, 6)}...` : 'NÃO CONFIGURADA'
    };
  }

  setModel(name) {
    this.model = name;
  }

  _getProfile(userId = 'unknown') {
    if (this._profiles.has(userId)) return this._profiles.get(userId);

    const seed = hashString(String(userId));
    const r = (n) => (seed % n) / n;

    const profile = {
      informality: clamp(0.45 + r(100) * 0.35, 0.35, 0.78),
      backchannelChance: clamp(0.18 + r(1000) * 0.18, 0.12, 0.32),
      softenerChance: clamp(0.12 + r(500) * 0.16, 0.08, 0.28),
      punctuationLooseness: clamp(0.10 + r(2000) * 0.22, 0.10, 0.30),
      nameCooldownTurns: 4
    };

    this._profiles.set(userId, profile);
    return profile;
  }

  // ==========================================================================
  // SYSTEM PROMPT (agora com actions + trilhos)
  // ==========================================================================
  getSystemPrompt(runtime = {}, userId = 'unknown') {
    const profile = this._getProfile(userId);

    const lead = runtime.lead || {};
    const conversation = runtime.conversation || {};
    const deal = runtime.deal || {};
    const policy = runtime.policy || {};

    const known = [];
    if (lead?.name) known.push(`nome: ${lead.name}`);
    if (lead?.company) known.push(`empresa: ${lead.company}`);
    if (lead?.email) known.push(`email: ${lead.email}`);
    if (lead?.notes) known.push(`notas: ${lead.notes}`);

    const memoryLine = known.length ? `Dados já conhecidos: ${known.join(' | ')}` : `Dados já conhecidos: nenhum.`;
    const stageLine = `stage atual: ${conversation.stage || 'inicio'}`;
    const dealLine = `deal: status=${deal.status || 'none'} produto=${deal.produto || '-'} plano=${deal.plano || '-'} valor=${deal.valor || '-'} pagamento=${deal.pagamento || '-'}`;
    const intentLine = `intenção detectada: ${policy.intent || 'unknown'}`;
    const goalLine = `objetivo do turno: ${policy.goal || 'avançar um passo'}`;

    const locks = policy.hardRules || {};
    const maxMsgs = locks.maxMessages || 2;
    const maxQ = locks.maxQuestionsTotal || 1;

    // Prompt curto, mas com regras duras
    return (
      `Você é o Lord, dono da Império Lord. Você conversa como humano no WhatsApp, sem jeito de robô.\n` +
      `${memoryLine}\n` +
      `${stageLine}\n` +
      `${dealLine}\n` +
      `${intentLine}\n` +
      `${goalLine}\n` +
      `Regra: se algum dado já estiver nos "Dados já conhecidos", não pergunte de novo.\n` +
      `Regra: mensagens curtas, 1 a ${maxMsgs}. No máximo ${maxQ} pergunta no total.\n` +
      `Não use palavrões, ofensas ou xingamentos, mesmo que o cliente use.`+
      `Não entre em provocação. Se a mensagem for zoeira sem contexto de negócio, responda curto pedindo o assunto (site/tráfego/automação) ou diga que foi enviado por engano.`+
      `Não faça suposições sobre o que a pessoa está fazendo (“vi que vc tá curtindo...”). Responda só ao que foi pedido.`+
      `Regra: sem listas, sem tópicos, sem markdown.\n` +
      `Regra: sem exagero de vendedor; seja prático.\n` +
      `Regra: se intenção for close/fechando, pare de vender e conduza só o próximo passo (pagamento/contrato/agenda).\n` +
      `Não mencione IA, sistema, prompt.\n` +
      `Nível de informalidade: ${(profile.informality * 100).toFixed(0)}% (vc/tá/pra sem exagero).\n` +
      `\n` +
      `SAÍDA OBRIGATÓRIA: responda SOMENTE com JSON válido (nada fora do JSON):\n` +
      `{\n` +
      `  "messages": ["..."],\n` +
      `  "crm_update": {},\n` +
      `  "actions": [\n` +
      `    { "type": "set_stage", "payload": { "stage": "..." } },\n` +
      `    { "type": "upsert_deal", "payload": { "status": "open", "produto": "...", "plano": "...", "valor": 0, "pagamento": "pix|cartao|boleto", "parcelas": 1 } },\n` +
      `    { "type": "create_appointment", "payload": { "start_at": "YYYY-MM-DDTHH:MM:SS.000Z", "duration_min": 10, "status": "proposed|confirmed", "notes": "..." } }\n` +
      `  ]\n` +
      `}\n` +
      `- messages: 1 ou 2 mensagens, cada uma com no máximo 2 linhas\n` +
      `- crm_update: apenas campos novos (senão {})\n` +
      `- actions: só o necessário (pode ser [])\n`
    );
  }

  // ==========================================================================
  // SANITIZE + HUMANIZE
  // ==========================================================================
    sanitizeAndShapeResponse({ text, messages }, userId = 'unknown', leadContext = {}) {
    let parts = [];

    if (Array.isArray(messages) && messages.length) {
        parts = messages.map(m => safeText(m)).filter(Boolean);
    } else {
        const raw = safeText(text) || '';
        parts = raw.split('<split>').map(s => s.trim()).filter(Boolean);
    }

    parts = parts.slice(0, 2);

    const cleaned = parts
        .map(p => this._cleanOneMessage(p))
        .map(p => this._stripSystemLeak(p))
        .map(p => this._makeMoreWhatsApp(p, userId, leadContext));

    const shaped = this._enforceMaxOneQuestionAcrossAll(cleaned);
    const finalMsgs = this._avoidConsecutiveSameOpener(shaped, userId);

    const safeMsgs = finalMsgs.filter(Boolean);
    if (!safeMsgs.length) {
        return { messages: ['entendi. me diz só: isso é pra agora ou mais pra frente?'] };
    }

    const hardMax = 260;

    const clipped = safeMsgs
        .map(m => this._stripOffensiveOutput(m))
        .map(m => (m.length > hardMax ? (m.slice(0, hardMax - 1).trim() + '…') : m))
        .filter(Boolean);

    return { messages: clipped };
    }

    // ✅ fora da sanitizeAndShapeResponse (método da classe)
    _stripOffensiveOutput(s) {
    if (!s) return s;

    // Remove xingamentos comuns (não substitui por nada; só corta)
    return String(s)
        .replace(/\b(tmnc|corno|fdp|vsf|porra|caralho|mane)\b/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();
    }

  _cleanOneMessage(input) {
    let s = input || '';

    s = s.replace(/```[\s\S]*?```/g, '');

    s = s
      .split('\n')
      .map(line => line.replace(/^\s*([-*•]|(\d+[\).]))\s+/g, ''))
      .join('\n');

    s = s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

    s = s.replace(/[ \t]{2,}/g, ' ').trim();

    s = s.replace(/\bprezado\b/gi, '').replace(/\bcordialmente\b/gi, '').trim();

    const lines = s.split('\n').map(x => x.trim()).filter(Boolean);
    if (lines.length > 2) s = lines.slice(0, 2).join('\n');

    if (s.length > 340) {
      const cut = s.slice(0, 340);
      const idx = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
      s = (idx > 120 ? cut.slice(0, idx + 1) : cut).trim();
    }

    s = s.replace(/!{2,}/g, '!');

    return s;
  }

  _stripSystemLeak(s) {
    const ban = [
      /contexto rápido:/i,
      /mensagem do cliente:/i,
      /lembrete:/i,
      /responda somente com json/i,
      /crm_update/i,
      /dados já conhecidos:/i,
      /nível de informalidade/i,
      /saída obrigatória/i,
      /actions/i
    ];

    const lines = (s || '').split('\n').map(l => l.trim()).filter(Boolean);
    const filtered = lines.filter(l => !ban.some(rx => rx.test(l)));
    return filtered.join('\n').trim();
  }

  _makeMoreWhatsApp(s, userId, leadContext) {
    let out = (s || '').trim();
    if (!out) return out;

    const profile = this._getProfile(userId);
    const turn = this._turns.get(userId) || 1;

    out = out.replace(/^\s*(show|beleza|blz|massa|top|olá|oi|e aí|eai)[,!\.\s-]*/i, '').trim();

    if (!/^(entendi|saquei|pode crer|fechou|boa|perfeito)\b/i.test(out)) {
      if (Math.random() < profile.backchannelChance) {
        const choices = ['entendi.', 'saquei.', 'pode crer.', 'fechou.'];
        out = `${choices[Math.floor(Math.random() * choices.length)]} ${out}`;
      }
    }

    if (Math.random() < profile.informality) {
      out = out
        .replace(/\bvocê\b/gi, 'vc')
        .replace(/\bestá\b/gi, 'tá')
        .replace(/\bestão\b/gi, 'tão')
        .replace(/\bpara\b/gi, 'pra')
        .replace(/\bporque\b/gi, 'pq');
    }

    if (Math.random() < profile.softenerChance) {
      if (out.includes('?') || /\bme manda\b|\bme diz\b|\bme fala\b/i.test(out)) {
        const soft = ['rapidinho', 'só pra eu entender', 'bem de boa'];
        const pick = soft[Math.floor(Math.random() * soft.length)];
        if (!new RegExp(pick, 'i').test(out)) {
          out = out.replace(/\b(me diz|me fala|me manda)\b/i, `$1 ${pick}`);
        }
      }
    }

    if (leadContext?.name) {
      const lastNameTurn = this._lastUsedNameTurn.get(userId) || -999;
      const cooldown = profile.nameCooldownTurns;

      const startsWithName = new RegExp(`^\\s*${leadContext.name}\\b[:,\\s-]*`, 'i');
      if (startsWithName.test(out) && (turn - lastNameTurn) < cooldown) {
        out = out.replace(startsWithName, '').trim();
      }

      if (new RegExp(`\\b${leadContext.name}\\b`, 'i').test(out)) {
        this._lastUsedNameTurn.set(userId, turn);
      }
    }

    if (Math.random() < profile.punctuationLooseness) {
      out = out.replace(/\.\s*$/g, '');
    }

    const lines = out.split('\n').map(x => x.trim()).filter(Boolean);
    if (lines.length > 2) out = lines.slice(0, 2).join('\n');

    return out.trim();
  }

  _enforceMaxOneQuestionAcrossAll(msgs) {
    const all = msgs.join(' ');
    const qCount = (all.match(/\?/g) || []).length;
    if (qCount <= 1) return msgs;

    let used = false;
    return msgs.map(m => {
      let out = '';
      for (let i = 0; i < m.length; i++) {
        const ch = m[i];
        if (ch === '?') {
          if (used) out += '.';
          else {
            out += '?';
            used = true;
          }
        } else out += ch;
      }
      return out;
    });
  }

  _avoidConsecutiveSameOpener(msgs, userId) {
    const opener = (s) => {
      const t = (s || '').toLowerCase().trim();
      return t.split(/\s+/).slice(0, 2).join(' ');
    };

    const last = this._lastOpeners.get(userId);
    const current = opener(msgs[0]);

    if (last && current && last === current) {
      const common = ['entendi', 'saquei', 'pode crer', 'fechou', 'beleza', 'blz', 'show', 'massa', 'top', 'oi', 'olá', 'e aí', 'eai'];
      if (common.includes(current)) {
        msgs[0] = msgs[0].replace(/^\s*(entendi|saquei|pode crer|fechou|beleza|blz|show|massa|top|e aí|eai|oi|olá)[,!\.\s-]*/i, '').trim();
        if (!msgs[0]) msgs[0] = 'entendi.';
      }
    }

    this._lastOpeners.set(userId, opener(msgs[0]));
    return msgs;
  }

  // ==========================================================================
  // JSON MODE (com runtimeContext)
  // ==========================================================================
  async generate(userPrompt, conversationHistory = [], runtimeContext = {}, userId = 'unknown', retries = 1) {
    return limiter.add(async () => {
      if (!this.isConfigured()) throw new Error('API Key ausente');

      const prevTurn = this._turns.get(userId) || 0;
      const turn = prevTurn + 1;
      this._turns.set(userId, turn);

      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const systemText = this.getSystemPrompt(runtimeContext, userId);

      const jitter = (Math.random() * 0.08) - 0.04;
      const temp = clamp(this.temperature + jitter, 0.35, 0.75);

      const body = {
        contents: [],
        generationConfig: {
          temperature: temp,
          maxOutputTokens: clamp(this.maxTokens, 160, 520),
          topP: 0.9,
          topK: 40,
        },
      };

      if (String(this.model).toLowerCase().includes('gemma')) {
        body.contents.push({ role: 'user', parts: [{ text: 'INSTRUÇÃO:\n' + systemText }] });
        body.contents.push({ role: 'model', parts: [{ text: 'Ok. Vou responder somente em JSON.' }] });
      } else {
        body.systemInstruction = { parts: [{ text: systemText }] };
      }

      const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];
      for (const msg of history) {
        const t = safeText(msg?.text);
        if (!t) continue;
        const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
        body.contents.push({ role, parts: [{ text: t }] });
      }

      const up = safeText(userPrompt) || '...';
      body.contents.push({
        role: 'user',
        parts: [{
          text: up + `\n\nResponda só com JSON válido.`
        }]
      });

      let attempts = 0;
      while (attempts <= retries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), this.timeout);

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errBody = await response.text();
            if ((response.status === 429 || response.status >= 500) && attempts < retries) {
              await new Promise(r => setTimeout(r, 2500 + Math.random() * 1000));
              attempts++;
              continue;
            }
            throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 500)}`);
          }

          const data = await response.json();
          const parsed = this.parseResponse(data);

          // humanização só das mensagens (actions/crm_update seguem intactos)
          const shaped = this.sanitizeAndShapeResponse(
            { text: parsed.text, messages: parsed.messages },
            userId,
            runtimeContext?.lead || {}
          );

          return {
            text: shaped.messages.join(' <split> '),
            messages: shaped.messages,
            crmUpdate: parsed.crmUpdate || null,
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
            raw: parsed.raw || null
          };

        } catch (e) {
          attempts++;
          if (e?.name === 'AbortError') {
            if (attempts > retries) throw new Error(`Timeout (${this.timeout}ms)`);
          } else if (attempts > retries) {
            throw e;
          }
          await new Promise(r => setTimeout(r, 1500 + Math.random() * 800));
        }
      }
    });
  }

  parseResponse(data) {
    let raw = '';
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) raw = parts.map(p => p?.text || '').join('').trim();
    if (!raw && typeof data?.candidates?.[0]?.text === 'string') raw = data.candidates[0].text.trim();

    if (!raw) return { text: '', messages: [], crmUpdate: null, actions: [], raw: '' };

    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/g, '').trim();

    const jsonParsed = this._tryParseJsonObject(raw);
    if (jsonParsed && (Array.isArray(jsonParsed.messages) || typeof jsonParsed.message === 'string')) {
      const messages = Array.isArray(jsonParsed.messages)
        ? jsonParsed.messages
        : [jsonParsed.message];

      const crmUpdate = (jsonParsed.crm_update && typeof jsonParsed.crm_update === 'object')
        ? jsonParsed.crm_update
        : (jsonParsed.crmUpdate && typeof jsonParsed.crmUpdate === 'object')
          ? jsonParsed.crmUpdate
          : null;

      const actions = Array.isArray(jsonParsed.actions) ? jsonParsed.actions : [];

      return { text: '', messages, crmUpdate, actions, raw };
    }

    // fallback antigo
    let text = raw;
    let crmUpdate = null;

    const crmMatch = text.match(/<crm_update>\s*(\{[\s\S]+?\})\s*<\/crm_update>/i);
    if (crmMatch) {
      try { crmUpdate = JSON.parse(crmMatch[1]); } catch {}
      text = text.replace(/<crm_update>[\s\S]*?<\/crm_update>/gi, '').trim();
    }

    return { text, messages: [], crmUpdate, actions: [], raw };
  }

  _tryParseJsonObject(raw) {
    const t = (raw || '').trim();
    if (!t) return null;

    if (t.startsWith('{') && t.endsWith('}')) {
      try { return JSON.parse(t); } catch {}
    }

    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const slice = t.slice(first, last + 1);
      try { return JSON.parse(slice); } catch {}
    }

    return null;
  }
}

module.exports = new GeminiClient();
