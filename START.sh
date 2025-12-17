#!/bin/sh
# Script de inicialização rápida - Império Lorde Bot v2.0

echo "🚀 Império Lorde - WhatsApp Bot NLP"
echo "===================================="
echo ""

# Verificar Bun
if ! command -v bun &> /dev/null; then
    echo "❌ Bun não encontrado!"
    echo ""
    echo "Instalando Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
    echo "✅ Bun instalado!"
fi

echo "✅ Bun encontrado: $(bun --version)"
echo ""

# Criar diretórios
echo "📁 Criando diretórios..."
mkdir -p data sessions logs
echo "✅ Diretórios criados!"
echo ""

# Criar .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando .env..."
    cp .env.example .env
    echo "✅ .env criado!"
    echo "⚠️  Configure o .env antes de usar em produção!"
else
    echo "✅ .env já existe"
fi
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
bun install
echo "✅ Dependências instaladas!"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 TUDO PRONTO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Para iniciar o bot, execute:"
echo ""
echo "  🔥 Desenvolvimento (hot reload):"
echo "     bun run dev"
echo ""
echo "  📦 Produção:"
echo "     bun run start"
echo ""
echo "Depois acesse: http://localhost:3210"
echo ""
echo "📖 Leia TESTE_AGORA.md para mais informações"
echo ""
