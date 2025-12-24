// FILE: src/nlp/llm-router.js
const config = require('../config/index.js');

let gemini;
try {
  gemini = require('../llm/gemini.js');
} catch (e) {
  console.log('⚠️ Gemini não disponível:', e.message);
  gemini = { isConfigured: () => false, generate: async () => ({ text: '', actions: [] }) };
}

class LLMRouter {
  constructor() {
    this.lastResponses = new Map();
    this.enabled = !!(config.gemini?.enabled && gemini.isConfigured());
  }

  shouldUseGemini(result, state) {
    if (!this.enabled) return false;
    if (!gemini.isConfigured()) return false;

    // full_gemini: sempre Gemini
    if (config.bot?.mode === 'full_gemini') return true;

    const { intent, confidence, action } = result || {};

    if (intent === 'unknown' || (confidence ?? 0) < (config.gemini?.confidenceThreshold || 0.55)) return true;
    if (state?.mode === 'reentry' || state?.mode === 'cold') return true;
    if (action === 'FALLBACK' || action === 'ANSWER_QUESTION') return true;

    if (['GREET_FIRST', 'GREET_RETURN', 'CONTINUE_FLOW'].includes(action)) return Math.random() < 0.15;

    return false;
  }

  buildUserPrompt(text, ctx) {
    const intent = ctx?.policy?.intent || 'sales';
    const goal = ctx?.policy?.goal || '';
    const stage = ctx?.conversation?.stage || 'inicio';

    const deal = ctx?.deal || {};
    const dealLine = `deal(status=${deal.status || 'none'} produto=${deal.produto || 'n/a'} plano=${deal.plano || 'n/a'} valor=${deal.valor || 'n/a'})`;

    const slots = Array.isArray(ctx?.policy?.slots) ? ctx.policy.slots : null;
    const slotsLine = slots && slots.length ? `slots sugeridos: ${slots.map(s => s.label).join(' ou ')}` : '';

    return [
      `Contexto: intent=${intent} stage=${stage} ${dealLine} ${slotsLine}`.trim(),
      goal ? `Objetivo: ${goal}` : '',
      `Cliente: "${text}"`
    ].filter(Boolean).join('\n');
  }

  isTooSimilar(userId, newText) {
    const lastText = this.lastResponses.get(userId);
    if (!lastText) return false;

    const normalize = t => (t || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
    const a = normalize(newText);
    const b = normalize(lastText);

    if (!a || !b) return false;
    if (a === b) return true;

    const setA = new Set(a.split(' ').filter(Boolean));
    const setB = new Set(b.split(' ').filter(Boolean));
    if (!setA.size || !setB.size) return false;

    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return (intersection / union) > 0.86;
  }

  saveLastResponse(userId, text) {
    this.lastResponses.set(userId, text);
    if (this.lastResponses.size > 1000) {
      const keys = [...this.lastResponses.keys()].slice(0, 500);
      keys.forEach(k => this.lastResponses.delete(k));
    }
  }

  // route(text, nlpResult, state, chatId, leadContext, ctxRuntime)
  async route(text, result, state, userId, leadContext = {}, ctx = {}) {
    const method = { used: 'nlp', geminiCalled: false };

    if (!this.shouldUseGemini(result, state)) {
      return { response: result?.response || null, method, crmUpdate: null, actions: [] };
    }

    try {
      method.geminiCalled = true;

      const userPrompt = this.buildUserPrompt(text, ctx);
      const history = Array.isArray(ctx?.history) ? ctx.history.slice(-10) : [];

      const leadForPrompt = {
        name: leadContext?.name || leadContext?.nome || null,
        company: leadContext?.company || leadContext?.empresa || null,
        email: leadContext?.email || null,
        notes: leadContext?.notes || null,
        conversation: ctx?.conversation || null,
        deal: ctx?.deal || null,
        policy: ctx?.policy || null
      };

      console.log('   🤖 Chamando Gemini...');
      const geminiResult = await gemini.generate(userPrompt, history, leadForPrompt, userId);

      let finalText = geminiResult?.text || '';
      const crmUpdate = geminiResult?.crmUpdate || null;
      const actions = Array.isArray(geminiResult?.actions) ? geminiResult.actions : [];

      if (!finalText || finalText.length < 2) throw new Error('Resposta Gemini vazia');

      if (this.isTooSimilar(userId, finalText)) {
        console.log('   ⚠️ Resposta similar, variando...');
        const retryPrompt = userPrompt + '\nRegra: não repita frase pronta. seja mais direto e diferente.';
        const retry = await gemini.generate(retryPrompt, history, leadForPrompt, userId);
        finalText = retry?.text || finalText;
      }

      this.saveLastResponse(userId, finalText);
      method.used = 'gemini';

      console.log(`   ✅ Gemini OK (${finalText.length} chars)`);

      return { response: finalText, method, crmUpdate, actions };

    } catch (e) {
      console.log(`   ⚠️ Gemini falhou: ${e.message}`);
      return {
        response: result?.response || null,
        method: { used: 'nlp_fallback', geminiCalled: true, error: e.message },
        crmUpdate: null,
        actions: []
      };
    }
  }
}

module.exports = new LLMRouter();
