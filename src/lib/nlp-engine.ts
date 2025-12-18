// src/lib/nlp-engine-advanced.ts - VERSÃO SIMPLIFICADA (SEM COMPROMISE)

import natural from 'natural';

const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Treinar classificador com dados expandidos
const trainingData = [
  // Saudações
  { text: 'oi', intent: 'saudacao' },
  { text: 'olá', intent: 'saudacao' },
  { text: 'ola', intent: 'saudacao' },
  { text: 'bom dia', intent: 'saudacao' },
  { text: 'boa tarde', intent: 'saudacao' },
  { text: 'boa noite', intent: 'saudacao' },
  { text: 'e ai', intent: 'saudacao' },
  { text: 'opa', intent: 'saudacao' },
  { text: 'fala', intent: 'saudacao' },

  // Tráfego Pago
  { text: 'quero anunciar', intent: 'trafego_interesse' },
  { text: 'preciso de tráfego', intent: 'trafego_interesse' },
  { text: 'meta ads', intent: 'trafego_interesse' },
  { text: 'google ads', intent: 'trafego_interesse' },
  { text: 'facebook ads', intent: 'trafego_interesse' },
  { text: 'instagram ads', intent: 'trafego_interesse' },
  { text: 'tiktok ads', intent: 'trafego_interesse' },
  { text: 'anúncios', intent: 'trafego_interesse' },
  { text: 'campanhas', intent: 'trafego_interesse' },
  { text: 'tráfego pago', intent: 'trafego_interesse' },
  { text: 'divulgar', intent: 'trafego_interesse' },
  { text: 'alavancar vendas', intent: 'trafego_interesse' },
  { text: 'aumentar alcance', intent: 'trafego_interesse' },

  // Criativos
  { text: 'preciso de criativos', intent: 'criativo_interesse' },
  { text: 'fazer artes', intent: 'criativo_interesse' },
  { text: 'design', intent: 'criativo_interesse' },
  { text: 'vídeos', intent: 'criativo_interesse' },
  { text: 'banners', intent: 'criativo_interesse' },
  { text: 'imagens para anúncio', intent: 'criativo_interesse' },
  { text: 'criar artes', intent: 'criativo_interesse' },
  { text: 'identidade visual', intent: 'criativo_interesse' },
  { text: 'vídeos curtos', intent: 'criativo_interesse' },
  { text: 'reels', intent: 'criativo_interesse' },

  // Social Media
  { text: 'instagram parado', intent: 'social_interesse' },
  { text: 'social media', intent: 'social_interesse' },
  { text: 'redes sociais', intent: 'social_interesse' },
  { text: 'postar', intent: 'social_interesse' },
  { text: 'calendário editorial', intent: 'social_interesse' },
  { text: 'conteúdo', intent: 'social_interesse' },
  { text: 'gestão de redes', intent: 'social_interesse' },
  { text: 'copywriting', intent: 'social_interesse' },
  { text: 'engajamento', intent: 'social_interesse' },

  // Site / Landing Page
  { text: 'preciso de site', intent: 'site_interesse' },
  { text: 'landing page', intent: 'site_interesse' },
  { text: 'criar site', intent: 'site_interesse' },
  { text: 'página de captura', intent: 'site_interesse' },
  { text: 'site institucional', intent: 'site_interesse' },
  { text: 'refazer site', intent: 'site_interesse' },
  { text: 'lp', intent: 'site_interesse' },

  // Consultoria
  { text: 'consultoria', intent: 'consultoria_interesse' },
  { text: 'diagnóstico', intent: 'consultoria_interesse' },
  { text: 'análise', intent: 'consultoria_interesse' },
  { text: 'estratégia', intent: 'consultoria_interesse' },
  { text: 'planejamento', intent: 'consultoria_interesse' },
  { text: 'melhorar resultados', intent: 'consultoria_interesse' },

  // CRM / Funil
  { text: 'crm', intent: 'funil_interesse' },
  { text: 'funil de vendas', intent: 'funil_interesse' },
  { text: 'automação', intent: 'funil_interesse' },
  { text: 'captação de leads', intent: 'funil_interesse' },
  { text: 'qualificação de leads', intent: 'funil_interesse' },
  { text: 'nutrição de leads', intent: 'funil_interesse' },

  // Valores
  { text: 'quanto custa', intent: 'valores' },
  { text: 'preço', intent: 'valores' },
  { text: 'valor', intent: 'valores' },
  { text: 'investimento', intent: 'valores' },
  { text: 'orçamento', intent: 'valores' },
  { text: 'quanto é', intent: 'valores' },
  { text: 'tabela de preços', intent: 'valores' },

  // Atendente Humano
  { text: 'quero falar com humano', intent: 'handoff' },
  { text: 'atendente', intent: 'handoff' },
  { text: 'pessoa', intent: 'handoff' },
  { text: 'falar com alguém', intent: 'handoff' },
  { text: 'atendimento humano', intent: 'handoff' },
  { text: 'transferir', intent: 'handoff' },

  // Menu
  { text: 'menu', intent: 'menu' },
  { text: 'opções', intent: 'menu' },
  { text: 'o que vocês fazem', intent: 'menu' },
  { text: 'serviços', intent: 'menu' },
  { text: 'voltar', intent: 'menu' },
  { text: 'início', intent: 'menu' },

  // Confirmação
  { text: 'sim', intent: 'confirma' },
  { text: 'correto', intent: 'confirma' },
  { text: 'isso mesmo', intent: 'confirma' },
  { text: 'confirmado', intent: 'confirma' },
  { text: 'perfeito', intent: 'confirma' },
  { text: 'ok', intent: 'confirma' },
  { text: 'tá bom', intent: 'confirma' },
  { text: 'pode ser', intent: 'confirma' },

  // Negação
  { text: 'não', intent: 'nega' },
  { text: 'nao', intent: 'nega' },
  { text: 'errado', intent: 'nega' },
  { text: 'negativo', intent: 'nega' },
  { text: 'não é isso', intent: 'nega' },

  // Agradecimento
  { text: 'obrigado', intent: 'agradecimento' },
  { text: 'obrigada', intent: 'agradecimento' },
  { text: 'valeu', intent: 'agradecimento' },
  { text: 'muito obrigado', intent: 'agradecimento' },

  // Despedida
  { text: 'tchau', intent: 'despedida' },
  { text: 'até mais', intent: 'despedida' },
  { text: 'falou', intent: 'despedida' },
  { text: 'até logo', intent: 'despedida' },
];

// Treinar classificador
for (const data of trainingData) {
  classifier.addDocument(data.text, data.intent);
}
classifier.train();

export interface NLPResult {
  intent: string;
  confidence: number;
  entities: {
    nome?: string;
    email?: string;
    telefone?: string;
    empresa?: string;
    cidade?: string;
    estado?: string;
    orcamento?: number;
    urgencia?: 'alta' | 'media' | 'baixa';
    servico?: string;
    plataforma?: string;
    numbers?: number[];
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  normalized: string;
  keywords: string[];
}

export function analyzeMessage(message: string): NLPResult {
  const normalized = message.toLowerCase().trim();

  // Classificar intenção com Natural
  const classifications = classifier.getClassifications(normalized);
  const topIntent = classifications[0];

  // Extrair entidades
  const entities = extractEntities(normalized);

  // Análise de sentimento
  const sentiment = analyzeSentiment(normalized);

  // Extrair keywords
  const keywords = extractKeywords(normalized);

  return {
    intent: topIntent.label,
    confidence: topIntent.value,
    entities,
    sentiment,
    normalized,
    keywords
  };
}

function extractEntities(text: string): NLPResult['entities'] {
  const entities: NLPResult['entities'] = {};

  // Detectar valores monetários (R$, reais)
  const moneyRegex = /(?:r\$|reais?)\s*(\d+(?:[.,]\d+)?)/gi;
  let moneyMatch;
  while ((moneyMatch = moneyRegex.exec(text)) !== null) {
    const value = parseFloat(moneyMatch[1].replace(/\./g, '').replace(',', '.'));
    entities.orcamento = value;
  }

  // Detectar orçamento por extenso (mil, milhões)
  const milRegex = /(\d+)\s*mil/i;
  const milMatch = text.match(milRegex);
  if (milMatch) {
    entities.orcamento = parseInt(milMatch[1]) * 1000;
  }

  // Detectar email
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    entities.email = emailMatch[0];
  }

  // Detectar telefone brasileiro
  const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    entities.telefone = phoneMatch[0].replace(/\D/g, '');
  }

  // Detectar nome próprio (palavras capitalizadas)
  const nameRegex = /\b([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)\b/;
  const nameMatch = text.match(nameRegex);
  if (nameMatch) {
    entities.nome = nameMatch[1];
  }

  // Detectar empresa
  const empresaRegex = /(?:empresa|da|do|na|no)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)*)/;
  const empresaMatch = text.match(empresaRegex);
  if (empresaMatch) {
    entities.empresa = empresaMatch[1];
  }

  // Detectar urgência
  if (/(urgente|hoje|agora|já|imediato|rápido)/i.test(text)) {
    entities.urgencia = 'alta';
  } else if (/(sem pressa|futuro|próximo mês|daqui|depois)/i.test(text)) {
    entities.urgencia = 'baixa';
  } else {
    entities.urgencia = 'media';
  }

  // Detectar serviço mencionado
  const servicoMap: Record<string, string> = {
    'tráfego|anúncio|ads|campanha': 'Tráfego Pago',
    'criativo|arte|design|vídeo|banner': 'Criativos',
    'social|instagram|facebook|rede|post': 'Social Media',
    'site|landing|página|lp': 'Site/Landing Page',
    'crm|funil|lead|automação': 'CRM/Funil',
    'consultoria|diagnóstico|análise|estratégia': 'Consultoria',
  };

  for (const [pattern, servico] of Object.entries(servicoMap)) {
    if (new RegExp(pattern, 'i').test(text)) {
      entities.servico = servico;
      break;
    }
  }

  // Detectar plataforma
  const plataformaMap: Record<string, string> = {
    'meta|facebook|instagram': 'Meta (Facebook/Instagram)',
    'google|search|display': 'Google Ads',
    'tiktok': 'TikTok',
    'linkedin': 'LinkedIn',
  };

  for (const [pattern, plataforma] of Object.entries(plataformaMap)) {
    if (new RegExp(pattern, 'i').test(text)) {
      entities.plataforma = plataforma;
      break;
    }
  }

  // Extrair números
  const numbersRegex = /\d+/g;
  const numbers = text.match(numbersRegex);
  if (numbers) {
    entities.numbers = numbers.map(n => parseInt(n));
  }

  return entities;
}

function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = [
    'ótimo', 'bom', 'excelente', 'perfeito', 'legal', 'show', 'top',
    'maravilhoso', 'incrível', 'amo', 'adoro', 'gostei', 'obrigado'
  ];

  const negativeWords = [
    'ruim', 'péssimo', 'horrível', 'problema', 'erro', 'não funciona',
    'difícil', 'complicado', 'caro', 'demora', 'lento', 'não gostei'
  ];

  let score = 0;

  for (const word of positiveWords) {
    if (text.includes(word)) score++;
  }

  for (const word of negativeWords) {
    if (text.includes(word)) score--;
  }

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function extractKeywords(text: string): string[] {
  const tokens = tokenizer.tokenize(text) || [];
  
  // Palavras irrelevantes (stopwords)
  const stopwords = ['o', 'a', 'de', 'da', 'do', 'em', 'para', 'com', 'por', 'que', 'se', 'na', 'no'];
  
  const keywords = tokens
    .filter(word => word.length > 3)
    .filter(word => !stopwords.includes(word))
    .slice(0, 5);

  return keywords;
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  const minConfidence = parseFloat(process.env.MIN_CONFIDENCE || '0.6');

  if (confidence >= minConfidence + 0.2) return 'high';
  if (confidence >= minConfidence) return 'medium';
  return 'low';
}

export function shouldHandoff(nlp: NLPResult, context: Record<string, any>): boolean {
  if (nlp.intent === 'handoff') return true;
  if (nlp.confidence < 0.3 && context.tentativas_nao_entendeu >= 2) return true;
  if (nlp.sentiment === 'negative' && context.mensagens_negativas >= 2) return true;
  if (context.status === 'quente' && nlp.intent === 'valores') return true;
  return false;
}

export function qualifyLead(context: Record<string, any>): 'quente' | 'morno' | 'frio' {
  const minBudgetHot = parseInt(process.env.MIN_BUDGET_HOT || '3000');
  const minBudgetWarm = parseInt(process.env.MIN_BUDGET_WARM || '1000');

  let score = 0;

  if (context.orcamento >= minBudgetHot) score += 3;
  else if (context.orcamento >= minBudgetWarm) score += 2;
  else if (context.orcamento) score += 1;

  if (context.urgencia === 'alta') score += 2;
  else if (context.urgencia === 'media') score += 1;

  if (context.nome && context.empresa && context.cidade) score += 1;
  if (context.servico_interesse) score += 1;

  if (score >= 6) return 'quente';
  if (score >= 3) return 'morno';
  return 'frio';
}