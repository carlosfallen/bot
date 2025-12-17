#!/bin/bash
# Script de inicialização Docker - Império Lorde Bot

echo "🚀 Império Lorde - Inicialização Docker"
echo "========================================"
echo ""

# 1. Criar diretórios necessários no host
echo "📁 Criando diretórios..."
mkdir -p data sessions logs

# 2. Ajustar permissões (importante para o usuário não-root do container)
echo "🔧 Ajustando permissões..."
chmod 777 data sessions logs

# 3. Criar .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando .env..."
    cp .env.example .env
    echo "⚠️  Configure o ADMIN_NUMBER no arquivo .env!"
    echo ""
fi

# 4. Parar containers antigos
echo "🛑 Parando containers antigos..."
docker-compose down

# 5. Build
echo "🔨 Building containers..."
docker-compose build --no-cache

# 6. Iniciar
echo "🚀 Iniciando containers..."
docker-compose up

