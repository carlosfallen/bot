// FILE: src/llm/gemini.js
/**
 * CLIENTE GEMINI REST - PARSING ROBUSTO
 */

const config = require('../config/index.js');

class GeminiClient {
    constructor() {
        this.apiKey = config.gemini.apiKey;
        this.model = config.gemini.model;
        this.timeout = config.gemini.timeout;
        this.temperature = config.gemini.temperature;
        this.maxTokens = config.gemini.maxTokens;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }

    isConfigured() {
        return !!(this.apiKey && this.apiKey.length > 10);
    }

    getStatus() {
        return {
            configured: this.isConfigured(),
            model: this.model,
            timeout: this.timeout,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
            apiKeyPreview: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NÃO CONFIGURADA'
        };
    }

    async listModels() {
        if (!this.isConfigured()) throw new Error('API Key não configurada');

        const url = `${this.baseUrl}/models?key=${this.apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const data = await response.json();
        
        return (data.models || [])
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => ({
                name: m.name.replace('models/', ''),
                displayName: m.displayName,
                inputTokenLimit: m.inputTokenLimit,
                outputTokenLimit: m.outputTokenLimit
            }));
    }

    setModel(modelName) {
        this.model = modelName;
    }

    async generate(systemPrompt, userPrompt, retries = 1) {
        if (!this.isConfigured()) {
            throw new Error('Gemini não configurado');
        }

        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

        // Combinar system + user prompt em uma única mensagem
        const combinedPrompt = `${systemPrompt}\n\n---\n\nMensagem do cliente:\n"${userPrompt}"\n\nResponda de forma curta e natural:`;

        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: combinedPrompt }]
                }
            ],
            generationConfig: {
                temperature: this.temperature,
                maxOutputTokens: this.maxTokens,
                topP: 0.95,
                topK: 40
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const startTime = Date.now();
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const latency = Date.now() - startTime;

            if (!response.ok) {
                const status = response.status;
                const errorBody = await response.text();
                
                if ((status === 429 || status >= 500) && retries > 0) {
                    await this.sleep(1000);
                    return this.generate(systemPrompt, userPrompt, retries - 1);
                }
                
                throw new Error(`HTTP ${status}: ${errorBody.substring(0, 300)}`);
            }

            const data = await response.json();
            
            // DEBUG: Log resposta bruta
            console.log('   📦 Gemini raw:', JSON.stringify(data).substring(0, 200));
            
            const result = this.parseResponse(data);
            result.latency = latency;
            
            return result;

        } catch (e) {
            clearTimeout(timeoutId);
            
            if (e.name === 'AbortError') {
                throw new Error(`Timeout (${this.timeout}ms)`);
            }
            
            if (retries > 0 && !e.message.includes('Timeout')) {
                await this.sleep(500);
                return this.generate(systemPrompt, userPrompt, retries - 1);
            }
            
            throw e;
        }
    }

    parseResponse(data) {
        // Verificar diferentes estruturas de resposta
        let text = '';

        // Estrutura padrão: candidates[0].content.parts[0].text
        if (data?.candidates?.[0]?.content?.parts) {
            const parts = data.candidates[0].content.parts;
            text = parts.map(p => p.text || '').join('').trim();
        }
        
        // Fallback: candidates[0].text (alguns modelos)
        if (!text && data?.candidates?.[0]?.text) {
            text = data.candidates[0].text;
        }

        // Fallback: response direto
        if (!text && data?.response) {
            text = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
        }

        // Fallback: text direto
        if (!text && data?.text) {
            text = data.text;
        }

        // Verificar se foi bloqueado por segurança
        if (!text && data?.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error('Resposta bloqueada por filtro de segurança');
        }

        // Verificar promptFeedback
        if (!text && data?.promptFeedback?.blockReason) {
            throw new Error(`Bloqueado: ${data.promptFeedback.blockReason}`);
        }

        if (!text) {
            console.log('   ⚠️ Resposta completa:', JSON.stringify(data));
            throw new Error('Resposta Gemini vazia');
        }

        // Limpar e processar texto
        text = this.cleanText(text);

        // Tentar extrair JSON se presente
        let parsed = null;
        try {
            const jsonMatch = text.match(/\{[\s\S]*"text"[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
                if (parsed.text) {
                    text = this.cleanText(parsed.text);
                }
            }
        } catch {}

        return {
            text,
            next_action: parsed?.next_action || 'none',
            topic: parsed?.topic || 'geral',
            raw: data?.candidates?.[0]?.content?.parts?.[0]?.text || text,
            parsed: !!parsed
        };
    }

    cleanText(text) {
        return text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/^\s*\{[\s\S]*"text"\s*:\s*"/m, '')
            .replace(/"\s*,?\s*"next_action"[\s\S]*$/m, '')
            .replace(/"\s*\}\s*$/m, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\s+|\s+$/g, '')
            .substring(0, 500);
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async testConnection() {
        const startTime = Date.now();
        
        try {
            const result = await this.generate(
                'Você é um assistente. Responda de forma curta.',
                'Diga apenas: Olá, estou funcionando!'
            );
            
            return {
                success: true,
                latency: Date.now() - startTime,
                response: result.text,
                raw: result.raw,
                parsed: result.parsed,
                model: this.model
            };
        } catch (e) {
            return {
                success: false,
                latency: Date.now() - startTime,
                error: e.message,
                model: this.model
            };
        }
    }
}

module.exports = new GeminiClient();