# 🧪 Como Testar o Bot

## ✅ Checklist Completo de Testes

### 1. ✅ Instalação e Setup

```bash
# 1.1 Instalar dependências
npm install

# 1.2 Verificar se instalou corretamente
npm list @whiskeysockets/baileys pino dotenv

# 1.3 Inicializar banco de dados
npm run init-db

# Resultado esperado:
# ✅ Database initialized successfully
# Tabelas criadas: leads, conversations, messages, etc.
```

### 2. ✅ Conexão WhatsApp

```bash
# 2.1 Iniciar bot
npm start

# 2.2 Quando solicitar, digite número com DDI
# Exemplo: 5589994333316

# 2.3 Copiar código de 8 dígitos exibido
# Exemplo: ABC1-DEF2

# 2.4 No WhatsApp:
# Dispositivos Conectados > Conectar com número > Cole o código

# Resultado esperado:
# ✅ CONECTADO AO WHATSAPP!
# 🤖 Bot rodando... Aguardando mensagens.
# 🌐 Dashboard disponível em: http://localhost:3000
```

### 3. ✅ Dashboard Web

```bash
# 3.1 Abrir navegador em:
http://localhost:3000

# Resultado esperado:
# ✅ Dashboard carrega
# ✅ Status mostra "Conectado: [Nome]"
# ✅ Menu lateral funciona
```

#### 3.1 Testar Navegação
- [ ] Click em "Dashboard" - Mostra estatísticas
- [ ] Click em "Conversas" - Lista vazia inicialmente
- [ ] Click em "Leads" - Lista vazia inicialmente
- [ ] Click em "Testar Bot" - Chat interativo
- [ ] Click em "Configurações" - Painel de config

### 4. ✅ Testar NLP (Via Dashboard)

```
# 4.1 Ir em "Testar Bot"

# 4.2 Testar cada intent:

Saudação:
Digite: "oi"
Esperado: "Olá! 👋 Bem-vindo à nossa agência digital!"
Intent: greeting
Confidence: > 80%

Tráfego:
Digite: "preciso de tráfego pago"
Esperado: Resposta sobre Meta Ads, Google Ads
Intent: traffic

Marketing:
Digite: "gestão de instagram"
Esperado: Resposta sobre redes sociais
Intent: marketing

Site:
Digite: "quero fazer um site"
Esperado: Resposta sobre desenvolvimento web
Intent: web_development

Preço:
Digite: "quanto custa"
Esperado: Tabela de preços
Intent: pricing

Menu:
Digite: "menu"
Esperado: Lista de opções
Intent: menu
```

### 5. ✅ Testar WhatsApp Real

```
# 5.1 Enviar mensagens de outro número para o bot

Teste 1 - Saudação:
Envie: "Oi"
Esperado: Bot responde com saudação

Teste 2 - Serviço:
Envie: "Quero anunciar no Instagram"
Esperado: Bot responde sobre Meta Ads

Teste 3 - Preço:
Envie: "Qual o valor?"
Esperado: Bot mostra tabela de preços

Teste 4 - Menu:
Envie: "Menu"
Esperado: Bot lista todos os serviços

# 5.2 Verificar no terminal
# Deve aparecer:
📨 Mensagem de [número]
   Texto: [mensagem]
   🧠 Intent: [intent detectado]
   ✅ Resposta: [resposta enviada]
```

### 6. ✅ Verificar Salvamento de Dados

```
# 6.1 Após enviar mensagens, verificar dashboard

Dashboard:
- Estatística "Mensagens Hoje" deve aumentar
- Estatística "Novos Leads" deve aumentar (se chat privado)
- "Conversas Recentes" deve mostrar a conversa

Conversas:
- Click em "Conversas"
- Deve listar a conversa
- Click na conversa
- Deve mostrar histórico de mensagens

Leads:
- Click em "Leads"
- Deve mostrar o telefone que enviou mensagem
- Se NLP extraiu nome/email, deve aparecer
```

### 7. ✅ Configurações

```
# 7.1 Ir em "Configurações"

Teste 1 - Desativar Bot:
1. Desmarcar "Bot Ativo Globalmente"
2. Salvar
3. Enviar mensagem no WhatsApp
4. Bot NÃO deve responder
5. Ativar novamente

Teste 2 - Horário Comercial:
1. Marcar "Apenas Horário Comercial"
2. Definir horário (ex: 09:00 - 18:00)
3. Se fora do horário:
   - Enviar mensagem
   - Bot envia mensagem de ausência
4. Se dentro do horário:
   - Bot responde normalmente

Teste 3 - Grupos:
1. Desmarcar "Responder em Grupos"
2. Adicionar bot em grupo
3. Enviar mensagem no grupo
4. Bot NÃO responde
5. Ativar novamente

Teste 4 - Mensagens Personalizadas:
1. Editar "Mensagem de Boas-vindas"
2. Colocar: "Bem-vindo! Teste OK"
3. Salvar
4. Enviar "oi" no WhatsApp
5. Bot deve responder com nova mensagem
```

### 8. ✅ Extração de Entidades

```
Teste Nome:
Digite: "Meu nome é João Silva"
Esperado: NLP extrai "name": "João Silva"

Teste Email:
Digite: "Meu email é joao@email.com"
Esperado: NLP extrai "email": "joao@email.com"

Teste Telefone:
Digite: "Meu telefone é (11) 99999-9999"
Esperado: NLP extrai "phone": "11999999999"

Verificar no dashboard:
- Ir em "Testar Bot"
- Enviar mensagem com dados
- Painel "Análise NLP" deve mostrar entidades
```

### 9. ✅ Conversas por Tipo

```
Chat Privado:
1. Enviar de número privado
2. Verificar em "Conversas"
3. Tipo deve ser "💬 Chat privado"

Grupo:
1. Adicionar bot em grupo (se config permitir)
2. Enviar mensagem no grupo
3. Verificar em "Conversas"
4. Tipo deve ser "👥 Grupo"
```

### 10. ✅ Desativar Bot por Conversa

```
1. Ir em "Conversas"
2. Click em uma conversa
3. Click em "Desativar Bot"
4. Enviar mensagem no WhatsApp
5. Bot NÃO deve responder nesta conversa
6. Outras conversas continuam funcionando
7. Ativar novamente
```

### 11. ✅ Estatísticas

```
Verificar no Dashboard:
- Mensagens Hoje: Conta todas as mensagens recebidas
- Novos Leads: Conta novos contatos privados
- Conversas Ativas: Conversas com mensagens hoje
- Respostas Bot: Quantas vezes o bot respondeu

Testar:
1. Anotar números atuais
2. Enviar 3 mensagens diferentes
3. Atualizar dashboard (auto-refresh em 10s)
4. Números devem aumentar
```

### 12. ✅ Performance e Estabilidade

```
Teste de Carga:
1. Enviar 10 mensagens rápidas
2. Bot deve responder todas
3. Dashboard deve registrar todas
4. Sem erros no terminal

Teste de Reconexão:
1. Fechar WhatsApp Web
2. Aguardar 30 segundos
3. Bot deve tentar reconectar
4. Terminal mostra: "🔄 Conectando..."

Teste de Memória:
1. Deixar bot rodando por 1 hora
2. Verificar se continua respondendo
3. Sem crashes ou lentidão
```

## 🐛 Problemas Comuns e Soluções

### ❌ Erro: "CLOUDFLARE_API_TOKEN not found"
**Solução**:
```bash
# Verificar arquivo .env existe
cat .env

# Se não existe, criar:
cp .env.example .env
# Editar .env com suas credenciais
```

### ❌ Dashboard não carrega
**Solução**:
```bash
# Verificar se bot está rodando
# Deve aparecer: "🌐 Dashboard disponível em: http://localhost:3000"

# Verificar porta 3000 está livre
lsof -i :3000

# Se ocupada, mudar porta no .env
echo "PORT=3001" >> .env
```

### ❌ Bot não responde
**Checklist**:
1. [ ] Terminal mostra "✅ CONECTADO"?
2. [ ] Status no dashboard "Conectado"?
3. [ ] Config "Bot Ativo" está ON?
4. [ ] Não está fora do horário comercial?
5. [ ] Conversa não está desativada?

### ❌ NLP não detecta intent
**Solução**:
```javascript
// Adicionar mais patterns em src/nlp/intents.js
meu_intent: {
    patterns: [
        'palavra chave',
        'outra palavra',
        'termo importante'
    ]
}
```

### ❌ Dados não salvam no banco
**Solução**:
```bash
# Reinicializar banco
npm run init-db

# Verificar credenciais Cloudflare no .env
# Testar conexão manual
```

## 📊 Relatório de Testes

```
[ ] 1. Instalação completa
[ ] 2. Conexão WhatsApp OK
[ ] 3. Dashboard abre e funciona
[ ] 4. NLP detecta todos os intents
[ ] 5. Bot responde no WhatsApp
[ ] 6. Dados salvos corretamente
[ ] 7. Configurações aplicadas
[ ] 8. Entidades extraídas
[ ] 9. Tipos de chat funcionam
[ ] 10. Desativar por conversa OK
[ ] 11. Estatísticas corretas
[ ] 12. Performance estável

✅ Todos os testes passaram: SISTEMA OK
❌ Algum teste falhou: Ver problemas comuns acima
```

## 🎯 Teste Completo End-to-End

```
1. Iniciar bot limpo (deletar auth_info se existe)
2. Conectar WhatsApp com pairing code
3. Configurar horário comercial: 00:00 - 23:59
4. Ativar "Salvar Leads Automaticamente"
5. Ativar "Bot Ativo Globalmente"
6. Enviar mensagem: "Oi"
7. Verificar resposta no WhatsApp
8. Abrir dashboard
9. Verificar conversa aparece
10. Verificar lead foi salvo
11. Verificar mensagens no histórico
12. Testar NLP no chat de teste
13. Alterar configuração de horário
14. Testar mensagem fora do horário
15. Verificar estatísticas atualizaram

✅ SE TUDO FUNCIONAR: Sistema 100% operacional!
```

---

**Dica**: Execute este checklist sempre após atualizar o código ou fazer deploy!
