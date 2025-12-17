#!/bin/sh
# Script de teste rápido

echo "🚀 Império Lorde - Teste Rápido"
echo "================================"
echo ""

# 1. Verificar Bun
if ! command -v bun &> /dev/null; then
    echo "❌ Bun não encontrado!"
    echo "Instale: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun encontrado: $(bun --version)"
echo ""

# 2. Criar .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando .env..."
    cp .env.example .env
fi

# 3. Criar diretórios
echo "📁 Criando diretórios..."
mkdir -p data sessions logs

# 4. Instalar dependências (sem better-sqlite3)
echo "📦 Instalando dependências..."
bun install --no-save

echo ""
echo "✅ Pronto para testar!"
echo ""
echo "Execute: bun run dev"
echo "Acesse: http://localhost:3210"
echo ""

