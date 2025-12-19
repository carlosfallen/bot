// FILE: src/nlp/intents.js
/**
 * Definição de intenções para detecção
 * Patterns para embeddings e fallback
 */

const intents = {
    greeting: {
        patterns: [
            'oi', 'olá', 'ola', 'hey', 'hi', 'hello',
            'bom dia', 'boa tarde', 'boa noite',
            'opa', 'e ai', 'eai', 'salve', 'fala',
            'opa tudo bem', 'oi tudo bem'
        ],
        priority: 1
    },

    goodbye: {
        patterns: [
            'tchau', 'até logo', 'falou', 'ate depois',
            'flw', 'fui', 'bye', 'até mais'
        ],
        priority: 2
    },

    thanks: {
        patterns: [
            'obrigado', 'obrigada', 'brigado', 'brigada',
            'valeu', 'vlw', 'agradeço', 'muito obrigado',
            'valeu pela ajuda'
        ],
        priority: 3
    },

    pricing: {
        patterns: [
            'preço', 'preco', 'valor', 'valores', 'quanto custa',
            'quanto é', 'orçamento', 'orcamento', 'custo',
            'quanto fica', 'quanto sai', 'me passa o valor',
            'qual o valor', 'tabela de preços', 'quanto cobram'
        ],
        priority: 10
    },

    web_development: {
        patterns: [
            'site', 'website', 'criar site', 'fazer site',
            'landing page', 'landingpage', 'pagina de vendas',
            'loja virtual', 'ecommerce', 'loja online',
            'quero um site', 'preciso de um site',
            'fazer uma landing', 'site institucional',
            'site simples', 'site pra minha empresa',
            'apresentar minha loja', 'apresentar minha empresa',
            'vocês fazem site', 'voces fazem site'
        ],
        priority: 8,
        assunto: 'site'
    },

    landing: {
        patterns: [
            'landing page', 'landingpage', 'landing',
            'página de captura', 'pagina de captura',
            'página de vendas', 'pagina de vendas'
        ],
        priority: 9,
        assunto: 'landing'
    },

    traffic: {
        patterns: [
            'trafego pago', 'tráfego pago', 'trafego',
            'facebook ads', 'google ads', 'meta ads',
            'instagram ads', 'anuncio', 'anúncio',
            'campanhas', 'anunciar', 'impulsionar',
            'como funciona o trafego', 'gestão de trafego'
        ],
        priority: 8,
        assunto: 'trafego'
    },

    marketing: {
        patterns: [
            'marketing', 'redes sociais', 'gestao de redes',
            'gestão de redes', 'social media', 'instagram',
            'posts', 'stories', 'engajamento',
            'gerenciar instagram', 'criar posts',
            'como funciona gestao de redes'
        ],
        priority: 8,
        assunto: 'marketing'
    },

    portfolio: {
        patterns: [
            'portfolio', 'portfólio', 'trabalhos',
            'cases', 'clientes', 'exemplos',
            'mostrar trabalhos', 'ver trabalhos'
        ],
        priority: 7
    },

    schedule: {
        patterns: [
            'agendar', 'reunião', 'reuniao', 'marcar',
            'conversar', 'call', 'videochamada',
            'quero agendar', 'marcar horário'
        ],
        priority: 7
    },

    contact: {
        patterns: [
            'contato', 'telefone', 'email', 'whatsapp',
            'falar com humano', 'falar com atendente',
            'pessoa real'
        ],
        priority: 7
    },

    menu: {
        patterns: [
            'menu', 'ajuda', 'opções', 'opcoes',
            'o que vocês fazem', 'serviços', 'servicos',
            'como funciona'
        ],
        priority: 5
    },

    affirmative: {
        patterns: [
            'sim', 'quero', 'isso', 'claro', 'ok',
            'beleza', 'pode ser', 'bora', 'vamos',
            'sim por favor', 'quero sim', 'isso mesmo',
            'exato', 'certo', 'positivo', 'show', 'top'
        ],
        priority: 4
    },

    negative: {
        patterns: [
            'não', 'nao', 'agora não', 'depois',
            'não quero', 'não preciso', 'talvez depois',
            'vou pensar', 'deixa pra lá'
        ],
        priority: 4
    },

    send_proposal: {
        patterns: [
            'manda pra mim', 'me manda', 'envia',
            'manda a proposta', 'quero a proposta',
            'pode mandar', 'me envia'
        ],
        priority: 9
    },

    explain: {
        patterns: [
            'como funciona', 'me explica', 'explica melhor',
            'quero entender', 'fala mais sobre',
            'me conta mais', 'como é'
        ],
        priority: 6
    },

    simple_site: {
        patterns: [
            'simples', 'algo simples', 'bem simples',
            'basico', 'básico', 'só pra apresentar',
            'nada muito elaborado', 'coisa simples'
        ],
        priority: 9,
        assunto: 'site'
    },

    urgency: {
        patterns: [
            'urgente', 'urgência', 'pra ontem',
            'o mais rápido', 'preciso rápido',
            'é urgente', 'muito urgente'
        ],
        priority: 10
    }
};

const contextKeywords = {
    urgency: ['urgente', 'rápido', 'rapido', 'hoje', 'agora', 'já', 'pressa'],
    budget: ['barato', 'caro', 'investimento', 'orçamento', 'verba']
};

module.exports = { intents, contextKeywords };
