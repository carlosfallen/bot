# 💬 WhatsApp Bot com NLP

Bot de WhatsApp inteligente com processamento de linguagem natural (NLP) para atendimento automatizado.

## 🚀 Tecnologias

- **Bun** - Runtime JavaScript rápido
- **Baileys** - Biblioteca WhatsApp Web API
- **Natural.js** - Processamento de Linguagem Natural
- **SQLite** - Banco de dados
- **WebSocket** - Comunicação em tempo real

## 📁 Estrutura do Projeto

```
bot/
├── src/
│   ├── index.tsx              # Servidor principal Bun
│   ├── server/
│   │   ├── whatsapp.ts       # Conexão WhatsApp
│   │   └── db.ts             # Banco de dados SQLite
│   └── lib/
│       ├── nlp-engine.ts     # Engine NLP com Natural.js
│       ├── message-builder.ts
│       └── business-hours.ts
├── auth_info/                 # Sessão WhatsApp
├── data/                      # Banco de dados
└── package.json
```

## 🔧 Instalação

```bash
# Instalar Bun (se ainda não tiver)
curl -fsSL https://bun.sh/install | bash

# Instalar dependências
bun install

# Rodar o servidor
bun run src/index.tsx
```

## 📱 Conexão WhatsApp

O bot suporta duas formas de conexão:

### 1. QR Code
- Acesse `http://localhost:3210`
- Aguarde o QR Code aparecer
- Escaneie com WhatsApp (Dispositivos Conectados)

### 2. Pairing Code (Código de Pareamento)
- Acesse `http://localhost:3210`
- Digite seu número com DDI (ex: 5511999999999)
- Clique em "Gerar Código de Pareamento"
- Digite o código no WhatsApp (Dispositivos Conectados)

## 🤖 Funcionalidades NLP

O bot reconhece as seguintes intenções:

### Saudações
- "oi", "olá", "bom dia", "boa tarde", "boa noite"

### Serviços
- **Tráfego Pago**: anúncios, Meta Ads, Google Ads
- **Social Media**: gestão de redes, conteúdo, engajamento
- **Sites**: landing pages, sites institucionais
- **Consultoria**: estratégia, diagnóstico, análise

### Informações
- **Valores**: preços, orçamentos, investimento
- **Menu**: opções de serviços
- **Atendimento**: transferência para humano

### Análise Avançada
- Extração de entidades (nome, email, telefone, empresa)
- Análise de sentimento (positivo, neutro, negativo)
- Qualificação de leads (quente, morno, frio)
- Detecção de urgência (alta, média, baixa)

## 🌐 API Endpoints

### Status do WhatsApp
```bash
GET /api/status
```

### Gerar Código de Pareamento
```bash
POST /api/pairing-code
Body: { "phone": "5511999999999" }
```

### Enviar Mensagem
```bash
POST /api/send
Body: { "to": "5511999999999", "text": "Olá!" }
```

### Testar NLP
```bash
POST /api/test-nlp
Body: { "message": "Quero anunciar no Google" }
```

### Estatísticas
```bash
GET /api/stats
```

### Desconectar WhatsApp
```bash
POST /api/disconnect
```

## 📊 Dashboard

Acesse `http://localhost:3210` para ver o dashboard com:

- Status da conexão WhatsApp
- Estatísticas em tempo real
- Log de mensagens
- Controles de conexão/desconexão

## 🔄 Reconexão Automática

O bot reconecta automaticamente em caso de:
- Perda de conexão com internet
- Timeout do servidor
- Erros temporários

**Não reconecta em caso de:**
- Logout manual
- Dispositivo desvinculado

## 💾 Banco de Dados

Tabelas SQLite:

- **leads**: Prospects capturados
- **interactions**: Histórico de mensagens
- **sessions**: Estado da conversa por usuário
- **message_templates**: Templates de respostas
- **config**: Configurações gerais

## 🛠️ Desenvolvimento

```bash
# Rodar em modo desenvolvimento
bun --watch src/index.tsx

# Limpar sessão do WhatsApp
rm -rf auth_info/

# Limpar banco de dados
rm -rf data/imperio.db
```

## 📝 Personalização

### Adicionar Novas Intenções

Edite `src/lib/nlp-engine.ts`:

```typescript
const trainingData = [
  // Adicionar novos exemplos
  { text: 'quero orçamento', intent: 'valores' },
  { text: 'preciso de ajuda', intent: 'suporte' },
];
```

### Personalizar Respostas

Edite `src/server/whatsapp.ts`:

```typescript
const responses: Record<string, string> = {
  saudacao: 'Olá! Como posso ajudar?',
  valores: 'Entre em contato: (XX) XXXX-XXXX',
  // Adicionar novas respostas
};
```

## 🐛 Troubleshooting

### QR Code não aparece
- Aguarde 5-10 segundos
- Verifique se há sessão ativa em `auth_info/`
- Limpe a sessão: `rm -rf auth_info/`

### Bot não responde
- Verifique se está conectado no dashboard
- Veja os logs no terminal
- Teste o NLP: `POST /api/test-nlp`

### Erro ao instalar dependências
- Use `bun install` ao invés de `npm install`
- Verifique a versão do Bun: `bun --version`

## 📄 Licença

MIT

## 👨‍💻 Autor

Projeto refatorado e otimizado para máxima performance e simplicidade.

## 🔗 Links Úteis

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Natural.js](https://github.com/NaturalNode/natural)
- [Bun](https://bun.sh)
