// FILE: src/nlp/llm-router.js - Verificar se tem import correto
/**
 * LLM ROUTER - Decide quando usar Gemini
 */

const config = require('../config/index.js');

// Verificar se gemini existe antes de importar
let gemini;
try {
    gemini = require('../llm/gemini.js');
} catch (e) {
    console.log('⚠️ Gemini não disponível:', e.message);
    gemini = { isConfigured: () => false };
}

class LLMRouter {
    constructor() {
        this.lastResponses = new Map();
        this.enabled = config.gemini?.enabled && gemini.isConfigured();
    }

    shouldUseGemini(result, state) {
        if (!this.enabled) return false;
        if (!gemini.isConfigured()) return false;

        const { intent, confidence, action } = result;

        if (intent === 'unknown' || confidence < (config.gemini?.confidenceThreshold || 0.55)) {
            return true;
        }

        if (state?.mode === 'reentry' || state?.mode === 'cold') {
            return true;
        }

        if (action === 'FALLBACK' || action === 'ANSWER_QUESTION') {
            return true;
        }

        if (['GREET_FIRST', 'GREET_RETURN', 'CONTINUE_FLOW'].includes(action)) {
            return Math.random() < 0.2;
        }

        return false;
    }

    buildSystemPrompt() {
        return `Você é um atendente humano de uma agência de marketing digital chamada "Império Lord".

REGRAS ABSOLUTAS:
1. Respostas CURTAS: 1 a 3 linhas no máximo
2. NO MÁXIMO 1 pergunta por mensagem
3. NUNCA use listas, bullets ou formatação excessiva
4. Seja natural, como um vendedor real no WhatsApp
5. Conduza para conversão (site/landing/tráfego/redes)
6. NÃO repita informações já ditas
7. Use português brasileiro informal mas profissional

SERVIÇOS:
- Site simples: R$ 2.500 | Completo: R$ 4.500 | Loja: R$ 5.500
- Landing page: R$ 997 a R$ 1.500
- Tráfego pago: R$ 1.500 a R$ 4.500/mês
- Gestão de redes: R$ 997 a R$ 3.500/mês

Responda de forma natural e direta.`;
    }

    buildContext(text, result, state) {
        const { intent, confidence, action } = result;
        const { stage, assunto, plano, cliente, ja, mode, historico } = state || {};

        const recentHistory = (historico || [])
            .slice(-6)
            .map(h => `- ${h.message || h.text || h}`)
            .join('\n');

        return `CONTEXTO:
- Intent: ${intent} (${Math.round((confidence || 0) * 100)}%)
- Ação: ${action}
- Modo: ${mode || 'normal'}
- Estágio: ${stage || 'inicio'}
- Assunto: ${assunto || 'não definido'}
- Plano: ${plano || 'não escolhido'}
- Cliente: ${cliente?.nome || 'não identificado'}

HISTÓRICO:
${recentHistory || 'Primeira mensagem'}

MENSAGEM:
"${text}"

Gere uma resposta curta e natural.`;
    }

    isTooSimilar(userId, newText) {
        const lastText = this.lastResponses.get(userId);
        if (!lastText) return false;

        const normalize = t => (t || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
        const a = normalize(newText);
        const b = normalize(lastText);

        if (a === b) return true;

        const setA = new Set(a.split(' ').filter(Boolean));
        const setB = new Set(b.split(' ').filter(Boolean));
        if (setA.size === 0 || setB.size === 0) return false;
        
        const intersection = [...setA].filter(x => setB.has(x)).length;
        const union = new Set([...setA, ...setB]).size;
        const jaccard = intersection / union;

        return jaccard > 0.85;
    }

    saveLastResponse(userId, text) {
        this.lastResponses.set(userId, text);
        
        if (this.lastResponses.size > 1000) {
            const keys = [...this.lastResponses.keys()].slice(0, 500);
            keys.forEach(k => this.lastResponses.delete(k));
        }
    }

    async route(text, result, state, userId) {
        const method = { used: 'nlp', geminiCalled: false };

        if (!this.shouldUseGemini(result, state)) {
            return { response: result.response, method };
        }

        try {
            method.geminiCalled = true;
            
            const systemPrompt = this.buildSystemPrompt();
            const userPrompt = this.buildContext(text, result, state);

            console.log('   🤖 Chamando Gemini...');
            const geminiResult = await gemini.generate(systemPrompt, userPrompt);
            
            let finalText = geminiResult?.text;

            if (!finalText || finalText.length < 2) {
                throw new Error('Resposta Gemini vazia');
            }

            if (this.isTooSimilar(userId, finalText)) {
                console.log('   ⚠️ Resposta similar, tentando variar...');
                const retryPrompt = userPrompt + '\n\nIMPORTANTE: Varie o texto, não repita.';
                const retryResult = await gemini.generate(systemPrompt, retryPrompt);
                finalText = retryResult?.text;
                
                if (!finalText || this.isTooSimilar(userId, finalText)) {
                    console.log('   ⚠️ Usando fallback NLP');
                    return { response: result.response, method: { used: 'nlp_fallback', geminiCalled: true } };
                }
            }

            if (finalText.length > 300) {
                finalText = finalText.substring(0, 300).trim() + '...';
            }

            this.saveLastResponse(userId, finalText);
            method.used = 'gemini';

            console.log(`   ✅ Gemini OK (${finalText.length} chars)`);

            return { response: finalText, method, geminiData: geminiResult };

        } catch (e) {
            console.log(`   ⚠️ Gemini falhou: ${e.message}`);
            return {
                response: result.response,
                method: { used: 'nlp_fallback', geminiCalled: true, error: e.message }
            };
        }
    }
}

module.exports = new LLMRouter();