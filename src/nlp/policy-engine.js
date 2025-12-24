// FILE: src/nlp/policy-engine.js

function normalizeText(t) {
  return String(t || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const CLOSE_RE = /\b(quero fechar|quero fechar agora|fechar|fechamos|manda o contrato|envia o contrato|gera o pix|gera o link|pode mandar o link|vou pagar|posso pagar|pago agora|fechou|bora fechar)\b/i;
const PAYMENT_RE = /\b(pix|cartao|cartão|credito|crédito|debito|débito|boleto|parcel|parcelar|parcelado|link de pagamento|qr code)\b/i;
const SCHEDULE_RE = /\b(agenda|agendar|horario|horário|meet|reuniao|reunião|call|videochamada|ligacao|ligação|marcar)\b/i;
const SUPPORT_RE = /\b(nao funciona|não funciona|erro|bug|travou|não consigo|nao consigo|problema|caiu|tá com erro|ta com erro|não abre|nao abre)\b/i;

function hasEssentialDealInfo(deal) {
  if (!deal) return false;
  const produto = deal.produto || null;
  const plano = deal.plano || null;
  const valor = typeof deal.valor === 'number' ? deal.valor : (deal.valor ? Number(deal.valor) : null);
  return !!(produto && plano && valor && valor > 0);
}

function missingEssentialDealFields(deal) {
  const missing = [];
  if (!deal?.produto) missing.push('produto');
  if (!deal?.plano) missing.push('plano');
  const v = typeof deal?.valor === 'number' ? deal.valor : (deal?.valor ? Number(deal.valor) : 0);
  if (!v || v <= 0) missing.push('valor');
  return missing;
}

/**
 * Decide o "modo" do bot sem LLM.
 * Retorna um objeto com:
 * - intent: close|payment|schedule|support|sales|unknown
 * - goal: objetivo do turno
 * - hardRules: trilhos determinísticos
 * - locks: flags úteis para travas
 */
function evaluatePolicy(text, ctx = {}) {
  const t = normalizeText(text);

  const lead = ctx.lead || {};
  const conversation = ctx.conversation || {};
  const deal = ctx.deal || null;

  const stage = conversation.stage || 'inicio';

  const isClose = CLOSE_RE.test(t) || stage === 'fechando';
  const isPayment = PAYMENT_RE.test(t) || deal?.status === 'waiting_payment';
  const isSchedule = SCHEDULE_RE.test(t);
  const isSupport = SUPPORT_RE.test(t);

  let intent = 'unknown';

  if (isSupport) intent = 'support';
  else if (isClose) intent = 'close';
  else if (isPayment) intent = 'payment';
  else if (isSchedule) intent = 'schedule';
  else intent = 'sales';

  const hardRules = {
    maxMessages: 2,
    maxQuestionsTotal: 1,
    forbidLists: true,
    forbidPitchLong: true,
    forbidAskingKnownFields: true,
    forbidDiscovery: false, // ativa em close
    allowOnlyNextStep: false, // ativa em stage fechando
    allowedTopics: null, // se preenchido, vira whitelist
  };

  const locks = {
    stopSelling: false,
    mustCloseNextStep: false,
    stageLock: null,
  };

  let goal = 'responder natural e avançar um passo.';

  if (intent === 'support') {
    goal = 'resolver o problema com objetividade e pedir 1 detalhe técnico se necessário.';
    hardRules.forbidDiscovery = true;
    locks.stopSelling = true;
  }

  if (intent === 'schedule') {
    goal = 'agendar uma call curta (10 min) sugerindo 2 horários e pedindo escolha.';
    hardRules.forbidDiscovery = true;
  }

  if (intent === 'payment') {
    goal = 'conduzir pagamento (pix/cartão) e confirmar o melhor formato.';
    hardRules.forbidDiscovery = true;
    locks.stopSelling = true;
  }

  if (intent === 'close') {
    locks.stopSelling = true;
    locks.mustCloseNextStep = true;
    locks.stageLock = 'fechando';

    const hasEssential = hasEssentialDealInfo(deal);
    const missing = missingEssentialDealFields(deal);

    if (hasEssential) {
      goal = 'cliente quer fechar: confirmar forma de pagamento (pix ou cartão) OU agendar call de 10 min.';
      hardRules.forbidDiscovery = true;
      hardRules.allowOnlyNextStep = true;
      hardRules.allowedTopics = ['pagamento', 'contrato', 'agenda'];
    } else {
      // reparo mínimo: só 1 dado essencial
      const ask = missing[0] || 'plano';
      if (ask === 'produto') goal = 'cliente quer fechar: destravar com 1 pergunta: qual produto/serviço (site, landing, tráfego, automação).';
      else if (ask === 'plano') goal = 'cliente quer fechar: destravar com 1 pergunta: qual plano (simples/completo/loja).';
      else goal = 'cliente quer fechar: destravar com 1 pergunta: qual investimento (faixa de valor) pra eu enviar pagamento/contrato.';
      hardRules.forbidDiscovery = true;
      hardRules.allowOnlyNextStep = true;
      hardRules.allowedTopics = ['pagamento', 'contrato', 'agenda', 'produto', 'plano', 'valor'];
    }
  }

  if (stage === 'fechando' && intent !== 'support') {
    locks.stopSelling = true;
    hardRules.forbidDiscovery = true;
    hardRules.allowOnlyNextStep = true;
    hardRules.allowedTopics = hardRules.allowedTopics || ['pagamento', 'contrato', 'agenda'];
  }

  // Observações úteis para prompt dinâmico
  const memory = {
    hasName: !!lead?.name,
    hasCompany: !!lead?.company,
    stage,
    dealStatus: deal?.status || null,
  };

  return {
    intent,
    goal,
    hardRules,
    locks,
    memory,
  };
}

module.exports = {
  evaluatePolicy,
};
