# NLP (src/nlp) — Como o cérebro do bot funciona

Esta pasta contém o “cérebro” do bot: detecção de intenção, memória de conversa, regras (políticas) e textos de resposta.
A ideia é o bot responder **como humano**, sem repetir, entendendo contexto e guiando para conversão.

---

## Visão geral (em 30 segundos)

Quando chega uma mensagem:

1) **Normaliza o texto** (remove acentos, pontuação, etc.)  
2) **Detecta a intenção** (ex.: greeting, pricing, web_development, traffic…)  
3) **Lê o estado da conversa** (assunto atual, estágio, o que já foi dito)  
4) **Aplica regras de conversa (policy)** (ex.: não interrogar, não repetir, pedir dado só na hora certa)  
5) **Escolhe a melhor resposta** (curta, humana, contextual)  
6) **Atualiza o estado** (memória) para a próxima mensagem

Fluxo mental:

`Mensagem → Intent → Estado → Policy → Resposta → Atualiza Estado`

---

## Arquivos e responsabilidades

### 1) `analyzer.js`
**O maestro do NLP.**  
É o arquivo principal que:
- recebe a mensagem,
- detecta a intenção (embeddings + fallback),
- consulta o **estado**,
- aplica **policy**,
- escolhe a resposta em `responses.js`,
- dispara automações (ex.: proposta, funil),
- atualiza a memória da conversa.

Se você quiser mudar “como o bot pensa”, quase sempre é aqui.

---

### 2) `embeddings.js`
**Detecção por similaridade sem LLM (offline/local).**

Responsabilidades típicas:
- carrega o modelo de embeddings (ex.: `all-MiniLM-L6-v2` via transformers),
- gera embedding da mensagem do usuário,
- compara com embeddings dos `patterns` de cada intent,
- retorna a intenção mais provável e a confiança,
- salva cache para não recalcular tudo toda hora.

Pontos de ajuste comuns:
- `similarityThreshold` (limiar mínimo para aceitar um match)
- cache (para acelerar boot)
- fallback quando embeddings falhar (ambiente sem onnx, etc.)

---

### 3) `intents.js`
**Catálogo do que o bot sabe identificar.**

Aqui você define:
- nomes de intenções (ex.: `greeting`, `pricing`, `traffic`, etc.)
- `patterns` (frases exemplo que representam aquela intenção)
- `priority` (empate: o que ganha quando duas intenções parecem iguais)

Dica prática:
- patterns devem ser curtos e variados (sinônimos, PT-BR real).
- evite patterns longos demais (viram ruído).
- mantenha intents “macro” e use slots/estado para detalhe.

---

### 4) `responses.js`
**O que o bot fala (humanizado).**

Normalmente contém:
- respostas em categorias e subcategorias:
  - `inicial`, `detalhamento`, `apos_preco`, `retomada`, etc.
- função para escolher aleatoriamente (para variar sem parecer robô)
- placeholders (ex.: `$NOME`) quando disponível

Como deixar mais humano:
- respostas curtas
- 1 pergunta no máximo (quando precisar)
- não repetir “a gente trabalha com…” toda hora
- usar o assunto atual (site/landing/tráfego/redes) para responder direto

---

### 5) `state.js`
**Memória da conversa (para ter contexto).**

Controla coisas como:
- `stage` (início, exploração, detalhamento, fechamento, retomada)
- `assunto` (site/landing/tráfego/redes)
- flags do que já foi dito (já apresentou? já falou preço? já pediu dados?)
- histórico curto (últimas interações)
- timeout (se ficou muito tempo sem falar, “zera” ou muda para retomada)

Sem estado, o bot sempre parece robô porque responde “do zero” a cada mensagem.

---

### 6) `policy.js`
**Regras para não virar interrogatório e não repetir.**

Este arquivo costuma concentrar regras como:
- limitar número de perguntas seguidas
- preferir respostas diretas quando a intenção está clara
- quando pedir nome/empresa (somente após interesse/preço)
- como reagir a mensagens curtas (“sim”, “ok”, “manda”)
- como lidar com ambiguidade (puxar para o assunto atual)

Pense nele como “etiqueta e estratégia de conversa”.

---

### 7) `signals.js`
**Sinais rápidos (heurísticas) antes/depois da intenção.**

Geralmente serve para detectar “pistas” que não dependem só de intent:
- urgência (hoje/agora/urgente)
- objeção de preço (caro/barato)
- pedido de prova (exemplos/cases/portfólio)
- retorno do cliente (“voltei”, “oi de novo”)
- pedido de proposta (“me manda”, “manda no zap”)

Esses sinais ajudam o bot a ajustar a resposta sem criar 200 intents novas.

---

### 8) `proposals.js`
**Estruturas de proposta e pacotes.**

Normalmente guarda:
- templates de proposta (site/landing/tráfego/redes)
- o que inclui, prazos, valores base
- variações por perfil (básico, padrão, completo)

A ideia é o bot não inventar: ele puxa a estrutura pronta e adapta conforme contexto.

---

### 9) `sales-automation.js`
**Funil e automações de venda (conversão).**

Costuma cuidar de:
- “próximo passo” após demonstrar interesse (capturar nome/empresa)
- quando oferecer proposta
- quando sugerir agendamento
- regras de transição de estágio (exploração → fechamento)
- gatilhos: se o cliente pediu “manda”, bot não agenda do nada — ele pede o mínimo necessário.

---

## Como evoluir para “mais abrangência” (sem LLM)

### A) Aumentar variações sem bagunçar
- Em `responses.js`, crie mais subcategorias:
  - `retomada`, `objeção_preço`, `pedido_exemplo`, `confuso`, `pressa`
- Em `state.js`, salve:
  - `lastResponseKey` (para evitar repetir)
  - `lastQuestionKey` (para não perguntar duas vezes a mesma coisa)

### B) Cobrir mais formas de perguntar
- Em `intents.js`, aumente patterns com variações reais:
  - “quanto fica”, “qual investimento”, “tem plano”, “pra começar quanto é”
- Use `signals.js` para variações que se repetem (caro/urgente/voltei).

### C) Teste regressivo (muito importante)
Crie uma lista de frases de teste por intenção e rode sempre que alterar intents/respostas.
Assim você evita:
- “sim” virar negativo
- “manda pra eu ver” virar agendamento
- “2” virar “não” quando veio do menu

---

## Checklist: bot humano (objetivo)
- [ ] Responde curto e direto quando a intenção é clara  
- [ ] Não repete o mesmo texto em sequência  
- [ ] Lembra do assunto atual (estado)  
- [ ] Faz no máximo 1 pergunta por mensagem (só quando precisa)  
- [ ] Quando o cliente volta depois de um tempo, faz retomada natural  
- [ ] Conduz para conversão (proposta/agendamento) sem parecer robô  

---