// FILE: src/nlp/policy.js
/**
 * MOTOR DE DECISÃO - VERSÃO FINAL
 */

function chooseAction({ intent, signals, state, entities }) {
    const { mode, stage, assunto, plano, ja, pending, negotiation, cliente } = state;

    console.log(`   📋 Stage: ${stage} | Assunto: ${assunto || '-'} | Plano: ${plano || '-'}`);
    console.log(`   📋 Pending: ${pending?.kind || '-'} | Cliente: ${cliente?.nome || '-'}`);
    console.log(`   📋 Proposta: ${ja?.enviouProposta ? 'SIM' : 'NÃO'} | Pagamento: ${ja?.enviouPagamento ? 'SIM' : 'NÃO'}`);

    // ========== PAGAMENTO CONFIRMADO (MÁXIMA PRIORIDADE) ==========
    if (signals.payment_done) {
        if (ja?.enviouPagamento || pending?.kind === 'confirm_payment') {
            return 'CONFIRM_PAYMENT';
        }
    }

    // ========== PARCELAS (SE ESPERANDO) ==========
    if (signals.has_parcelas_choice && pending?.kind === 'choose_parcelas') {
        return 'PROCESS_PARCELAS';
    }

    // ========== MÉTODOS DE PAGAMENTO (APÓS PROPOSTA) ==========
    if (ja?.enviouProposta) {
        if (signals.payment_pix) return 'GENERATE_PIX';
        if (signals.payment_card) return 'GENERATE_CARD';
        if (signals.payment_boleto) return 'GENERATE_BOLETO';
        
        // Pergunta sobre formas de pagamento
        if (signals.asking_payment_methods) {
            return 'EXPLAIN_PAYMENT_METHODS';
        }
    }

    // ========== CONFIRMAÇÃO APÓS PAGAMENTO ENVIADO ==========
    if (ja?.enviouPagamento && signals.short_confirm) {
        // "ok" após boleto/pix = aguardando pagamento
        return 'AWAIT_PAYMENT_CONFIRMATION';
    }

    // ========== DADOS DO CLIENTE (CUIDADO!) ==========
    // Só processar se realmente parece dados E estamos esperando
    if (signals.looks_like_client_data && !signals.is_question) {
        if (pending?.kind === 'send_data' || (ja?.pediuDados && !cliente?.nome)) {
            return 'PROCESS_CLIENT_DATA';
        }
    }

    // ========== ESCOLHA DE PLANO ==========
    if (signals.has_plan_choice && assunto && !ja?.enviouProposta) {
        return 'PROCESS_PLAN_CHOICE';
    }

    // ========== CONFIRMAÇÃO GENÉRICA ==========
    if (signals.short_confirm && !signals.is_question) {
        // Após proposta → perguntar pagamento
        if (ja?.enviouProposta && !ja?.enviouPagamento) {
            return 'ASK_PAYMENT_METHOD';
        }
        // Tem assunto/plano/cliente → enviar proposta
        if (assunto && plano && cliente?.nome && !ja?.enviouProposta) {
            return 'SEND_PROPOSAL';
        }
        // Tem assunto mas não plano → mostrar opções
        if (assunto && !ja?.mostrouOpcoes) {
            return 'SHOW_OPTIONS';
        }
        // Mostrou opções, aguardar escolha
        if (ja?.mostrouOpcoes && !plano) {
            return 'ASK_WHICH_PLAN';
        }
        return 'CONTINUE_FLOW';
    }

    // ========== OBJEÇÕES ==========
    if (signals.objection_price) {
        if ((negotiation?.descontoOferecido || 0) < 15) return 'OFFER_DISCOUNT';
        return 'HANDLE_PRICE_OBJECTION_MAX';
    }
    if (signals.objection_time) return 'HANDLE_TIME_OBJECTION';
    if (signals.objection_trust) return 'HANDLE_TRUST_OBJECTION';

    // ========== NEGATIVA ==========
    if (signals.short_negative) return 'HANDLE_NEGATIVE';

    // ========== PEDIDOS DIRETOS ==========
    if (signals.wants_proposal || signals.ready_to_buy) {
        if (!cliente?.nome) return 'ASK_CLIENT_DATA';
        if (!assunto) return 'ASK_SERVICE';
        if (!plano) return 'SHOW_OPTIONS';
        return 'SEND_PROPOSAL';
    }

    if (signals.price_ask && !signals.is_question) {
        if (assunto) return ja?.mostrouPreco ? 'REMIND_PRICE' : 'SHOW_OPTIONS';
        return 'ASK_SERVICE_FOR_PRICE';
    }

    // ========== SERVIÇOS ==========
    if (signals.about_landing) return 'START_LANDING';
    if (signals.about_site) {
        if (signals.wants_simple) return 'START_SITE_SIMPLE';
        if (signals.wants_complete) return 'START_SITE_COMPLETE';
        return 'START_SITE';
    }
    if (signals.about_trafego) return 'START_TRAFEGO';
    if (signals.about_marketing) return 'START_MARKETING';

    // ========== SAUDAÇÕES ==========
    if (signals.is_greeting) {
        return ja?.apresentou ? 'GREET_RETURN' : 'GREET_FIRST';
    }
    if (signals.is_goodbye) return 'GOODBYE';

    // ========== PERGUNTAS ==========
    if (signals.is_question) {
        if (signals.asking_payment_methods) return 'EXPLAIN_PAYMENT_METHODS';
        if (signals.price_ask) return assunto ? 'SHOW_OPTIONS' : 'ASK_SERVICE_FOR_PRICE';
        return 'ANSWER_QUESTION';
    }

    // ========== FALLBACK INTELIGENTE ==========
    if (assunto) {
        if (plano && cliente?.nome && !ja?.enviouProposta) return 'SEND_PROPOSAL';
        if (plano && !cliente?.nome) return 'ASK_CLIENT_DATA';
        if (!ja?.mostrouOpcoes) return 'SHOW_OPTIONS';
        if (!plano) return 'ASK_WHICH_PLAN';
    }

    return 'FALLBACK';
}

module.exports = { chooseAction };