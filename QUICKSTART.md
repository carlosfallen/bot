# 🚀 Início Rápido

## 1. Instalar Dependências

```bash
bun install
```

## 2. Rodar o Servidor

```bash
bun run src/index.tsx
```

## 3. Conectar WhatsApp

Abra o navegador em `http://localhost:3210` e escolha:

### Opção A: QR Code
- Aguarde o QR Code aparecer
- Escaneie com WhatsApp > Dispositivos Conectados

### Opção B: Pairing Code
- Digite seu número: `5511999999999`
- Clique em "Gerar Código"
- Digite o código no WhatsApp > Dispositivos Conectados > Conectar com número

## 4. Pronto!

O bot já está funcionando e respondendo mensagens automaticamente.

## 🧪 Testar NLP

```bash
curl -X POST http://localhost:3210/api/test-nlp \
  -H "Content-Type: application/json" \
  -d '{"message": "quero anunciar no google"}'
```

## 📱 Enviar Mensagem

```bash
curl -X POST http://localhost:3210/api/send \
  -H "Content-Type: application/json" \
  -d '{"to": "5511999999999", "text": "Olá! Teste do bot"}'
```

## 🛑 Desconectar

```bash
curl -X POST http://localhost:3210/api/disconnect
```

Ou clique em "Desconectar" no dashboard.

## 🔄 Reiniciar Conexão

```bash
# Limpar sessão
rm -rf auth_info/

# Rodar novamente
bun run src/index.tsx
```

## 📊 Ver Estatísticas

```bash
curl http://localhost:3210/api/stats
```

## ✅ Funcionalidades

- ✅ Conexão WhatsApp via QR Code ou Pairing Code
- ✅ Reconexão automática
- ✅ Respostas automáticas com NLP
- ✅ Análise de intenções e sentimento
- ✅ Dashboard em tempo real
- ✅ WebSocket para updates ao vivo
- ✅ Banco de dados SQLite
- ✅ API REST completa

## 🎯 Próximos Passos

1. Personalize as respostas em `src/server/whatsapp.ts`
2. Adicione novas intenções em `src/lib/nlp-engine.ts`
3. Configure horário de atendimento em `src/lib/business-hours.ts`
4. Customize o dashboard em `src/index.tsx`

## 💡 Dicas

- Use `bun --watch src/index.tsx` para desenvolvimento
- Veja os logs no terminal para debug
- Acesse o dashboard para monitorar em tempo real
- Teste o NLP antes de colocar em produção
