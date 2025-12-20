// FILE: src/nlp/proposals.js
/**
 * GERADOR DE PROPOSTAS COMERCIAIS
 */

const catalogo = {
    site: {
        simples: {
            nome: 'Site Institucional Simples',
            valor: 2500,
            prazo: '15 dias úteis',
            inclui: [
                'Até 5 páginas personalizadas',
                'Design moderno e responsivo',
                'Formulário de contato',
                'Botão WhatsApp flutuante',
                'Integração Google Maps',
                'Otimização SEO básica',
                'Hospedagem grátis 1 ano',
                'Domínio .com.br grátis 1 ano',
                'Certificado SSL',
                'Painel para editar textos',
                '30 dias de suporte'
            ]
        },
        completo: {
            nome: 'Site Institucional Completo',
            valor: 4500,
            prazo: '20 dias úteis',
            inclui: [
                'Até 10 páginas personalizadas',
                'Design exclusivo premium',
                'Totalmente responsivo',
                'Formulários avançados',
                'WhatsApp + Email automático',
                'Blog completo',
                'Galeria de fotos/vídeos',
                'SEO avançado + Analytics',
                'Hospedagem premium 1 ano',
                'Domínio grátis 1 ano',
                'SSL + CDN',
                'Painel administrativo',
                'Treinamento de uso',
                '60 dias de suporte'
            ]
        },
        loja: {
            nome: 'Loja Virtual E-commerce',
            valor: 5500,
            prazo: '30 dias úteis',
            inclui: [
                'Loja completa com carrinho',
                'Produtos ilimitados',
                'Categorias e filtros',
                'Cálculo de frete automático',
                'Pagamento integrado (Pix, Cartão, Boleto)',
                'Painel de gestão de pedidos',
                'Controle de estoque',
                'Cupons de desconto',
                'Notificações automáticas',
                'Design responsivo premium',
                'SEO para e-commerce',
                'Hospedagem otimizada 1 ano',
                'SSL + proteção',
                'Treinamento completo',
                '90 dias de suporte'
            ]
        }
    },
    landing: {
        simples: {
            nome: 'Landing Page de Captura',
            valor: 997,
            prazo: '7 dias úteis',
            inclui: [
                'Página única otimizada',
                'Design persuasivo',
                'Formulário de captura',
                'Integração WhatsApp',
                'Responsivo',
                'Copy básica',
                'Hospedagem 1 ano',
                'SSL',
                'Pixels configurados',
                '15 dias de suporte'
            ]
        },
        vendas: {
            nome: 'Landing Page de Vendas',
            valor: 1500,
            prazo: '10 dias úteis',
            inclui: [
                'Página de vendas completa',
                'Copy profissional',
                'Seções de benefícios, depoimentos, FAQ',
                'Checkout integrado',
                'Design de alta conversão',
                'Responsivo otimizado',
                'Garantia e selos',
                'Gateway de pagamento',
                'Pixels de rastreamento',
                'Testes A/B',
                '30 dias de suporte'
            ]
        }
    },
    trafego: {
        starter: {
            nome: 'Gestão de Tráfego Starter',
            valor: 1500,
            tipo: 'mensal',
            prazo: 'Início em 3 dias',
            investimentoMinimo: 1000,
            inclui: [
                '1 plataforma (Meta OU Google)',
                'Até 3 campanhas',
                'Públicos segmentados',
                'Até 5 anúncios/mês',
                'Otimização semanal',
                'Relatório mensal',
                'Reunião mensal',
                'Suporte WhatsApp'
            ]
        },
        pro: {
            nome: 'Gestão de Tráfego Pro',
            valor: 2500,
            tipo: 'mensal',
            prazo: 'Início em 3 dias',
            investimentoMinimo: 2000,
            inclui: [
                'Meta + Google Ads',
                'Campanhas ilimitadas',
                'Públicos avançados',
                'Até 15 anúncios/mês',
                'Otimização diária',
                'Testes A/B contínuos',
                'Remarketing',
                'Relatório semanal',
                'Reunião quinzenal',
                'Suporte prioritário'
            ]
        },
        scale: {
            nome: 'Gestão de Tráfego Scale',
            valor: 4500,
            tipo: 'mensal',
            prazo: 'Início em 3 dias',
            investimentoMinimo: 5000,
            inclui: [
                'Todas as plataformas',
                'Estratégia de funil completa',
                'Campanhas ilimitadas',
                'Criativos ilimitados',
                'Otimização em tempo real',
                'Remarketing avançado',
                'Automações',
                'Dashboard real-time',
                'Relatório diário',
                'Reunião semanal',
                'Gerente dedicado',
                'Suporte 24/7'
            ]
        }
    },
    marketing: {
        basico: {
            nome: 'Gestão de Redes Básico',
            valor: 997,
            tipo: 'mensal',
            prazo: 'Início em 5 dias',
            inclui: [
                '1 rede social',
                '8 posts por mês',
                '8 stories por mês',
                'Artes personalizadas',
                'Legendas com copy',
                'Hashtags estratégicas',
                'Agendamento',
                'Relatório mensal'
            ]
        },
        completo: {
            nome: 'Gestão de Redes Completo',
            valor: 1800,
            tipo: 'mensal',
            prazo: 'Início em 5 dias',
            inclui: [
                'Até 3 redes sociais',
                '16 posts por mês',
                '20 stories por mês',
                '4 reels por mês',
                'Artes premium',
                'Copywriting estratégico',
                'Calendário editorial',
                'Gestão de comentários',
                'Engajamento ativo',
                'Relatório semanal',
                'Reunião mensal'
            ]
        },
        premium: {
            nome: 'Gestão de Redes Premium',
            valor: 3500,
            tipo: 'mensal',
            prazo: 'Início em 5 dias',
            inclui: [
                'Todas as redes',
                'Posts diários',
                'Stories diários',
                'Reels semanais',
                'Produção in loco 1x/mês',
                'Estratégia de branding',
                'Social listening',
                'Gestão de comunidade',
                'Relatórios real-time',
                'Reuniões semanais',
                'Gerente dedicado'
            ]
        }
    }
};

function gerarProposta(assunto, plano, cliente, desconto = 0) {
    const dados = catalogo[assunto]?.[plano];
    if (!dados) return null;

    const valorOriginal = dados.valor;
    const valorDesconto = Math.round(valorOriginal * (desconto / 100));
    const valorFinal = valorOriginal - valorDesconto;
    const tipo = dados.tipo === 'mensal' ? '/mês' : '';
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const validade = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR');

    let texto = `
━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *PROPOSTA COMERCIAL*
━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *Cliente:* ${cliente.nome || 'A definir'}
${cliente.empresa ? `🏢 *Empresa:* ${cliente.empresa}` : ''}
📅 *Data:* ${dataHoje}
⏰ *Validade:* ${validade}

━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *${dados.nome.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━━━━━

*O que está incluso:*

${dados.inclui.map(item => `✅ ${item}`).join('\n')}
`;

    if (dados.investimentoMinimo) {
        texto += `
⚠️ *Investimento mínimo em anúncios:* R$ ${dados.investimentoMinimo.toLocaleString('pt-BR')}${tipo}
_(valor pago diretamente às plataformas)_
`;
    }

    texto += `
━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *INVESTIMENTO*
━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    if (desconto > 0) {
        texto += `
~R$ ${valorOriginal.toLocaleString('pt-BR')}${tipo}~ ❌
*R$ ${valorFinal.toLocaleString('pt-BR')}${tipo}* ✅
🏷️ _Desconto especial de ${desconto}%!_
`;
    } else {
        texto += `
*R$ ${valorFinal.toLocaleString('pt-BR')}${tipo}*
`;
    }

    texto += `
*Formas de pagamento:*
💳 Cartão: até 12x de R$ ${Math.ceil(valorFinal / 12).toLocaleString('pt-BR')}
📱 Pix: R$ ${valorFinal.toLocaleString('pt-BR')} à vista
📄 Boleto: até 3x

${dados.tipo !== 'mensal' ? `*Condição:* 50% entrada + 50% entrega` : '*Pagamento:* Todo dia 5'}

📆 *Prazo:* ${dados.prazo}

━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 *BÔNUS*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 Suporte prioritário WhatsApp
🔥 Consultoria inicial gratuita
🔥 Ajustes inclusos no projeto

━━━━━━━━━━━━━━━━━━━━━━━━━

_Pra fechar, só escolher a forma de pagamento!_
`;

    return {
        texto,
        dados,
        valorOriginal,
        valorFinal,
        desconto
    };
}

function getPlanos(assunto) {
    return catalogo[assunto] ? Object.keys(catalogo[assunto]) : [];
}

function getValor(assunto, plano) {
    return catalogo[assunto]?.[plano]?.valor || 0;
}

module.exports = { catalogo, gerarProposta, getPlanos, getValor };