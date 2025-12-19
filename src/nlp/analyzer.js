// FILE: src/nlp/analyzer.js
const { intents, contextKeywords } = require('./intents.js');
const embeddingsManager = require('./embeddings.js');

class NLPAnalyzer {
    constructor() {
        this.conversationContext = new Map();
        this.userSessions = new Map();
        this.pendingLeadData = new Map();
        this.useEmbeddings = true;
        this.embeddingsReady = false;
        this.similarityThreshold = 0.45;
    }

    async initializeEmbeddings() {
        if (this.embeddingsReady) return;

        try {
            await embeddingsManager.initialize();
            this.embeddingsReady = true;
            console.log('✅ NLP com embeddings ativo');
        } catch (error) {
            console.log('⚠️  Embeddings não disponível, usando fallback');
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

    async identifyIntent(text, userId) {
        const normalized = this.normalize(text);
        const context = this.conversationContext.get(userId);

        if (this.useEmbeddings && this.embeddingsReady) {
            const result = await embeddingsManager.findBestIntent(normalized);

            if (result.intent && result.confidence >= this.similarityThreshold) {
                console.log(`   📐 Embedding match: ${result.intent} (${(result.confidence * 100).toFixed(1)}%) - "${result.matchedPattern}"`);
                
                return {
                    intent: result.intent,
                    confidence: result.confidence,
                    normalized,
                    method: 'embeddings'
                };
            }
        }

        const fallbackResult = this.fallbackIdentify(normalized);

        if (context && (!fallbackResult.intent || fallbackResult.confidence < 0.6)) {
            const contextualIntent = this.resolveContextualIntent(normalized, context, userId);
            if (contextualIntent) {
                return {
                    intent: contextualIntent.intent,
                    confidence: contextualIntent.confidence,
                    normalized,
                    method: 'context'
                };
            }
        }

        if (this.isLeadInfoResponse(text, userId)) {
            return {
                intent: 'lead_info',
                confidence: 0.9,
                normalized,
                method: 'lead_capture'
            };
        }

        return {
            ...fallbackResult,
            normalized,
            method: 'fallback'
        };
    }

    fallbackIdentify(normalized) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [intentName, intentData] of Object.entries(intents)) {
            if (!intentData.patterns || intentData.patterns.length === 0) continue;

            for (const pattern of intentData.patterns) {
                const normalizedPattern = this.normalize(pattern);

                if (normalized.includes(normalizedPattern)) {
                    const lengthBonus = normalizedPattern.split(' ').length * 0.1;
                    const score = 0.8 + lengthBonus + (intentData.priority || 1) * 0.02;

                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = intentName;
                    }
                }
            }
        }

        return {
            intent: bestMatch || 'unknown',
            confidence: Math.min(bestScore, 1.0)
        };
    }

    resolveContextualIntent(text, context, userId) {
        const affirmativeWords = ['sim', 's', 'quero', 'ok', 'claro', 'aceito', 'isso', 'beleza', 'pode', 'bora'];
        const negativeWords = ['nao', 'não', 'n', 'depois', 'agora nao', 'agora não'];

        const isAffirmative = affirmativeWords.some(w => text.includes(w));
        const isNegative = negativeWords.some(w => text.includes(w));

        if (isAffirmative && !isNegative) {
            if (['services', 'pricing', 'portfolio'].includes(context)) {
                return { intent: 'interested', confidence: 0.85 };
            }
            return { intent: 'affirmative', confidence: 0.8 };
        }

        if (isNegative) {
            return { intent: 'negative', confidence: 0.85 };
        }

        return null;
    }

    isLeadInfoResponse(text, userId) {
        const context = this.conversationContext.get(userId);
        if (context !== 'lead_capture') return false;

        const lines = text.split('\n').filter(l => l.trim());
        const entities = this.extractEntities(text);

        return lines.length >= 2 || Object.keys(entities).length >= 1;
    }

    extractEntities(text) {
        const entities = {};

        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i;
        const emailMatch = text.match(emailRegex);
        if (emailMatch) {
            entities.email = emailMatch[0].toLowerCase();
        }

        const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/;
        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch) {
            entities.phone = phoneMatch[0].replace(/\D/g, '');
        }

        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        if (lines.length >= 1) {
            const firstLine = lines[0];
            if (!emailMatch || !firstLine.includes('@')) {
                if (!phoneMatch || !firstLine.match(/\d{4,}/)) {
                    if (firstLine.length > 1 && firstLine.length < 50) {
                        const cleanName = firstLine.replace(/[^\w\s]/g, '').trim();
                        if (cleanName && !cleanName.match(/^\d+$/)) {
                            entities.name = this.capitalizeWords(cleanName);
                        }
                    }
                }
            }
        }

        if (lines.length >= 2) {
            const secondLine = lines[1];
            if (!secondLine.includes('@') && !secondLine.match(/\d{4,}/)) {
                if (secondLine.length > 1 && secondLine.length < 50) {
                    entities.company = secondLine;
                }
            }
        }

        if (lines.length >= 3) {
            const thirdLine = lines[2].toLowerCase();
            const services = ['site', 'landing', 'trafego', 'tráfego', 'marketing', 'ecommerce', 'loja'];
            for (const service of services) {
                if (thirdLine.includes(service)) {
                    entities.service = thirdLine;
                    break;
                }
            }
            if (!entities.service && thirdLine.length > 2) {
                entities.service = thirdLine;
            }
        }

        return entities;
    }

    capitalizeWords(str) {
        return str.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    detectUrgency(text) {
        const normalized = this.normalize(text);
        return contextKeywords.urgency.some(keyword => normalized.includes(keyword));
    }

    detectBudgetConcern(text) {
        const normalized = this.normalize(text);
        return contextKeywords.budget.some(keyword => normalized.includes(keyword));
    }

    async analyze(text, userId) {
        if (!this.embeddingsReady && this.useEmbeddings) {
            await this.initializeEmbeddings();
        }

        const { intent, confidence, normalized, method } = await this.identifyIntent(text, userId);
        const entities = this.extractEntities(text);
        const isUrgent = this.detectUrgency(text);
        const budgetConcern = this.detectBudgetConcern(text);

        if (Object.keys(entities).length > 0) {
            const existing = this.pendingLeadData.get(userId) || {};
            this.pendingLeadData.set(userId, { ...existing, ...entities });
        }

        const response = this.getResponse(intent, userId, entities);

        if (intents[intent]?.context) {
            this.conversationContext.set(userId, intents[intent].context);
        }

        this.updateSession(userId, {
            lastIntent: intent,
            lastMessage: text,
            timestamp: Date.now()
        });

        const collectedEntities = this.pendingLeadData.get(userId) || {};
        const finalEntities = { ...collectedEntities, ...entities };

        return {
            intent,
            confidence,
            response,
            entities: finalEntities,
            context: {
                isUrgent,
                budgetConcern
            },
            method,
            shouldCollectData: intents[intent]?.collectData || Object.keys(entities).length > 0
        };
    }

    getResponse(intent, userId, entities) {
        const intentData = intents[intent];

        if (!intentData) {
            return this.getDefaultResponse();
        }

        if (intent === 'lead_info' && entities.name) {
            return `Anotado, ${entities.name}! Vou passar pro time e alguém entra em contato em breve.

Precisa de mais alguma coisa?`;
        }

        if (Array.isArray(intentData.responses)) {
            const randomIndex = Math.floor(Math.random() * intentData.responses.length);
            return intentData.responses[randomIndex];
        }

        return intentData.responses;
    }

    getDefaultResponse() {
        return `Não consegui entender direito. 😅

Me conta de outra forma o que você tá buscando, ou digita *menu* pra ver as opções.`;
    }

    updateSession(userId, data) {
        const session = this.userSessions.get(userId) || {
            messages: [],
            startTime: Date.now()
        };

        session.messages.push(data);
        session.lastActivity = Date.now();

        this.userSessions.set(userId, session);
    }

    getSession(userId) {
        return this.userSessions.get(userId);
    }

    cleanOldSessions() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000;

        for (const [userId, session] of this.userSessions.entries()) {
            if (now - session.lastActivity > timeout) {
                this.userSessions.delete(userId);
                this.conversationContext.delete(userId);
                this.pendingLeadData.delete(userId);
            }
        }
    }
}

const nlpAnalyzer = new NLPAnalyzer();

setInterval(() => {
    nlpAnalyzer.cleanOldSessions();
}, 5 * 60 * 1000);

module.exports = nlpAnalyzer;