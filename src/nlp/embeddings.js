
// FILE: src/nlp/embeddings.js
const path = require('path');
const fs = require('fs');

class EmbeddingsManager {
    constructor() {
        this.extractor = null;
        this.intentEmbeddings = new Map();
        this.isReady = false;
        this.cachePath = path.join(process.cwd(), 'data', 'embeddings-cache.json');
    }

    async initialize() {
        if (this.isReady) return;

        console.log('🧠 Carregando modelo de embeddings...');

        try {
            const { pipeline } = await import('@xenova/transformers');
            
            this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true
            });

            console.log('✅ Modelo carregado');

            if (!this.loadCache()) {
                await this.generateEmbeddings();
                this.saveCache();
            }

            this.isReady = true;
        } catch (error) {
            console.error('❌ Erro ao carregar modelo:', error.message);
            throw error;
        }
    }

    async getEmbedding(text) {
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    async generateEmbeddings() {
        const { intents } = require('./intents.js');

        console.log('📊 Gerando embeddings...');

        for (const [name, data] of Object.entries(intents)) {
            if (!data.patterns || data.patterns.length === 0) continue;

            const patterns = [];
            for (const pattern of data.patterns) {
                const embedding = await this.getEmbedding(pattern);
                patterns.push({ pattern, embedding });
            }

            this.intentEmbeddings.set(name, {
                patterns,
                priority: data.priority || 1,
                servico: data.servico,
                categoria: data.categoria,
                subcategoria: data.subcategoria
            });
        }

        console.log(`✅ ${this.intentEmbeddings.size} intents processados`);
    }

    loadCache() {
        try {
            if (!fs.existsSync(this.cachePath)) return false;

            const cached = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
            const { intents } = require('./intents.js');
            
            const currentHash = this.hash(JSON.stringify(intents));
            
            if (cached.hash !== currentHash) {
                console.log('⚠️  Intents mudaram, regenerando...');
                return false;
            }

            for (const [name, data] of Object.entries(cached.embeddings)) {
                this.intentEmbeddings.set(name, data);
            }

            console.log('✅ Cache carregado');
            return true;
        } catch {
            return false;
        }
    }

    saveCache() {
        try {
            const dir = path.dirname(this.cachePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const { intents } = require('./intents.js');

            fs.writeFileSync(this.cachePath, JSON.stringify({
                hash: this.hash(JSON.stringify(intents)),
                embeddings: Object.fromEntries(this.intentEmbeddings)
            }));

            console.log('💾 Cache salvo');
        } catch {
            console.log('⚠️  Erro ao salvar cache');
        }
    }

    hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h = h & h;
        }
        return h.toString(16);
    }

    cosineSimilarity(a, b) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async findBestIntent(text) {
        if (!this.isReady) await this.initialize();

        const inputEmb = await this.getEmbedding(text.toLowerCase());

        let best = { intent: null, confidence: 0, data: null };

        for (const [name, data] of this.intentEmbeddings.entries()) {
            for (const { pattern, embedding } of data.patterns) {
                const sim = this.cosineSimilarity(inputEmb, embedding);
                const score = sim + (data.priority || 1) * 0.015;

                if (score > best.confidence) {
                    best = { intent: name, confidence: Math.min(score, 1.0), data };
                }
            }
        }

        return best;
    }
}

module.exports = new EmbeddingsManager();
