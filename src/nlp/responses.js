// FILE: src/nlp/responses.js
/**
 * BANCO DE RESPOSTAS HUMANIZADAS COMPLETO
 * Muitas variações para parecer natural
 */

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickWithContext(arr, ctx = {}) {
    let text = pick(arr);
    
    // Substituir variáveis
    if (ctx.nome) text = text.replace(/\$NOME/g, ctx.nome);
    if (ctx.assunto) text = text.replace(/\$ASSUNTO/g, ctx.assunto);
    if (ctx.valor) text = text.replace(/\$VALOR/g, ctx.valor);
    if (ctx.parcela) text = text.replace(/\$PARCELA/g, ctx.parcela);
    if (ctx.desconto) text = text.replace(/\$DESCONTO/g, ctx.desconto);
    if (ctx.plano) text = text.replace(/\$PLANO/g, ctx.plano);
    
    return text;
}

const responses = {
    // ==================== SAUDAÇÕES ====================
    GREET_FIRST: [
        'Oi! Tudo bem? Em que posso te ajudar?',
        'Olá! Como posso te ajudar hoje?',
        'Oi! Me conta o que você precisa.',
        'E aí! Tudo certo? O que você tá buscando?',
        'Oi! Seja bem-vindo! Em que posso ajudar?',
        'Olá! Que bom que entrou em contato. Me conta o que precisa!'
    ],

    GREET_RETURN: [
        'Oi de novo! Em que posso ajudar?',
        'E aí! Tudo certo?',
        'Oi! Continuando de onde paramos?',
        'Opa! Voltou. O que você precisa agora?',
        'Oi! Quer retomar o assunto ou tirar outra dúvida?'
    ],

    GREET_COLD_NEW: [
        'Oi! Faz tempo que não nos falamos. Posso te ajudar com algo?',
        'Olá! Que bom te ver por aqui. Em que posso ajudar?',
        'Oi! Tudo bem com você? Me conta o que precisa.'
    ],

    GREET_COLD_WITH_HISTORY: [
        'Oi! Você tinha interesse em $ASSUNTO, né? Quer continuar dali ou mudou de ideia?',
        'Olá! Da última vez conversamos sobre $ASSUNTO. Quer retomar ou é outro assunto?',
        'Oi! Lembro que você perguntou sobre $ASSUNTO. Ainda tem interesse?'
    ],

    RESUME_CONVERSATION: [
        'Oi! Voltando no $ASSUNTO: quer que eu te passe as opções ou prefere tirar uma dúvida?',
        'Opa! Retomando: sobre $ASSUNTO, posso te ajudar com valores ou explicar melhor?',
        'E aí! Continuando sobre $ASSUNTO. O que você quer saber?',
        'Oi! Sobre o $ASSUNTO que você perguntou: quer ver as opções ou tirar dúvidas primeiro?'
    ],

    // ==================== MENU / SERVIÇOS ====================
    EXPLAIN_SERVICES: [
        'A gente trabalha com:\n\n1️⃣ Sites e Landing Pages\n2️⃣ Tráfego Pago (anúncios)\n3️⃣ Gestão de Redes Sociais\n\nQual desses te interessa?',
        'Posso te ajudar com sites, anúncios online ou gestão de redes. Qual você tá buscando?',
        'Trabalhamos com três frentes: sites/landing, tráfego pago e redes sociais. Qual faz sentido pra você?'
    ],

    ASK_SERVICE_FOR_PRICE: [
        'Claro! Pra te passar os valores, me diz: é pra site, tráfego ou redes sociais?',
        'Os preços variam. Você tá pensando em site, anúncios ou gestão de redes?',
        'Depende do serviço. É site, tráfego ou redes que você quer?'
    ],

    ASK_SERVICE_FOR_PROPOSAL: [
        'Pra montar a proposta, preciso saber: é pra site, tráfego ou redes?',
        'Qual serviço você quer? Site, anúncios ou gestão de redes?'
    ],

    // ==================== SITES ====================
    START_SITE: [
        'Fazemos sim! Você quer algo simples, só pra apresentar, ou precisa de algo mais completo?',
        'Site a gente faz! É mais pra mostrar sua empresa ou vai precisar de funcionalidades específicas?',
        'Perfeito! Você imagina algo mais básico ou mais robusto?',
        'Legal! Me conta: é pra ter presença online ou precisa de algo mais elaborado?'
    ],

    START_SITE_SIMPLE: [
        'Entendi! Um site simples é perfeito pra começar. Geralmente inclui umas 5 páginas, formulário e WhatsApp. Te explico melhor?',
        'Site simples é uma boa! Fica bem profissional e atende bem quem quer apresentar o negócio. Quer saber o valor?',
        'Beleza! Site básico é ideal pra quem quer marcar presença online sem gastar muito. Posso te passar os detalhes?'
    ],

    START_SITE_COMPLETE: [
        'Entendi que você quer algo mais completo! Dá pra fazer com várias páginas, blog, área de clientes... Me conta mais o que imagina?',
        'Site completo é bacana! Podemos incluir várias funcionalidades. O que você precisa ter nele?'
    ],

    START_LANDING: [
        'Landing page a gente faz! É pra captar leads ou pra vender algo específico?',
        'Perfeito! Landing é ótima pra campanhas. Você quer capturar contatos ou vender direto?',
        'Legal! Landing page é ideal pra conversão. Qual o objetivo: captar leads ou vendas?'
    ],

    START_ECOMMERCE: [
        'Loja virtual a gente faz também! Você já vende em algum lugar ou vai começar do zero?',
        'E-commerce é com a gente sim! Quantos produtos mais ou menos você tem?',
        'Perfeito! Loja online é o que fazemos. Você já tem os produtos organizados?'
    ],

    EXPLAIN_SITE: [
        'O site funciona assim: a gente faz o design, monta as páginas e coloca no ar. Você me passa as informações (textos, fotos) e eu organizo tudo profissionalmente.',
        'Basicamente: você me conta sobre seu negócio, eu crio o layout, você aprova e a gente publica. Simples assim!',
        'É tranquilo: eu cuido de toda parte técnica (design, programação, hospedagem). Você só precisa me passar o conteúdo.'
    ],

    // ==================== TRÁFEGO ====================
    START_TRAFEGO: [
        'Trabalhamos com Meta Ads e Google Ads. Você já rodou campanha antes ou vai começar agora?',
        'Fazemos gestão de tráfego sim! É pra Instagram/Facebook ou Google?',
        'Tráfego pago a gente cuida! Você quer anunciar em qual plataforma?',
        'Perfeito! Trabalhamos com todas as plataformas. Já tem experiência com anúncios?'
    ],

    EXPLAIN_TRAFEGO: [
        'Funciona assim: você define quanto quer investir nos anúncios, e eu cuido de criar as campanhas, segmentar o público e otimizar pra ter o melhor resultado.',
        'O tráfego pago é: você coloca uma verba, eu crio os anúncios e fico ajustando pra trazer o máximo de resultado possível. Te mando relatório toda semana.',
        'Basicamente: eu cuido de tudo (criação, público, otimização) e você acompanha os resultados. O investimento em anúncios é separado da gestão.'
    ],

    // ==================== MARKETING ====================
    START_MARKETING: [
        'Fazemos gestão de redes sim! Quais redes você usa hoje?',
        'Perfeito! É pra Instagram, Facebook, LinkedIn? Quais você precisa?',
        'Gestão de redes a gente faz! Quantos posts por semana você imagina?',
        'Legal! Você já tem as redes ou precisa criar também?'
    ],

    EXPLAIN_MARKETING: [
        'A gestão inclui: planejamento de conteúdo, criação dos posts/stories, legendas e publicação. Você aprova tudo antes de ir pro ar.',
        'Funciona assim: eu monto um calendário, crio as artes e textos, você aprova e eu publico. Cuido de todo o conteúdo.',
        'Basicamente: planejo, crio e posto. Você só precisa aprovar. Também respondo comentários e mensagens se quiser.'
    ],

    // ==================== OPÇÕES ====================
    SHOW_OPTIONS_SITE: [
        'Pra sites, tenho 3 opções:\n\n1️⃣ *Site Simples* - R$ 2.500\n(5 páginas, formulário, WhatsApp)\n\n2️⃣ *Site Completo* - R$ 4.500\n(10 páginas, blog, painel admin)\n\n3️⃣ *Loja Virtual* - R$ 5.500\n(carrinho, pagamento, estoque)\n\nQual faz mais sentido pra você?',
        'Tenho essas opções de site:\n\n1️⃣ Simples (R$ 2.500) - ideal pra apresentar\n2️⃣ Completo (R$ 4.500) - mais páginas e recursos\n3️⃣ Loja (R$ 5.500) - pra vender online\n\nQual te interessa?'
    ],

    SHOW_OPTIONS_LANDING: [
        'Pra landing page:\n\n1️⃣ *Captura* - R$ 997\n(formulário + WhatsApp)\n\n2️⃣ *Vendas* - R$ 1.500\n(copy profissional + checkout)\n\nQual você precisa?',
        'Tenho duas opções:\n\n1️⃣ Landing de Captura (R$ 997)\n2️⃣ Landing de Vendas (R$ 1.500)\n\nA primeira é pra pegar contatos, a segunda pra vender direto. Qual faz sentido?'
    ],

    SHOW_OPTIONS_TRAFEGO: [
        'Pra tráfego, tenho 3 planos:\n\n1️⃣ *Starter* - R$ 1.500/mês\n(1 plataforma, 3 campanhas)\n\n2️⃣ *Pro* - R$ 2.500/mês\n(Meta + Google, ilimitado)\n\n3️⃣ *Scale* - R$ 4.500/mês\n(todas plataformas, gerente dedicado)\n\nQual te interessa?',
        'Os planos de tráfego:\n\n1️⃣ Starter (R$ 1.500/mês)\n2️⃣ Pro (R$ 2.500/mês)\n3️⃣ Scale (R$ 4.500/mês)\n\nO investimento em anúncios é à parte. Qual quer saber mais?'
    ],

    SHOW_OPTIONS_MARKETING: [
        'Pra gestão de redes:\n\n1️⃣ *Básico* - R$ 997/mês\n(8 posts, 1 rede)\n\n2️⃣ *Completo* - R$ 1.800/mês\n(16 posts + reels, 3 redes)\n\n3️⃣ *Premium* - R$ 3.500/mês\n(diário, todas as redes)\n\nQual faz mais sentido?',
        'Os pacotes de redes:\n\n1️⃣ Básico (R$ 997) - 8 posts/mês\n2️⃣ Completo (R$ 1.800) - 16 posts + reels\n3️⃣ Premium (R$ 3.500) - conteúdo diário\n\nQual te interessa?'
    ],

    // ==================== PREÇOS ====================
    GIVE_PRICE_SITE: [
        'Site simples fica a partir de R$ 2.500. Se precisar de mais páginas ou funcionalidades, sobe um pouco. Quer que eu detalhe o que inclui?',
        'Um site institucional simples começa em R$ 2.500. Sites mais completos vão de R$ 4.500 a R$ 8.000. Depende do que você precisa.',
        'Pra um site básico de apresentação, R$ 2.500. Se for loja virtual, R$ 5.500. Quer saber o que vem em cada um?'
    ],

    GIVE_PRICE_LANDING: [
        'Landing page fica a partir de R$ 997. Se for página de vendas com checkout, R$ 1.500.',
        'Uma landing simples sai R$ 997. Com copy profissional e checkout, R$ 1.500.'
    ],

    GIVE_PRICE_TRAFEGO: [
        'Gestão de tráfego começa em R$ 1.500/mês. O valor dos anúncios é separado - você define quanto quer investir.',
        'O pacote de gestão é a partir de R$ 1.500 mensais. Os anúncios em si você paga direto pra plataforma (Meta, Google).',
        'Tráfego: gestão a partir de R$ 1.500/mês. Recomendo no mínimo R$ 1.000/mês de verba pra anúncios pra ter resultado.'
    ],

    GIVE_PRICE_MARKETING: [
        'Gestão de redes começa em R$ 997/mês. Pacotes maiores com mais posts ficam entre R$ 1.800 e R$ 3.500.',
        'Redes sociais: a partir de R$ 997/mês pro básico (8 posts). Pacote completo com reels é R$ 1.800.'
    ],

    PRICE_REMINDER: [
        'Já te passei os valores, lembra? Se quiser, posso detalhar o que inclui em cada opção.',
        'Os valores são os que te falei. Quer que eu explique o que vem em cada pacote?',
        'O preço continua o mesmo. Posso te ajudar a escolher a melhor opção pro seu caso?'
    ],

    // ==================== OBJEÇÕES ====================
    OFFER_DISCOUNT: [
        'Olha, consigo fazer um esforço. Posso aplicar $DESCONTO% de desconto se você fechar agora. Fica R$ $VALOR. O que acha?',
        'Entendo que o valor pesa. Consigo te dar $DESCONTO% de desconto: sai R$ $VALOR. Fechamos?',
        'Posso fazer $DESCONTO% pra você. De R$ $VALOR_ORIGINAL por R$ $VALOR. Vale a pena?'
    ],

    HANDLE_PRICE_OBJECTION_MAX: [
        'Esse é o máximo que consigo, mas dá pra parcelar em até 12x. Ou a gente pode ajustar o escopo pra caber no orçamento. O que prefere?',
        'Não tenho como baixar mais, mas posso parcelar. Ou fazemos uma versão mais enxuta. Qual caminho você prefere?',
        'Já apliquei o desconto máximo. Posso parcelar em 12x ou a gente vê uma opção mais simples. O que faz mais sentido?'
    ],

    HANDLE_TIME_OBJECTION: [
        'Sem problema! Fico à disposição quando você decidir. Se surgir alguma dúvida, é só chamar.',
        'Tranquilo! Pensa com calma. A proposta fica válida por 7 dias. Qualquer coisa, me chama.',
        'Entendo! Fica à vontade. Quando quiser retomar, é só mandar um oi aqui.',
        'Beleza! Fico por aqui se precisar. Só me avisa quando quiser continuar.'
    ],

    HANDLE_TRUST_OBJECTION: [
        'Entendo sua preocupação! A gente trabalha há mais de 3 anos, já atendemos mais de 150 clientes. Posso te mandar alguns cases se quiser.',
        'Faz sentido! Trabalhamos com contrato, você só paga o restante na entrega. Posso te mostrar trabalhos que já fizemos também.',
        'Compreendo! A gente tem CNPJ, contrato certinho, e você acompanha tudo durante o projeto. Quer ver exemplos do que já fizemos?'
    ],

    HANDLE_COMPARE_OBJECTION: [
        'Faz sentido comparar! Só te peço pra olhar o que está incluso, não só o preço. Às vezes o barato sai caro. Qualquer dúvida, me chama!',
        'Tranquilo! Quando for comparar, veja bem o que cada um oferece. Posso te explicar nosso diferencial se quiser.',
        'Entendo! Se precisar comparar algo específico, me fala que te ajudo a entender as diferenças.'
    ],

    HANDLE_URGENCY: [
        'Entendi que é urgente! Me passa seu contato direto que priorizo seu atendimento.',
        'Posso agilizar sim! Qual o prazo que você precisa? Me fala que eu vejo o que dá pra fazer.',
        'Pra casos urgentes a gente consegue encaixar. Me conta: pra quando você precisa?'
    ],

    // ==================== COLETA DE DADOS ====================
    ASK_CLIENT_DATA: [
        'Pra montar a proposta, só preciso de:\n\n• Seu nome\n• Empresa (se tiver)\n• WhatsApp ou email\n\nPode mandar?',
        'Me passa rapidinho:\n\n• Nome\n• Empresa\n• Contato\n\nQue eu monto a proposta.',
        'Pra eu preparar tudo certinho, me manda seu nome, empresa e um contato (WhatsApp ou email).'
    ],

    PROCESS_CLIENT_DATA: [
        'Anotado, $NOME! Vou preparar a proposta e te mando já já.',
        'Perfeito, $NOME! Tenho tudo que preciso. Em instantes te mando a proposta completa.',
        'Beleza, $NOME! Montando a proposta pra você. Já te envio!'
    ],

    // ==================== PROPOSTA ====================
    PROPOSAL_SENT: [
        'Pronto! 👆 Essa é sua proposta completa.\n\nDá uma olhada e me fala: quer fechar? Só escolher como quer pagar!',
        'Aí está a proposta! Deu uma lida? Se tiver alguma dúvida, me fala. Se tiver ok, é só escolher a forma de pagamento!',
        'Mandei a proposta! Qualquer dúvida me pergunta. Se quiser fechar, me diz como prefere pagar: Pix, cartão ou boleto.'
    ],

    // ==================== PAGAMENTO ====================
    ASK_PAYMENT_METHOD: [
        'Ótimo! Como prefere pagar?\n\n📱 *Pix* - à vista\n💳 *Cartão* - até 12x\n📄 *Boleto* - até 3x',
        'Perfeito! Qual forma de pagamento fica melhor?\n\n• Pix (à vista)\n• Cartão (até 12x)\n• Boleto (até 3x)',
        'Vamos fechar! Como você quer pagar: Pix, cartão ou boleto?'
    ],

    GENERATE_PIX: [
        'Gerando seu Pix... 📱\n\n━━━━━━━━━━━━━━━━━━━━━━\n💰 *Valor:* R$ $VALOR\n━━━━━━━━━━━━━━━━━━━━━━\n\n📋 *Chave Pix (CNPJ):*\n```00.000.000/0001-00```\n\n⏰ Me avisa aqui quando pagar que eu já libero tudo!',
        'Aqui está o Pix!\n\n💰 R$ $VALOR\n\n📋 Chave: 00.000.000/0001-00\n\nQuando fizer o pagamento, me manda o comprovante ou só avisa aqui!'
    ],

    GENERATE_CARD: [
        'Ótimo! Em quantas vezes quer parcelar? (1 a 12x)',
        'Perfeito! Posso parcelar em até 12x. Quantas parcelas ficam boas pra você?'
    ],

    PROCESS_PARCELAS: [
        'Fechado! $PARCELA parcelas de R$ $VALOR.\n\nVou te mandar o link de pagamento:\n🔗 [Link será enviado]\n\n🔒 Ambiente 100% seguro!',
        'Beleza! $PARCELAx de R$ $VALOR.\n\nSegue o link pra finalizar:\n🔗 [Link de pagamento]\n\nMe avisa quando concluir!'
    ],

    GENERATE_BOLETO: [
        'Gerando seu boleto... 📄\n\n💰 R$ $VALOR\n📅 Vencimento: em 3 dias\n\n🔗 [Link do boleto]\n\nMe avisa quando pagar!',
        'Boleto gerado!\n\n💰 Valor: R$ $VALOR\n\nVou te mandar o link. Quando pagar, me avisa aqui!'
    ],

    CONFIRM_PAYMENT: [
        '🎉 *PAGAMENTO CONFIRMADO!*\n\nMuito obrigado pela confiança, $NOME!\n\n*Próximos passos:*\n1️⃣ Você recebe o briefing pra preencher\n2️⃣ Nossa equipe inicia o projeto\n3️⃣ Te mantenho atualizado por aqui!\n\nQualquer dúvida, é só chamar. 🚀',
        '✅ *RECEBIDO!*\n\nObrigado, $NOME! Negócio fechado!\n\nAgora é assim:\n1. Te mando um formulário pra preencher\n2. A gente começa o projeto\n3. Você acompanha tudo por aqui\n\nBora fazer um trabalho incrível! 🚀'
    ],

    // ==================== CONTINUAÇÃO ====================
    CONTINUE_CONVERSATION: [
        'Beleza! O que mais você quer saber?',
        'Perfeito! Posso te ajudar com mais alguma coisa?',
        'Ótimo! Tem mais alguma dúvida?'
    ],

    CONTINUE_TOPIC: [
        'Sobre o $ASSUNTO, quer saber mais alguma coisa? Posso te passar mais detalhes ou já montar a proposta.',
        'Continuando sobre $ASSUNTO: quer ver as opções de pacote ou tirar alguma dúvida?',
        'Ainda sobre $ASSUNTO: posso te ajudar com mais algum detalhe?'
    ],

    HANDLE_NEGATIVE: [
        'Sem problema! Se mudar de ideia, é só chamar. Fico à disposição!',
        'Tranquilo! Qualquer coisa, tô por aqui.',
        'Beleza! Quando precisar, é só mandar mensagem.',
        'Ok! Fico à disposição se precisar de algo.'
    ],

    // ==================== EXEMPLOS / PORTFÓLIO ====================
    SEND_EXAMPLES: [
        'Claro! Qual seu segmento? Assim te mando algo parecido.',
        'Posso te mandar sim! Você trabalha com o quê? Mando cases do seu ramo.',
        'Tenho vários exemplos! Me conta sua área de atuação que eu seleciono os mais relevantes.'
    ],

    // ==================== AGENDAMENTO ====================
    OFFER_SCHEDULE: [
        'Posso sim! Qual melhor dia e horário pra você?',
        'Claro! Me fala quando fica bom que a gente marca.',
        'Bora! Prefere essa semana ou semana que vem? Qual horário?'
    ],

    // ==================== DESPEDIDA ====================
    GOODBYE_NORMAL: [
        'Beleza! Qualquer coisa, é só chamar. Até mais!',
        'Valeu! Fico à disposição. Até!',
        'Tranquilo! Precisando, tô por aqui. Tchau!',
        'Ok! Quando quiser, é só mandar mensagem. Até mais!'
    ],

    GOODBYE_HOT: [
        'Beleza! Fico no aguardo então. Qualquer dúvida, me chama!',
        'Ok! Quando quiser fechar, é só me avisar. Até mais!',
        'Tranquilo! A proposta continua válida. Me chama quando decidir!'
    ],

    // ==================== FELICIDADE ====================
    RESPOND_HAPPINESS: [
        'Que bom que gostou! Posso te ajudar com mais alguma coisa?',
        'Fico feliz! Quer seguir em frente com isso?',
        'Show! Vamos fechar então?'
    ],

    // ==================== FALLBACK ====================
    FALLBACK: [
        'Não entendi bem. Você quer saber sobre sites, anúncios ou redes sociais?',
        'Desculpa, não peguei. Pode explicar melhor o que você precisa?',
        'Hmm, não entendi. É sobre site, tráfego ou gestão de redes?',
        'Pode reformular? Trabalho com sites, anúncios online e redes sociais.',
        'Não captei direito. Me conta: é sobre qual serviço?'
    ],

    // ==================== EXPLICAÇÕES DETALHADAS ====================
    EXPLAIN_TOPIC: {
        site: [
            'O site funciona assim: você me passa as informações do seu negócio (textos, fotos, logo) e eu crio um site profissional. Fica responsivo (funciona no celular), com formulário de contato e botão do WhatsApp. Geralmente entrego em 2-3 semanas.',
            'Basicamente: eu cuido de toda a parte técnica - design, programação, hospedagem. Você só precisa me mandar o conteúdo. O site fica seu, com domínio próprio (.com.br).',
            'Site institucional serve pra apresentar sua empresa online. Coloco suas informações de forma profissional, com fotos, descrição dos serviços e formas de contato. É a vitrine digital do seu negócio.'
        ],
        landing: [
            'Landing page é uma página única, focada em fazer o visitante tomar uma ação: deixar o contato ou comprar. É ideal pra campanhas de anúncio porque é direta e objetiva.',
            'Diferente de um site com várias páginas, a landing é uma só, feita pra converter. Você direciona o anúncio pra ela e ela captura o lead ou faz a venda.',
            'É uma página de conversão. Simples, direta, com foco em um único objetivo: fazer a pessoa entrar em contato ou comprar.'
        ],
        ecommerce: [
            'Loja virtual é um site completo pra vender online. Tem carrinho de compras, pagamento integrado (Pix, cartão, boleto), cálculo de frete automático e um painel pra você gerenciar os pedidos.',
            'E-commerce inclui tudo: cadastro de produtos, categorias, carrinho, checkout, pagamento e gestão de pedidos. Você consegue vender 24h sem precisar estar online.',
            'Na loja virtual, o cliente escolhe os produtos, coloca no carrinho e paga online. Você recebe o pedido e só precisa enviar. Automatiza todo o processo de venda.'
        ],
        trafego: [
            'No tráfego pago, você define quanto quer investir em anúncios (por exemplo, R$ 1.000/mês) e eu cuido de criar as campanhas, definir o público certo, e ficar otimizando pra você ter o melhor resultado possível. Te mando relatório toda semana.',
            'Funciona assim: a gente cria anúncios no Instagram/Facebook ou Google. Você aparece pra pessoas que têm interesse no seu produto/serviço. Quanto mais gente vê, mais clientes potenciais você tem.',
            'Gestão de tráfego é cuidar dos seus anúncios online. Eu crio, testo diferentes versões, ajusto o público e vou melhorando os resultados. Você acompanha tudo por relatórios.'
        ],
        marketing: [
            'Gestão de redes é cuidar do seu Instagram, Facebook ou LinkedIn. Eu planejo o conteúdo, crio as artes e textos, e publico. Você aprova antes de ir pro ar.',
            'Funciona assim: monto um calendário mensal, crio os posts e stories, você dá ok e eu publico. Também posso responder comentários e mensagens se quiser.',
            'Basicamente: você para de se preocupar com "o que postar". Eu cuido de tudo - planejamento, design, texto e publicação. Sua rede fica sempre ativa e profissional.'
        ]
    }
};

function render(action, ctx = {}) {
    const templates = responses[action];
    
    if (!templates) {
        return pick(responses.FALLBACK);
    }

    // Se for objeto com subchaves (EXPLAIN_TOPIC)
    if (typeof templates === 'object' && !Array.isArray(templates)) {
        const assunto = ctx.state?.assunto || 'site';
        const subTemplates = templates[assunto] || templates.site || Object.values(templates)[0];
        return pickWithContext(subTemplates, ctx);
    }

    return pickWithContext(templates, ctx);
}

module.exports = { responses, render, pick, pickWithContext };