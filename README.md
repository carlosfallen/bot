# 🤖 WhatsApp Bot - Sistema Completo

Bot de atendimento automatizado para WhatsApp com:
- 🧠 NLP (Processamento de Linguagem Natural)
- 📊 Dashboard web moderno
- 💾 Banco de dados Cloudflare D1
- 🎯 Gestão de leads e conversas
- ⚙️ Configurações avançadas

## 🎯 Funcionalidades

### Bot de Atendimento
- ✅ Respostas automáticas inteligentes com NLP
- ✅ Detecção de intenções (tráfego pago, marketing, web dev)
- ✅ Extração de entidades (nome, email, telefone)
- ✅ Contexto de conversa
- ✅ Respostas personalizadas por serviço

### Dashboard Web
- 📊 Estatísticas em tempo real
- 💬 Visualização de conversas
- 👥 Gerenciamento de leads
- 🧪 Teste de respostas do bot
- ⚙️ Painel de configurações

### Banco de Dados
- 💾 Cloudflare D1 (SQLite na nuvem)
- 📝 Registro de todas as mensagens
- 👤 Salvamento automático de leads
- 📊 Estatísticas diárias
- 🔍 Histórico completo

### Configurações
- ✅ Ativar/Desativar bot globalmente
- ✅ Ativar/Desativar por conversa individual
- ✅ Responder em grupos (sim/não)
- ✅ Responder em canais (sim/não)
- ✅ Horário comercial
- ✅ Mensagens personalizadas

## 📦 Instalação

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do Cloudflare D1.

### 3. Inicializar banco de dados
```bash
npm run init-db
```

### 4. Executar o bot
```bash
npm start
```

## 🚀 Como Usar

### Primeira Conexão
1. Execute `npm start`
2. Digite seu número com DDI (ex: 5589994333316)
3. Copie o código de pareamento exibido
4. No WhatsApp: Dispositivos Conectados > Conectar com número de telefone
5. Digite o código

### Acessar Dashboard
Abra no navegador: `http://localhost:3000`

### Páginas do Dashboard

#### 📊 Dashboard
- Visão geral das estatísticas do dia
- Mensagens, leads, conversas e respostas
- Lista de conversas recentes

#### 💬 Conversas
- Lista todas as conversas
- Visualização de mensagens
- Ativar/Desativar bot por conversa
- Busca de conversas

#### 👥 Leads
- Tabela com todos os leads
- Nome, telefone, email, empresa
- Última interação
- Status (ativo/inativo)

#### 🧪 Testar Bot
- Chat interativo para testar
- Análise NLP em tempo real
- Intent detectado
- Confidence score
- Entidades extraídas

#### ⚙️ Configurações
- Bot ativo globalmente
- Salvar contatos automaticamente
- Responder em grupos
- Responder em canais
- Horário comercial
- Mensagens automáticas

## 🧠 Sistema NLP

### Intents Disponíveis

#### Saudações
- `greeting` - Oi, olá, bom dia, boa tarde

#### Serviços
- `traffic` - Tráfego pago, anúncios, Meta Ads, Google Ads
- `marketing` - Marketing digital, redes sociais, Instagram
- `web_development` - Sites, landing pages, e-commerce
- `pricing` - Preços, valores, orçamento
- `portfolio` - Portfólio, cases, trabalhos

#### Interações
- `goodbye` - Tchau, até logo, obrigado
- `contact` - Contato, telefone, email
- `menu` - Menu, ajuda, opções
- `schedule` - Agendar, reunião, horário
- `interested` - Quero contratar, tenho interesse

### Extração de Entidades
- **Nome**: Detecta nomes próprios
- **Email**: Valida e extrai emails
- **Telefone**: Identifica números de telefone

### Contexto
- **Urgência**: Detecta mensagens urgentes
- **Orçamento**: Identifica preocupação com preço
- **Follow-up**: Mantém contexto da conversa

## 🗄️ Estrutura do Banco de Dados

### Tabelas

#### `leads`
- Todos os contatos que interagiram
- Nome, telefone, email, empresa
- Tags, notas, data de criação

#### `conversations`
- Conversas individuais
- Tipo (privado, grupo, canal)
- Status do bot (ativo/inativo)
- Contagem de mensagens

#### `messages`
- Histórico completo de mensagens
- Direção (entrada/saída)
- Intent e confidence do NLP
- Entidades extraídas

#### `bot_config`
- Todas as configurações
- Chave-valor
- Editável via dashboard

#### `statistics`
- Estatísticas diárias
- Mensagens, conversas, leads
- Respostas do bot

## 🔧 Configurações Avançadas

### Alterar Porta do Servidor
No arquivo `.env`:
```
PORT=3000
```

### Personalizar Respostas
Edite o arquivo: `src/nlp/intents.js`

Adicione novos intents:
```javascript
meu_intent: {
    patterns: ['palavra1', 'palavra2'],
    responses: [
        'Resposta 1',
        'Resposta 2'
    ],
    context: 'contexto'
}
```

### Configurar Horário Comercial
Via dashboard ou diretamente no banco:
```javascript
await db.setConfig('business_hours_start', '09:00');
await db.setConfig('business_hours_end', '18:00');
await db.setConfig('business_hours_only', true);
```

## 📁 Estrutura do Projeto

```
bot/
├── src/
│   ├── nlp/
│   │   ├── intents.js          # Definição de intenções
│   │   └── analyzer.js         # Analisador NLP
│   ├── database/
│   │   ├── schema.sql          # Schema do banco
│   │   └── d1.js               # Cliente Cloudflare D1
│   ├── api/
│   │   └── server.js           # API REST
│   └── config/
│       └── index.js            # Configurações
├── public/
│   ├── index.html              # Dashboard
│   ├── css/
│   │   └── style.css          # Estilos
│   └── js/
│       └── app.js             # Frontend
├── scripts/
│   └── init-db.js             # Inicializar banco
├── bot.js                      # Bot antigo (simples)
├── bot-new.js                  # Bot novo (completo)
└── package.json
```

## 🔒 Cloudflare D1

### Obter Credenciais

1. **Account ID**
   - Dashboard Cloudflare > Workers & Pages
   - Copiar Account ID

2. **Database ID**
   - D1 > Seu banco > Copiar ID

3. **API Token**
   - My Profile > API Tokens > Create Token
   - Permissões: Account - D1 - Edit

### Criar Banco D1

```bash
# Via Cloudflare Dashboard
1. Workers & Pages > D1
2. Create database
3. Nome: "bot"
4. Copiar Database ID
```

## 🎨 Personalização

### Logo e Cores
Edite `public/css/style.css`:
```css
:root {
    --primary: #25D366;  /* Cor principal */
    --secondary: #075E54; /* Cor secundária */
}
```

### Mensagens Padrão
Via dashboard ou editando o schema:
```sql
UPDATE bot_config
SET value = 'Sua mensagem aqui'
WHERE key = 'welcome_message';
```

## 📊 API REST

### Endpoints

#### `GET /api/status`
Status da conexão do bot

#### `GET /api/config`
Obter configurações

#### `POST /api/config`
Atualizar configurações

#### `GET /api/leads`
Listar leads

#### `GET /api/conversations`
Listar conversas

#### `GET /api/messages/:id`
Mensagens de uma conversa

#### `POST /api/send`
Enviar mensagem (teste)

#### `POST /api/test`
Testar NLP

## 🐛 Troubleshooting

### Bot não conecta
1. Verifique se o número está correto (com DDI)
2. Tente gerar novo código de pareamento
3. Limpe a pasta `auth_info` e reconecte

### Banco de dados não salva
1. Verifique credenciais no `.env`
2. Confirme que executou `npm run init-db`
3. Verifique permissões do API Token

### Dashboard não carrega
1. Confirme que o bot está rodando
2. Acesse `http://localhost:3000` (não https)
3. Verifique se a porta 3000 está disponível

## 📝 Licença

MIT

## 👨‍💻 Autor

Bot Team

## 🤝 Contribuindo

Pull requests são bem-vindos!

## 📞 Suporte

Para dúvidas e suporte, abra uma issue.

---

**Desenvolvido com ❤️ para atendimento automatizado no WhatsApp**
