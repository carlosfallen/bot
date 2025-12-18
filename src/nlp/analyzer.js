// Analisador NLP - Processa mensagens e identifica intenções

const { intents, contextKeywords } = require('./intents.js');

class NLPAnalyzer {
    constructor() {
        this.conversationContext = new Map(); // Armazena contexto por usuário
        this.userSessions = new Map(); // Sessões de usuário
    }

    // Normalizar texto para análise
    normalize(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^\w\s]/g, ' ') // Remove pontuação
            .trim();
    }

    // Calcular similaridade entre texto e padrão
    calculateSimilarity(text, pattern) {
        const textWords = text.split(/\s+/);
        const patternWords = pattern.split(/\s+/);

        let matches = 0;
        for (const word of patternWords) {
            if (textWords.some(tw => tw.includes(word) || word.includes(tw))) {
                matches++;
            }
        }

        return matches / patternWords.length;
    }

    // Identificar intent da mensagem
    identifyIntent(text, userId) {
        const normalized = this.normalize(text);
        let bestMatch = null;
        let bestScore = 0;

        // Buscar em todos os intents
        for (const [intentName, intentData] of Object.entries(intents)) {
            for (const pattern of intentData.patterns) {
                const normalizedPattern = this.normalize(pattern);

                // Verificar match exato
                if (normalized.includes(normalizedPattern)) {
                    const score = 1.0;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = intentName;
                    }
                }

                // Calcular similaridade
                const similarity = this.calculateSimilarity(normalized, normalizedPattern);
                if (similarity > bestScore && similarity > 0.5) {
                    bestScore = similarity;
                    bestMatch = intentName;
                }
            }
        }

        // Se não encontrou match, verificar contexto anterior
        if (!bestMatch || bestScore < 0.6) {
            const context = this.conversationContext.get(userId);
            if (context && this.isContextualResponse(normalized, context)) {
                bestMatch = this.getContextualIntent(normalized, context);
                bestScore = 0.7;
            }
        }

        return {
            intent: bestMatch || 'unknown',
            confidence: bestScore,
            normalized
        };
    }

    // Verificar se é resposta contextual
    isContextualResponse(text, context) {
        const affirmative = ['sim', 's', 'quero', 'vamos', 'ok', 'aceito', 'claro'];
        const negative = ['nao', 'não', 'n', 'depois', 'agora nao'];

        return affirmative.some(w => text.includes(w)) ||
               negative.some(w => text.includes(w));
    }

    // Obter intent baseado no contexto
    getContextualIntent(text, context) {
        const affirmative = ['sim', 's', 'quero', 'vamos', 'ok', 'aceito'];

        if (affirmative.some(w => text.includes(w))) {
            if (context === 'services') return 'interested';
            if (context === 'pricing') return 'interested';
        }

        return 'menu';
    }

    // Extrair entidades (nome, email, telefone, etc)
    extractEntities(text) {
        const entities = {};

        // Email
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const emailMatch = text.match(emailRegex);
        if (emailMatch) {
            entities.email = emailMatch[0];
        }

        // Telefone
        const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/;
        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch) {
            entities.phone = phoneMatch[0].replace(/\D/g, '');
        }

        // Nome (heurística simples: 2+ palavras capitalizadas)
        const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/;
        const nameMatch = text.match(nameRegex);
        if (nameMatch) {
            entities.name = nameMatch[0];
        }

        return entities;
    }

    // Detectar urgência
    detectUrgency(text) {
        const normalized = this.normalize(text);
        return contextKeywords.urgency.some(keyword =>
            normalized.includes(keyword)
        );
    }

    // Detectar menção a orçamento
    detectBudgetConcern(text) {
        const normalized = this.normalize(text);
        return contextKeywords.budget.some(keyword =>
            normalized.includes(keyword)
        );
    }

    // Processar mensagem completa
    async analyze(text, userId) {
        // Identificar intent
        const { intent, confidence, normalized } = this.identifyIntent(text, userId);

        // Extrair entidades
        const entities = this.extractEntities(text);

        // Detectar contexto
        const isUrgent = this.detectUrgency(text);
        const budgetConcern = this.detectBudgetConcern(text);

        // Obter resposta
        const response = this.getResponse(intent, userId);

        // Atualizar contexto
        if (intents[intent]?.context) {
            this.conversationContext.set(userId, intents[intent].context);
        }

        // Atualizar sessão
        this.updateSession(userId, {
            lastIntent: intent,
            lastMessage: text,
            timestamp: Date.now()
        });

        return {
            intent,
            confidence,
            response,
            entities,
            context: {
                isUrgent,
                budgetConcern
            },
            shouldCollectData: intents[intent]?.collectData || false
        };
    }

    // Obter resposta para intent
    getResponse(intent, userId) {
        const intentData = intents[intent];

        if (!intentData) {
            return this.getDefaultResponse();
        }

        // Se tem múltiplas respostas, escolher aleatória
        if (Array.isArray(intentData.responses)) {
            const randomIndex = Math.floor(Math.random() * intentData.responses.length);
            return intentData.responses[randomIndex];
        }

        return intentData.responses;
    }

    // Resposta padrão
    getDefaultResponse() {
        return `Desculpe, não entendi muito bem. 😅

Digite *menu* para ver todas as opções de serviços!

Ou me conte: o que você está procurando?`;
    }

    // Atualizar sessão do usuário
    updateSession(userId, data) {
        const session = this.userSessions.get(userId) || {
            messages: [],
            startTime: Date.now()
        };

        session.messages.push(data);
        session.lastActivity = Date.now();

        this.userSessions.set(userId, session);
    }

    // Obter sessão do usuário
    getSession(userId) {
        return this.userSessions.get(userId);
    }

    // Limpar sessões antigas (mais de 30 minutos inativas)
    cleanOldSessions() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutos

        for (const [userId, session] of this.userSessions.entries()) {
            if (now - session.lastActivity > timeout) {
                this.userSessions.delete(userId);
                this.conversationContext.delete(userId);
            }
        }
    }
}

// Singleton
const nlpAnalyzer = new NLPAnalyzer();

// Limpar sessões antigas a cada 5 minutos
setInterval(() => {
    nlpAnalyzer.cleanOldSessions();
}, 5 * 60 * 1000);

module.exports = nlpAnalyzer;
