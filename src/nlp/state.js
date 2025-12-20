// FILE: src/nlp/state.js
/**
 * GERENCIADOR DE ESTADO AVANÇADO
 * Memória completa da conversa
 */

class ConversationStateManager {
    constructor() {
        this.states = new Map();
        this.timeouts = {
            active: 10 * 60 * 1000,      // 10 minutos
            pause: 3 * 60 * 60 * 1000,   // 3 horas
            reentry: 7 * 24 * 60 * 60 * 1000  // 7 dias
        };
    }

    get(userId) {
        let state = this.states.get(userId);
        
        if (!state) {
            state = this.createNew();
            this.states.set(userId, state);
        }

        // Calcular modo baseado no tempo
        state.mode = this.calculateMode(state);
        
        return state;
    }

    createNew() {
        return {
            // Estágio da conversa
            stage: 'inicio', // inicio, conhecendo, explorando, detalhando, negociando, fechando, pos_venda
            
            // Assunto atual
            assunto: null, // site, landing, ecommerce, trafego, marketing
            plano: null,   // simples, completo, loja, starter, pro, scale, basico, premium
            
            // Modo temporal
            mode: 'active', // active, pause, reentry, cold
            
            // Temperatura de compra
            heat: 'cold', // cold, warm, hot
            
            // Cliente
            cliente: {
                nome: null,
                empresa: null,
                telefone: null,
                email: null,
                segmento: null
            },
            
            // Flags de ações já feitas
            ja: {
                apresentou: false,
                explicou: { site: false, landing: false, ecommerce: false, trafego: false, marketing: false },
                mostrouPreco: false,
                mostrouOpcoes: false,
                pediuDados: false,
                enviouProposta: false,
                ofereceuDesconto: false,
                enviouPagamento: false
            },
            
            // Última ação do bot
            lastBot: {
                action: null,     // greet, explain, price, options, ask_data, proposal, payment, etc
                question: null,   // binary, open, data, confirm
                timestamp: 0
            },
            
            // O que o usuário precisa/quer
            userNeeds: {
                info: false,
                price: false,
                examples: false,
                proposal: false,
                schedule: false
            },
            
            // Objeções identificadas
            objections: {
                price: 0,    // contador de vezes
                time: 0,
                trust: 0,
                compare: 0,
                confusion: 0
            },
            
            // Negociação
            negotiation: {
                descontoOferecido: 0,
                descontoMaximo: 15,
                valorOriginal: 0,
                valorAtual: 0,
                formaPagamento: null,
                parcelas: null
            },
            
            // Pendências
            pending: {
                kind: null,  // choose_service, choose_plan, send_data, confirm_payment, etc
                data: null,
                createdAt: 0
            },
            
            // Resumo do que foi discutido
            topicSummary: '',
            
            // Histórico recente
            historico: [], // últimas 10 interações
            
            // Timestamps
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0
        };
    }

    calculateMode(state) {
        const timeSince = Date.now() - state.lastActivity;
        
        if (timeSince < this.timeouts.active) return 'active';
        if (timeSince < this.timeouts.pause) return 'pause';
        if (timeSince < this.timeouts.reentry) return 'reentry';
        return 'cold';
    }

    update(userId, updates) {
        const state = this.get(userId);
        
        // Merge profundo
        this.deepMerge(state, updates);
        
        state.lastActivity = Date.now();
        state.messageCount++;
        
        this.states.set(userId, state);
        return state;
    }

    deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    addToHistory(userId, entry) {
        const state = this.get(userId);
        
        state.historico.push({
            ...entry,
            timestamp: Date.now()
        });
        
        // Manter apenas últimas 10
        if (state.historico.length > 10) {
            state.historico = state.historico.slice(-10);
        }
        
        this.states.set(userId, state);
    }

    updateHeat(userId, signals) {
        const state = this.get(userId);
        
        if (signals.wants_proposal || signals.ready_to_buy || signals.payment_pix || signals.payment_card) {
            state.heat = 'hot';
        } else if (signals.price_ask || signals.wants_examples || signals.schedule_request) {
            if (state.heat === 'cold') state.heat = 'warm';
        } else if (signals.objection_time || signals.short_negative) {
            state.heat = 'cold';
        }
        
        this.states.set(userId, state);
        return state.heat;
    }

    incrementObjection(userId, type) {
        const state = this.get(userId);
        if (state.objections[type] !== undefined) {
            state.objections[type]++;
        }
        this.states.set(userId, state);
    }

    setAssunto(userId, assunto, plano = null) {
        this.update(userId, { 
            assunto, 
            plano,
            stage: 'explorando'
        });
    }

    cleanup() {
        const now = Date.now();
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
        
        for (const [userId, state] of this.states.entries()) {
            if (now - state.lastActivity > maxAge) {
                this.states.delete(userId);
            }
        }
    }
}

const stateManager = new ConversationStateManager();

// Limpar a cada hora
setInterval(() => stateManager.cleanup(), 60 * 60 * 1000);

module.exports = stateManager;