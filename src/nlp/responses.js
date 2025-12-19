
// FILE: src/nlp/responses.js
/**
 * BANCO DE RESPOSTAS HUMANIZADAS
 * Organizadas por contexto e situação
 */

const responses = {
    // ==================== SAUDAÇÕES ====================
    saudacao: {
        primeira: [
            'Oi! Tudo bem? Em que posso te ajudar?',
            'Olá! Como posso te ajudar hoje?',
            'Oi! Me conta o que você precisa.'
        ],
        retorno: [
            'Oi de novo! Em que posso ajudar?',
            'E aí! Tudo certo?',
            'Oi! Continuando de onde paramos?'
        ],
        bom_dia: [
            'Bom dia! Como posso te ajudar?',
            'Bom dia! Me conta o que você precisa.'
        ],
        boa_tarde: [
            'Boa tarde! Em que posso ajudar?',
            'Boa tarde! Me conta o que você precisa.'
        ],
        boa_noite: [
            'Boa noite! Como posso te ajudar?',
            'Boa noite! Em que posso ajudar?'
        ]
    },

    // ==================== SERVIÇOS - SITES ====================
    site: {
        interesse_inicial: [
            'Fazemos sim! Você quer algo simples, só pra apresentar, ou precisa de algo mais completo?',
            'Sim, a gente faz. É pra mostrar sua empresa ou vai precisar de algo com vendas também?',
            'Fazemos. Me conta rapidinho: é pra apresentação ou precisa de funcionalidades específicas?'
        ],
        simples: [
            'Entendi! Um site simples de apresentação a gente faz em torno de 2 semanas. Geralmente inclui umas 5 páginas, formulário de contato e WhatsApp.',
            'Beleza! Pra um site institucional simples, fica em torno de R$ 2.500. Já inclui design, responsivo pra celular e formulário.'
        ],
        completo: [
            'Pra um site mais completo, depende um pouco das funcionalidades. Pode me contar o que você imagina?',
            'Legal! Me conta um pouco mais do que você precisa que eu te passo um valor mais certeiro.'
        ],
        loja: [
            'Loja virtual a gente faz também. Você já vende online em algum lugar ou vai começar do zero?',
            'Fazemos e-commerce sim. É pra quantos produtos mais ou menos?'
        ],
        explicacao: [
            'Funciona assim: a gente cuida de tudo - design, programação e coloca no ar. Você só me passa as informações e imagens. Geralmente fica pronto em 2 a 3 semanas.',
            'A gente faz o site completo. Você me passa o conteúdo (textos e fotos) e eu cuido do resto. Fica pronto rapidinho.'
        ],
        preco: [
            'Um site institucional simples fica a partir de R$ 2.500. Sites mais completos variam de R$ 4.000 a R$ 8.000, dependendo das funcionalidades.',
            'Pra te dar uma ideia: sites simples a partir de R$ 2.500, e-commerce a partir de R$ 4.500. Posso detalhar o que inclui se quiser.'
        ]
    },

    // ==================== SERVIÇOS - LANDING PAGE ====================
    landing: {
        interesse_inicial: [
            'Landing page a gente faz! É pra captar leads ou pra vender algum produto/serviço específico?',
            'Sim! Você quer uma página de captura ou de vendas?'
        ],
        explicacao: [
            'Landing page é uma página única, focada em conversão. Ideal pra campanhas de anúncios. A gente faz o design pensando em fazer o visitante tomar uma ação.',
            'É uma página objetiva, sem distrações. O foco é fazer a pessoa entrar em contato ou comprar. Funciona muito bem com tráfego pago.'
        ],
        preco: [
            'Landing page fica a partir de R$ 997. Inclui design, copy e integração com WhatsApp ou formulário.',
            'Uma landing simples sai em torno de R$ 997 a R$ 1.500, dependendo da complexidade.'
        ]
    },

    // ==================== SERVIÇOS - TRÁFEGO PAGO ====================
    trafego: {
        interesse_inicial: [
            'Trabalhamos com Meta Ads e Google Ads. Você já rodou campanha antes ou vai começar agora?',
            'Fazemos gestão de tráfego sim. É pra Instagram/Facebook ou Google?',
            'Sim! Qual plataforma te interessa mais: Meta (Instagram/Facebook) ou Google?'
        ],
        nunca_fez: [
            'Sem problema! A gente cuida de tudo: cria a conta, configura e roda as campanhas. Você só define quanto quer investir nos anúncios.',
            'Tranquilo, a gente configura do zero. Você não precisa entender nada técnico.'
        ],
        ja_fez: [
            'Ótimo! Então você já sabe como funciona. A gente pega suas campanhas e otimiza pra melhorar os resultados.',
            'Legal! Posso dar uma olhada no que você já tem e te falar onde dá pra melhorar.'
        ],
        explicacao: [
            'A gente cuida de tudo: criação dos anúncios, segmentação do público, e fica otimizando pra você ter o melhor resultado possível. Te mando relatório toda semana.',
            'Funciona assim: você define o orçamento dos anúncios, e a gente cuida de criar, testar e otimizar. O foco é sempre no retorno.'
        ],
        preco: [
            'A gestão fica a partir de R$ 1.500/mês. Aí você define separado quanto quer investir nos anúncios em si. Geralmente recomendo no mínimo R$ 1.000/mês pra começar.',
            'Gestão de tráfego a partir de R$ 1.500 mensais. O valor dos anúncios é à parte - você decide quanto quer colocar.'
        ]
    },

    // ==================== SERVIÇOS - MARKETING/REDES ====================
    marketing: {
        interesse_inicial: [
            'Fazemos gestão de redes sim. Quais redes você usa hoje?',
            'Sim! É pra Instagram, Facebook, LinkedIn? Quais você precisa?',
            'Fazemos! Quantos posts por semana você imagina que precisa?'
        ],
        detalhamento: [
            'A gente cuida de tudo: cria os posts, faz as artes, escreve as legendas e posta. Também responde comentários e mensagens se quiser.',
            'Funciona assim: montamos um calendário de conteúdo, você aprova, e a gente cuida de todo o resto.'
        ],
        explicacao: [
            'Gestão completa inclui: planejamento de conteúdo, criação das artes, legendas, hashtags, postagem e engajamento. Te mando relatório mensal.',
            'A gente pensa na estratégia, cria tudo e posta. Você só precisa aprovar o conteúdo antes.'
        ],
        preco: [
            'Gestão de redes começa em R$ 997/mês pra um pacote básico (8 posts). Pacotes maiores a partir de R$ 1.500.',
            'Temos pacotes a partir de R$ 997/mês. Depende da quantidade de posts e redes que você precisa.'
        ]
    },

    // ==================== PREÇOS GERAIS ====================
    precos: {
        sem_contexto: [
            'Os valores dependem do serviço. Você tá pensando em site, tráfego pago ou gestão de redes?',
            'Posso te passar valores, mas antes me conta: é pra qual serviço?'
        ],
        tabela_geral: [
            'Pra te dar uma ideia geral:\n\n• Sites - a partir de R$ 2.500\n• Landing pages - a partir de R$ 997\n• Tráfego pago - R$ 1.500/mês\n• Gestão de redes - R$ 997/mês\n\nQual desses te interessa mais?'
        ],
        apos_mostrar: [
            'Esses são os valores base. Se quiser, me conta mais sobre seu projeto que eu monto uma proposta certinha.',
            'Posso te passar mais detalhes sobre algum desses?'
        ]
    },

    // ==================== CONFIRMAÇÕES ====================
    confirmacao: {
        apos_servico: [
            'Quer que eu te explique melhor como funciona?',
            'Posso te dar mais detalhes se quiser.',
            'Te explico como funciona na prática?'
        ],
        apos_preco: [
            'Faz sentido pra você? Quer que eu monte uma proposta?',
            'O que acha? Posso detalhar o que inclui.',
            'Quer seguir com isso? Me passa seu contato que eu monto a proposta.'
        ],
        apos_explicacao: [
            'Ficou claro? Quer saber o valor?',
            'Alguma dúvida? Posso te passar o investimento se quiser.'
        ],
        generica: [
            'Posso te ajudar com mais alguma coisa?',
            'Quer saber mais sobre algo?'
        ]
    },

    // ==================== COLETA DE DADOS ====================
    coleta: {
        nome: [
            'Pra eu montar a proposta, qual seu nome?',
            'Me passa seu nome que eu preparo os detalhes.',
            'Qual seu nome pra eu anotar aqui?'
        ],
        empresa: [
            'E o nome da empresa?',
            'Você tem empresa ou é autônomo?'
        ],
        contato_completo: [
            'Pra eu te mandar a proposta, só preciso do seu nome e um contato (WhatsApp ou email).',
            'Me passa seu nome e melhor contato que eu monto tudo certinho.'
        ],
        segmento: [
            'Qual seu ramo de atuação?',
            'Você trabalha com o quê?'
        ]
    },

    // ==================== DADOS RECEBIDOS ====================
    dados_recebidos: {
        nome: [
            'Beleza, $NOME! Vou preparar a proposta.',
            'Anotado, $NOME! Te mando os detalhes aqui mesmo.',
            'Perfeito, $NOME! Vou montar tudo certinho.'
        ],
        completo: [
            'Anotei tudo, $NOME! Vou preparar a proposta e te mando aqui. Qualquer dúvida é só chamar.',
            'Beleza, $NOME! Em breve te mando a proposta completa. Obrigado pelo contato!'
        ]
    },

    // ==================== OBJEÇÕES ====================
    objecoes: {
        caro: [
            'Entendo. A gente pode parcelar se precisar. E os resultados geralmente compensam o investimento rapidinho.',
            'Posso ver uma opção que caiba melhor no seu orçamento. Me conta quanto você tinha em mente.'
        ],
        pensar: [
            'Sem problema! Fico à disposição quando decidir. Quer que eu te mande um resumo por escrito?',
            'Claro! Se tiver dúvidas depois, é só chamar aqui.'
        ],
        comparar: [
            'Faz sentido! Qualquer dúvida depois, me chama que te explico melhor o que inclui.',
            'Tranquilo. Se quiser comparar, posso te explicar nosso diferencial.'
        ]
    },

    // ==================== DÚVIDAS ====================
    duvidas: {
        prazo: [
            'Depende do projeto, mas geralmente:\n• Landing page: 5-7 dias\n• Site simples: 2-3 semanas\n• E-commerce: 3-4 semanas',
            'Trabalhamos rápido! Me conta o que você precisa que te passo o prazo certinho.'
        ],
        garantia: [
            'A gente acompanha o projeto depois de pronto. Se precisar de ajustes, fazemos sem custo adicional nos primeiros 30 dias.',
            'Tem garantia sim. Qualquer ajuste que precisar a gente resolve.'
        ],
        suporte: [
            'Depois de pronto, você tem suporte por WhatsApp pra qualquer dúvida. E ajustes simples a gente faz sem cobrar.',
            'Suporte via WhatsApp, resposta rápida. Tamos sempre disponíveis.'
        ],
        pagamento: [
            'Geralmente 50% pra começar e 50% na entrega. Dá pra parcelar no cartão também.',
            'Metade pra iniciar e metade quando entregar. Aceito Pix, transferência ou cartão parcelado.'
        ]
    },

    // ==================== AGENDAMENTO ====================
    agendamento: {
        oferecer: [
            'Quer marcar uma call rápida pra gente conversar melhor? Uns 15 minutos já resolve.',
            'Se preferir, posso agendar uma conversa. Qual melhor dia e horário pra você?'
        ],
        confirmar: [
            'Beleza! Fica combinado então. Te chamo no horário.',
            'Anotado! Te ligo nesse horário. Até lá!'
        ]
    },

    // ==================== PORTFÓLIO ====================
    portfolio: {
        geral: [
            'Já atendemos mais de 150 clientes em vários segmentos. Qual seu ramo? Te mostro algo parecido.',
            'Temos cases bem legais. Me conta sua área que eu te mando exemplos.'
        ],
        especifico: [
            'Temos alguns cases nessa área sim. Vou te mandar uns exemplos.',
            'Já fizemos projetos parecidos. Te mando umas referências.'
        ]
    },

    // ==================== URGÊNCIA ====================
    urgencia: {
        detectada: [
            'Entendi que é urgente! Me passa seu WhatsApp que priorizo seu atendimento.',
            'Posso agilizar pra você. Qual seu telefone pra contato direto?'
        ],
        confirmar_prazo: [
            'Pra quando você precisa? Dependendo, consigo encaixar.',
            'Me fala o prazo que você tem que eu vejo o que dá pra fazer.'
        ]
    },

    // ==================== MENU / AJUDA ====================
    menu: {
        servicos: [
            'A gente trabalha com:\n\n1. Sites e landing pages\n2. Tráfego pago (Meta e Google)\n3. Gestão de redes sociais\n\nQual te interessa?',
            'Nossos serviços principais são sites, anúncios online e gestão de redes. O que você tá buscando?'
        ],
        como_funciona: [
            'É simples: você me conta o que precisa, eu monto uma proposta, e se fechar a gente começa. Te acompanho em todo o processo.',
            'Funciona assim: conversamos, monto a proposta, você aprova e a gente começa. Simples e direto.'
        ]
    },

    // ==================== DESPEDIDA ====================
    despedida: {
        com_proposta: [
            'Perfeito! Te mando a proposta aqui mesmo. Qualquer dúvida, só chamar!',
            'Beleza! Em breve te envio tudo. Obrigado pelo contato!'
        ],
        sem_proposta: [
            'Beleza! Quando precisar, é só chamar aqui.',
            'Qualquer coisa, tô por aqui. Até mais!',
            'Valeu! Fico à disposição.'
        ],
        agradecimento: [
            'Eu que agradeço! Sucesso pra você!',
            'Imagina! Precisando, é só chamar.',
            'De nada! Fico à disposição.'
        ]
    },

    // ==================== FALLBACK ====================
    fallback: {
        nao_entendeu: [
            'Não entendi bem. Você quer saber sobre sites, anúncios ou redes sociais?',
            'Pode me explicar melhor? Trabalho com sites, tráfego pago e gestão de redes.',
            'Desculpa, não peguei. Sobre qual serviço você quer saber?'
        ],
        repetir: [
            'Pode repetir de outra forma?',
            'Não entendi. Pode explicar melhor o que você precisa?'
        ]
    },

    // ==================== CONTATO ====================
    contato: {
        info: [
            'Pode falar comigo por aqui mesmo, é mais rápido! Em que posso ajudar?',
            'Aqui é o canal mais direto. Me conta o que você precisa.'
        ]
    }
};

// Função para pegar resposta
function getResponse(categoria, subcategoria = null, variaveis = {}) {
    let opcoes;
    
    if (subcategoria && responses[categoria]?.[subcategoria]) {
        opcoes = responses[categoria][subcategoria];
    } else if (responses[categoria]) {
        // Pegar primeira subcategoria disponível
        const primeiraKey = Object.keys(responses[categoria])[0];
        opcoes = responses[categoria][primeiraKey];
    } else {
        return responses.fallback.nao_entendeu[0];
    }

    if (!opcoes || opcoes.length === 0) {
        return responses.fallback.nao_entendeu[0];
    }

    let resposta = opcoes[Math.floor(Math.random() * opcoes.length)];

    // Substituir variáveis
    for (const [key, value] of Object.entries(variaveis)) {
        resposta = resposta.replace(`$${key.toUpperCase()}`, value);
    }

    return resposta;
}

module.exports = { responses, getResponse };
