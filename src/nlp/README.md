## 📂 O que é a pasta `src/nlp`?

Essa pasta é o **cérebro do bot**.

Tudo que acontece aqui serve para:
- entender o que o cliente escreveu
- lembrar do que já foi falado
- decidir a melhor resposta
- evitar respostas repetidas
- manter a conversa natural

---

## 🔁 Fluxo geral (bem simples)

```

Cliente envia mensagem
↓
Bot entende o que a pessoa quis dizer
↓
Bot lembra do histórico da conversa
↓
Bot escolhe a resposta correta para aquele momento
↓
Bot responde
↓
Bot salva o contexto para a próxima mensagem

```

---

## 1️⃣ `state.js` — Memória da conversa

📌 **O que faz:**  
Guarda o estado da conversa de cada pessoa.

Funciona como a memória de um atendente humano.

Ele lembra coisas como:
- já dei bom dia?
- já falei de preço?
- estamos falando de site, tráfego ou redes?
- já pedi nome?
- em que etapa da conversa estamos?

👉 Sem isso, o bot repetiria tudo e pareceria robô.

---

## 2️⃣ `intents.js` — O que o cliente quis dizer

📌 **O que faz:**  
Define as **intenções** das mensagens.

Intenção = objetivo da frase.

Exemplos:
- “oi” → `greeting`
- “quanto custa?” → `pricing`
- “quero um site” → `web_development`
- “sim” → `affirmative`

Esse arquivo **não responde nada**, ele só ajuda o bot a entender.

---

## 3️⃣ `embeddings.js` — Entendimento inteligente (IA)

📌 **O que faz:**  
Ajuda o bot a entender frases diferentes com o mesmo sentido.

Exemplo:
- “vocês fazem site?”
- “preciso de um site”
- “quero apresentar minha empresa”

Mesmo com palavras diferentes, o bot entende que é **a mesma intenção**.

👉 Isso deixa o bot mais flexível e humano.

⚠️ Importante:
- Se isso falhar, o bot ainda funciona (fallback).
- É um reforço de inteligência, não algo obrigatório.

---

## 4️⃣ `responses.js` — Respostas humanas prontas

📌 **O que faz:**  
Guarda **todas as respostas do bot**, escritas manualmente.

As respostas:
- são curtas
- variam para não repetir
- mudam conforme o momento da conversa

Exemplo:
- primeira mensagem → “Oi! Como posso te ajudar?”
- depois → “Oi de novo! Em que posso ajudar?”

👉 Aqui está o “jeito humano” do bot.

---

## 5️⃣ `analyzer.js` — O cérebro principal

📌 **Arquivo mais importante.**

Ele junta tudo:
- mensagem do cliente
- intenção detectada
- estado da conversa
- respostas disponíveis

E decide:

> **Qual é a melhor resposta agora?**

### Ele faz isso em passos:
1. limpa e normaliza a mensagem
2. detecta a intenção
3. consulta o estado da conversa
4. escolhe a resposta mais adequada
5. atualiza o estado para a próxima mensagem

---

## 🔄 Fluxo resumido (visual)

```

Mensagem do cliente
↓
analyzer.js
↓
intents.js   → entende o que foi dito
↓
state.js     → lembra do histórico
↓
responses.js → escolhe a frase
↓
Resposta enviada
↓
state.js salva o novo estado

```

---

## 🤖 Por que isso parece humano?

Porque o bot:
- não repete apresentação
- não volta para o menu toda hora
- responde de forma curta e direta
- lembra do assunto atual
- só pergunta quando faz sentido

👉 Exatamente como um atendente humano faria.

---

## 🧠 Resumo final (em uma frase)

> Este NLP funciona como um atendente que entende o que o cliente quer, lembra da conversa e responde no momento certo, sem confundir assuntos ou repetir mensagens.

---

