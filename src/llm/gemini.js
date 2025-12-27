// FILE: src/llm/gemini.js
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

class ConversationMemory {
  constructor() {
    this.conversations = new Map();
    this.maxHistory = 15;
  }

  get(id) {
    let conv = this.conversations.get(id);
    if (!conv) {
      conv = {
        id,
        history: [],
        context: {
          name: null,
          interest: null,
          business: null,
          stage: 'inicio',
          sentPrices: false,
          messageCount: 0,
          userStyle: { formal: 0.5 },
          lastMediaType: null,
          lastAudioSent: 0,
          notes: []
        },
        lastActivity: Date.now()
      };
      this.conversations.set(id, conv);
    }
    return conv;
  }

  addMessage(id, role, content, mediaType = null) {
    const conv = this.get(id);
    conv.history.push({ role, content, mediaType, ts: Date.now() });
    if (conv.history.length > this.maxHistory) {
      conv.history = conv.history.slice(-this.maxHistory);
    }
    conv.lastActivity = Date.now();
    conv.context.messageCount++;
    if (mediaType) conv.context.lastMediaType = mediaType;
    
    if (role === 'user') {
      const t = (content || '').toLowerCase();
      const ctx = conv.context;
      ctx.userStyle.formal = /senhor|prezado|poderia|gostaria/i.test(t) ? 0.8 : 
                             /vc|tb|pq|blz|vlw|kk/i.test(t) ? 0.2 : ctx.userStyle.formal;
    }
  }

  addNote(id, note) {
    const conv = this.get(id);
    conv.context.notes.push({ text: note, ts: Date.now() });
    if (conv.context.notes.length > 10) conv.context.notes.shift();
  }

  cleanup() {
    const now = Date.now();
    for (const [id, conv] of this.conversations) {
      if (now - conv.lastActivity > 7 * 24 * 60 * 60 * 1000) {
        this.conversations.delete(id);
      }
    }
  }
}

const memory = new ConversationMemory();
setInterval(() => memory.cleanup(), 60 * 60 * 1000);

// Parse mime type para extrair parâmetros
function parseMimeType(mimeType) {
  // audio/L16;codec=pcm;rate=24000
  const parts = mimeType.split(';');
  const base = parts[0].trim();
  const params = {};
  
  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].trim().split('=');
    if (key && value) params[key] = value;
  }
  
  return { base, params };
}

// Converter áudio para OGG Opus (formato WhatsApp)
async function convertToOpus(inputBuffer, inputMimeType = 'audio/mp3') {
  return new Promise((resolve, reject) => {
    const { base, params } = parseMimeType(inputMimeType);
    
    // Construir argumentos do FFmpeg baseado no formato de entrada
    const inputArgs = [];
    
    if (base === 'audio/L16' || base === 'audio/pcm' || params.codec === 'pcm') {
      // PCM raw precisa de parâmetros específicos
      const rate = params.rate || '24000';
      inputArgs.push(
        '-f', 's16le',           // 16-bit signed little-endian PCM
        '-ar', rate,             // Sample rate
        '-ac', '1',              // Mono
        '-i', 'pipe:0'
      );
    } else if (base === 'audio/wav' || base === 'audio/wave') {
      inputArgs.push('-i', 'pipe:0');
    } else if (base === 'audio/mp3' || base === 'audio/mpeg') {
      inputArgs.push('-i', 'pipe:0');
    } else {
      // Genérico
      inputArgs.push('-i', 'pipe:0');
    }
    
    const outputArgs = [
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-ar', '48000',
      '-ac', '1',
      '-application', 'voip',
      '-f', 'ogg',
      'pipe:1'
    ];
    
    const ffmpegArgs = [...inputArgs, ...outputArgs];
    
    console.log(`   [FFmpeg] Args: ${ffmpegArgs.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    const chunks = [];
    let errorData = '';

    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', data => errorData += data.toString());
    
    ffmpeg.on('close', code => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        // Log apenas as últimas linhas do erro
        const errorLines = errorData.split('\n').slice(-5).join('\n');
        reject(new Error(`FFmpeg code ${code}: ${errorLines}`));
      }
    });

    ffmpeg.on('error', err => {
      reject(new Error(`FFmpeg spawn: ${err.message}`));
    });

    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}

class GeminiClient {
  constructor() {
    this.textApiKey = process.env.GEMINI_API_KEY || '';
    this.mediaApiKey = process.env.GEMINI_MEDIA_API_KEY || process.env.GEMINI_API_KEY || '';
    
    this.textModel = process.env.GEMINI_MODEL || 'gemma-3-27b-it';
    this.mediaModel = process.env.GEMINI_MEDIA_MODEL || 'gemini-2.0-flash-lite';
    this.imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation';
    this.ttsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.timeout = parseInt(process.env.GEMINI_TIMEOUT_MS) || 45000;
    this.temperature = parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7;
    this.maxTokens = parseInt(process.env.GEMINI_MAX_TOKENS) || 200;
    
    this.audioChance = parseFloat(process.env.AUDIO_RESPONSE_CHANCE) || 0.15;
    this.audioMinInterval = parseInt(process.env.AUDIO_MIN_INTERVAL) || 5;
    
    this.isGemma = (model) => model.toLowerCase().includes('gemma');
    
    console.log(`   [Gemini] Texto: ${this.textModel} (${this.textApiKey ? '✅' : '❌'})`);
    console.log(`   [Gemini] Mídia: ${this.mediaModel} (${this.mediaApiKey ? '✅' : '❌'})`);
  }

  isConfigured() {
    return !!(this.textApiKey && this.textApiKey.length > 10);
  }

  isMediaConfigured() {
    return !!(this.mediaApiKey && this.mediaApiKey.length > 10);
  }

  getStatus() {
    return { 
      configured: this.isConfigured(), 
      mediaConfigured: this.isMediaConfigured(),
      model: this.textModel,
      mediaModel: this.mediaModel,
      imageModel: this.imageModel,
      ttsModel: this.ttsModel
    };
  }

  shouldSendAudio(chatId) {
    const conv = memory.get(chatId);
    const messagesSinceAudio = conv.context.messageCount - conv.context.lastAudioSent;
    if (messagesSinceAudio < this.audioMinInterval) return false;
    return Math.random() < this.audioChance;
  }

  markAudioSent(chatId) {
    const conv = memory.get(chatId);
    conv.context.lastAudioSent = conv.context.messageCount;
  }

  _buildPrompt(conv, mediaContext = null) {
    const ctx = conv.context;
    const style = ctx.userStyle.formal > 0.6 ? 'formal' : 'informal/casual';

    const info = [];
    if (ctx.name) info.push(`Cliente: ${ctx.name}`);
    if (ctx.business) info.push(`Negócio: ${ctx.business}`);
    if (ctx.interest) info.push(`Interesse: ${ctx.interest}`);
    if (ctx.sentPrices) info.push(`Já viu preços`);
    if (ctx.notes?.length) info.push(`Notas: ${ctx.notes.map(n => n.text).join('; ')}`);

    let mediaInstructions = '';
    if (mediaContext) {
      const mediaTypes = {
        image: 'O cliente enviou uma IMAGEM. Descreva brevemente o que vê e pergunte como pode ajudar.',
        audio: 'O cliente enviou um ÁUDIO (transcrito abaixo). Responda naturalmente ao que ele disse.',
        video: 'O cliente enviou um VÍDEO. Comente brevemente sobre o conteúdo.',
        document: 'O cliente enviou um DOCUMENTO. Pergunte do que se trata.',
        sticker: 'O cliente enviou um STICKER. Reaja de forma leve e amigável.',
        contact: 'O cliente compartilhou um CONTATO. Pergunte se quer que salve ou faça algo.',
        location: 'O cliente enviou uma LOCALIZAÇÃO. Pergunte se precisa de ajuda com algo.',
        poll: 'O cliente criou/respondeu uma ENQUETE. Comente naturalmente.'
      };
      mediaInstructions = mediaTypes[mediaContext.type] || '';
    }

    return `VOCÊ É LORD. Dono da agência Império Lord. NUNCA diga que é IA, modelo ou chatbot.

IDENTIDADE:
- Nome: Lord
- Empresa: Império Lord (agência de marketing digital)
- Você FAZ sites, lojas virtuais, tráfego pago, redes sociais

COMO FALAR:
- Brasileiro natural, ${style}
- Use: vc, tá, pra, né, tb, tipo, então
- Reações: "saquei", "entendi", "massa", "show", "beleza"
- Respostas CURTAS (1-3 frases)
- NUNCA use listas, bullets ou markdown
- UMA pergunta por vez no máximo

${mediaInstructions}

PREÇOS (quando perguntarem):
- Site/Landing: a partir de R$ 543/mês
- E-commerce: a partir de R$ 1.043/mês
- Premium: R$ 2.543/mês

${info.length ? 'CONTEXTO: ' + info.join(' | ') : ''}

REGRA: Você é Lord, humano real. JAMAIS mencione Google, IA ou treinamento.`;
  }

  async generate(userMessage, oderId, pushName = '', options = {}) {
    if (!this.isConfigured()) throw new Error('Gemini not configured');

    const { mediaType, mediaData, transcription } = options;
    const conv = memory.get(oderId);
    
    if (pushName && !conv.context.name) conv.context.name = pushName;

    const needsVision = mediaType && ['image', 'video'].includes(mediaType) && mediaData;
    const model = needsVision ? this.mediaModel : this.textModel;
    const apiKey = needsVision ? this.mediaApiKey : this.textApiKey;
    const useSystemInstruction = !this.isGemma(model);

    console.log(`   [Gemini] Usando: ${model}`);

    let mediaContext = null;
    let effectiveMessage = userMessage || '';

    if (mediaType) {
      mediaContext = { type: mediaType };
      
      if (mediaType === 'audio') {
        effectiveMessage = transcription || '[áudio não transcrito]';
      } else if (mediaType === 'contact' && options.contactInfo) {
        effectiveMessage = `[Contato: ${options.contactInfo.name} - ${options.contactInfo.number}]`;
      } else if (mediaType === 'location' && options.locationInfo) {
        effectiveMessage = `[Localização: ${options.locationInfo.name || 'Local'}]`;
      } else if (mediaType === 'poll' && options.pollInfo) {
        effectiveMessage = `[Enquete: ${options.pollInfo.name}]`;
      } else if (mediaType === 'sticker') {
        effectiveMessage = '[sticker]';
      } else if (mediaType === 'document') {
        effectiveMessage = '[documento]';
      } else if (!effectiveMessage) {
        effectiveMessage = `[${mediaType}]`;
      }
    }

    memory.addMessage(oderId, 'user', effectiveMessage, mediaType);
    this._updateContext(conv, effectiveMessage);

    const systemPrompt = this._buildPrompt(conv, mediaContext);
    const contents = [];
    const recentHistory = conv.history.slice(-8);
    
    if (!useSystemInstruction) {
      for (let i = 0; i < recentHistory.length; i++) {
        const msg = recentHistory[i];
        if (i === 0 && msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n---\nCliente: ${msg.content}` }]
          });
        } else {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
    } else {
      for (let i = 0; i < recentHistory.length; i++) {
        const msg = recentHistory[i];
        const parts = [];
        
        if (i === recentHistory.length - 1 && msg.role === 'user' && needsVision && mediaData) {
          parts.push({
            inlineData: {
              mimeType: options.mimetype || 'image/jpeg',
              data: mediaData.toString('base64')
            }
          });
        }
        
        parts.push({ text: msg.content || '[mídia]' });
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts });
      }
    }

    const body = {
      contents,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
        topP: 0.9,
        topK: 40
      }
    };

    if (useSystemInstruction) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API ${response.status}: ${err.slice(0, 150)}`);
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) throw new Error('Empty response');

      text = this._clean(text, conv);
      memory.addMessage(oderId, 'assistant', text);

      return [text];

    } catch (err) {
      clearTimeout(timeoutId);
      throw err.name === 'AbortError' ? new Error('Timeout') : err;
    }
  }

  async transcribeAudio(audioBuffer, mimetype = 'audio/ogg') {
    if (!this.isMediaConfigured()) throw new Error('Media API not configured');

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: mimetype, data: audioBuffer.toString('base64') } },
          { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito.' }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
    };

    const url = `${this.baseUrl}/models/${this.mediaModel}:generateContent?key=${this.mediaApiKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Transcription failed');

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (e) {
      console.error('   ⚠️ Transcrição:', e.message);
      return null;
    }
  }

  // Gerar áudio TTS
  async generateAudio(text, voice = 'Kore') {
    if (!this.isMediaConfigured()) throw new Error('Media API not configured');

    const voices = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'];
    const selectedVoice = voices.includes(voice) ? voice : 'Kore';

    const body = {
      contents: [{
        role: 'user',
        parts: [{ text }]
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: selectedVoice
            }
          }
        }
      }
    };

    const url = `${this.baseUrl}/models/${this.ttsModel}:generateContent?key=${this.mediaApiKey}`;
    
    try {
      console.log('   🔊 Gerando áudio TTS...');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`TTS failed: ${err.slice(0, 100)}`);
      }

      const data = await response.json();
      const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      
      if (!audioData) throw new Error('No audio data');

      const rawBuffer = Buffer.from(audioData.data, 'base64');
      const inputMime = audioData.mimeType || 'audio/mp3';
      
      console.log(`   🔄 Convertendo ${inputMime} para OGG Opus...`);
      
      try {
        const opusBuffer = await convertToOpus(rawBuffer, inputMime);
        console.log(`   ✅ Convertido: ${opusBuffer.length} bytes`);
        return {
          buffer: opusBuffer,
          mimetype: 'audio/ogg; codecs=opus'
        };
      } catch (convErr) {
        console.error('   ⚠️ Conversão:', convErr.message);
        return null;
      }
    } catch (e) {
      console.error('   ⚠️ TTS:', e.message);
      return null;
    }
  }

  // Gerar imagem
  async generateImageWithFlash(prompt) {
    if (!this.isMediaConfigured()) throw new Error('Media API not configured');

    const body = {
      contents: [{
        role: 'user',
        parts: [{ text: `Generate an image: ${prompt}` }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    const url = `${this.baseUrl}/models/${this.imageModel}:generateContent?key=${this.mediaApiKey}`;
    
    try {
      console.log('   🎨 Gerando imagem...');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Image failed: ${err.slice(0, 100)}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData);
      
      if (!imagePart) throw new Error('No image in response');

      return {
        buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
        mimetype: imagePart.inlineData.mimeType || 'image/png'
      };
    } catch (e) {
      console.error('   ⚠️ Image:', e.message);
      return null;
    }
  }

  _clean(text, conv) {
    let t = text.trim();

    t = t.replace(/\*\*(.*?)\*\*/g, '$1');
    t = t.replace(/\*(.*?)\*/g, '$1');
    t = t.replace(/```[\s\S]*?```/g, '');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/^#+\s*/gm, '');
    t = t.replace(/^\d+\.\s+/gm, '');
    t = t.replace(/^[-*•]\s+/gm, '');

    t = t.replace(/sou (um |uma )?(modelo|IA|inteligência artificial|assistente|chatbot).*/gi, 'sou o Lord, da Império Lord.');
    t = t.replace(/como (modelo|IA|assistente).*/gi, '');
    t = t.replace(/treinado (pelo |por )?Google.*/gi, '');
    t = t.replace(/modelo de linguagem.*/gi, '');

    t = t.replace(/^(Olá|Oi)!\s*(Tudo bem\??\s*)?(Como posso|Em que posso) ajudar?\??\s*/gi, '');
    t = t.replace(/^(Claro|Certamente|Com certeza)!\s*/gi, '');

    if (conv.context.userStyle.formal < 0.5) {
      t = t.replace(/\bvocê\b/gi, 'vc');
      t = t.replace(/\bestá\b/gi, 'tá');
      t = t.replace(/\bpara\b/gi, 'pra');
    }

    if (t.length < 5) t = 'opa, pode repetir?';
    if (t.length > 400) {
      const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
      t = sentences.slice(0, 3).join(' ').trim();
    }

    return t;
  }

  _updateContext(conv, msg) {
    const u = (msg || '').toLowerCase();
    const ctx = conv.context;

    if (/informática|computador|notebook|tecnologia/i.test(u)) ctx.business = 'informática';
    else if (/roupa|moda|vestuário/i.test(u)) ctx.business = 'moda';
    else if (/comida|restaurante|delivery/i.test(u)) ctx.business = 'alimentação';

    if (/site|página|web/i.test(u) && !/loja|ecommerce/i.test(u)) ctx.interest = 'site';
    else if (/landing/i.test(u)) ctx.interest = 'landing';
    else if (/loja|ecommerce|e-commerce/i.test(u)) ctx.interest = 'ecommerce';
    else if (/tráfego|trafego|ads/i.test(u)) ctx.interest = 'trafego';

    if (/pre[çc]o|valor|quanto|cobram|tabela/i.test(u)) {
      ctx.sentPrices = true;
      ctx.stage = 'negociando';
    }
  }
}

const gemini = new GeminiClient();
module.exports = gemini;
module.exports.memory = memory;