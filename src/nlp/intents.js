// FILE: src/nlp/intents.js
/**
 * PATTERNS DE INTENÇÕES PARA EMBEDDINGS
 */

const intents = {
    greeting: {
        patterns: [
            'oi', 'olá', 'ola', 'hey', 'hi', 'hello', 'opa', 'eai', 'e ai',
            'salve', 'fala', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem',
            'tudo certo', 'como vai', 'oi tudo bem', 'opa tudo bem'
        ],
        priority: 1
    },
    goodbye: {
        patterns: [
            'tchau', 'até logo', 'ate logo', 'falou', 'flw', 'fui', 'bye',
            'até mais', 'ate mais', 'vou nessa', 'valeu', 'obrigado', 'obrigada',
            'brigado', 'brigada', 'vlw', 'tmj'
        ],
        priority: 2
    },
    site: {
        patterns: [
            'site', 'website', 'criar site', 'fazer site', 'quero um site',
            'preciso de um site', 'site institucional', 'site pra empresa',
            'site para empresa', 'voces fazem site', 'vocês fazem site',
            'faz site', 'desenvolver site', 'pagina', 'página'
        ],
        priority: 8,
        assunto: 'site'
    },
    landing: {
        patterns: [
            'landing page', 'landingpage', 'landing', 'pagina de captura',
            'página de captura', 'pagina de vendas', 'página de vendas',
            'one page', 'uma pagina', 'uma página', 'pagina unica'
        ],
        priority: 9,
        assunto: 'landing'
    },
    ecommerce: {
        patterns: [
            'loja virtual', 'ecommerce', 'e-commerce', 'loja online',
            'vender online', 'site de vendas', 'carrinho', 'montar loja'
        ],
        priority: 9,
        assunto: 'ecommerce'
    },
    trafego: {
        patterns: [
            'trafego pago', 'tráfego pago', 'trafego', 'tráfego',
            'anuncio', 'anúncio', 'anuncios', 'anúncios',
            'facebook ads', 'instagram ads', 'google ads', 'meta ads',
            'ads', 'campanhas', 'anunciar', 'impulsionar', 'patrocinar'
        ],
        priority: 8,
        assunto: 'trafego'
    },
    marketing: {
        patterns: [
            'marketing', 'marketing digital', 'redes sociais',
            'gestao de redes', 'gestão de redes', 'social media',
            'instagram', 'posts', 'stories', 'conteudo', 'conteúdo',
            'gerenciar redes', 'criar posts'
        ],
        priority: 8,
        assunto: 'marketing'
    },
    pricing: {
        patterns: [
            'preco', 'preço', 'valor', 'valores', 'quanto custa',
            'quanto é', 'quanto e', 'orcamento', 'orçamento',
            'quanto fica', 'quanto sai', 'tabela de precos', 'investimento'
        ],
        priority: 10
    },
    proposal: {
        patterns: [
            'proposta', 'quero proposta', 'manda proposta', 'me manda',
            'envia', 'quero fechar', 'fechar', 'contratar'
        ],
        priority: 10
    },
    confirm: {
        patterns: [
            'sim', 'quero', 'isso', 'claro', 'ok', 'beleza', 'pode',
            'bora', 'vamos', 'fechado', 'combinado', 'aceito', 'show', 'top'
        ],
        priority: 4
    },
    deny: {
        patterns: [
            'não', 'nao', 'depois', 'talvez', 'vou pensar', 'agora nao'
        ],
        priority: 4
    }
};

module.exports = { intents };