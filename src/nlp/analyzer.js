// FILE: src/nlp/analyzer.js
/**
 * Analisador NLP com controle de estado
 * Decide resposta baseado no ESTADO + INTENÇÃO
 */

const { intents, contextKeywords } = require('./intents.js');
const { getResponse } = require('./responses.js');
const conversationState = require('./state.js');
const embeddingsManager = require('./embeddings.js');

class NLPAnalyzer {
    constructor() {
        this.useEmbeddings = true;
        this.embeddingsReady = false;
        this.similarityThreshold = 0.55;
    }

    async initializeEmbeddings() {
        if (this.embeddingsReady) return;

        try {
            await embeddingsManager.initialize();
            this.embeddingsReady = true;
            console.log('✅ NLP com embeddings ativo');
        } catch (error) {
            console.log('⚠️  Usando fallback (sem embeddings)');
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

    isShortMessage(text) {
        const words = this.normalize(text).split(' ').filter(w => w);
        return words.length <= 3;
    }

    isNumericChoice(text) {
        return /^[1-3]$/.test(this.normalize(text).trim());
    }

    // ==================== DETECÇÃO DE INTENÇÃO ====================
    async detectIntent(text, userId) {
        const normalized = this.normalize(text);
        const state = conversationState.getState(userId);
        const isShort = this.isShortMessage(text);

        // 1. Escolha numérica (1, 2, 3)
        if (this.isNumericChoice(normalized)) {
            const choice = parseInt(normalized);
            const map = { 1: 'traffic', 2: 'marketing', 3: 'web_development' };
            if (state.ultimoTopico === 'menu' && map[choice]) {
                return { intent: map[choice], confidence: 1.0, method: 'numeric_choice' };
            }
        }

        // 2. Confirmação/Negação curta
        if (isShort) {
            const confirmWords = ['sim', 's', 'ok', 'beleza', 'quero', 'isso', 'claro', 'bora', 'vamos', 'pode', 'show', 'top'];
            const negWords = ['nao', 'n', 'depois', 'nope'];

            if (confirmWords.includes(normalized)) {
                return { intent: 'affirmative', confidence: 0.95, method: 'short_confirm' };
            }
            if (negWords.includes(normalized)) {
                return { intent: 'negative', confidence: 0.95, method: 'short_negative' };
            }
        }

        // 3. Embeddings para mensagens maiores
        if (this.useEmbeddings && this.embeddingsReady && !isShort) {
            const result = await embeddingsManager.findBestIntent(normalized);
            if (result.intent && result.confidence >= this.similarityThreshold) {
                return { intent: result.intent, confidence: result.confidence, method: 'embeddings' };
            }
        }

        // 4. Fallback com patterns
        return this.fallbackDetect(normalized);
    }

    fallbackDetect(normalized) {
        let bestIntent = null;
        let bestScore = 0;

        for (const [name, data] of Object.entries(intents)) {
            if (!data.patterns) continue;

            for (const pattern of data.patterns) {
                const p = this.normalize(pattern);
                
                if (normalized === p) {
                    const score = 1.0 + (data.priority || 1) * 0.01;
                    if (score > bestScore) {
                        bestScore = score;
                        bestIntent = name;
                    }
                } else if (normalized.includes(p) && p.length >= 3) {
                    const score = 0.7 + (p.length / normalized.length) * 0.2;
                    if (score > bestScore) {
                        bestScore = score;
                        bestIntent = name;
                    }
                }
            }
        }

        return {
            intent: bestIntent || 'unknown',
            confidence: Math.min(bestScore, 1.0),
            method: 'fallback'
        };
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

        // Nome (linhas de texto sem números)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length >= 1) {
            const first = lines[0];
            if (!first.includes('@') && !first.match(/\d{4,}/) && first.length < 50) {
                const clean = first.replace(/[^\w\s]/g, '').trim();
                if (clean && !clean.match(/^\d+$/)) {
                    entities.name = clean.split(' ').map(w => 
                        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                    ).join(' ');
                }
            }
        }

        // Empresa
        if (lines.length >= 2 && !lines[1].includes('@') && !lines[1].match(/\d{4,}/)) {
            entities.company = lines[1];
        }

        return entities;
    }

    // ==================== DECISÃO DE RESPOSTA ====================
    decideResponse(intent, state, entities) {
        const { stage, assunto, jaApresentou, jaMostrouPreco, jaPediuDados, ultimoTopico } = state;

        // GREETING
        if (intent === 'greeting') {
            if (jaApresentou) {
                return getResponse('greeting', 'ja_conhece');
            }
            return getResponse('greeting', 'primeiro_contato');
        }

        // GOODBYE
        if (intent === 'goodbye') {
            return getResponse('goodbye', 'padrao');
        }

        // THANKS
        if (intent === 'thanks') {
            return getResponse('thanks', 'padrao');
        }

        // PRICING - resposta baseada no assunto atual
        if (intent === 'pricing') {
            if (assunto === 'site') return getResponse('pricing', 'site');
            if (assunto === 'landing') return getResponse('pricing', 'landing');
            if (assunto === 'trafego') return getResponse('pricing', 'trafego');
            if (assunto === 'marketing') return getResponse('pricing', 'marketing');
            return getResponse('pricing', 'generico');
        }

        // SERVIÇOS
        if (intent === 'web_development' || intent === 'simple_site') {
            if (ultimoTopico === 'web_development') {
                return getResponse('web_development', 'detalhamento');
            }
            return getResponse('web_development', 'inicial');
        }

        if (intent === 'landing') {
            return getResponse('landing', 'inicial');
        }

        if (intent === 'traffic') {
            if (ultimoTopico === 'traffic') {
                return getResponse('trafego', 'detalhamento');
            }
            return getResponse('trafego', 'inicial');
        }

        if (intent === 'marketing') {
            if (ultimoTopico === 'marketing') {
                return getResponse('marketing', 'detalhamento');
            }
            return getResponse('marketing', 'inicial');
        }

        // CONFIRMAÇÃO - depende do contexto anterior
        if (intent === 'affirmative') {
            // Após mostrar preço → pedir dados
            if (jaMostrouPreco && !jaPediuDados) {
                return getResponse('lead_capture', 'primeira_vez');
            }
            // Após falar de serviço → continuar
            if (assunto) {
                return getResponse('affirmative', 'apos_servico');
            }
            return getResponse('affirmative', 'continuar_assunto');
        }

        // NEGAÇÃO
        if (intent === 'negative') {
            return getResponse('negative', 'padrao');
        }

        // PROPOSTA
        if (intent === 'send_proposal') {
            if (jaPediuDados) {
                return 'Pode me passar seu nome e empresa?';
            }
            return getResponse('lead_capture', 'primeira_vez');
        }

        // EXPLICAÇÃO
        if (intent === 'explain') {
            if (assunto === 'site') return getResponse('explain', 'site');
            if (assunto === 'landing') return getResponse('explain', 'landing');
            if (assunto === 'trafego') return getResponse('explain', 'trafego');
            if (assunto === 'marketing') return getResponse('explain', 'marketing');
            return getResponse('menu', 'primeira_vez');
        }

        // MENU
        if (intent === 'menu') {
            if (jaApresentou) {
                return getResponse('menu', 'ja_viu');
            }
            return getResponse('menu', 'primeira_vez');
        }

        // URGÊNCIA
        if (intent === 'urgency') {
            return getResponse('urgency', 'padrao');
        }

        // PORTFOLIO
        if (intent === 'portfolio') {
            return getResponse('portfolio', 'padrao');
        }

        // SCHEDULE
        if (intent === 'schedule') {
            return getResponse('schedule', 'padrao');
        }

        // CONTACT
        if (intent === 'contact') {
            return 'Pode falar comigo por aqui mesmo, é mais rápido. Em que posso ajudar?';
        }

        // DADOS DO LEAD
        if (entities.name && (stage === 'fechamento' || jaPediuDados)) {
            let resp = getResponse('lead_received', 'padrao');
            return resp.replace('$NOME', entities.name);
        }

        // UNKNOWN
        return getResponse('unknown', 'padrao');
    }

    // ==================== ATUALIZAR ESTADO ====================
    updateStateAfterIntent(userId, intent, entities) {
        const state = conversationState.getState(userId);
        const updates = {};

        // Marcar que já apresentou
        if (intent === 'greeting') {
            updates.jaApresentou = true;
        }

        // Definir assunto
        const assuntoMap = {
            'web_development': 'site',
            'simple_site': 'site',
            'landing': 'landing',
            'traffic': 'trafego',
            'marketing': 'marketing'
        };
        if (assuntoMap[intent]) {
            updates.assunto = assuntoMap[intent];
            updates.stage = 'exploracao';
        }

        // Marcar que mostrou preço
        if (intent === 'pricing') {
            updates.jaMostrouPreco = true;
            updates.stage = 'detalhamento';
        }

        // Marcar que pediu dados
        if (intent === 'send_proposal' || intent === 'affirmative' && state.jaMostrouPreco) {
            updates.jaPediuDados = true;
            updates.stage = 'fechamento';
        }

        // Recebeu dados do lead
        if (entities.name) {
            updates.stage = 'fechamento';
        }

        // Último tópico
        updates.ultimoTopico = intent;

        conversationState.updateState(userId, updates);
        conversationState.addToHistory(userId, intent, '');
    }

    // ==================== ANÁLISE PRINCIPAL ====================
    async analyze(text, userId) {
        try {
            if (!this.embeddingsReady && this.useEmbeddings) {
                await this.initializeEmbeddings();
            }

            const state = conversationState.getState(userId);
            const { intent, confidence, method } = await this.detectIntent(text, userId);
            const entities = this.extractEntities(text);

            console.log(`   🔍 Estado: stage=${state.stage}, assunto=${state.assunto || 'null'}`);
            console.log(`   🎯 Intent: ${intent} (${(confidence * 100).toFixed(0)}%) [${method}]`);

            // Decidir resposta baseada no estado
            const response = this.decideResponse(intent, state, entities);

            // Atualizar estado
            this.updateStateAfterIntent(userId, intent, entities);

            return {
                intent,
                confidence,
                response,
                entities,
                method,
                context: {
                    isUrgent: contextKeywords.urgency.some(k => this.normalize(text).includes(k)),
                    budgetConcern: contextKeywords.budget.some(k => this.normalize(text).includes(k))
                },
                shouldCollectData: Object.keys(entities).length > 0
            };

        } catch (error) {
            console.error('❌ Erro em analyze:', error);
            return {
                intent: 'unknown',
                confidence: 0,
                response: 'Desculpa, tive um problema. Pode repetir?',
                entities: {},
                method: 'error',
                context: {},
                shouldCollectData: false
            };
        }
    }
}

const nlpAnalyzer = new NLPAnalyzer();

module.exports = nlpAnalyzer;