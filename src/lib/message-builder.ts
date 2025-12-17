// FILE: src/lib/message-builder.ts

import { db, getTemplatesByIntent } from '../server/db';

export function buildMessage(intent: string, context: Record<string, any>): string {
  const templates = getTemplatesByIntent(intent) as any[];
  
  if (templates.length === 0) {
    return 'Desculpa, tive um problema aqui. Pode repetir? 😅';
  }

  // Pegar template aleatório
  const template = templates[Math.floor(Math.random() * templates.length)];
  const variations = JSON.parse(template.variations) as string[];
  let message = variations[Math.floor(Math.random() * variations.length)];

  // Substituir variáveis
  message = message.replace(/\{(\w+)\}/g, (match, key) => {
    if (key === 'nome' && context.nome) {
      return context.nome;
    }
    if (key === 'dados') {
      return formatContextData(context);
    }
    return context[key] || match;
  });

  return message;
}

function formatContextData(context: Record<string, any>): string {
  const parts: string[] = [];

  if (context.nome) parts.push(`👤 Nome: ${context.nome}`);
  if (context.empresa) parts.push(`🏢 Empresa: ${context.empresa}`);
  if (context.cidade) parts.push(`📍 Cidade: ${context.cidade}`);
  if (context.servico_interesse) parts.push(`🎯 Serviço: ${context.servico_interesse}`);
  if (context.orcamento) parts.push(`💰 Orçamento: ${context.orcamento}`);
  if (context.prazo) parts.push(`⏰ Prazo: ${context.prazo}`);

  return parts.join('\n');
}

export function getNextState(currentState: string, intent: string, context: Record<string, any>): string {
  const stateMap: Record<string, Record<string, string>> = {
    initial: {
      saudacao: 'saudado',
      trafego_interesse: 'coleta_dados',
      criativo_interesse: 'coleta_dados',
      social_interesse: 'coleta_dados',
      site_interesse: 'coleta_dados',
      menu: 'menu_mostrado',
      handoff: 'handoff',
    },
    saudado: {
      trafego_interesse: 'coleta_dados',
      criativo_interesse: 'coleta_dados',
      social_interesse: 'coleta_dados',
      site_interesse: 'coleta_dados',
      menu: 'menu_mostrado',
    },
    menu_mostrado: {
      trafego_interesse: 'coleta_dados',
      criativo_interesse: 'coleta_dados',
      social_interesse: 'coleta_dados',
      site_interesse: 'coleta_dados',
    },
    coleta_dados: {
      confirma: context.nome && context.empresa ? 'agendamento' : 'coleta_dados',
      nega: 'coleta_dados',
    },
    agendamento: {
      confirma: 'finalizado',
    },
  };

  return stateMap[currentState]?.[intent] || currentState;
}

export function shouldCollectData(context: Record<string, any>): { field: string; intent: string } | null {
  if (!context.nome) return { field: 'nome', intent: 'coleta_nome' };
  if (!context.empresa) return { field: 'empresa', intent: 'coleta_empresa' };
  if (context.servico_interesse && !context.orcamento) {
    return { field: 'orcamento', intent: 'coleta_orcamento' };
  }
  return null;
}