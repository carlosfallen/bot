// FILE: src/nlp/sales-automation.js
/**
 * AUTOMAÇÃO COMPLETA DE VENDAS
 * Bot fecha sozinho e notifica o dono
 */

class SalesAutomation {
    constructor() {
        this.sales = new Map();
        this.adminNumber = process.env.ADMIN_WHATSAPP || null;
    }

    // Gerar ID único para venda
    generateSaleId() {
        return 'VND' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }

    // Criar nova venda
    createSale(userId, data) {
        const saleId = this.generateSaleId();
        const sale = {
            id: saleId,
            oderId: saleId,
            status: 'proposta_enviada',
            cliente: data.cliente || {},
            servico: data.servico,
            plano: data.plano,
            valorOriginal: data.valor,
            desconto: 0,
            valorFinal: data.valor,
            formaPagamento: null,
            parcelas: null,
            proposta: data.proposta,
            etapas: [
                { etapa: 'proposta_enviada', data: new Date().toISOString(), obs: 'Proposta enviada automaticamente' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.sales.set(saleId, sale);
        this.sales.set(userId, saleId); // Referência rápida

        return sale;
    }

    // Atualizar venda
    updateSale(saleId, updates) {
        const sale = this.sales.get(saleId);
        if (!sale) return null;
        
        Object.assign(sale, updates, { updatedAt: new Date().toISOString() });
        
        if (updates.status) {
            sale.etapas.push({
                etapa: updates.status,
                data: new Date().toISOString(),
                obs: updates.obs || ''
            });
        }
        
        this.sales.set(saleId, sale);
        return sale;
    }

    // Buscar venda do usuário
    getSaleByUser(userId) {
        const saleId = this.sales.get(userId);
        if (!saleId) return null;
        return this.sales.get(saleId);
    }

    // Gerar PIX (simulado - integrar com sua API real)
    generatePix(sale) {
        const pixCode = `00020126580014br.gov.bcb.pix0136${sale.id}520400005303986540${sale.valorFinal.toFixed(2)}5802BR5925IMPERIO LORD MARKETING6009SAO PAULO62070503***6304`;
        
        return {
            code: pixCode,
            qrcode: `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(pixCode)}`,
            valor: sale.valorFinal,
            expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
    }

    // Gerar link de cartão (simulado - integrar com Stripe/PagSeguro/etc)
    generateCardLink(sale) {
        // Em produção, integrar com gateway real
        return {
            url: `https://pay.imperiolord.com.br/checkout/${sale.id}`,
            valor: sale.valorFinal,
            parcelas: sale.parcelas || 1
        };
    }

    // Gerar boleto (simulado)
    generateBoleto(sale) {
        return {
            linha: `23793.38128 60000.000003 00000.000400 1 ${Math.floor(Math.random() * 9999999999)}`,
            url: `https://pay.imperiolord.com.br/boleto/${sale.id}`,
            vencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
            valor: sale.valorFinal
        };
    }

    // Gerar contrato
    generateContract(sale) {
        const data = new Date().toLocaleDateString('pt-BR');
        
        return `
━━━━━━━━━━━━━━━━━━━━━━━━━
📜 *CONTRATO DE PRESTAÇÃO DE SERVIÇOS*
━━━━━━━━━━━━━━━━━━━━━━━━━

*Nº do Contrato:* ${sale.id}
*Data:* ${data}

━━━━━━━━━━━━━━━━━━━━━━━━━
*CONTRATANTE*
━━━━━━━━━━━━━━━━━━━━━━━━━

Nome: ${sale.cliente.nome || '-'}
${sale.cliente.empresa ? `Empresa: ${sale.cliente.empresa}` : ''}
${sale.cliente.telefone ? `Telefone: ${sale.cliente.telefone}` : ''}
${sale.cliente.email ? `Email: ${sale.cliente.email}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━
*CONTRATADA*
━━━━━━━━━━━━━━━━━━━━━━━━━

Império Lord Marketing Digital
CNPJ: XX.XXX.XXX/0001-XX

━━━━━━━━━━━━━━━━━━━━━━━━━
*OBJETO DO CONTRATO*
━━━━━━━━━━━━━━━━━━━━━━━━━

Serviço: ${sale.proposta?.dados?.nome || sale.servico}
Valor: R$ ${sale.valorFinal?.toLocaleString('pt-BR')}
${sale.desconto > 0 ? `Desconto aplicado: ${sale.desconto}%` : ''}
Forma de pagamento: ${sale.formaPagamento || 'A definir'}
${sale.parcelas ? `Parcelas: ${sale.parcelas}x` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━
*PRAZO DE ENTREGA*
━━━━━━━━━━━━━━━━━━━━━━━━━

${sale.proposta?.dados?.prazo || '15 dias úteis'}
Início: Após confirmação do pagamento

━━━━━━━━━━━━━━━━━━━━━━━━━
*ITENS INCLUSOS*
━━━━━━━━━━━━━━━━━━━━━━━━━

${sale.proposta?.dados?.inclui?.slice(0, 10).map(i => `✅ ${i}`).join('\n') || 'Conforme proposta enviada'}

━━━━━━━━━━━━━━━━━━━━━━━━━
*TERMOS E CONDIÇÕES*
━━━━━━━━━━━━━━━━━━━━━━━━━

1. O pagamento da entrada confirma a aceitação deste contrato.

2. O prazo de entrega inicia após confirmação do pagamento e recebimento do briefing.

3. Estão inclusos até 3 (três) rounds de alterações.

4. Garantia de 30 dias para ajustes após a entrega.

5. O cliente deve fornecer todo material necessário (textos, imagens, logos).

6. Cancelamento: reembolso proporcional ao trabalho não executado.

━━━━━━━━━━━━━━━━━━━━━━━━━

Ao efetuar o pagamento, você confirma que leu e aceita todos os termos acima.

*Império Lord Marketing Digital*
Transformando ideias em resultados 🚀
`;
    }

    // Formatar notificação para admin
    formatAdminNotification(sale, tipo) {
        const notifications = {
            nova_venda: `
🎉 *NOVA VENDA FECHADA!*
━━━━━━━━━━━━━━━━━━━━━━

📋 *Pedido:* ${sale.id}
👤 *Cliente:* ${sale.cliente.nome || '-'}
🏢 *Empresa:* ${sale.cliente.empresa || '-'}
📱 *WhatsApp:* ${sale.cliente.telefone || '-'}
📧 *Email:* ${sale.cliente.email || '-'}

📦 *Serviço:* ${sale.proposta?.dados?.nome || sale.servico}
💰 *Valor:* R$ ${sale.valorFinal?.toLocaleString('pt-BR')}
${sale.desconto > 0 ? `🏷️ *Desconto:* ${sale.desconto}%` : ''}
💳 *Pagamento:* ${sale.formaPagamento || '-'}
${sale.parcelas ? `📅 *Parcelas:* ${sale.parcelas}x` : ''}

⏰ *Data:* ${new Date().toLocaleString('pt-BR')}

✅ Contrato e pagamento enviados automaticamente!
`,
            pagamento_confirmado: `
✅ *PAGAMENTO CONFIRMADO!*
━━━━━━━━━━━━━━━━━━━━━━

📋 *Pedido:* ${sale.id}
👤 *Cliente:* ${sale.cliente.nome}
📦 *Serviço:* ${sale.proposta?.dados?.nome || sale.servico}
💰 *Valor:* R$ ${sale.valorFinal?.toLocaleString('pt-BR')}

🚀 Hora de iniciar o projeto!
`,
            proposta_enviada: `
📤 *PROPOSTA ENVIADA*
━━━━━━━━━━━━━━━━━━━━━━

👤 *Cliente:* ${sale.cliente.nome || '-'}
📱 *WhatsApp:* ${sale.cliente.telefone || '-'}
📦 *Serviço:* ${sale.proposta?.dados?.nome || sale.servico}
💰 *Valor:* R$ ${sale.valorFinal?.toLocaleString('pt-BR')}

⏳ Aguardando resposta do cliente...
`,
            desconto_aplicado: `
🏷️ *DESCONTO APLICADO*
━━━━━━━━━━━━━━━━━━━━━━

📋 *Pedido:* ${sale.id}
👤 *Cliente:* ${sale.cliente.nome}
💰 *De:* R$ ${sale.valorOriginal?.toLocaleString('pt-BR')}
💰 *Para:* R$ ${sale.valorFinal?.toLocaleString('pt-BR')}
📉 *Desconto:* ${sale.desconto}%
`
        };

        return notifications[tipo] || '';
    }
}

const salesAutomation = new SalesAutomation();

module.exports = salesAutomation;