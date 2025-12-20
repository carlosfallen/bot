// FILE: src/nlp/signals.js
/**
 * DETECTOR DE SINAIS - VERSÃO FINAL CORRIGIDA
 */

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s@.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasAny(t, arr) {
    return arr.some(w => t.includes(w));
}

function hasExact(t, arr) {
    return arr.includes(t) || arr.some(w => t.split(' ').includes(w));
}

function detectSignals(text) {
    const t = normalize(text);
    const words = t.split(' ');

    // ===== DETECTAR SE É PERGUNTA =====
    const isQuestion = (
        t.includes('?') ||
        t.startsWith('qual') ||
        t.startsWith('quais') ||
        t.startsWith('como') ||
        t.startsWith('quando') ||
        t.startsWith('onde') ||
        t.startsWith('quanto') ||
        t.startsWith('por que') ||
        t.startsWith('porque') ||
        t.startsWith('o que') ||
        hasAny(t, ['quais sao', 'quais são', 'como funciona', 'me explica', 'pode explicar'])
    );

    // ===== ESCOLHA DE PLANO =====
    let planChoice = null;
    
    if (/^[1-3]$/.test(t)) {
        planChoice = parseInt(t);
    } else if (t.match(/^(opcao|opção|o|numero|número|quero a|quero o)\s*[1-3]$/)) {
        planChoice = parseInt(t.match(/[1-3]/)[0]);
    } else if (hasAny(t, ['simples', 'basico', 'básico', 'primeiro', 'primeira']) && !isQuestion) {
        planChoice = 1;
    } else if (hasAny(t, ['completo', 'segundo', 'segunda', 'pro']) && !isQuestion) {
        planChoice = 2;
    } else if (hasAny(t, ['loja', 'terceiro', 'terceira', 'premium', 'scale']) && !isQuestion) {
        planChoice = 3;
    }

    // ===== PARCELAS =====
    let parcelasChoice = null;
    if (t.match(/^([1-9]|1[0-2])x?$/)) {
        parcelasChoice = parseInt(t.match(/\d+/)[0]);
    } else if (t.match(/^em\s*([1-9]|1[0-2])\s*(vezes|x)?$/)) {
        parcelasChoice = parseInt(t.match(/\d+/)[0]);
    }

    const signals = {
        // ===== FLAGS ESPECIAIS =====
        is_question: isQuestion,
        plan_choice: planChoice,
        has_plan_choice: planChoice !== null && !isQuestion,
        parcelas_choice: parcelasChoice,
        has_parcelas_choice: parcelasChoice !== null,

        // ===== PAGAMENTO (PRIORIDADE ALTA) =====
        payment_pix: hasAny(t, ['pix', 'a vista', 'à vista', 'avista']) && !isQuestion,
        payment_card: hasAny(t, ['cartao', 'cartão', 'credito', 'crédito']) && !isQuestion,
        payment_boleto: hasAny(t, ['boleto']) && !isQuestion,
        payment_done: hasAny(t, [
            'paguei', 'pago', 'ja paguei', 'já paguei', 'fiz o pix', 'transferi',
            'mandei', 'feito', 'ta pago', 'tá pago', 'fiz o pagamento', 'transferido',
            'efetuei', 'realizei', 'concluido', 'concluído'
        ]),

        // ===== PERGUNTAS SOBRE PAGAMENTO =====
        asking_payment_methods: hasAny(t, [
            'formas de pagamento', 'forma de pagamento', 'como pagar', 'como pago',
            'quais formas', 'aceita cartao', 'aceita cartão', 'parcela', 'parcelar',
            'em quantas vezes', 'pode parcelar'
        ]),

        // ===== PREÇO =====
        price_ask: hasAny(t, [
            'preco', 'preço', 'valor', 'valores', 'quanto custa', 'quanto e', 'quanto é',
            'custo', 'orcamento', 'orçamento', 'investimento', 'quanto fica', 'quanto sai',
            'qual o valor', 'tabela de preco', 'quanto cobra', 'quanto seria'
        ]),

        // ===== PROPOSTA =====
        wants_proposal: hasAny(t, [
            'proposta', 'orçamento formal', 'fechar', 'contratar', 'quero fechar',
            'vamos fechar', 'manda a proposta', 'quero a proposta', 'envia a proposta',
            'faz a proposta', 'monta a proposta', 'quero contratar'
        ]) && !isQuestion,

        ready_to_buy: hasAny(t, [
            'quero comprar', 'vou fechar', 'fechado', 'pode fazer', 'vamos la',
            'vamos lá', 'bora', 'aceito', 'vou querer', 'quero sim', 'pode ser',
            'to dentro', 'tô dentro', 'manda ver', 'pode mandar', 'fechamos'
        ]) && !isQuestion,

        // ===== OBJEÇÕES =====
        objection_price: hasAny(t, [
            'caro', 'muito caro', 'ta caro', 'tá caro', 'fora do orcamento',
            'nao tenho esse valor', 'não tenho esse valor', 'mais em conta',
            'mais barato', 'tem desconto', 'desconto', 'plano mais barato'
        ]),

        objection_time: hasAny(t, [
            'vou pensar', 'preciso pensar', 'deixa eu pensar', 'vou analisar',
            'depois', 'talvez depois', 'agora nao', 'agora não', 'mais pra frente'
        ]),

        objection_trust: hasAny(t, [
            'confiavel', 'confiável', 'garantia', 'e se der errado', 'quem sao voces',
            'quem são vocês', 'cnpj', 'seguro', 'é seguro'
        ]),

        // ===== CONFIRMAÇÕES =====
        short_confirm: (
            hasExact(t, ['sim', 's', 'ok', 'beleza', 'claro', 'quero', 'pode', 'bora', 'vamos', 'isso', 'certo', 'show', 'top', 'manda', 'fechado', 'combinado', 'perfeito', 'aceito', 'isso mesmo', 'legal', 'otimo', 'ótimo', 'certo', 'entendi', 'blz'])
        ) && words.length <= 3 && !isQuestion,

        short_negative: (
            hasExact(t, ['nao', 'não', 'n', 'depois', 'talvez', 'negativo', 'deixa', 'para', 'ainda nao', 'ainda não'])
        ),

        // ===== SERVIÇOS =====
        about_site: hasAny(t, ['site', 'website', 'pagina', 'página', 'institucional']) && !hasAny(t, ['landing']),
        about_landing: hasAny(t, ['landing', 'landingpage', 'pagina de captura', 'pagina de vendas']),
        about_trafego: hasAny(t, ['trafego', 'tráfego', 'anuncio', 'anúncio', 'ads', 'campanha']),
        about_marketing: hasAny(t, ['marketing', 'redes sociais', 'gestao de redes', 'posts', 'stories']) && !hasAny(t, ['site', 'landing']),

        wants_simple: hasAny(t, ['simples', 'basico', 'básico', 'so pra apresentar', 'só pra apresentar']) && !isQuestion,
        wants_complete: hasAny(t, ['completo', 'profissional', 'robusto', 'elaborado']) && !isQuestion,

        // ===== SAUDAÇÕES =====
        is_greeting: hasAny(t, ['oi', 'ola', 'olá', 'hey', 'opa', 'eai', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem']) && words.length <= 5,
        is_goodbye: hasAny(t, ['tchau', 'ate logo', 'até logo', 'falou', 'flw', 'fui', 'valeu', 'obrigado', 'obrigada']),

        // ===== DADOS (só se não for pergunta e não for comando) =====
        has_email: t.includes('@') && t.includes('.') && !isQuestion,
        has_phone: !!t.match(/\d{8,}/) && !isQuestion,

        // Parece dados: tem vírgula/quebra, ou tem email, e não é pergunta nem comando
        looks_like_client_data: (
            !isQuestion &&
            !hasAny(t, ['site', 'landing', 'trafego', 'marketing', 'preco', 'preço', 'quanto', 'oi', 'ola', 'olá', 'sim', 'nao', 'não', 'ok', 'pix', 'cartao', 'boleto', 'paguei', 'formas']) &&
            (t.includes('@') || (text.includes(',') || text.includes('\n'))) &&
            words.length >= 1 && words.length <= 10
        )
    };

    return {
        normalized: t,
        words,
        signals,
        isQuestion,
        isShort: words.length <= 3
    };
}

module.exports = { detectSignals, normalize, hasAny };