// Sistema de Intents para NLP
// Define todas as intenções do usuário e suas respostas

const intents = {
    // Saudações
    greeting: {
        patterns: [
            'oi', 'olá', 'ola', 'hey', 'hi', 'hello',
            'bom dia', 'boa tarde', 'boa noite',
            'opa', 'e ai', 'eai', 'salve'
        ],
        responses: [
            'Olá! 👋 Bem-vindo à nossa agência digital! Como posso ajudar você hoje?',
            'Oi! Tudo bem? Sou o assistente virtual da agência. Como posso te auxiliar?',
            'Olá! 😊 Posso te ajudar com Tráfego Pago, Marketing Digital ou Desenvolvimento Web!'
        ],
        context: 'greeting'
    },

    // Despedidas
    goodbye: {
        patterns: [
            'tchau', 'até logo', 'falou', 'vlw', 'valeu',
            'obrigado', 'obrigada', 'thanks', 'até mais'
        ],
        responses: [
            'Até logo! Foi um prazer ajudar. Qualquer dúvida, estamos aqui! 👋',
            'Obrigado pelo contato! Até mais! 😊',
            'Tchau! Se precisar, é só chamar! 🚀'
        ],
        context: 'goodbye'
    },

    // Tráfego Pago
    traffic: {
        patterns: [
            'trafego', 'tráfego', 'anuncio', 'anúncio', 'ads',
            'facebook ads', 'google ads', 'meta ads',
            'campanhas', 'anunciar', 'publicidade'
        ],
        responses: [
            `🎯 *TRÁFEGO PAGO*

Criamos e gerenciamos campanhas otimizadas de:

• 📱 *Meta Ads* (Facebook e Instagram)
• 🔍 *Google Ads* (Pesquisa e Display)
• 📊 *LinkedIn Ads*
• 🎥 *YouTube Ads*

✅ ROI garantido
✅ Relatórios semanais
✅ Otimização contínua

Quer um orçamento personalizado?`
        ],
        context: 'services',
        followUp: true
    },

    // Marketing Digital
    marketing: {
        patterns: [
            'marketing', 'redes sociais', 'instagram', 'facebook',
            'social media', 'gestão de redes', 'posts',
            'conteúdo', 'stories', 'engajamento'
        ],
        responses: [
            `📱 *MARKETING DIGITAL*

Gestão completa de redes sociais:

• ✍️ *Criação de Conteúdo* estratégico
• 📸 *Posts e Stories* profissionais
• 💬 *Engajamento* com sua audiência
• 📊 *Relatórios* de performance
• 🎨 *Design* criativo e atrativo

Pacotes a partir de R$ 997/mês.

Gostaria de conhecer nossos planos?`
        ],
        context: 'services',
        followUp: true
    },

    // Desenvolvimento Web
    web_development: {
        patterns: [
            'site', 'website', 'desenvolvimento', 'desenvolver',
            'landing page', 'loja virtual', 'ecommerce',
            'sistema', 'aplicativo', 'app', 'portal'
        ],
        responses: [
            `💻 *DESENVOLVIMENTO WEB*

Criamos soluções digitais sob medida:

• 🌐 *Sites Institucionais*
• 🛒 *E-commerce* completo
• 📄 *Landing Pages* de alta conversão
• ⚙️ *Sistemas Personalizados*
• 📱 *Apps Web Responsivos*

Tecnologias modernas, SEO otimizado e design profissional.

Quer ver nosso portfólio?`
        ],
        context: 'services',
        followUp: true
    },

    // Preços e Orçamento
    pricing: {
        patterns: [
            'preço', 'preco', 'valor', 'quanto custa',
            'orçamento', 'orcamento', 'investimento',
            'planos', 'pacotes', 'valores'
        ],
        responses: [
            `💰 *PREÇOS E INVESTIMENTO*

Nossos valores variam de acordo com a necessidade:

📱 *Gestão de Redes* - a partir de R$ 997/mês
🎯 *Tráfego Pago* - a partir de R$ 1.500/mês
💻 *Sites* - a partir de R$ 2.500
🚀 *Landing Pages* - a partir de R$ 997

Para um orçamento personalizado e detalhado, me informe:

1️⃣ Qual serviço te interessa?
2️⃣ Qual o objetivo principal?

Assim posso passar valores exatos! 😊`
        ],
        context: 'pricing',
        followUp: true
    },

    // Portfólio
    portfolio: {
        patterns: [
            'portfolio', 'portfólio', 'trabalhos',
            'cases', 'clientes', 'projetos',
            'exemplos', 'mostrar'
        ],
        responses: [
            `🎨 *NOSSO PORTFÓLIO*

Temos orgulho dos resultados que geramos:

✅ Mais de 150 clientes atendidos
✅ R$ 2M+ em vendas geradas
✅ 300%+ de ROI médio

Principais cases:
• E-commerce de moda - 250% de aumento em vendas
• Clínica médica - 400% mais agendamentos
• Loja de cosméticos - R$ 180k em 3 meses

Acesse nosso site: [www.agencia.com.br/portfolio]

Qual segmento te interessa mais?`
        ],
        context: 'portfolio'
    },

    // Contato
    contact: {
        patterns: [
            'contato', 'telefone', 'email', 'whatsapp',
            'falar com', 'atendente', 'humano',
            'ligar', 'número'
        ],
        responses: [
            `📞 *FALE CONOSCO*

Estou aqui para ajudar, mas se preferir falar com nossa equipe:

📱 WhatsApp: (11) 99999-9999
📧 Email: contato@agencia.com.br
🌐 Site: www.agencia.com.br

⏰ *Horário de atendimento:*
Segunda a Sexta - 9h às 18h

Posso agendar um horário para você?`
        ],
        context: 'contact'
    },

    // Menu / Ajuda
    menu: {
        patterns: [
            'menu', 'ajuda', 'help', 'opções', 'opcoes',
            'o que você faz', 'serviços', 'servicos'
        ],
        responses: [
            `📋 *MENU DE SERVIÇOS*

Somos especialistas em:

1️⃣ 🎯 *Tráfego Pago* - Meta e Google Ads
2️⃣ 📱 *Marketing Digital* - Gestão de Redes
3️⃣ 💻 *Desenvolvimento Web* - Sites e Sistemas
4️⃣ 💰 *Ver Preços* - Investimento
5️⃣ 🎨 *Portfólio* - Cases de sucesso
6️⃣ 📞 *Contato* - Fale conosco

Digite o número ou nome do serviço que deseja conhecer!`
        ],
        context: 'menu'
    },

    // Agendamento
    schedule: {
        patterns: [
            'agendar', 'reunião', 'reuniao', 'conversar',
            'marcar', 'horário', 'horario', 'disponibilidade'
        ],
        responses: [
            `📅 *AGENDAR REUNIÃO*

Ótimo! Vamos agendar uma conversa com nossa equipe.

Qual o melhor dia e horário para você?

Exemplo: "Segunda-feira às 14h"

Ou prefere que eu te passe nossos horários disponíveis?`
        ],
        context: 'scheduling',
        followUp: true,
        collectData: 'schedule_preference'
    },

    // Interesse / Quero contratar
    interested: {
        patterns: [
            'quero', 'tenho interesse', 'contratar',
            'fechar', 'vamos', 'sim', 'aceito'
        ],
        responses: [
            `🎉 *EXCELENTE!*

Para te atender melhor, preciso de algumas informações:

1️⃣ Qual seu nome?
2️⃣ Nome da empresa (se tiver)
3️⃣ Qual serviço deseja?

Pode me mandar tudo numa mensagem só! 😊`
        ],
        context: 'lead_capture',
        followUp: true,
        collectData: ['name', 'company', 'service']
    }
};

// Palavras-chave de contexto para melhorar detecção
const contextKeywords = {
    urgency: ['urgente', 'rápido', 'hoje', 'agora', 'já'],
    budget: ['barato', 'caro', 'investimento', 'pagar', 'custo'],
    quality: ['melhor', 'qualidade', 'profissional', 'bom'],
    comparison: ['comparar', 'diferença', 'concorrente', 'versus']
};

module.exports = { intents, contextKeywords };
