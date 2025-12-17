// FILE: src/lib/nlp-engine.ts

import natural from 'natural';

const tokenizer = new natural.WordTokenizer();
const classifier = new natural.BayesClassifier();

// Treinar classificador com intenções em português
const trainingData = [
  // Saudações
  { text: 'oi', intent: 'saudacao' },
  { text: 'olá', intent: 'saudacao' },
  { text: 'ola', intent: 'saudacao' },
  { text: 'bom dia', intent: 'saudacao' },
  { text: 'boa tarde', intent: 'saudacao' },
  { text: 'boa noite', intent: 'saudacao' },
  { text: 'e ai', intent: 'saudacao' },
  
  // Tráfego
  { text: 'quero anunciar', intent: 'trafego_interesse' },
  { text: 'preciso de tráfego', intent: 'trafego_interesse' },
  { text: 'meta ads', intent: 'trafego_interesse' },
  { text: 'google ads', intent: 'trafego_interesse' },
  { text: 'facebook ads', intent: 'trafego_interesse' },
  { text: 'anúncios', intent: 'trafego_interesse' },
  { text: 'campanhas', intent: 'trafego_interesse' },
  
  // Criativos
  { text: 'preciso de criativos', intent: 'criativo_interesse' },
  { text: 'fazer artes', intent: 'criativo_interesse' },
  { text: 'design', intent: 'criativo_interesse' },
  { text: 'vídeos', intent: 'criativo_interesse' },
  { text: 'banners', intent: 'criativo_interesse' },
  
  // Social Media
  { text: 'instagram parado', intent: 'social_interesse' },
  { text: 'social media', intent: 'social_interesse' },
  { text: 'redes sociais', intent: 'social_interesse' },
  { text: 'postar', intent: 'social_interesse' },
  
  // Site
  { text: 'preciso de site', intent: 'site_interesse' },
  { text: 'landing page', intent: 'site_interesse' },
  { text: 'criar site', intent: 'site_interesse' },
  
  // Valores
  { text: 'quanto custa', intent: 'valores' },
  { text: 'preço', intent: 'valores' },
  { text: 'valor', intent: 'valores' },
  { text: 'investimento', intent: 'valores' },
  
  // Atendente
  { text: 'quero falar com humano', intent: 'handoff' },
  { text: 'atendente', intent: 'handoff' },
  { text: 'pessoa', intent: 'handoff' },
  
  // Menu
  { text: 'menu', intent: 'menu' },
  { text: 'opções', intent: 'menu' },
  { text: 'o que vocês fazem', intent: 'menu' },
  
  // Confirmação
  { text: 'sim', intent: 'confirma' },
  { text: 'correto', intent: 'confirma' },
  { text: 'isso mesmo', intent: 'confirma' },
  { text: 'confirmado', intent: 'confirma' },
  
  // Negação
  { text: 'não', intent: 'nega' },
  { text: 'nao', intent: 'nega' },
  { text: 'errado', intent: 'nega' },
];

// Treinar
for (const data of trainingData) {
  classifier.addDocument(data.text, data.intent);
}
classifier.train();

export interface NLPResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  normalized: string;
}

export function analyzeMessage(message: string): NLPResult {
  const normalized = message.toLowerCase().trim();
  const tokens = tokenizer.tokenize(normalized);

  // Classificar intenção
  const classifications = classifier.getClassifications(normalized);
  const topIntent = classifications[0];

  // Extrair entidades
  const entities = extractEntities(normalized, tokens || []);

  return {
    intent: topIntent.label,
    confidence: topIntent.value,
    entities,
    normalized
  };
}

function extractEntities(text: string, tokens: string[]): Record<string, any> {
  const entities: Record<string, any> = {};

  // Extrair números
  const numbers = text.match(/\d+/g);
  if (numbers) {
    entities.numbers = numbers.map(n => parseInt(n));
  }

  // Detectar valores monetários
  const moneyRegex = /(?:r\$|reais?)\s*(\d+(?:[.,]\d+)?)/i;
  const moneyMatch = text.match(moneyRegex);
  if (moneyMatch) {
    entities.orcamento = moneyMatch[1];
  }

  // Detectar email
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    entities.email = emailMatch[0];
  }

  // Detectar possível nome (primeira palavra capitalizada)
  const nameRegex = /\b[A-Z][a-zà-ú]+\b/;
  const nameMatch = text.match(nameRegex);
  if (nameMatch) {
    entities.possivelNome = nameMatch[0];
  }

  // Detectar urgência
  if (text.includes('urgente') || text.includes('rápido') || text.includes('hoje')) {
    entities.urgencia = 'alta';
  } else if (text.includes('sem pressa') || text.includes('futuro')) {
    entities.urgencia = 'baixa';
  }

  return entities;
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}