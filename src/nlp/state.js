// FILE: src/nlp/state.js
/**
 * Gerenciador de Estado da Conversa
 * Controla o fluxo natural da conversa como um humano faria
 */

class ConversationState {
    constructor() {
        this.states = new Map();
        this.timeout = 30 * 60 * 1000; // 30 minutos
    }

    getState(userId) {
        let state = this.states.get(userId);
        
        if (!state) {
            state = this.createInitialState();
            this.states.set(userId, state);
        }

        // Verificar se expirou
        if (Date.now() - state.lastActivity > this.timeout) {
            state = this.createInitialState();
            this.states.set(userId, state);
        }

        return state;
    }

    createInitialState() {
        return {
            stage: 'inicio',           // inicio, exploracao, detalhamento, fechamento
            assunto: null,             // site, landing, trafego, marketing, null
            jaApresentou: false,       // já mandou saudação?
            jaMostrouPreco: false,     // já falou de valores?
            jaPediuDados: false,       // já pediu nome/contato?
            ultimoTopico: null,        // último assunto discutido
            perguntasPendentes: 0,     // quantas perguntas fez sem resposta
            mensagensRecebidas: 0,     // contador de mensagens
            lastActivity: Date.now(),
            historico: []              // últimas 5 interações
        };
    }

    updateState(userId, updates) {
        const state = this.getState(userId);
        
        Object.assign(state, updates, { lastActivity: Date.now() });
        
        this.states.set(userId, state);
        return state;
    }

    addToHistory(userId, intent, message) {
        const state = this.getState(userId);
        
        state.historico.push({
            intent,
            message: message.substring(0, 100),
            timestamp: Date.now()
        });

        // Manter apenas últimas 5
        if (state.historico.length > 5) {
            state.historico = state.historico.slice(-5);
        }

        state.mensagensRecebidas++;
        state.lastActivity = Date.now();
        
        this.states.set(userId, state);
        return state;
    }

    // Verificar se já falou sobre um assunto
    jaFalouSobre(userId, assunto) {
        const state = this.getState(userId);
        return state.historico.some(h => h.intent === assunto);
    }

    // Limpar estados antigos
    cleanup() {
        const now = Date.now();
        for (const [userId, state] of this.states.entries()) {
            if (now - state.lastActivity > this.timeout) {
                this.states.delete(userId);
            }
        }
    }
}

const conversationState = new ConversationState();

// Limpar a cada 5 minutos
setInterval(() => {
    conversationState.cleanup();
}, 5 * 60 * 1000);

module.exports = conversationState;
