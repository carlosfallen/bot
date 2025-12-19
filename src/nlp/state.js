// FILE: src/nlp/state.js
/**
 * GERENCIADOR DE ESTADO AVANÇADO
 * Controla toda a jornada do cliente de forma inteligente
 */

class ConversationStateManager {
    constructor() {
        this.states = new Map();
        this.timeout = 60 * 60 * 1000; // 1 hora
    }

    get(userId) {
        let state = this.states.get(userId);
        
        if (!state || this.isExpired(state)) {
            state = this.createNew();
            this.states.set(userId, state);
        }

        return state;
    }

    isExpired(state) {
        return Date.now() - state.lastActivity > this.timeout;
    }

    createNew() {
        return {
            // ===== ESTÁGIO DA CONVERSA =====
            stage: 'inicio',
            // inicio → conhecendo → explorando → detalhando → negociando → fechando

            // ===== CONTEXTO DO CLIENTE =====
            cliente: {
                nome: null,
                empresa: null,
                telefone: null,
                email: null,
                segmento: null
            },

            // ===== INTERESSE =====
            interesse: {
                servico: null,        // site, landing, trafego, marketing
                tipo: null,           // simples, completo, loja, etc.
                urgencia: false,
                orcamento: null,      // baixo, medio, alto
                objetivo: null        // vendas, presenca, leads, etc.
            },

            // ===== HISTÓRICO =====
            historico: {
                mensagens: 0,
                ultimoIntent: null,
                ultimoAssunto: null,
                servicosMencionados: [],
                perguntasFeitas: [],
                informacoesColetadas: []
            },

            // ===== FLAGS =====
            flags: {
                jaApresentou: false,
                jaMostrouServicos: false,
                jaMostrouPreco: false,
                jaPediuContato: false,
                jaExplicouServico: false,
                aguardandoResposta: null,  // tipo de resposta esperada
                tentativasColeta: 0
            },

            // ===== TIMESTAMPS =====
            createdAt: Date.now(),
            lastActivity: Date.now()
        };
    }

    update(userId, updates) {
        const state = this.get(userId);
        
        // Merge profundo
        this.deepMerge(state, updates);
        state.lastActivity = Date.now();
        
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

    addToHistory(userId, intent, servico = null) {
        const state = this.get(userId);
        
        state.historico.mensagens++;
        state.historico.ultimoIntent = intent;
        
        if (servico && !state.historico.servicosMencionados.includes(servico)) {
            state.historico.servicosMencionados.push(servico);
        }

        state.lastActivity = Date.now();
        this.states.set(userId, state);
    }

    registrarPergunta(userId, pergunta) {
        const state = this.get(userId);
        state.historico.perguntasFeitas.push(pergunta);
        state.flags.aguardandoResposta = pergunta;
        this.states.set(userId, state);
    }

    registrarInfoColetada(userId, tipo) {
        const state = this.get(userId);
        if (!state.historico.informacoesColetadas.includes(tipo)) {
            state.historico.informacoesColetadas.push(tipo);
        }
        this.states.set(userId, state);
    }

    // Determinar próximo passo lógico
    proximoPasso(userId) {
        const state = this.get(userId);
        const { stage, interesse, cliente, flags, historico } = state;

        // Se não sabe o serviço, perguntar
        if (!interesse.servico && historico.mensagens > 1) {
            return 'perguntar_servico';
        }

        // Se sabe o serviço mas não detalhou
        if (interesse.servico && !flags.jaExplicouServico) {
            return 'explicar_servico';
        }

        // Se explicou mas não mostrou preço
        if (flags.jaExplicouServico && !flags.jaMostrouPreco) {
            return 'mostrar_preco';
        }

        // Se mostrou preço mas não tem contato
        if (flags.jaMostrouPreco && !cliente.nome) {
            return 'coletar_contato';
        }

        // Se tem tudo, fechar
        if (cliente.nome && flags.jaMostrouPreco) {
            return 'fechar';
        }

        return 'continuar';
    }

    cleanup() {
        const now = Date.now();
        for (const [userId, state] of this.states.entries()) {
            if (now - state.lastActivity > this.timeout) {
                this.states.delete(userId);
            }
        }
    }
}

const stateManager = new ConversationStateManager();

setInterval(() => stateManager.cleanup(), 10 * 60 * 1000);

module.exports = stateManager;
