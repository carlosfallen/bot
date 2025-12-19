
// FILE: src/nlp/intents.js
/**
 * DEFINIÇÃO DE INTENÇÕES
 * Patterns para embeddings e detecção
 */

const intents = {
    // ===== SAUDAÇÕES =====
    greeting: {
        patterns: [
            'oi', 'olá', 'ola', 'hey', 'hi', 'hello',
            'opa', 'e ai', 'eai', 'salve', 'fala',
            'opa tudo bem', 'oi tudo bem', 'tudo bem'
        ],
        priority: 1,
        categoria: 'saudacao'
    },
    
    greeting_morning: {
        patterns: ['bom dia', 'bomdia'],
        priority: 2,
        categoria: 'saudacao',
        subcategoria: 'bom_dia'
    },
    
    greeting_afternoon: {
        patterns: ['boa tarde', 'boatarde'],
        priority: 2,
        categoria: 'saudacao',
        subcategoria: 'boa_tarde'
    },
    
    greeting_night: {
        patterns: ['boa noite', 'boanoite'],
        priority: 2,
        categoria: 'saudacao',
        subcategoria: 'boa_noite'
    },

    // ===== DESPEDIDAS =====
    goodbye: {
        patterns: [
            'tchau', 'até logo', 'ate logo', 'falou',
            'flw', 'fui', 'bye', 'até mais', 'ate mais',
            'vou nessa', 'to indo'
        ],
        priority: 2,
        categoria: 'despedida',
        subcategoria: 'sem_proposta'
    },

    thanks: {
        patterns: [
            'obrigado', 'obrigada', 'brigado', 'brigada',
            'valeu', 'vlw', 'agradeço', 'muito obrigado',
            'valeu pela ajuda', 'thanks', 'obg'
        ],
        priority: 3,
        categoria: 'despedida',
        subcategoria: 'agradecimento'
    },

    // ===== SITES =====
    site: {
        patterns: [
            'site', 'website', 'criar site', 'fazer site',
            'quero um site', 'preciso de um site',
            'fazer um site', 'site institucional',
            'site pra minha empresa', 'site para empresa',
            'vocês fazem site', 'voces fazem site',
            'faz site', 'desenvolver site'
        ],
        priority: 8,
        servico: 'site',
        categoria: 'site',
        subcategoria: 'interesse_inicial'
    },

    site_simples: {
        patterns: [
            'site simples', 'algo simples', 'bem simples',
            'basico', 'básico', 'só pra apresentar',
            'so pra apresentar', 'site de apresentação',
            'nada muito elaborado', 'coisa simples',
            'site institucional simples'
        ],
        priority: 9,
        servico: 'site',
        tipo: 'simples',
        categoria: 'site',
        subcategoria: 'simples'
    },

    site_completo: {
        patterns: [
            'site completo', 'site profissional',
            'site grande', 'site robusto',
            'preciso de várias páginas', 'muitas funcionalidades'
        ],
        priority: 9,
        servico: 'site',
        tipo: 'completo',
        categoria: 'site',
        subcategoria: 'completo'
    },

    ecommerce: {
        patterns: [
            'loja virtual', 'ecommerce', 'e-commerce',
            'loja online', 'vender online', 'site de vendas',
            'quero vender pela internet', 'montar loja'
        ],
        priority: 9,
        servico: 'site',
        tipo: 'loja',
        categoria: 'site',
        subcategoria: 'loja'
    },

    // ===== LANDING PAGE =====
    landing: {
        patterns: [
            'landing page', 'landingpage', 'landing',
            'página de captura', 'pagina de captura',
            'página de vendas', 'pagina de vendas',
            'página única', 'pagina unica', 'one page'
        ],
        priority: 9,
        servico: 'landing',
        categoria: 'landing',
        subcategoria: 'interesse_inicial'
    },

    // ===== TRÁFEGO PAGO =====
    trafego: {
        patterns: [
            'trafego pago', 'tráfego pago', 'trafego',
            'anuncio', 'anúncio', 'anuncios', 'anúncios',
            'facebook ads', 'instagram ads', 'meta ads',
            'google ads', 'ads', 'campanhas',
            'anunciar', 'rodar anuncios', 'fazer anuncios',
            'impulsionar', 'patrocinar', 'publicidade'
        ],
        priority: 8,
        servico: 'trafego',
        categoria: 'trafego',
        subcategoria: 'interesse_inicial'
    },

    trafego_meta: {
        patterns: [
            'facebook', 'instagram', 'meta',
            'anuncio no facebook', 'anuncio no instagram'
        ],
        priority: 9,
        servico: 'trafego',
        plataforma: 'meta',
        categoria: 'trafego'
    },

    trafego_google: {
        patterns: [
            'google', 'google ads', 'pesquisa google',
            'anunciar no google'
        ],
        priority: 9,
        servico: 'trafego',
        plataforma: 'google',
        categoria: 'trafego'
    },

    // ===== MARKETING/REDES =====
    marketing: {
        patterns: [
            'marketing', 'marketing digital',
            'redes sociais', 'gestao de redes', 'gestão de redes',
            'social media', 'gerenciar redes',
            'gerenciar instagram', 'gerenciar facebook',
            'posts', 'postagens', 'conteudo', 'conteúdo',
            'criar posts', 'fazer posts'
        ],
        priority: 8,
        servico: 'marketing',
        categoria: 'marketing',
        subcategoria: 'interesse_inicial'
    },

    // ===== PREÇOS =====
    pricing: {
        patterns: [
            'preço', 'preco', 'valor', 'valores',
            'quanto custa', 'quanto é', 'quanto e',
            'orçamento', 'orcamento', 'investimento',
            'quanto fica', 'quanto sai', 'quanto vai custar',
            'me passa o valor', 'qual o valor', 'qual é o valor',
            'tabela de preços', 'quanto cobram', 'qual o preco'
        ],
        priority: 10,
        categoria: 'precos'
    },

    pricing_site: {
        patterns: [
            'quanto custa um site', 'valor do site',
            'preço do site', 'preco do site',
            'quanto fica um site', 'site quanto custa'
        ],
        priority: 11,
        servico: 'site',
        categoria: 'site',
        subcategoria: 'preco'
    },

    pricing_landing: {
        patterns: [
            'quanto custa landing', 'valor da landing',
            'preço da landing', 'landing page quanto custa'
        ],
        priority: 11,
        servico: 'landing',
        categoria: 'landing',
        subcategoria: 'preco'
    },

    pricing_trafego: {
        patterns: [
            'quanto custa trafego', 'valor do trafego',
            'preço gestão de trafego', 'trafego quanto custa'
        ],
        priority: 11,
        servico: 'trafego',
        categoria: 'trafego',
        subcategoria: 'preco'
    },

    pricing_marketing: {
        patterns: [
            'quanto custa gestao de redes', 'valor gestão de redes',
            'preço marketing', 'marketing quanto custa'
        ],
        priority: 11,
        servico: 'marketing',
        categoria: 'marketing',
        subcategoria: 'preco'
    },

    // ===== CONFIRMAÇÕES =====
    affirmative: {
        patterns: [
            'sim', 'quero', 'isso', 'claro', 'ok',
            'beleza', 'pode ser', 'bora', 'vamos',
            'sim por favor', 'quero sim', 'isso mesmo',
            'exato', 'certo', 'positivo', 'show', 'top',
            'isso ai', 'perfeito', 'fechado', 'combinado',
            'manda', 'pode', 'aceito'
        ],
        priority: 4,
        categoria: 'confirmacao'
    },

    negative: {
        patterns: [
            'não', 'nao', 'agora não', 'agora nao',
            'depois', 'não quero', 'nao quero',
            'não preciso', 'talvez depois', 'vou pensar',
            'deixa pra lá', 'deixa quieto', 'não obrigado'
        ],
        priority: 4,
        categoria: 'objecoes',
        subcategoria: 'pensar'
    },

    // ===== EXPLICAÇÕES =====
    explain: {
        patterns: [
            'como funciona', 'me explica', 'explica melhor',
            'quero entender', 'fala mais sobre',
            'me conta mais', 'como é', 'como seria',
            'o que inclui', 'o que vem', 'o que está incluso'
        ],
        priority: 6,
        categoria: 'explicacao'
    },

    // ===== PROPOSTA =====
    send_proposal: {
        patterns: [
            'manda pra mim', 'me manda', 'envia',
            'manda a proposta', 'quero a proposta',
            'pode mandar', 'me envia', 'quero proposta',
            'faz a proposta', 'monta a proposta'
        ],
        priority: 9,
        categoria: 'proposta'
    },

    // ===== DÚVIDAS =====
    prazo: {
        patterns: [
            'quanto tempo', 'qual o prazo', 'demora quanto',
            'prazo de entrega', 'quando fica pronto',
            'em quanto tempo fica pronto', 'tempo de entrega'
        ],
        priority: 7,
        categoria: 'duvidas',
        subcategoria: 'prazo'
    },

    garantia: {
        patterns: [
            'tem garantia', 'garantia', 'e se der problema',
            'suporte depois', 'tem suporte', 'vocês dão suporte'
        ],
        priority: 7,
        categoria: 'duvidas',
        subcategoria: 'garantia'
    },

    pagamento: {
        patterns: [
            'como paga', 'forma de pagamento', 'paga como',
            'parcela', 'parcelamento', 'aceita pix',
            'aceita cartão', 'aceita cartao', 'pode parcelar'
        ],
        priority: 7,
        categoria: 'duvidas',
        subcategoria: 'pagamento'
    },

    // ===== MENU/AJUDA =====
    menu: {
        patterns: [
            'menu', 'ajuda', 'opções', 'opcoes',
            'o que vocês fazem', 'o que voces fazem',
            'serviços', 'servicos', 'quais serviços',
            'como funciona', 'me ajuda'
        ],
        priority: 5,
        categoria: 'menu',
        subcategoria: 'servicos'
    },

    // ===== AGENDAMENTO =====
    schedule: {
        patterns: [
            'agendar', 'reunião', 'reuniao', 'marcar',
            'call', 'conversar por telefone', 'ligar',
            'marcar horário', 'quero agendar', 'posso ligar'
        ],
        priority: 7,
        categoria: 'agendamento',
        subcategoria: 'oferecer'
    },

    // ===== PORTFÓLIO =====
    portfolio: {
        patterns: [
            'portfolio', 'portfólio', 'trabalhos',
            'cases', 'clientes', 'exemplos',
            'mostrar trabalhos', 'ver trabalhos',
            'já fizeram', 'projetos anteriores'
        ],
        priority: 7,
        categoria: 'portfolio',
        subcategoria: 'geral'
    },

    // ===== CONTATO =====
    contact: {
        patterns: [
            'contato', 'telefone', 'email', 'whatsapp',
            'falar com humano', 'falar com atendente',
            'pessoa real', 'número', 'ligar pra vocês'
        ],
        priority: 7,
        categoria: 'contato',
        subcategoria: 'info'
    },

    // ===== URGÊNCIA =====
    urgency: {
        patterns: [
            'urgente', 'urgência', 'pra ontem',
            'muito urgente', 'preciso rápido',
            'é urgente', 'super urgente', 'emergência'
        ],
        priority: 10,
        categoria: 'urgencia',
        subcategoria: 'detectada'
    },

    // ===== OBJEÇÕES =====
    expensive: {
        patterns: [
            'caro', 'muito caro', 'ta caro', 'tá caro',
            'acima do orçamento', 'não tenho esse valor',
            'pesa no bolso', 'fora do orçamento'
        ],
        priority: 8,
        categoria: 'objecoes',
        subcategoria: 'caro'
    },

    compare: {
        patterns: [
            'vou comparar', 'vou pesquisar', 'ver outras opções',
            'tem concorrente mais barato', 'vou cotar'
        ],
        priority: 8,
        categoria: 'objecoes',
        subcategoria: 'comparar'
    }
};

const contextKeywords = {
    urgency: ['urgente', 'rápido', 'rapido', 'hoje', 'agora', 'já', 'pressa', 'correndo'],
    budget: ['barato', 'caro', 'orçamento', 'orcamento', 'verba', 'investimento'],
    quality: ['profissional', 'qualidade', 'melhor', 'bom']
};

module.exports = { intents, contextKeywords };
