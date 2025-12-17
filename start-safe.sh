#!/bin/bash
# Script de inicialização SEGURA - Garante apenas 1 instância

echo "🚀 Império Lorde - Inicialização Segura"
echo "========================================"
echo ""

# 1. Verificar se já está rodando
RUNNING=$(ps aux | grep -E "bun.*src/index" | grep -v grep | wc -l)

if [ "$RUNNING" -gt 0 ]; then
    echo "⚠️  ATENÇÃO: Já existem $RUNNING instância(s) rodando!"
    echo ""
    echo "Processos encontrados:"
    ps aux | grep -E "bun.*src/index" | grep -v grep
    echo ""
    echo "Opções:"
    echo "  1. Matar tudo e iniciar limpo: ./kill-all.sh && ./start-safe.sh"
    echo "  2. Cancelar e manter processos atuais: Ctrl+C"
    echo ""
    read -p "Deseja matar tudo e iniciar limpo? (s/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[SsYy]$ ]]; then
        echo "🛑 Matando processos existentes..."
        ./kill-all.sh
        sleep 2
    else
        echo "❌ Cancelado. Processos mantidos."
        exit 1
    fi
fi

# 2. Verificar diretórios
echo "📁 Verificando diretórios..."
mkdir -p data sessions logs
chmod 777 data sessions logs
echo "✅ Diretórios OK"
echo ""

# 3. Verificar .env
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado!"
    echo "📝 Criando .env a partir do .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANTE: Configure o ADMIN_NUMBER no arquivo .env!"
    echo ""
fi

# 4. Limpar sessões antigas (opcional)
read -p "Deseja limpar sessões antigas do WhatsApp? (s/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[SsYy]$ ]]; then
    echo "🧹 Limpando sessões..."
    rm -rf sessions/*
    echo "✅ Sessões limpas"
    echo ""
fi

# 5. Iniciar
echo "🚀 Iniciando bot (ÚNICA INSTÂNCIA)..."
echo ""
echo "Para parar: Ctrl+C ou execute ./kill-all.sh em outro terminal"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

bun run dev
