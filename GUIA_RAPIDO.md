# 🚀 Guia Rápido - WhatsApp Bot

## ▶️ Iniciar o Bot

### 1. Primeira vez (instalar dependências)
```bash
npm install
```

### 2. Inicializar banco de dados
```bash
npm run init-db
```

### 3. Executar o bot
```bash
npm start
```

### 4. Conectar WhatsApp
Quando solicitado:
1. Digite seu número com DDI (exemplo: **5589994333316**)
2. Copie o código de 8 dígitos exibido
3. Abra WhatsApp no celular
4. Vá em: **Dispositivos Conectados** > **Conectar Dispositivo** > **Conectar com número de telefone**
5. Digite o código

## 🌐 Acessar Dashboard

Abra no navegador: **http://localhost:3000**

## 🎯 Principais Funcionalidades

### Dashboard
- Estatísticas em tempo real
- Conversas recentes
- Métricas do dia

### Conversas
- Todas as conversas ativas
- Histórico de mensagens
- Ativar/desativar bot por conversa

### Leads
- Lista de todos os contatos
- Dados capturados automaticamente
- Status de cada lead

### Testar Bot
- Chat para testar respostas
- Análise NLP em tempo real
- Ver intent e confiança

### Configurações
- **Bot Ativo Globalmente**: Liga/desliga o bot completamente
- **Salvar Leads**: Salva automaticamente novos contatos
- **Responder em Grupos**: Bot responde em grupos do WhatsApp
- **Responder em Canais**: Bot responde em canais
- **Horário Comercial**: Bot só responde em determinado horário
- **Mensagens Automáticas**: Personalizar boas-vindas e ausência

## 💬 Como o Bot Funciona

### Mensagens que o Bot Entende

#### Saudações
- "Oi", "Olá", "Bom dia", "Boa tarde"

#### Serviços
- "Tráfego pago", "Anúncios", "Meta Ads", "Google Ads"
- "Marketing", "Instagram", "Redes sociais"
- "Site", "Landing page", "E-commerce", "Desenvolvimento"

#### Informações
- "Preço", "Valor", "Quanto custa", "Orçamento"
- "Portfólio", "Cases", "Trabalhos"
- "Contato", "Telefone", "Email"

#### Ações
- "Menu", "Ajuda", "Opções"
- "Agendar", "Reunião"
- "Quero contratar", "Tenho interesse"

## 🔧 Configurações Rápidas

### Desativar Bot em Conversa Específica
1. Vá em **Conversas**
2. Clique na conversa
3. Clique em **Desativar Bot**

### Alterar Horário de Atendimento
1. Vá em **Configurações**
2. Ative **Apenas Horário Comercial**
3. Defina **Início** (ex: 09:00)
4. Defina **Fim** (ex: 18:00)
5. Clique em **Salvar Configurações**

### Personalizar Mensagens
1. Vá em **Configurações**
2. Edite **Mensagem de Boas-vindas**
3. Edite **Mensagem Fora do Horário**
4. Clique em **Salvar Configurações**

## 📊 Entendendo as Estatísticas

- **Mensagens Hoje**: Total de mensagens recebidas hoje
- **Novos Leads**: Novos contatos salvos hoje
- **Conversas Ativas**: Conversas com mensagens hoje
- **Respostas Bot**: Quantas vezes o bot respondeu hoje

## 🎨 Personalizar Respostas

### Editar arquivo de intents
Abra: `src/nlp/intents.js`

Adicione novo serviço:
```javascript
meu_servico: {
    patterns: [
        'palavra chave 1',
        'palavra chave 2'
    ],
    responses: [
        'Sua resposta aqui!'
    ],
    context: 'services'
}
```

Reinicie o bot para aplicar mudanças.

## ❓ Problemas Comuns

### Bot não responde
1. Verifique se está **Conectado** (canto superior direito)
2. Vá em **Configurações** e verifique se **Bot Ativo Globalmente** está ligado
3. Verifique se **Horário Comercial** não está bloqueando

### Dashboard não abre
1. Certifique-se que o bot está rodando
2. Acesse `http://localhost:3000` (não https)
3. Tente mudar a porta no arquivo `.env`

### Leads não aparecem
1. Vá em **Configurações**
2. Ative **Salvar Contatos Automaticamente**
3. Execute `npm run init-db` novamente

### Bot desconectou
1. Feche o bot (Ctrl+C)
2. Execute `npm start` novamente
3. Se pedir código novamente, repita o processo de pareamento

## 🔄 Reiniciar Bot

```bash
# Parar o bot
Ctrl+C

# Iniciar novamente
npm start
```

## 🗑️ Resetar Conexão WhatsApp

```bash
# Parar o bot
Ctrl+C

# Deletar pasta de autenticação
rm -rf auth_info

# Iniciar e reconectar
npm start
```

## 📱 Testar o Bot

### Via Dashboard
1. Vá em **Testar Bot**
2. Digite uma mensagem (ex: "oi")
3. Veja a resposta e análise NLP

### Via WhatsApp
1. Envie mensagem para o número conectado
2. Bot responderá automaticamente
3. Veja a conversa no dashboard

## 💾 Backup dos Dados

### Cloudflare D1
Seus dados estão salvos automaticamente no Cloudflare D1.

Para backup local:
1. Acesse Cloudflare Dashboard
2. D1 > Seu banco
3. Export data

## 🆘 Suporte

### Logs do Bot
Tudo que o bot faz aparece no terminal:
- ✅ Ações bem-sucedidas
- ❌ Erros
- 📨 Mensagens recebidas
- 🧠 Análises NLP

### Resetar Tudo
```bash
# Limpar autenticação
rm -rf auth_info

# Reinicializar banco
npm run init-db

# Reiniciar bot
npm start
```

---

**Dica**: Mantenha o terminal aberto para ver os logs em tempo real!
