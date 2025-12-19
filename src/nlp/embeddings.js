const path = require('path');
const fs = require('fs');

class EmbeddingsManager {
    constructor() {
        this.model = null;
        this.tokenizer = null;
        this.intentEmbeddings = new Map();
        this.isReady = false;
        this.embeddingsCachePath = path.join(process.cwd(), 'data', 'embeddings-cache.json');
    }

    async initialize() {
        if (this.isReady) return;

        console.log('🧠 Carregando modelo de embeddings...');

        try {
            const { pipeline } = await import('@xenova/transformers');
            
            this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true
            });

            console.log('✅ Modelo carregado com sucesso');

            if (this.loadCachedEmbeddings()) {
                console.log('✅ Embeddings carregados do cache');
            } else {
                await this.generateIntentEmbeddings();
                this.saveCachedEmbeddings();
            }

            this.isReady = true;
        } catch (error) {
            console.error('❌ Erro ao carregar modelo:', error.message);
            throw error;
        }
    }

    async getEmbedding(text) {
        if (!this.extractor) {
            throw new Error('Modelo não inicializado');
        }

        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    async generateIntentEmbeddings() {
        const { intents } = require('./intents.js');

        console.log('📊 Gerando embeddings para intents...');

        for (const [intentName, intentData] of Object.entries(intents)) {
            if (!intentData.patterns || intentData.patterns.length === 0) continue;

            const patternEmbeddings = [];

            for (const pattern of intentData.patterns) {
                const embedding = await this.getEmbedding(pattern);
                patternEmbeddings.push({
                    pattern,
                    embedding
                });
            }

            this.intentEmbeddings.set(intentName, {
                patterns: patternEmbeddings,
                priority: intentData.priority || 1
            });

            console.log(`   ✓ ${intentName}: ${patternEmbeddings.length} patterns`);
        }

        console.log('✅ Embeddings gerados com sucesso');
    }

    loadCachedEmbeddings() {
        try {
            if (!fs.existsSync(this.embeddingsCachePath)) {
                return false;
            }

            const cached = JSON.parse(fs.readFileSync(this.embeddingsCachePath, 'utf8'));
            
            const { intents } = require('./intents.js');
            const currentPatterns = JSON.stringify(
                Object.entries(intents).map(([k, v]) => [k, v.patterns])
            );
            
            if (cached.patternsHash !== this.hashString(currentPatterns)) {
                console.log('⚠️  Intents modificados, regenerando embeddings...');
                return false;
            }

            for (const [intentName, data] of Object.entries(cached.embeddings)) {
                this.intentEmbeddings.set(intentName, data);
            }

            return true;
        } catch (error) {
            console.log('⚠️  Erro ao carregar cache:', error.message);
            return false;
        }
    }

    saveCachedEmbeddings() {
        try {
            const dir = path.dirname(this.embeddingsCachePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const { intents } = require('./intents.js');
            const currentPatterns = JSON.stringify(
                Object.entries(intents).map(([k, v]) => [k, v.patterns])
            );

            const cache = {
                patternsHash: this.hashString(currentPatterns),
                generatedAt: new Date().toISOString(),
                embeddings: Object.fromEntries(this.intentEmbeddings)
            };

            fs.writeFileSync(this.embeddingsCachePath, JSON.stringify(cache));
            console.log('💾 Embeddings salvos em cache');
        } catch (error) {
            console.log('⚠️  Erro ao salvar cache:', error.message);
        }
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (normA * normB);
    }

    async findBestIntent(text) {
        if (!this.isReady) {
            await this.initialize();
        }

        const inputEmbedding = await this.getEmbedding(text.toLowerCase());

        let bestIntent = null;
        let bestScore = 0;
        let bestPattern = null;

        for (const [intentName, intentData] of this.intentEmbeddings.entries()) {
            for (const { pattern, embedding } of intentData.patterns) {
                const similarity = this.cosineSimilarity(inputEmbedding, embedding);
                
                const priorityBonus = (intentData.priority || 1) * 0.02;
                const adjustedScore = similarity + priorityBonus;

                if (adjustedScore > bestScore) {
                    bestScore = adjustedScore;
                    bestIntent = intentName;
                    bestPattern = pattern;
                }
            }
        }

        return {
            intent: bestIntent,
            confidence: Math.min(bestScore, 1.0),
            matchedPattern: bestPattern
        };
    }
}

const embeddingsManager = new EmbeddingsManager();

module.exports = embeddingsManager;
