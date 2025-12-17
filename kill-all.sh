#!/bin/bash
# Script para matar TODAS as instâncias do bot

echo "🛑 Matando todas as instâncias do Império Lorde Bot..."
echo ""

# Matar todos os processos bun relacionados ao bot
echo "Matando processos Bun..."
pkill -f "bun --watch src/index" || true
pkill -f "bun run dev" || true
pkill -f "bun run start" || true
pkill -f "imperio-baileys" || true

# Aguardar processos terminarem
sleep 2

# Verificar se ainda há processos
REMAINING=$(ps aux | grep -E "bun.*src/index" | grep -v grep | wc -l)

if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Ainda há $REMAINING processos. Matando com -9..."
    pkill -9 -f "bun --watch src/index" || true
    pkill -9 -f "bun run dev" || true
    sleep 1
fi

echo ""
echo "✅ Todos os processos foram encerrados!"
echo ""
echo "Verificando..."
ps aux | grep -E "bun.*src/index" | grep -v grep || echo "✅ Nenhum processo rodando"
echo ""
echo "Agora você pode iniciar com: bun run dev"
