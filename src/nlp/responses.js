// FILE: src/nlp/responses.js
/**
 * Respostas contextuais baseadas no estado da conversa
 * Tom: humano, curto, direto, profissional
 */

const responses = {
    // ==================== SAUDAÇÕES ====================
    greeting: {
        primeiro_contato: [
            'Oi! Como posso te ajudar?',
            'Olá! Em que posso ajudar?',
            'Oi! Tudo bem? Me conta o que você precisa.'
        ],
        ja_conhece: [
            'Oi de novo! Em que posso ajudar?',
            'E aí! Continuando...',
            'Oi! Tudo certo?'
        ]
    },

    // ==================== SERVIÇOS ====================
    web_development: {
        inicial: [
            'Fazemos sim. Você quer algo simples ou mais completo?',
            'Sim, a gente faz. É pra apresentar sua empresa ou vender online?',
            'Fazemos. Me conta rapidinho o que você imagina.'
        ],
        com_contexto: [
            'Sobre o site, você quer algo simples ou mais elaborado?',
            'Pensando no site, seria mais institucional ou com vendas?'
        ],
        detalhamento: [
            'Entendi. Um site assim geralmente leva de 7 a 15 dias.',
            'Beleza. Geralmente inclui até 5 páginas, formulário e WhatsApp.'
        ]
    },

    landing: {
        inicial: [
            'Landing page a gente faz também. É pra captar leads ou vender direto?',
            'Sim, fazemos landing pages. Qual seria o objetivo principal?'
        ],
        com_contexto: [
            'Pra landing page, você já tem o conteúdo ou precisa de ajuda nisso também?'
        ]
    },

    trafego: {
        inicial: [
            'Trabalhamos com Meta Ads e Google Ads. Você já rodou campanha antes?',
            'Fazemos gestão de tráfego sim. É pra Instagram/Facebook ou Google?'
        ],
        com_contexto: [
            'Sobre o tráfego, qual plataforma te interessa mais?',
            'Você já tem conta de anúncios ou começaria do zero?'
        ],
        detalhamento: [
            'A gestão inclui criação das campanhas, otimização e relatórios semanais.',
            'Geralmente em 2-3 semanas já dá pra ver os primeiros resultados.'
        ]
    },

    marketing: {
        inicial: [
            'Fazemos gestão de redes sim. Quais redes você usa hoje?',
            'Sim, cuidamos de Instagram, Facebook, LinkedIn... Qual te interessa?'
        ],
        com_contexto: [
            'Pra gestão, você precisa de quantos posts por semana mais ou menos?'
        ],
        detalhamento: [
            'Inclui criação de posts, stories, legendas e engajamento com seguidores.',
            'A gente cuida de tudo: design, texto e agendamento.'
        ]
    },

    // ==================== PREÇOS ====================
    pricing: {
        generico: [
            'Depende um pouco do que você precisa. Qual serviço te interessa?',
            'Os valores variam. Você tá pensando em site, tráfego ou redes?'
        ],
        site: [
            'Um site simples começa em R$ 2.500. Algo mais completo vai de R$ 4.000 a R$ 6.000.',
            'Sites a partir de R$ 2.500. Depende do número de páginas e funcionalidades.'
        ],
        landing: [
            'Landing page fica a partir de R$ 997.',
            'Uma landing page simples sai em torno de R$ 997 a R$ 1.500.'
        ],
        trafego: [
            'A gestão de tráfego começa em R$ 1.500/mês, fora o valor dos anúncios.',
            'Tráfego pago a partir de R$ 1.500 mensais de gestão.'
        ],
        marketing: [
            'Gestão de redes começa em R$ 997/mês.',
            'Pacotes de redes sociais a partir de R$ 997/mês.'
        ]
    },

    // ==================== CONFIRMAÇÕES ====================
    affirmative: {
        continuar_assunto: [
            'Beleza! Me conta mais sobre o que você precisa.',
            'Ótimo! O que mais você quer saber?',
            'Legal! Pode falar.'
        ],
        apos_preco: [
            'Quer que eu monte uma proposta?',
            'Posso te passar mais detalhes se quiser.',
            'Quer saber o que inclui?'
        ],
        apos_servico: [
            'Quer saber como funciona?',
            'Te explico melhor se quiser.',
            'Posso detalhar pra você.'
        ]
    },

    negative: {
        padrao: [
            'Sem problema. Se precisar, tô aqui.',
            'Beleza! Qualquer coisa é só chamar.',
            'Ok! Fico à disposição.'
        ]
    },

    // ==================== COLETA DE DADOS ====================
    lead_capture: {
        primeira_vez: [
            'Pra montar a proposta, só preciso do seu nome e empresa (se tiver).',
            'Me passa seu nome que eu monto a proposta.',
            'Qual seu nome? Vou preparar os detalhes pra você.'
        ],
        ja_pediu: [
            'Pode me passar seu nome?',
            'Qual seu nome pra eu anotar?'
        ]
    },

    lead_received: {
        padrao: [
            'Anotado! Vou preparar a proposta e te mando aqui mesmo.',
            'Beleza, $NOME! Já vou montar a proposta.',
            'Perfeito! Em breve te mando os detalhes.'
        ]
    },

    // ==================== DÚVIDAS / MENU ====================
    menu: {
        primeira_vez: [
            'A gente trabalha com sites, tráfego pago e gestão de redes. O que te interessa mais?',
            'Fazemos sites, landing pages, anúncios e redes sociais. Qual desses você tá buscando?'
        ],
        ja_viu: [
            'Quer saber sobre sites, tráfego ou redes?',
            'Em que posso te ajudar agora?'
        ]
    },

    explain: {
        site: [
            'A gente cria o site completo: design, programação e coloca no ar. Você só precisa fornecer as informações e imagens.',
            'Fazemos tudo: layout, textos, formulários. Geralmente fica pronto em 2 semanas.'
        ],
        landing: [
            'Landing page é uma página única focada em conversão. Ideal pra campanhas.',
            'É uma página simples e direta, feita pra captar leads ou vender.'
        ],
        trafego: [
            'A gente cria e gerencia as campanhas. Você define o orçamento dos anúncios.',
            'Cuidamos de tudo: criação, segmentação, otimização e relatórios.'
        ],
        marketing: [
            'Criamos os posts, stories, fazemos as postagens e respondemos comentários.',
            'Gestão completa: planejamento, design, textos e engajamento.'
        ]
    },

    // ==================== URGÊNCIA ====================
    urgency: {
        padrao: [
            'Entendi que é urgente. Me passa seu contato que priorizo seu atendimento.',
            'Beleza, vou agilizar. Qual seu WhatsApp/telefone?'
        ]
    },

    // ==================== FALLBACK ====================
    unknown: {
        padrao: [
            'Não entendi bem. Você quer saber sobre sites, tráfego ou redes sociais?',
            'Pode explicar melhor? Trabalho com sites, anúncios e gestão de redes.',
            'Desculpa, não peguei. Sobre qual serviço você quer saber?'
        ]
    },

    // ==================== DESPEDIDA ====================
    goodbye: {
        padrao: [
            'Beleza! Qualquer coisa, só chamar.',
            'Até mais! Tô aqui se precisar.',
            'Valeu! Fico à disposição.'
        ]
    },

    thanks: {
        padrao: [
            'De nada! Precisando, é só chamar.',
            'Imagina! Tô aqui.',
            'Por nada!'
        ]
    },

    // ==================== AGENDAMENTO ====================
    schedule: {
        padrao: [
            'Qual melhor dia e horário pra você?',
            'Posso marcar uma conversa. Quando fica bom pra você?'
        ]
    },

    // ==================== PORTFÓLIO ====================
    portfolio: {
        padrao: [
            'Já atendemos vários clientes. Qual seu segmento? Te mostro algo parecido.',
            'Posso te mandar alguns exemplos. Qual área você atua?'
        ]
    }
};

// Função para pegar resposta aleatória
function getResponse(category, subcategory = 'padrao') {
    const cat = responses[category];
    if (!cat) return null;

    const options = cat[subcategory] || cat['padrao'] || cat['inicial'];
    if (!options || options.length === 0) return null;

    return options[Math.floor(Math.random() * options.length)];
}

module.exports = { responses, getResponse };
