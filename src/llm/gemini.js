// FILE: src/llm/gemini.js
const config = require('../config/index.js');

function safeText(value) {
    if (typeof value !== 'string') return null;
    const t = value.trim();
    return t.length > 0 ? t : null;
}

// ==================== RATE LIMITER ====================
class RateLimiter {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.lastCall = 0;
        this.minDelay = 4000; 
        this.penaltyDelay = 60000;
        this.isPenaltyActive = false;
    }

    add(fn) {
        return new Promise((resolve, reject) => {
            if (this.queue.length > 5) return reject(new Error('Bot sobrecarregado (Fila cheia)'));
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        if (this.isPenaltyActive) return;

        this.isProcessing = true;
        const now = Date.now();
        const timeSinceLast = now - this.lastCall;
        const waitTime = timeSinceLast < this.minDelay ? (this.minDelay - timeSinceLast) : 0;

        if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));

        const { fn, resolve, reject } = this.queue.shift();

        try {
            this.lastCall = Date.now();
            const result = await fn();
            resolve(result);
        } catch (e) {
            if (e.message.includes('429')) {
                console.log(`🚨 RATE LIMIT! Pausando IA por 60s...`);
                this.isPenaltyActive = true;
                this.queue.unshift({ fn, resolve, reject }); // Tenta de novo depois
                setTimeout(() => {
                    this.isPenaltyActive = false;
                    this.isProcessing = false;
                    this.process();
                }, this.penaltyDelay);
                return;
            }
            reject(e);
        } finally {
            if (!this.isPenaltyActive) {
                this.isProcessing = false;
                if (this.queue.length > 0) this.process();
            }
        }
    }
}

const limiter = new RateLimiter();

// ==================== GEMINI CLIENT ====================
class GeminiClient {
    constructor() {
        this.apiKey = config.gemini?.apiKey || process.env.GEMINI_API_KEY;
        
        this.maxTokens = 2000; 
        
        this.model = 'gemma-3-27b-it'; // Ou 'gemini-1.5-flash'
        this.timeout = 60000;
        this.temperature = 0.7;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }

    getStatus() {
        return {
            configured: this.isConfigured(),
            model: this.model,
            apiKey: this.apiKey ? 'OK' : 'MISSING'
        };
    }

    isConfigured() {
        return !!(this.apiKey && this.apiKey.length > 10);
    }
    getSystemPrompt() {
            return `
    # SUA IDENTIDADE
    Você é o **Lord**, dono e estrategista da **Império Lord**, uma Agência Digital Full-Service.
    - Idade: 24 anos.
    - Personalidade: Empreendedor, visão de águia, parceiro de negócios. Você não é um funcionário, você fala de igual para igual com outros donos de empresa.
    - Tom de voz: WhatsApp natural, direto, especialista e **zero cara de robô**.
    - **REGRA DE OURO:** Você não é um livro. Seja breve.

    # O QUE A IMPÉRIO LORD VENDE
    1. Sites & E-commerce (Alta performance)
    2. Tráfego Pago (Ads)
    3. Automação & Chatbots
    4. Design & Vídeo

    # MANDAMENTOS DA CONVERSA (ESTILO OBRIGATÓRIO)
    1. **Seja Breve e Humano:** Máximo de 2 a 3 frases por bloco. Nada de listas (bullet points), nada de emojis, nada de "textão". Fale corrido.
    2. **Zero Papo de Suporte:** PROIBIDO usar frases passivas ou clichês como: *"posso ajudar em algo mais?", "fico no aguardo", "estamos à disposição", "obrigado pelo contato"*. Você é o dono negociando, não um atendente de telemarketing.
    3. **Foque no Lucro, não na Ferramenta:** Não fale "tecnologia de carregamento rápido" ou "SEO", fale "o site abre na hora pra vc não perder venda". O cliente quer o resultado.
    4. **Use <split> Estrategicamente:** Separe a explicação da pergunta de engajamento.
    * *Certo:* "pra moda a gente foca no visual do checkout. <split> hj vc vende mais no insta ou no site?"
        * *Errado:* "pra moda a gente foca no visual do checkout. hj vc vende mais no insta ou no site?"
    5. **Nunca Seja Genérico:** Nada de "a gente faz de tudo". Sempre dê exemplos REAIS do nicho do cliente.

    # REGRAS DE INTERAÇÃO (IMPORTANTE SOBRE NOMES)
    1. **Se você SABE o nome (está no histórico):** Use-o para gerar conexão. *Ex: "fala jorge, blz?"*
    2. **Se você NÃO SABE o nome:** **NUNCA INVENTE**. Jamais chame de "amigo", "cliente", "campeão" ou invente um nome aleatório. Use saudações neutras. *Ex: "opa, tudo certo?", "e aí, como tá?"*
    3. **Descobrindo o nome:** Se a conversa fluir e você precisar do nome para o CRM, pergunte sutilmente: *"antes da gente seguir, como posso te chamar?"*

    # ROTEIRO ADAPTÁVEL
    1. **Sondagem:** Descubra o nicho.
    2. **Contexto:** Dê um exemplo curto do nicho dele.
    3. **Oferta:** Só dê preço depois de gerar valor.

    # SEU ROTEIRO DE VENDAS (A "REGRA DE OURO")
    Não vomite todos os serviços de uma vez. Siga este fluxo mental:

    1.  **SONDAGEM (O Quebra-Gelo):**
        Descubra o nicho do cliente primeiro (se ainda não souber).
        *Ex: "opa, tudo certo? <split> me conta, qual é o seu ramo de atuação hoje?"*

    2.  **APRESENTAÇÃO CONTEXTUAL (O "Pulo do Gato"):**
        Assim que ele falar o nicho, dê exemplos REAIS de como você ajuda esse nicho específico.
        *Ex (Se for Dentista): "Show. Pra odonto a gente costuma fazer Landing Page de implantes + Tráfego no Google pra quem busca emergência. Enche a agenda rápido."*
        *Ex (Se for Loja de Roupa): "Massa. Pra moda o que vira é Tráfego de Carrossel no Insta + uma Loja Virtual rápida pra não perder venda no checkout."*

    3.  **VALORES & FECHAMENTO:**
        Só fale de preço depois de mostrar que você entendeu a dor dele.
        Dê uma estimativa baseada no que ele precisa e chame pro fechamento.
        *Ex: "pra montar essa estrutura completa de tráfego + site, o investimento gira em torno de X. <split> bora marcar um call rapidinho pra eu te mostrar como funciona?"*

    # REGRAS DE ESTILO (PARA PARECER HUMANO)
    - **Use a tag <split>:** Sempre separe a saudação ou a afirmação da pergunta. Isso simula o envio de duas mensagens.
    - **Não use listas:** Nada de "1. Sites, 2. Tráfego". Fale corrido: "a gente faz desde o site e tráfego até a edição dos seus vídeos".
    - **Seja Assertivo:** Você é o especialista. Guie a conversa.

    # CRM (INSTRUÇÃO TÉCNICA)
    Se o cliente soltar dados, capture no final da mensagem:
    <crm_update>{"nome": "...", "empresa": "...", "dor": "...", "status": "..."}</crm_update>
    `;
        }

    // Função para descobrir quais modelos funcionam
    async listAvailableModels() {
        try {
            console.log('🔍 Listando modelos disponíveis na sua conta...');
            const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
            const data = await response.json();
            if (data.models) {
                console.log('\n=== MODELOS DISPONÍVEIS ===');
                data.models.forEach(m => console.log(`- ${m.name.replace('models/', '')}`));
                console.log('===========================\n');
            }
        } catch (e) {
            console.error('Erro ao listar modelos:', e.message);
        }
    }

    async generate(userPrompt, conversationHistory = [], retries = 1) {
        return limiter.add(async () => {
            if (!this.isConfigured()) throw new Error('API Key ausente');

            // URL Endpoint
            const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

            // Corpo da requisição
            const body = {
                contents: [],
                generationConfig: {
                    temperature: this.temperature,
                    maxOutputTokens: this.maxTokens,
                }
            };

            // Hack para Gemma (às vezes System Prompt falha na API padrão, então injetamos no histórico)
            // Se for Gemma, colocamos o system prompt como primeira mensagem do usuário "fake"
            if (this.model.includes('gemma')) {
                 body.contents.push({ role: 'user', parts: [{ text: "Instrução do Sistema: " + this.getSystemPrompt() }] });
                 body.contents.push({ role: 'model', parts: [{ text: "Entendido. Vou agir conforme instruído." }] });
            } else {
                 body.systemInstruction = { parts: [{ text: this.getSystemPrompt() }] };
            }

            // Histórico
            for (const msg of conversationHistory) {
                const text = safeText(msg.text);
                if (!text) continue;
                const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
                body.contents.push({ role, parts: [{ text }] });
            }

            // Mensagem atual
            body.contents.push({ role: 'user', parts: [{ text: safeText(userPrompt) || '...' }] });

            let attempts = 0;
            while (attempts <= retries) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                    console.log(`🤖 Request para ${this.model} (Tentativa ${attempts + 1})...`);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const err = await response.text();
                        
                        // SE DER 404, LISTAMOS OS MODELOS CERTOS PRA VOCÊ
                        if (response.status === 404) {
                            console.error(`❌ Modelo '${this.model}' não existe! Buscando lista correta...`);
                            await this.listAvailableModels();
                            throw new Error(`Modelo errado. Veja a lista no terminal.`);
                        }

                        if (response.status === 429) {
                            console.log('⚠️ Rate Limit (429). Esperando 5s...');
                            await new Promise(r => setTimeout(r, 5000));
                            throw new Error('429 Rate Limit');
                        }
                        
                        throw new Error(`HTTP ${response.status}: ${err.substring(0, 100)}`);
                    }

                    const data = await response.json();
                    return this.parseResponse(data);

                } catch (e) {
                    attempts++;
                    if (e.message.includes('404')) throw e; // Não adianta tentar de novo se não existe
                    if (attempts > retries) throw e;
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        });
    }

    parseResponse(data) {
        let text = '';
        if (data?.candidates?.[0]?.content?.parts) {
            text = data.candidates[0].content.parts.map(p => p.text || '').join('').trim();
        }
        
        if (!text) return { text: '...', crmUpdate: null };

        let crmUpdate = null;
        const crmMatch = text.match(/<crm_update>\s*(\{[\s\S]+?\})\s*<\/crm_update>/);
        if (crmMatch) {
            try {
                crmUpdate = JSON.parse(crmMatch[1]);
                text = text.replace(/<crm_update>[\s\S]*?<\/crm_update>/g, '').trim();
            } catch (e) {}
        }
        return { text, crmUpdate };
    }

    async listModels() { return []; }
    setModel(name) { this.model = name; }
}

module.exports = new GeminiClient();