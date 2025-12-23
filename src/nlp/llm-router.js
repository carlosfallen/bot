// FILE: src/nlp/llm-router.js
const config = require('../config/index.js');

let gemini;
try {
    gemini = require('../llm/gemini.js');
} catch (e) {
    console.log('⚠️ Gemini não disponível:', e.message);
    gemini = { isConfigured: () => false };
}

class LLMRouter {
    constructor() {
        this.conversationHistory = new Map();
        this.enabled = config.gemini?.enabled && gemini.isConfigured();
        this.fullGeminiMode = true; // FULL GEMINI MODE
    }

    shouldUseGemini(result, state) {
        // Full Gemini: SEMPRE usar (exceto se desabilitado)
        if (!this.enabled) return false;
        if (!gemini.isConfigured()) return false;
        return true;
    }

    buildConversationHistory(userId) {
        const history = this.conversationHistory.get(userId) || [];
        return history.slice(-10); // Últimas 10 mensagens
    }

    saveToHistory(userId, role, text) {
        let history = this.conversationHistory.get(userId) || [];
        history.push({ role, text, timestamp: Date.now() });
        
        // Manter apenas últimas 20 mensagens
        if (history.length > 20) {
            history = history.slice(-20);
        }
        
        this.conversationHistory.set(userId, history);
    }

    async route(text, result, state, userId) {
        const method = { used: 'nlp', geminiCalled: false };
        let crmUpdate = null;

        // FULL GEMINI MODE: Sempre usar Gemini
        if (!this.shouldUseGemini(result, state)) {
            return { response: result.response, method, crmUpdate };
        }

        try {
            method.geminiCalled = true;
            
            // Buscar histórico da conversa
            const history = this.buildConversationHistory(userId);

            console.log('   🤖 Chamando Gemini (Full Mode)...');
            const geminiResult = await gemini.generate(text, history);
            
            let finalText = geminiResult?.text;
            crmUpdate = geminiResult?.crmUpdate;

            if (!finalText || finalText.length < 2) {
                throw new Error('Resposta Gemini vazia');
            }

            if (finalText.length > 400) {
                finalText = finalText.substring(0, 400).trim();
            }

            // Salvar no histórico
            this.saveToHistory(userId, 'user', text);
            this.saveToHistory(userId, 'bot', finalText);

            method.used = 'gemini';

            console.log(`   ✅ Gemini OK (${finalText.length} chars)${crmUpdate ? ' + CRM' : ''}`);

            return { response: finalText, method, crmUpdate, geminiData: geminiResult };

        } catch (e) {
            console.log(`   ⚠️ Gemini falhou: ${e.message}`);
            return {
                response: result.response || 'Desculpa, tive um problema. Pode repetir?',
                method: { used: 'nlp_fallback', geminiCalled: true, error: e.message },
                crmUpdate
            };
        }
    }

    clearHistory(userId) {
        this.conversationHistory.delete(userId);
    }
}

module.exports = new LLMRouter();