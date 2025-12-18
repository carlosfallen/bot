# 🤖 WhatsApp Bot com NLP - JavaScript Puro

Bot de WhatsApp minimalista que responde mensagens automaticamente usando NLP simples.

## 🚀 Instalação

```bash
# Instalar dependências (apenas 2!)
npm install @whiskeysockets/baileys pino

# OU copiar package-simple.json
cp package-simple.json package.json
npm install
```

## 📱 Conectar WhatsApp

```bash
node bot.js
```

### O que vai acontecer:

1. **Primeira vez:**
```
📱 CONECTAR WHATSAPP

Digite seu número com DDI (ex: 5589994333316):
```
Digite seu número e aperte Enter.

2. **Código gerado:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CÓDIGO: XXXX-XXXX

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 Abra WhatsApp > Dispositivos Conectados
   > Conectar com número de telefone
   > Digite: XXXX-XXXX
```

3. **Digite o código no WhatsApp:**
   - Abra WhatsApp no celular
   - Configurações > Dispositivos Conectados
   - Conectar um Dispositivo
   - **Conectar com número de telefone**
   - Digite o código de 8 dígitos

4. **Conectado!**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CONECTADO AO WHATSAPP!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Bot rodando... Aguardando mensagens.
```

## 🤖 Como Funciona

O bot responde automaticamente quando recebe mensagens com palavras-chave:

### Saudações
- "oi", "olá", "bom dia", "boa tarde", "boa noite"

### Serviços
- "tráfego", "anúncio" → Informações sobre tráfego pago
- "instagram", "facebook" → Gestão de redes sociais
- "site", "landing" → Desenvolvimento web

### Preços
- "preço", "valor", "quanto custa" → Contato comercial

### Despedidas
- "obrigado", "valeu", "tchau"

## 📝 Logs em Tempo Real

Quando alguém enviar mensagem, você verá:

```
📨 Mensagem de 5589994333316@s.whatsapp.net
   Texto: oi, tudo bem?
✅ Resposta: Olá! 👋 Como posso ajudar você hoje?
```

## 🎯 Personalizar Respostas

Edite o arquivo `bot.js`, seção `responses`:

```javascript
const responses = {
    'sua palavra': 'Sua resposta aqui',
    'tráfego': 'Oferecemos tráfego pago...',
    // Adicione mais...
};
```

## 📂 Arquivos

```
bot/
├── bot.js                 ← Arquivo principal (APENAS 150 linhas!)
├── auth_info/            ← Sessão WhatsApp (criado automaticamente)
├── package.json
└── README-SIMPLE.md
```

## ✅ Próximas Execuções

Depois de conectar pela primeira vez, a sessão fica salva em `auth_info/`.

Nas próximas vezes, apenas rode:

```bash
node bot.js
```

E vai conectar automaticamente! ⚡

## 🔄 Reconectar

Se desconectar ou dar erro:

```bash
# Limpar sessão
rm -rf auth_info/

# Conectar novamente
node bot.js
```

## 🛑 Parar o Bot

Aperte `Ctrl+C` no terminal.

## 🎉 Vantagens desta Versão

✅ **Apenas 2 dependências** (Baileys + Pino)
✅ **150 linhas de código**
✅ **JavaScript puro** (sem TypeScript, sem Bun)
✅ **Sem frontend** (apenas terminal)
✅ **Pairing Code via terminal** (100% funcional)
✅ **NLP simples mas efetivo**
✅ **Responde automaticamente**
✅ **Leve e rápido**

## 📋 Requisitos

- Node.js 18+
- WhatsApp no celular

## 🐛 Problemas?

### Bot não conecta
```bash
rm -rf auth_info/
node bot.js
```

### Código não funciona
- Verifique se digitou corretamente (8 dígitos)
- Tente gerar novo código
- Use outro número se necessário

---

**Simples, enxuto e funcional!** 🚀
