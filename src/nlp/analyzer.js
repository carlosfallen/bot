
// FILE: src/nlp/analyzer.js
/**
 * ANALISADOR NLP INTELIGENTE
 * Decide resposta baseado em ESTADO + CONTEXTO + INTENÇÃO
 */

const { intents, contextKeywords } = require('./intents.js');
const { getResponse } = require('./responses.js');
const stateManager = require('./state.js');
const embeddingsManager = require('./embeddings.js');

class NLPAnalyzer {
    constructor() {
        this.useEmbeddings = true;
        this.embeddingsReady = false;
        this.similarityThreshold = 0.50;
    }

    async initializeEmbeddings() {
        if (this.embeddingsReady) return;
        try {
            await embeddingsManager.initialize();
            this.embeddingsReady = true;
            console.log('✅ NLP ativo');
        } catch {
            console.log('⚠️  Usando fallback');
            this.useEmbeddings = false;
        }
    }

    normalize(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s@.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isShort(text) {
        return this.normalize(text).split(' ').filter(w => w).length <= 3;
    }

    isNumeric(text) {
        return /^[1-3]$/.test(this.normalize(text).trim());
    }

    // ==================== DETECÇÃO ====================
    async detectIntent(text, userId) {
        const normalized = this.normalize(text);
        const state = stateManager.get(userId);
        const isShort = this.isShort(text);

        // 1. Escolha numérica após menu
        if (this.isNumeric(normalized) && state.historico.ultimoIntent?.includes('menu')) {
            const map = { '1': 'site', '2': 'trafego', '3': 'marketing' };
            const servico = map[normalized];
            if (servico) {
                return { intent: servico, confidence: 1.0, method: 'numeric', servico };
            }
        }

        // 2. Confirmação/Negação curta
        if (isShort) {
            const confirm = ['sim', 's', 'ok', 'beleza', 'quero', 'isso', 'claro', 'bora', 'pode', 'show', 'top', 'manda', 'fechado'];
            const deny = ['nao', 'n', 'depois', 'não'];
            
            if (confirm.includes(normalized)) {
                return { intent: 'affirmative', confidence: 0.95, method: 'short' };
            }
            if (deny.includes(normalized)) {
                return { intent: 'negative', confidence: 0.95, method: 'short' };
            }
        }

        // 3. Embeddings
        if (this.useEmbeddings && this.embeddingsReady) {
            const result = await embeddingsManager.findBestIntent(normalized);
            if (result.intent && result.confidence >= this.similarityThreshold) {
                return {
                    intent: result.intent,
                    confidence: result.confidence,
                    method: 'embeddings',
                    servico: result.data?.servico,
                    categoria: result.data?.categoria,
                    subcategoria: result.data?.subcategoria
                };
            }
        }

        // 4. Fallback
        return this.fallback(normalized);
    }

    fallback(normalized) {
        let best = { intent: 'unknown', confidence: 0 };

        for (const [name, data] of Object.entries(intents)) {
            if (!data.patterns) continue;

            for (const pattern of data.patterns) {
                const p = this.normalize(pattern);
                
                if (normalized === p) {
                    const score = 1.0 + (data.priority || 1) * 0.01;
                    if (score > best.confidence) {
                        best = { intent: name, confidence: score, servico: data.servico, categoria: data.categoria, subcategoria: data.subcategoria };
                    }
                } else if (normalized.includes(p) && p.length >= 3) {
                    const score = 0.7 + (p.length / normalized.length) * 0.2;
                    if (score > best.confidence) {
                        best = { intent: name, confidence: score, servico: data.servico, categoria: data.categoria, subcategoria: data.subcategoria };
                    }
                }
            }
        }

        return { ...best, method: 'fallback' };
    }

    // ==================== EXTRAÇÃO DE ENTIDADES ====================
    extractEntities(text) {
        const entities = {};

        // Email
        const email = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i);
        if (email) entities.email = email[0].toLowerCase();

        // Telefone
        const phone = text.match(/(?:\+?55\s?)?(?:\(?0?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
        if (phone) entities.phone = phone[0].replace(/\D/g, '');

        // Nome (texto sem números, até 50 chars)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length >= 1) {
            const first = lines[0];
            if (!first.includes('@') && !first.match(/\d{4,}/) && first.length < 50 && first.length > 1) {
                const clean = first.replace(/[^\w\s]/g, '').trim();
                if (clean && !clean.match(/^\d+$/) && clean.split(' ').length <= 4) {
                    entities.name = clean.split(' ').map(w => 
                        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                    ).join(' ');
                }
            }
        }

        // Empresa (segunda linha)
        if (lines.length >= 2 && !lines[1].includes('@') && !lines[1].match(/\d{4,}/)) {
            if (lines[1].length > 1 && lines[1].length < 50) {
                entities.company = lines[1];
            }
        }

        return entities;
    }

    // ==================== LÓGICA PRINCIPAL ====================
    async analyze(text, userId) {
        try {
            if (!this.embeddingsReady && this.useEmbeddings) {
                await this.initializeEmbeddings();
            }

            const state = stateManager.get(userId);
            const detection = await this.detectIntent(text, userId);
            const entities = this.extractEntities(text);
            
            // Detectar urgência
            const isUrgent = contextKeywords.urgency.some(k => this.normalize(text).includes(k));
            if (isUrgent) {
                stateManager.update(userId, { interesse: { urgencia: true } });
            }

            // Log
            console.log(`   📊 Estado: ${state.stage} | Serviço: ${state.interesse.servico || '-'}`);
            console.log(`   🎯 Intent: ${detection.intent} (${(detection.confidence * 100).toFixed(0)}%) [${detection.method}]`);

            // Decidir resposta
            const response = this.decideResponse(userId, detection, entities, text);

            // Atualizar estado
            this.updateState(userId, detection, entities);

            return {
                intent: detection.intent,
                confidence: detection.confidence,
                response,
                entities,
                method: detection.method,
                context: { isUrgent },
                shouldCollectData: Object.keys(entities).length > 0
            };

        } catch (error) {
            console.error('❌ Erro:', error);
            return {
                intent: 'error',
                confidence: 0,
                response: 'Desculpa, tive um problema. Pode repetir?',
                entities: {},
                method: 'error',
                shouldCollectData: false
            };
        }
    }

    // ==================== DECISÃO DE RESPOSTA ====================
    decideResponse(userId, detection, entities, text) {
        const state = stateManager.get(userId);
        const { intent, servico, categoria, subcategoria } = detection;
        const { stage, interesse, cliente, flags, historico } = state;

        // ===== ENTIDADES RECEBIDAS (LEAD) =====
        if (entities.name && (flags.jaPediuContato || stage === 'fechando')) {
            stateManager.update(userId, {
                cliente: { nome: entities.name, empresa: entities.company },
                stage: 'fechando'
            });
            return getResponse('dados_recebidos', entities.company ? 'completo' : 'nome', { nome: entities.name });
        }

        // ===== SAUDAÇÕES =====
        if (intent.startsWith('greeting')) {
            if (flags.jaApresentou) {
                return getResponse('saudacao', 'retorno');
            }
            return getResponse('saudacao', subcategoria || 'primeira');
        }

        // ===== DESPEDIDAS =====
        if (intent === 'goodbye') {
            if (flags.jaPediuContato || cliente.nome) {
                return getResponse('despedida', 'com_proposta');
            }
            return getResponse('despedida', 'sem_proposta');
        }

        if (intent === 'thanks') {
            return getResponse('despedida', 'agradecimento');
        }

        // ===== SERVIÇOS =====
        if (['site', 'site_simples', 'site_completo', 'ecommerce'].includes(intent)) {
            stateManager.update(userId, { interesse: { servico: 'site' } });
            
            if (intent === 'site_simples') {
                return getResponse('site', 'simples');
            }
            if (intent === 'ecommerce') {
                return getResponse('site', 'loja');
            }
            if (historico.ultimoIntent === 'site' || flags.jaExplicouServico) {
                return getResponse('site', 'preco');
            }
            return getResponse('site', 'interesse_inicial');
        }

        if (intent === 'landing') {
            stateManager.update(userId, { interesse: { servico: 'landing' } });
            if (historico.ultimoIntent === 'landing') {
                return getResponse('landing', 'preco');
            }
            return getResponse('landing', 'interesse_inicial');
        }

        if (intent.startsWith('trafego')) {
            stateManager.update(userId, { interesse: { servico: 'trafego' } });
            if (historico.ultimoIntent?.includes('trafego')) {
                return getResponse('trafego', 'preco');
            }
            return getResponse('trafego', 'interesse_inicial');
        }

        if (intent === 'marketing') {
            stateManager.update(userId, { interesse: { servico: 'marketing' } });
            if (historico.ultimoIntent === 'marketing') {
                return getResponse('marketing', 'preco');
            }
            return getResponse('marketing', 'interesse_inicial');
        }

        // ===== PREÇOS =====
        if (intent.startsWith('pricing')) {
            stateManager.update(userId, { flags: { jaMostrouPreco: true } });
            
            // Preço específico
            if (servico) {
                const mapa = { site: 'site', landing: 'landing', trafego: 'trafego', marketing: 'marketing' };
                return getResponse(mapa[servico] || 'precos', 'preco');
            }
            
            // Preço baseado no contexto
            if (interesse.servico) {
                return getResponse(interesse.servico, 'preco');
            }
            
            // Sem contexto
            return getResponse('precos', 'tabela_geral');
        }

        // ===== CONFIRMAÇÃO =====
        if (intent === 'affirmative') {
            // Após mostrar preço → coletar dados
            if (flags.jaMostrouPreco && !flags.jaPediuContato) {
                stateManager.update(userId, { flags: { jaPediuContato: true }, stage: 'fechando' });
                return getResponse('coleta', 'contato_completo');
            }
            
            // Após falar de serviço → mostrar preço
            if (interesse.servico && !flags.jaMostrouPreco) {
                stateManager.update(userId, { flags: { jaMostrouPreco: true } });
                return getResponse(interesse.servico, 'preco');
            }
            
            // Após explicação → continuar
            if (flags.jaExplicouServico) {
                return getResponse('confirmacao', 'apos_explicacao');
            }
            
            return getResponse('confirmacao', 'generica');
        }

        // ===== NEGAÇÃO =====
        if (intent === 'negative') {
            return getResponse('objecoes', 'pensar');
        }

        // ===== EXPLICAÇÃO =====
        if (intent === 'explain') {
            stateManager.update(userId, { flags: { jaExplicouServico: true } });
            
            if (interesse.servico) {
                const mapa = { site: 'site', landing: 'landing', trafego: 'trafego', marketing: 'marketing' };
                return getResponse(mapa[interesse.servico], 'explicacao');
            }
            return getResponse('menu', 'como_funciona');
        }

        // ===== PROPOSTA =====
        if (intent === 'send_proposal') {
            if (!cliente.nome) {
                stateManager.update(userId, { flags: { jaPediuContato: true }, stage: 'fechando' });
                return getResponse('coleta', 'contato_completo');
            }
            return getResponse('dados_recebidos', 'completo', { nome: cliente.nome });
        }

        // ===== DÚVIDAS =====
        if (['prazo', 'garantia', 'pagamento'].includes(intent)) {
            return getResponse('duvidas', intent);
        }

        // ===== URGÊNCIA =====
        if (intent === 'urgency') {
            stateManager.update(userId, { interesse: { urgencia: true }, flags: { jaPediuContato: true } });
            return getResponse('urgencia', 'detectada');
        }

        // ===== MENU =====
        if (intent === 'menu') {
            stateManager.update(userId, { flags: { jaMostrouServicos: true } });
            return getResponse('menu', 'servicos');
        }

        // ===== PORTFÓLIO =====
        if (intent === 'portfolio') {
            return getResponse('portfolio', 'geral');
        }

        // ===== AGENDAMENTO =====
        if (intent === 'schedule') {
            return getResponse('agendamento', 'oferecer');
        }

        // ===== CONTATO =====
        if (intent === 'contact') {
            return getResponse('contato', 'info');
        }

        // ===== OBJEÇÕES =====
        if (intent === 'expensive') {
            return getResponse('objecoes', 'caro');
        }
        if (intent === 'compare') {
            return getResponse('objecoes', 'comparar');
        }

        // ===== FALLBACK INTELIGENTE =====
        // Se já tem serviço definido, direcionar
        if (interesse.servico && historico.mensagens > 2) {
            if (!flags.jaMostrouPreco) {
                return `Sobre ${interesse.servico === 'site' ? 'o site' : interesse.servico === 'landing' ? 'a landing page' : interesse.servico === 'trafego' ? 'o tráfego' : 'a gestão'}, quer saber o valor?`;
            }
        }

        // Fallback padrão
        return getResponse('fallback', 'nao_entendeu');
    }

    // ==================== ATUALIZAÇÃO DE ESTADO ====================
    updateState(userId, detection, entities) {
        const { intent, servico } = detection;
        const updates = { historico: { ultimoIntent: intent } };

        // Saudação
        if (intent.startsWith('greeting')) {
            updates.flags = { jaApresentou: true };
            updates.stage = 'conhecendo';
        }

        // Serviço
        if (servico) {
            updates.interesse = { servico };
            updates.stage = 'explorando';
        }

        // Preço
        if (intent.startsWith('pricing')) {
            updates.flags = { jaMostrouPreco: true };
            updates.stage = 'detalhando';
        }

        // Proposta/Coleta
        if (['send_proposal', 'affirmative'].includes(intent)) {
            const state = stateManager.get(userId);
            if (state.flags.jaMostrouPreco) {
                updates.stage = 'fechando';
            }
        }

        // Entidades
        if (entities.name) {
            updates.cliente = { nome: entities.name };
            if (entities.company) updates.cliente.empresa = entities.company;
            if (entities.email) updates.cliente.email = entities.email;
            if (entities.phone) updates.cliente.telefone = entities.phone;
        }

        stateManager.update(userId, updates);
        stateManager.addToHistory(userId, intent, servico);
    }
}

module.exports = new NLPAnalyzer();