// FILE: src/nlp/analyzer.js
/**
 * ANALISADOR NLP - VERSÃO FINAL
 */

const { detectSignals } = require('./signals.js');
const { chooseAction } = require('./policy.js');
const { render } = require('./responses.js');
const stateManager = require('./state.js');
const { gerarProposta, getValor } = require('./proposals.js');
const embeddingsManager = require('./embeddings.js');
const { intents } = require('./intents.js');

class NLPAnalyzer {
    constructor() {
        this.embeddingsReady = false;
        this.threshold = 0.45;
        this.adminNumber = process.env.ADMIN_WHATSAPP || null;
    }

    async initializeEmbeddings() {
        if (this.embeddingsReady) return;
        try {
            await embeddingsManager.initialize();
            this.embeddingsReady = true;
            console.log('✅ NLP ativo');
        } catch (e) {
            console.log('⚠️ NLP fallback');
        }
    }

    extractEntities(text, currentCliente = null) {
        const entities = {};
        
        // Se já tem cliente, não sobrescrever com lixo
        if (currentCliente?.nome) {
            entities.name = currentCliente.nome;
            entities.company = currentCliente.empresa;
            entities.email = currentCliente.email;
            entities.phone = currentCliente.telefone;
        }

        // Detectar se parece dados novos
        const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Se é pergunta, comando ou palavra-chave, NÃO extrair como dados
        const blacklist = [
            'quais', 'qual', 'como', 'quanto', 'quando', 'onde', 'porque', 'por que',
            'formas', 'pagamento', 'pagar', 'site', 'landing', 'trafego', 'marketing',
            'sim', 'nao', 'não', 'ok', 'pix', 'cartao', 'cartão', 'boleto', 'paguei',
            'oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'obrigado', 'valeu'
        ];
        
        const hasBlacklist = blacklist.some(w => normalized.includes(w));
        if (hasBlacklist) {
            return entities; // Retorna dados existentes ou vazio
        }

        // Tentar extrair dados
        const lines = text.split(/[,\n]/).map(l => l.trim()).filter(l => l && l.length > 1);
        
        for (const line of lines) {
            const cleanLine = line.toLowerCase();
            
            // Pular se parece comando
            if (blacklist.some(w => cleanLine.includes(w))) continue;
            
            // Email
            const email = line.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i);
            if (email && !entities.email) {
                entities.email = email[0].toLowerCase();
                continue;
            }
            
            // Telefone (8+ dígitos)
            if (line.match(/\d{8,}/) && !entities.phone) {
                entities.phone = line.replace(/\D/g, '');
                continue;
            }
            
            // Nome (primeira linha válida sem números longos)
            if (!entities.name && line.length > 1 && line.length < 40 && !line.match(/\d{5,}/)) {
                const clean = line.replace(/[^\w\s]/g, '').trim();
                if (clean && clean.length > 1) {
                    entities.name = clean.split(' ').slice(0, 4).map(w => 
                        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                    ).join(' ');
                    continue;
                }
            }
            
            // Empresa (segunda linha)
            if (entities.name && !entities.company && line.length > 1 && line.length < 50 && !line.match(/\d{5,}/)) {
                if (!line.includes('@')) {
                    entities.company = line;
                }
            }
        }
        
        return entities;
    }

    async detectIntent(text) {
        const normalized = detectSignals(text).normalized;
        
        if (this.embeddingsReady) {
            try {
                const result = await embeddingsManager.findBestIntent(normalized);
                if (result.intent && result.confidence >= this.threshold) {
                    return { intent: result.intent, confidence: result.confidence, assunto: result.data?.assunto };
                }
            } catch {}
        }

        for (const [name, data] of Object.entries(intents)) {
            for (const p of data.patterns || []) {
                if (normalized.includes(p.toLowerCase())) {
                    return { intent: name, confidence: 0.7, assunto: data.assunto };
                }
            }
        }

        return { intent: 'unknown', confidence: 0 };
    }

    async analyze(text, userId, sock = null) {
        await this.initializeEmbeddings();

        const state = stateManager.get(userId);
        const { signals, normalized, isQuestion } = detectSignals(text);
        const { intent, confidence, assunto: intentAssunto } = await this.detectIntent(text);
        
        // Extrair entidades SEM sobrescrever dados existentes
        const entities = this.extractEntities(text, state.cliente);

        // Atualizar assunto se detectado E ainda não tem
        if (intentAssunto && !state.assunto) {
            stateManager.update(userId, { assunto: intentAssunto, stage: 'explorando' });
        }

        // Detectar assunto por sinais
        if (!state.assunto) {
            if (signals.about_landing) stateManager.update(userId, { assunto: 'landing', stage: 'explorando' });
            else if (signals.about_site) stateManager.update(userId, { assunto: 'site', stage: 'explorando' });
            else if (signals.about_trafego) stateManager.update(userId, { assunto: 'trafego', stage: 'explorando' });
            else if (signals.about_marketing) stateManager.update(userId, { assunto: 'marketing', stage: 'explorando' });
        }

        const updatedState = stateManager.get(userId);
        
        console.log(`\n   🎯 Intent: ${intent} | Pergunta: ${isQuestion ? 'SIM' : 'NÃO'}`);
        console.log(`   📊 PlanChoice: ${signals.plan_choice || '-'} | Parcelas: ${signals.parcelas_choice || '-'}`);

        const action = chooseAction({ intent, signals, state: updatedState, entities });
        
        console.log(`   🎬 Action: ${action}`);

        const result = await this.executeAction(action, { userId, signals, state: updatedState, entities, sock });

        stateManager.addToHistory(userId, { intent, action, message: normalized.substring(0, 50) });

        return { intent, confidence, action, response: result.response, entities, state: stateManager.get(userId) };
    }

    async executeAction(action, ctx) {
        const { userId, signals, state, entities, sock } = ctx;
        let response = '';
        let updates = {};

        const planMaps = {
            site: ['simples', 'completo', 'loja'],
            landing: ['simples', 'vendas'],
            trafego: ['starter', 'pro', 'scale'],
            marketing: ['basico', 'completo', 'premium']
        };

        switch (action) {
            // ===== SAUDAÇÕES =====
            case 'GREET_FIRST':
                updates = { ja: { ...state.ja, apresentou: true }, stage: 'conhecendo' };
                response = render('GREET_FIRST');
                break;

            case 'GREET_RETURN':
                response = render('GREET_RETURN');
                break;

            // ===== SERVIÇOS =====
            case 'START_SITE':
                updates = { assunto: 'site', stage: 'explorando' };
                response = render('START_SITE');
                break;

            case 'START_SITE_SIMPLE':
                updates = { assunto: 'site', plano: 'simples', stage: 'detalhando' };
                if (state.cliente?.nome) {
                    const prop = gerarProposta('site', 'simples', state.cliente, 0);
                    updates.ja = { ...state.ja, enviouProposta: true };
                    updates.negotiation = { valorOriginal: prop.valorOriginal, valorAtual: prop.valorFinal };
                    updates.stage = 'negociando';
                    response = prop.texto + '\n\n' + render('PROPOSAL_SENT');
                    this.notifyAdmin(sock, 'proposta', { cliente: state.cliente, state: { ...state, ...updates } });
                } else {
                    updates.ja = { ...state.ja, pediuDados: true };
                    updates.pending = { kind: 'send_data' };
                    response = render('ASK_CLIENT_DATA');
                }
                break;

            case 'START_SITE_COMPLETE':
                updates = { assunto: 'site', plano: 'completo', stage: 'detalhando' };
                if (state.cliente?.nome) {
                    const prop = gerarProposta('site', 'completo', state.cliente, 0);
                    updates.ja = { ...state.ja, enviouProposta: true };
                    updates.negotiation = { valorOriginal: prop.valorOriginal, valorAtual: prop.valorFinal };
                    updates.stage = 'negociando';
                    response = prop.texto + '\n\n' + render('PROPOSAL_SENT');
                } else {
                    updates.ja = { ...state.ja, pediuDados: true };
                    updates.pending = { kind: 'send_data' };
                    response = render('ASK_CLIENT_DATA');
                }
                break;

            case 'START_LANDING':
                updates = { assunto: 'landing', stage: 'explorando' };
                response = render('START_LANDING');
                break;

            case 'START_TRAFEGO':
                updates = { assunto: 'trafego', stage: 'explorando' };
                response = render('START_TRAFEGO');
                break;

            case 'START_MARKETING':
                updates = { assunto: 'marketing', stage: 'explorando' };
                response = render('START_MARKETING');
                break;

            // ===== OPÇÕES =====
            case 'SHOW_OPTIONS':
                updates = { ja: { ...state.ja, mostrouOpcoes: true, mostrouPreco: true } };
                response = render(`SHOW_OPTIONS_${(state.assunto || 'SITE').toUpperCase()}`);
                break;

            case 'ASK_WHICH_PLAN':
                response = 'Qual opção você prefere? 1, 2 ou 3?';
                break;

            case 'REMIND_PRICE':
                response = 'Os valores são os que te passei. Quer fechar? Só me dizer qual opção!';
                break;

            // ===== ESCOLHA DE PLANO =====
            case 'PROCESS_PLAN_CHOICE':
                const choice = signals.plan_choice;
                const plans = planMaps[state.assunto] || planMaps.site;
                const chosenPlan = plans[choice - 1];
                
                if (chosenPlan) {
                    updates = { plano: chosenPlan, stage: 'detalhando' };
                    
                    if (state.cliente?.nome) {
                        const prop = gerarProposta(state.assunto, chosenPlan, state.cliente, 0);
                        if (prop) {
                            updates.ja = { ...state.ja, enviouProposta: true };
                            updates.negotiation = { valorOriginal: prop.valorOriginal, valorAtual: prop.valorFinal };
                            updates.stage = 'negociando';
                            response = prop.texto + '\n\n' + render('PROPOSAL_SENT');
                            this.notifyAdmin(sock, 'proposta', { cliente: state.cliente, state: { ...state, ...updates } });
                        }
                    } else {
                        updates.ja = { ...state.ja, pediuDados: true };
                        updates.pending = { kind: 'send_data' };
                        response = render('ASK_CLIENT_DATA');
                    }
                } else {
                    response = 'Qual opção você prefere? 1, 2 ou 3?';
                }
                break;

            // ===== DADOS DO CLIENTE =====
            case 'ASK_CLIENT_DATA':
                updates = { ja: { ...state.ja, pediuDados: true }, pending: { kind: 'send_data' } };
                response = render('ASK_CLIENT_DATA');
                break;

            case 'PROCESS_CLIENT_DATA':
                // NUNCA sobrescrever com dados inválidos
                const novoCliente = {
                    nome: entities.name || state.cliente?.nome,
                    empresa: entities.company || state.cliente?.empresa,
                    email: entities.email || state.cliente?.email,
                    telefone: entities.phone || state.cliente?.telefone || userId.split('@')[0]
                };
                
                // Verificar se realmente tem nome válido
                if (!novoCliente.nome || novoCliente.nome.length < 2) {
                    response = 'Me passa seu nome pra eu montar a proposta.';
                    break;
                }
                
                updates = { cliente: novoCliente, pending: { kind: null } };

                if (state.assunto && state.plano) {
                    const prop = gerarProposta(state.assunto, state.plano, novoCliente, 0);
                    if (prop) {
                        updates.ja = { ...state.ja, enviouProposta: true };
                        updates.negotiation = { valorOriginal: prop.valorOriginal, valorAtual: prop.valorFinal };
                        updates.stage = 'negociando';
                        response = prop.texto + '\n\n' + render('PROPOSAL_SENT');
                        this.notifyAdmin(sock, 'proposta', { cliente: novoCliente, state: { ...state, ...updates } });
                    }
                } else if (state.assunto) {
                    updates.ja = { ...state.ja, mostrouOpcoes: true };
                    response = `Anotado, ${novoCliente.nome}!\n\n` + render(`SHOW_OPTIONS_${state.assunto.toUpperCase()}`);
                } else {
                    response = `Anotado, ${novoCliente.nome}! Você quer um site, gestão de tráfego ou redes sociais?`;
                }
                break;

            // ===== PROPOSTA =====
            case 'SEND_PROPOSAL':
                if (!state.plano) {
                    updates = { ja: { ...state.ja, mostrouOpcoes: true } };
                    response = render(`SHOW_OPTIONS_${(state.assunto || 'SITE').toUpperCase()}`);
                } else if (!state.cliente?.nome) {
                    updates = { ja: { ...state.ja, pediuDados: true }, pending: { kind: 'send_data' } };
                    response = render('ASK_CLIENT_DATA');
                } else {
                    const prop = gerarProposta(state.assunto, state.plano, state.cliente, state.negotiation?.descontoOferecido || 0);
                    if (prop) {
                        updates = { 
                            ja: { ...state.ja, enviouProposta: true },
                            negotiation: { ...state.negotiation, valorOriginal: prop.valorOriginal, valorAtual: prop.valorFinal },
                            stage: 'negociando'
                        };
                        response = prop.texto + '\n\n' + render('PROPOSAL_SENT');
                        this.notifyAdmin(sock, 'proposta', { cliente: state.cliente, state: { ...state, ...updates } });
                    }
                }
                break;

            // ===== PAGAMENTO =====
            case 'ASK_PAYMENT_METHOD':
                updates = { stage: 'fechando' };
                response = render('ASK_PAYMENT_METHOD');
                break;

            case 'EXPLAIN_PAYMENT_METHODS':
                response = 'As formas de pagamento são:\n\n📱 *Pix* - à vista\n💳 *Cartão* - até 12x sem juros\n📄 *Boleto* - até 3x\n\nQual você prefere?';
                break;

            case 'GENERATE_PIX':
                const valorPix = state.negotiation?.valorAtual || getValor(state.assunto, state.plano);
                updates = { 
                    ja: { ...state.ja, enviouPagamento: true },
                    negotiation: { ...state.negotiation, formaPagamento: 'pix' },
                    pending: { kind: 'confirm_payment' },
                    stage: 'fechando'
                };
                response = `Perfeito! Aqui está o Pix:\n\n💰 *Valor:* R$ ${valorPix.toLocaleString('pt-BR')}\n\n📋 *Chave Pix (CNPJ):*\n\`\`\`00.000.000/0001-00\`\`\`\n\n✅ Me avisa aqui quando pagar que eu confirmo!`;
                break;

            case 'GENERATE_CARD':
                updates = { 
                    negotiation: { ...state.negotiation, formaPagamento: 'cartao' },
                    pending: { kind: 'choose_parcelas' }
                };
                response = 'Ótimo! Em quantas vezes quer parcelar? (1 a 12x)';
                break;

            case 'PROCESS_PARCELAS':
                const parcelas = signals.parcelas_choice;
                const valorTotal = state.negotiation?.valorAtual || getValor(state.assunto, state.plano);
                const valorParcela = Math.ceil(valorTotal / parcelas);
                updates = {
                    ja: { ...state.ja, enviouPagamento: true },
                    negotiation: { ...state.negotiation, parcelas },
                    pending: { kind: 'confirm_payment' },
                    stage: 'fechando'
                };
                response = `Beleza! ${parcelas}x de R$ ${valorParcela.toLocaleString('pt-BR')}.\n\n🔗 Vou te mandar o link de pagamento.\n\n✅ Me avisa quando concluir!`;
                break;

            case 'GENERATE_BOLETO':
                const valorBoleto = state.negotiation?.valorAtual || getValor(state.assunto, state.plano);
                updates = { 
                    ja: { ...state.ja, enviouPagamento: true },
                    negotiation: { ...state.negotiation, formaPagamento: 'boleto' },
                    pending: { kind: 'confirm_payment' },
                    stage: 'fechando'
                };
                response = `Boleto gerado!\n\n💰 *Valor:* R$ ${valorBoleto.toLocaleString('pt-BR')}\n📅 *Vencimento:* em 3 dias\n\n🔗 Vou te mandar o link.\n\n✅ Me avisa quando pagar!`;
                break;

            case 'AWAIT_PAYMENT_CONFIRMATION':
                response = 'Beleza! Fico aguardando. Assim que pagar, me avisa aqui que eu confirmo tudo! 👍';
                break;

            case 'CONFIRM_PAYMENT':
                const nomeCliente = state.cliente?.nome || 'Cliente';
                updates = { stage: 'pos_venda', pending: { kind: null } };
                response = `🎉 *PAGAMENTO CONFIRMADO!*\n\nMuito obrigado pela confiança, ${nomeCliente}!\n\n*Próximos passos:*\n1️⃣ Você recebe o briefing pra preencher\n2️⃣ Nossa equipe inicia o projeto\n3️⃣ Te mantenho atualizado por aqui!\n\nQualquer dúvida, é só chamar. 🚀`;
                this.notifyAdmin(sock, 'venda', { cliente: state.cliente, state: { ...state, ...updates } });
                break;

            // ===== OBJEÇÕES =====
            case 'OFFER_DISCOUNT':
                const novoDesconto = Math.min((state.negotiation?.descontoOferecido || 0) + 5, 15);
                const valorOrig = state.negotiation?.valorOriginal || getValor(state.assunto, state.plano);
                const novoValor = Math.round(valorOrig * (1 - novoDesconto / 100));
                updates = { 
                    ja: { ...state.ja, ofereceuDesconto: true },
                    negotiation: { ...state.negotiation, descontoOferecido: novoDesconto, valorAtual: novoValor }
                };
                if (novoDesconto >= 15) {
                    response = `Esse é o máximo que consigo: 15% de desconto. Fica R$ ${novoValor.toLocaleString('pt-BR')}.\n\nÉ minha melhor oferta! Posso parcelar em até 12x também. Fechamos?`;
                } else {
                    response = `Consigo te dar ${novoDesconto}% de desconto. Fica R$ ${novoValor.toLocaleString('pt-BR')}. O que acha?`;
                }
                break;

            case 'HANDLE_PRICE_OBJECTION_MAX':
                response = 'Já apliquei o desconto máximo, mas posso parcelar em até 12x! Ou a gente pode ver uma opção mais simples. O que prefere?';
                break;

            case 'HANDLE_TIME_OBJECTION':
                response = 'Sem problema! Fico à disposição. A proposta vale por 7 dias. Qualquer dúvida, me chama!';
                break;

            case 'HANDLE_TRUST_OBJECTION':
                response = 'Entendo sua preocupação! Trabalhamos há mais de 3 anos, mais de 150 clientes atendidos. Tudo com contrato e garantia. Quer ver alguns trabalhos que fizemos?';
                break;

            case 'HANDLE_NEGATIVE':
                response = render('HANDLE_NEGATIVE');
                break;

            // ===== OUTROS =====
            case 'ASK_SERVICE':
            case 'ASK_SERVICE_FOR_PRICE':
                response = 'Você tá buscando site, tráfego pago ou gestão de redes?';
                break;

            case 'ANSWER_QUESTION':
                if (state.assunto) {
                    response = render('EXPLAIN_TOPIC', { state });
                } else {
                    response = 'Trabalhamos com sites, tráfego pago (anúncios) e gestão de redes sociais. Qual te interessa?';
                }
                break;

            case 'CONTINUE_FLOW':
                if (state.ja?.enviouProposta && !state.ja?.enviouPagamento) {
                    response = 'Como quer pagar? Pix, cartão ou boleto?';
                } else if (state.assunto && !state.ja?.mostrouOpcoes) {
                    updates = { ja: { ...state.ja, mostrouOpcoes: true } };
                    response = render(`SHOW_OPTIONS_${state.assunto.toUpperCase()}`);
                } else {
                    response = 'Posso te ajudar com mais alguma coisa?';
                }
                break;

            case 'GOODBYE':
                response = 'Beleza! Qualquer coisa, é só chamar. Até mais! 👋';
                break;

            case 'FALLBACK':
            default:
                if (state.ja?.enviouPagamento && !signals.payment_done) {
                    response = 'Fico aguardando a confirmação do pagamento! Assim que pagar, me avisa. 👍';
                } else if (state.ja?.enviouProposta) {
                    response = 'E aí, o que achou da proposta? Quer fechar? Como prefere pagar: Pix, cartão ou boleto?';
                } else if (state.assunto && state.ja?.mostrouOpcoes && !state.plano) {
                    response = 'Qual opção você prefere? Me diz 1, 2 ou 3!';
                } else if (state.assunto && !state.ja?.mostrouOpcoes) {
                    updates = { ja: { ...state.ja, mostrouOpcoes: true } };
                    response = render(`SHOW_OPTIONS_${state.assunto.toUpperCase()}`);
                } else {
                    response = 'Não entendi bem. Você quer saber sobre sites, anúncios ou redes sociais?';
                }
                break;
        }

        if (Object.keys(updates).length > 0) {
            stateManager.update(userId, updates);
        }

        return { response, updates };
    }

    async notifyAdmin(sock, tipo, data) {
        if (!this.adminNumber || !sock) return;
        const { cliente, state } = data;
        const label = { site: 'Site', landing: 'Landing', trafego: 'Tráfego', marketing: 'Redes' };

        let msg = tipo === 'proposta' 
            ? `📤 *PROPOSTA ENVIADA*\n\n👤 ${cliente?.nome || '-'}\n📦 ${label[state?.assunto] || '-'}\n💰 R$ ${(state?.negotiation?.valorAtual || 0).toLocaleString('pt-BR')}`
            : `🎉 *VENDA!*\n\n👤 ${cliente?.nome || '-'}\n📦 ${label[state?.assunto] || '-'}\n💰 R$ ${(state?.negotiation?.valorAtual || 0).toLocaleString('pt-BR')}`;

        try {
            await sock.sendMessage(this.adminNumber + '@s.whatsapp.net', { text: msg });
        } catch {}
    }
}

module.exports = new NLPAnalyzer();