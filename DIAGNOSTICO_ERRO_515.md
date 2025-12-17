# 🔬 DIAGNÓSTICO AVANÇADO - Erro 515 Imediato

## ❌ Padrão de Erro Observado

```
📱 QR Code gerado (tentativa 1/3)        # 20:03:42
[VOCÊ ESCANEIA O QR CODE]
❌ Conexão fechada {"statusCode":515}    # 20:03:51 (9 segundos depois!)
🚫 Conflito 515 detectado
```

**Tempo:** 9 segundos entre QR e erro 515

Isso é **MUITO RÁPIDO** para ser múltiplas instâncias.

---

## 🔍 CAUSA MAIS PROVÁVEL

O erro 515 **IMEDIATO** (segundos após escanear) geralmente significa:

### 1. WhatsApp Web está aberto em outro navegador/aba

**SOLUÇÃO:**
```bash
# No seu navegador:
1. Feche TODAS as abas do WhatsApp Web
2. Vá em whatsapp.com e desconecte todos
3. Ou use o celular:
   WhatsApp > Configurações > Aparelhos conectados > Desconectar todos
```

### 2. Outro bot/aplicação usando o mesmo número

**VERIFIQUE:**
```bash
# Ver TODOS os processos que podem conectar WhatsApp
ps aux | grep -E "baileys|whatsapp|wa-|@whiskeysockets"

# Deve retornar APENAS o seu bot
# Se aparecer outros PIDs = MATE TODOS
```

### 3. Sessão corrompida ou inválida

**SOLUÇÃO:**
```bash
# Limpar completamente
rm -rf sessions/*
rm -rf data/imperio.db

# Reiniciar
./start-safe.sh
```

---

## 🛠️ TESTE PASSO A PASSO

### Passo 1: Garantir Ambiente Limpo

```bash
# 1. Matar TUDO relacionado a WhatsApp/Baileys
./kill-all.sh

# 2. Verificar (DEVE SER VAZIO)
ps aux | grep -E "baileys|whatsapp|src/index"

# 3. Limpar sessões
rm -rf sessions/*

# 4. Limpar banco (se necessário)
rm -rf data/imperio.db
```

### Passo 2: Desconectar WhatsApp Web

**No Celular:**
1. Abra WhatsApp
2. Menu (3 pontos) > Aparelhos conectados
3. Se houver algum dispositivo: DESCONECTAR TODOS
4. Aguarde 30 segundos

**No Navegador:**
1. Feche TODAS as abas abertas
2. Vá em https://web.whatsapp.com
3. Se estiver conectado: Desconecte
4. Feche a aba

### Passo 3: Iniciar Bot

```bash
./start-safe.sh
```

**Aguarde aparecer:**
```
📱 QR Code gerado (tentativa 1/3)
```

### Passo 4: Conectar

1. **Abra o navegador:** http://localhost:3210
2. **Veja o QR Code** na interface
3. **No celular:**
   - WhatsApp > Aparelhos conectados
   - Conectar um aparelho
   - **IMPORTANTE:** Certifique-se que não há outros dispositivos conectados
4. **Escaneie o QR Code**
5. **AGUARDE** (não feche nada!)

### Passo 5: Observar Logs

**Logs de SUCESSO:**
```
🔄 Conectando...
✅ WhatsApp conectado com sucesso
```

**Se der erro 515:**
```
❌ Conexão fechada {"statusCode":515}
```

Vá para "Teste Avançado" abaixo.

---

## 🧪 TESTE AVANÇADO

Se ainda der erro 515:

### Teste 1: Verificar Outros Processos

```bash
# Listar TODOS os processos Node/Bun
ps aux | grep -E "node|bun" | grep -v grep

# Procurar por:
# - Outros bots WhatsApp
# - Baileys em outras pastas
# - WhatsApp Web rodando localmente
```

### Teste 2: Verificar Porta

```bash
# Ver quem está usando a porta 3210
lsof -i :3210

# Deve mostrar APENAS o seu bot
# Se aparecer outros = conflito
```

### Teste 3: Testar com Browser Diferente

Altere temporariamente em `src/server/whatsapp.ts` linha 77:

```typescript
// Tente diferentes browsers
browser: ['Chrome (Linux)', '', ''],  // Atual
// OU
browser: ['Windows', 'Chrome', '10.0'],
// OU
browser: ['Ubuntu', 'Chrome', '20.0.04'],
```

Reinicie após cada mudança.

### Teste 4: Modo Debug

Ative logs detalhados:

```typescript
// Em src/server/whatsapp.ts linha 76
logger: pino({ level: 'silent' }),  // Mudar para:
logger: pino({ level: 'info' }),   // Ver logs detalhados
```

Reinicie e veja logs completos.

---

## 📊 Análise do Timing

| Evento | Tempo | Análise |
|--------|-------|---------|
| QR Code gerado | 00:00 | ✅ OK |
| Você escaneia | ~00:05 | ✅ OK |
| Erro 515 | 00:09 | ❌ MUITO RÁPIDO = WhatsApp rejeitou |

**Se fosse múltiplas instâncias:**
- Erro seria ALEATÓRIO (várias tentativas conflitando)
- Não seria sempre 9 segundos
- Aconteceria antes de escanear

**Como é sempre DEPOIS de escanear:**
- WhatsApp aceitou a conexão inicial
- Mas detectou algum conflito/problema
- E desconectou imediatamente

---

## 🎯 CHECKLIST DE VERIFICAÇÃO

Antes de tentar novamente:

- [ ] **Fechei WhatsApp Web** em TODOS os navegadores
- [ ] **Desconectei todos os dispositivos** no celular
- [ ] **Não há outro bot** rodando neste número
- [ ] **Apenas 1 processo** do bot está rodando
- [ ] **Sessões limpas** (rm -rf sessions/*)
- [ ] **Internet estável** (ping google.com)
- [ ] **Aguardei 1 minuto** desde a última desconexão

---

## 🔧 ALTERAÇÕES APLICADAS NO CÓDIGO

Mudei a configuração do browser para ser mais genérico:

**Antes:**
```typescript
browser: ['Imperio Bot', 'Chrome', '120.0.0.0'],
retryRequestDelayMs: 500,
markOnlineOnConnect: true,
```

**Depois:**
```typescript
browser: ['Chrome (Linux)', '', ''],
getMessage: async () => ({ conversation: '' }),
```

Isso evita que o WhatsApp rejeite por nome de browser não reconhecido.

---

## 💡 TESTE DEFINITIVO

Se NADA funcionar, teste com número DIFERENTE:

1. Use um número de teste/secundário
2. Certifique-se que esse número:
   - Nunca foi conectado ao bot
   - Não tem WhatsApp Web ativo
   - Não tem outros bots conectados

Se funcionar = Problema está no número original
Se não funcionar = Problema está na configuração

---

## 🚨 IMPORTANTE

O erro 515 pode ter um período de "cooldown".

**Se você tentou conectar MUITAS vezes:**
- WhatsApp pode ter bloqueado temporariamente
- Aguarde **10-15 minutos** sem tentar
- Depois tente novamente com sessão limpa

---

## 📱 PASSO A PASSO COMPLETO (DO ZERO)

```bash
# 1. Parar TUDO
./kill-all.sh
docker-compose down 2>/dev/null || true

# 2. Aguardar
echo "Aguardando 30 segundos..."
sleep 30

# 3. Limpar TUDO
rm -rf sessions/*
rm -rf data/imperio.db

# 4. No celular: Desconectar todos os aparelhos

# 5. Aguardar mais
echo "Aguardando mais 30 segundos..."
sleep 30

# 6. Iniciar
./start-safe.sh

# 7. Aguardar QR Code

# 8. Escanear

# 9. NÃO FECHE NADA! Aguarde conectar
```

---

## 🎯 PRÓXIMOS PASSOS

Se ainda der erro 515 após TUDO isso:

1. **Copie os logs completos** e me envie
2. **Tire screenshot** do erro no celular (se aparecer)
3. **Verifique** se há mensagem no celular sobre muitas conexões
4. **Teste** com outro número (se possível)

---

**Desenvolvido com ❤️ para Império Lorde**

Diagnóstico avançado - Erro 515 imediato após escanear QR
