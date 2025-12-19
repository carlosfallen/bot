const intents = {
    greeting: {
        patterns: [
            'oi', 'olá', 'ola', 'hey', 'hi', 'hello',
            'bom dia', 'boa tarde', 'boa noite',
            'opa', 'e ai', 'eai', 'salve', 'fala',
            'opa tudo bem', 'oi tudo bem', 'olá tudo bem'
        ],
        responses: [
            `Oi! 👋 A gente trabalha com tráfego pago, marketing digital e criação de sites. Me conta o que você tá buscando.`
        ],
        context: 'greeting',
        priority: 1
    },

    goodbye: {
        patterns: [
            'tchau', 'até logo', 'falou', 'vlw', 'valeu',
            'obrigado', 'obrigada', 'thanks', 'até mais',
            'flw', 'abraço', 'abraco', 'brigado', 'brigada'
        ],
        responses: [
            `Beleza! Qualquer coisa, só chamar aqui. 👋`
        ],
        context: 'goodbye',
        priority: 2
    },

    pricing: {
        patterns: [
            'preço', 'preco', 'valor', 'valores', 'quanto custa', 'quanto é',
            'orçamento', 'orcamento', 'investimento', 'custo', 'custos',
            'planos', 'pacotes', 'tabela', 'qual o valor', 'qual é o valor',
            'qual e o valor', 'saber de valores', 'saber valores', 'saber o valor',
            'quanto fica', 'quanto sai', 'quanto vai custar', 'quanto custa isso',
            'me passa o valor', 'passa o valor', 'valor do', 'preço do',
            'quanto cobram', 'quanto vocês cobram', 'quanto voces cobram',
            'qual o preço da landing page', 'quanto custa um site',
            'valor da landing page', 'preço do site', 'quanto custa landing page'
        ],
        responses: [
            `Os valores variam conforme o projeto, mas pra te dar uma ideia:

📱 Gestão de redes — a partir de R$ 997/mês
🎯 Tráfego pago — a partir de R$ 1.500/mês
💻 Sites — a partir de R$ 2.500
🚀 Landing pages — a partir de R$ 997

Me conta qual desses te interessa que eu detalho melhor.`
        ],
        context: 'pricing',
        followUp: true,
        priority: 10
    },

    traffic: {
        patterns: [
            'trafego pago', 'tráfego pago', 'gestão de trafego', 'gestao de trafego',
            'anuncio no facebook', 'anúncio no facebook', 'anuncio no instagram',
            'facebook ads', 'google ads', 'meta ads', 'instagram ads',
            'campanhas pagas', 'anunciar no google', 'anunciar no facebook',
            'publicidade online', 'publicidade paga', 'impulsionar',
            'patrocinar posts', 'patrocinar publicação', 'fazer anuncios',
            'quero anunciar', 'preciso de anuncios', 'rodar campanhas'
        ],
        responses: [
            `A gente cuida de campanhas no Meta (Facebook e Instagram) e Google Ads.

Inclui criação, otimização e relatórios semanais. O foco é sempre no retorno do investimento.

Se quiser, posso montar uma proposta pro seu caso.`
        ],
        context: 'services',
        followUp: true,
        priority: 8
    },

    marketing: {
        patterns: [
            'marketing digital', 'marketing', 'redes sociais', 'gestao de redes',
            'gestão de redes', 'social media', 'posts para instagram',
            'conteúdo para redes', 'conteudo para redes', 'stories',
            'engajamento', 'gerenciar instagram', 'gerenciar redes',
            'criar posts', 'criar conteudo', 'criar conteúdo',
            'preciso de posts', 'quero postar mais', 'gestão do instagram'
        ],
        responses: [
            `Fazemos a gestão completa das redes: posts, stories, engajamento e relatórios.

Os pacotes começam em R$ 997/mês, dependendo da frequência de publicações.

Quer que eu explique como funciona na prática?`
        ],
        context: 'services',
        followUp: true,
        priority: 8
    },

    web_development: {
        patterns: [
            'site', 'website', 'criar site', 'fazer site', 'desenvolvimento web',
            'landing page', 'landingpage', 'pagina de vendas', 'página de vendas',
            'loja virtual', 'ecommerce', 'e-commerce', 'loja online',
            'sistema web', 'aplicativo', 'app', 'portal',
            'quero um site', 'preciso de um site', 'fazer um site',
            'criar uma landing', 'fazer uma landing', 'preciso de uma landing'
        ],
        responses: [
            `Criamos sites institucionais, landing pages e lojas virtuais.

As landing pages começam em R$ 997 e os sites a partir de R$ 2.500, dependendo do escopo.

Qual tipo de projeto você tem em mente?`
        ],
        context: 'services',
        followUp: true,
        priority: 8
    },

    portfolio: {
        patterns: [
            'portfolio', 'portfólio', 'trabalhos anteriores',
            'cases', 'clientes', 'projetos realizados',
            'exemplos', 'mostrar trabalhos', 'ver trabalhos',
            'ja fizeram', 'já fizeram', 'resultados anteriores'
        ],
        responses: [
            `Já atendemos mais de 150 clientes em diferentes segmentos.

Alguns resultados: e-commerce com +250% em vendas, clínica com +400% de agendamentos.

Se quiser, posso te mostrar cases do seu setor.`
        ],
        context: 'portfolio',
        priority: 7
    },

    contact: {
        patterns: [
            'contato', 'telefone', 'email', 'whatsapp da empresa',
            'falar com humano', 'falar com atendente', 'atendente humano',
            'ligar', 'número da empresa', 'falar com alguem',
            'falar com alguém', 'pessoa real', 'quero falar com alguem'
        ],
        responses: [
            `Pode falar comigo mesmo por aqui, é o canal mais rápido.

Se preferir, nosso time atende de segunda a sexta, das 9h às 18h.

📧 contato@agencia.com.br
📱 (11) 99999-9999`
        ],
        context: 'contact',
        priority: 7
    },

    menu: {
        patterns: [
            'menu', 'ajuda', 'help', 'opções', 'opcoes',
            'o que você faz', 'o que voce faz', 'serviços', 'servicos',
            'como funciona', 'me ajuda', 'não entendi', 'nao entendi',
            'quais serviços', 'o que vocês fazem'
        ],
        responses: [
            `A gente trabalha com três frentes principais:

1. Tráfego pago (Meta e Google Ads)
2. Gestão de redes sociais
3. Criação de sites e landing pages

Qual dessas faz mais sentido pra você?`
        ],
        context: 'menu',
        priority: 5
    },

    schedule: {
        patterns: [
            'agendar', 'reunião', 'reuniao', 'conversar pessoalmente',
            'marcar horário', 'marcar horario', 'disponibilidade',
            'agenda', 'call', 'videoconferencia', 'videochamada',
            'quero agendar', 'podemos conversar', 'marcar uma conversa'
        ],
        responses: [
            `Posso agendar uma conversa rápida com o time.

Me passa o melhor dia e horário pra você que eu confirmo.`
        ],
        context: 'scheduling',
        followUp: true,
        collectData: 'schedule_preference',
        priority: 7
    },

    interested: {
        patterns: [
            'quero contratar', 'tenho interesse', 'me interessa',
            'fechar negocio', 'fechar negócio', 'vamos fechar',
            'quero sim', 'aceito', 'bora', 'vamos la', 'vamos lá',
            'pode ser', 'fechado', 'combinado', 'quero saber mais',
            'me interesso', 'tenho interesse nisso'
        ],
        responses: [
            `Boa! Pra montar uma proposta, preciso de algumas infos:

- Seu nome
- Empresa (se tiver)
- Qual serviço te interessou

Pode mandar tudo junto aqui.`
        ],
        context: 'lead_capture',
        followUp: true,
        collectData: ['name', 'company', 'service'],
        priority: 9
    },

    affirmative: {
        patterns: [
            'sim', 's', 'isso', 'isso mesmo', 'exato', 'correto',
            'com certeza', 'claro', 'ok', 'okay', 'beleza', 'blz',
            'pode ser', 'quero', 'quero sim', 'yes', 'positivo',
            'isso aí', 'perfeito', 'isso ai'
        ],
        responses: [
            `Beleza! Me conta mais detalhes do que você precisa.`
        ],
        context: 'affirmative',
        priority: 3
    },

    negative: {
        patterns: [
            'não', 'nao', 'n', 'nope', 'negativo', 'ainda não',
            'ainda nao', 'depois', 'agora não', 'agora nao',
            'no momento não', 'no momento nao', 'talvez depois',
            'não quero', 'nao quero', 'não preciso'
        ],
        responses: [
            `Sem problema. Se mudar de ideia, é só chamar aqui.`
        ],
        context: 'negative',
        priority: 3
    },

    lead_info: {
        patterns: [],
        responses: [
            `Anotado! Vou passar pro time e alguém entra em contato em breve.

Precisa de mais alguma coisa?`
        ],
        context: 'lead_captured',
        priority: 1
    }
};

const contextKeywords = {
    urgency: ['urgente', 'rápido', 'rapido', 'hoje', 'agora', 'já', 'ja', 'pressa', 'logo'],
    budget: ['barato', 'caro', 'investimento', 'pagar', 'custo', 'orçamento', 'orcamento', 'verba'],
    quality: ['melhor', 'qualidade', 'profissional', 'bom', 'excelente'],
    comparison: ['comparar', 'diferença', 'diferenca', 'concorrente', 'versus', 'vs']
};

module.exports = { intents, contextKeywords };
