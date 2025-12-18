# 🏗️ Arquitetura do Sistema

## 📋 Visão Geral

O WhatsApp Bot é um sistema completo dividido em 4 camadas principais:

```
┌─────────────────────────────────────────┐
│          INTERFACE WEB (Dashboard)       │
│     HTML + CSS + JavaScript (Vanilla)    │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
┌─────────────────▼───────────────────────┐
│           API REST (servidor.js)         │
│        Node.js HTTP Server nativo        │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌───▼────┐ ┌──▼─────────┐
│   NLP    │ │Database│ │  WhatsApp  │
│ Analyzer │ │   D1   │ │   Baileys  │
└──────────┘ └────────┘ └────────────┘
```

## 🔧 Componentes

### 1. Bot Principal (bot-new.js)
**Responsabilidade**: Orquestrar todo o sistema

**Funções**:
- Conectar ao WhatsApp via Baileys
- Gerenciar eventos de mensagens
- Coordenar NLP, Database e API
- Aplicar regras de negócio (horário comercial, grupos, etc)

**Fluxo**:
```
Recebe Mensagem
    ↓
Verifica Configurações (bot ativo? grupo? horário?)
    ↓
Extrai Telefone/Chat ID
    ↓
Salva/Atualiza Lead no DB
    ↓
Processa com NLP
    ↓
Salva Mensagem no DB
    ↓
Gera Resposta
    ↓
Envia WhatsApp
    ↓
Salva Resposta no DB
```

### 2. NLP (Natural Language Processing)

#### src/nlp/intents.js
**Responsabilidade**: Definir intenções e respostas

**Estrutura**:
```javascript
{
    intent_name: {
        patterns: ['palavras', 'chave'],  // Palavras que ativam
        responses: ['Resposta 1'],         // Respostas possíveis
        context: 'contexto',               // Contexto da conversa
        followUp: true,                    // Espera resposta?
        collectData: ['name', 'email']     // Dados a coletar
    }
}
```

**Intents Disponíveis**:
- `greeting` - Saudações
- `goodbye` - Despedidas
- `traffic` - Tráfego pago
- `marketing` - Marketing digital
- `web_development` - Desenvolvimento web
- `pricing` - Preços
- `portfolio` - Portfólio
- `contact` - Contato
- `menu` - Menu
- `schedule` - Agendamento
- `interested` - Interesse em contratar

#### src/nlp/analyzer.js
**Responsabilidade**: Processar mensagens e identificar intenções

**Métodos**:
- `normalize()` - Limpa e normaliza texto
- `identifyIntent()` - Identifica intenção da mensagem
- `extractEntities()` - Extrai nome, email, telefone
- `analyze()` - Método principal que processa tudo

**Algoritmo**:
1. Normaliza texto (remove acentos, pontuação)
2. Compara com patterns de cada intent
3. Calcula similaridade (score 0-1)
4. Retorna intent com maior score
5. Extrai entidades (regex para email, telefone, nome)
6. Mantém contexto da conversa por usuário

### 3. Banco de Dados (Cloudflare D1)

#### src/database/schema.sql
**Responsabilidade**: Estrutura do banco de dados

**Tabelas**:

**leads**
- Armazena todos os contatos
- Campos: phone, name, email, company, tags, notes

**conversations**
- Uma conversa por chat (privado/grupo/canal)
- Campos: chat_id, chat_type, is_bot_active, message_count

**messages**
- Histórico completo de mensagens
- Campos: direction, message_text, intent, confidence, entities

**bot_config**
- Configurações chave-valor
- Campos: key, value, description

**statistics**
- Estatísticas diárias
- Campos: date, total_messages, new_leads, bot_responses

#### src/database/d1.js
**Responsabilidade**: Cliente para Cloudflare D1

**Métodos**:
- `query()` - Executa SQL
- `saveLead()` - Salva/atualiza lead
- `saveMessage()` - Salva mensagem
- `getConfig()` - Obtém configuração
- `isBotActiveForChat()` - Verifica se bot está ativo
- `getTodayStats()` - Estatísticas do dia

**Como funciona**:
- Usa API HTTP do Cloudflare
- Faz requisições HTTPS com autenticação Bearer
- Retorna resultados em JSON
- Suporta queries e batch queries

### 4. API REST

#### src/api/server.js
**Responsabilidade**: Servir dashboard e endpoints API

**Endpoints**:

```
GET  /                    → Dashboard (index.html)
GET  /css/style.css       → Estilos
GET  /js/app.js          → JavaScript

GET  /api/status         → Status da conexão
GET  /api/config         → Configurações
POST /api/config         → Salvar configurações
GET  /api/leads          → Listar leads
GET  /api/conversations  → Listar conversas
GET  /api/messages/:id   → Mensagens de conversa
POST /api/send           → Enviar mensagem teste
POST /api/test           → Testar NLP
PUT  /api/conversation/:id → Ativar/desativar bot
GET  /api/stats          → Estatísticas
```

**Como funciona**:
- Servidor HTTP nativo do Node.js
- Roteamento manual por pathname
- Serve arquivos estáticos (HTML, CSS, JS)
- CORS habilitado
- JSON como formato de dados

### 5. Interface Web

#### public/index.html
**Responsabilidade**: Estrutura HTML do dashboard

**Páginas**:
- Dashboard - Visão geral
- Conversas - Chat completo
- Leads - Tabela de leads
- Testar Bot - Chat de teste
- Configurações - Painel de config

#### public/css/style.css
**Responsabilidade**: Estilos visuais

**Características**:
- Dark theme moderno
- Design responsivo
- Variáveis CSS customizáveis
- Animações suaves
- Grid layout

#### public/js/app.js
**Responsabilidade**: Lógica frontend

**Classe BotDashboard**:
- Navegação entre páginas
- Fetch de dados da API
- Renderização dinâmica
- Auto-refresh de dados
- Gerenciamento de estado

## 🔄 Fluxos Principais

### Fluxo 1: Mensagem Recebida

```
WhatsApp Baileys
    ↓
Evento 'messages.upsert'
    ↓
handleMessage()
    ↓
┌─────────────────────────┐
│ Verificar Configurações │
└─────────┬───────────────┘
          │
    ┌─────▼─────┐
    │ Bot Ativo? │ → Não → FIM
    └─────┬─────┘
          │ Sim
    ┌─────▼──────┐
    │ Tipo Chat?  │
    └─────┬───────┘
          │
    ┌─────▼────────┐
    │ Salvar Lead  │
    └─────┬────────┘
          │
    ┌─────▼────────┐
    │ Processar NLP │
    └─────┬────────┘
          │
    ┌─────▼─────────┐
    │ Salvar Mensagem│
    └─────┬──────────┘
          │
    ┌─────▼──────┐
    │ Gerar Resposta│
    └─────┬────────┘
          │
    ┌─────▼──────┐
    │ Enviar WhatsApp│
    └─────┬────────┘
          │
    ┌─────▼──────┐
    │ Salvar Resposta│
    └───────────────┘
```

### Fluxo 2: Análise NLP

```
Texto da Mensagem
    ↓
normalize() → "oi tudo bem" → "oi tudo bem"
    ↓
identifyIntent()
    ↓
┌──────────────────┐
│ Para cada intent │
└────────┬─────────┘
         │
    ┌────▼─────┐
    │ Para cada pattern │
    └────┬──────┘
         │
    ┌────▼─────────┐
    │ Calcular Score │ → Match exato? → Score = 1.0
    └────┬──────────┘                → Similaridade
         │
    ┌────▼──────────┐
    │ Maior Score?   │ → Sim → Guardar
    └────┬───────────┘
         │
    ┌────▼────────┐
    │ Intent Final │
    └────┬─────────┘
         │
    ┌────▼────────────┐
    │ Extrair Entidades│
    └────┬─────────────┘
         │
    ┌────▼────────┐
    │ Obter Resposta│
    └────┬─────────┘
         │
    ┌────▼────────┐
    │ Retornar Tudo│
    └──────────────┘
```

### Fluxo 3: Configuração Alterada

```
Dashboard (Configurações)
    ↓
Usuário Altera Config
    ↓
Click "Salvar"
    ↓
POST /api/config
    ↓
updateConfig()
    ↓
┌──────────────────┐
│ Para cada config │
└────────┬─────────┘
         │
    ┌────▼────────┐
    │ db.setConfig() │
    └────┬─────────┘
         │
    ┌────▼─────────┐
    │ INSERT/UPDATE │
    └────┬──────────┘
         │
    ┌────▼───────┐
    │ Cloudflare D1│
    └────┬────────┘
         │
    ┌────▼────┐
    │ Success  │
    └────┬─────┘
         │
    ┌────▼─────┐
    │ Alert OK │
    └───────────┘
```

## 🔐 Segurança

### Credenciais
- Armazenadas em `.env`
- Nunca commitadas no git
- API Token com permissões mínimas

### Autenticação WhatsApp
- Pasta `auth_info` com sessão
- Multi-device com pairing code
- Renovação automática de creds

### API
- Sem autenticação (uso local)
- CORS aberto (apenas desenvolvimento)
- Para produção: adicionar JWT

## 📊 Performance

### Cache
- NLP mantém sessões em memória
- Limpeza automática de sessões antigas (30 min)

### Database
- Índices em campos frequentes
- Queries otimizadas
- Batch operations quando possível

### Frontend
- Auto-refresh inteligente (10s)
- Carregamento sob demanda
- Sem frameworks pesados

## 🚀 Escalabilidade

### Atual
- 1 instância Node.js
- 1 conexão WhatsApp
- Cloudflare D1 (ilimitado)

### Para Escalar
1. **Múltiplas Instâncias**
   - Load balancer
   - Redis para sessões compartilhadas

2. **Múltiplos Números WhatsApp**
   - Uma instância por número
   - Database centralizado

3. **Database**
   - D1 suporta escala automática
   - Adicionar cache Redis

## 🔧 Manutenção

### Logs
- Console logs no terminal
- Timestamp automático
- Níveis: ✅ Sucesso, ❌ Erro, ⏸️ Aviso

### Monitoramento
- Dashboard mostra status em tempo real
- Estatísticas por dia
- Histórico completo no DB

### Backup
- Dados no Cloudflare D1
- Export manual via dashboard
- Replicação automática (feature D1)

## 📝 Personalização

### Adicionar Novo Intent
1. Editar `src/nlp/intents.js`
2. Adicionar objeto com pattern e response
3. Reiniciar bot

### Modificar Schema DB
1. Editar `src/database/schema.sql`
2. Executar `npm run init-db`
3. Atualizar métodos em `d1.js` se necessário

### Adicionar Endpoint API
1. Editar `src/api/server.js`
2. Adicionar rota em `handleAPI()`
3. Implementar lógica
4. Atualizar frontend se necessário

### Customizar Interface
1. Cores: `public/css/style.css` (variáveis CSS)
2. Layout: `public/index.html`
3. Comportamento: `public/js/app.js`

---

**Sistema desenvolvido com arquitetura modular, desacoplada e fácil de manter**
