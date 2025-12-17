#!/bin/sh
# FILE: scripts/setup-alpine.sh
# Script de instalação e configuração para Alpine Linux

set -e

echo "=================================================="
echo "  Império Lorde - Setup Alpine Linux"
echo "=================================================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo "${RED}[ERROR]${NC} $1"
    exit 1
}

# Verificar se é Alpine Linux
if [ ! -f /etc/alpine-release ]; then
    error "Este script é apenas para Alpine Linux!"
fi

info "Alpine Linux $(cat /etc/alpine-release) detectado"

# 1. Atualizar sistema
info "Atualizando sistema..."
apk update
apk upgrade

# 2. Instalar dependências
info "Instalando dependências..."
apk add \
    docker \
    docker-compose \
    git \
    curl \
    wget \
    openssl \
    tzdata \
    bash

# 3. Configurar timezone
info "Configurando timezone..."
if [ ! -f /etc/localtime ]; then
    cp /usr/share/zoneinfo/America/Fortaleza /etc/localtime
    echo "America/Fortaleza" > /etc/timezone
    info "Timezone configurado: America/Fortaleza"
fi

# 4. Habilitar e iniciar Docker
info "Configurando Docker..."
rc-update add docker boot
service docker start

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando!"
fi

info "Docker $(docker --version) instalado e rodando"

# 5. Adicionar usuário ao grupo docker (se não for root)
if [ "$USER" != "root" ]; then
    info "Adicionando usuário $USER ao grupo docker..."
    addgroup $USER docker || warn "Usuário já está no grupo docker"
    warn "IMPORTANTE: Faça logout e login novamente para aplicar as permissões do grupo docker"
fi

# 6. Criar diretórios necessários
info "Criando estrutura de diretórios..."
mkdir -p data sessions logs nginx/ssl

# 7. Gerar .env se não existir
if [ ! -f .env ]; then
    info "Criando arquivo .env..."
    cp .env.example .env

    # Gerar secrets
    WEBHOOK_TOKEN=$(openssl rand -base64 32)

    # Substituir no .env
    sed -i "s|WEBHOOK_AUTH_TOKEN=|WEBHOOK_AUTH_TOKEN=$WEBHOOK_TOKEN|g" .env

    warn "IMPORTANTE: Edite o arquivo .env e configure:"
    warn "  - ADMIN_NUMBER (seu número WhatsApp com DDI)"
    warn "  - MIN_BUDGET_HOT e MIN_BUDGET_WARM (valores de qualificação)"
fi

# 8. Ajustar permissões
info "Ajustando permissões..."
chmod 755 scripts/*.sh 2>/dev/null || true
chmod 600 .env 2>/dev/null || true
chmod 755 data sessions logs

# 9. Inicializar banco de dados
info "Inicializando banco de dados..."
if [ -f schema.sql ]; then
    touch data/imperio.db
    info "Banco de dados criado em data/imperio.db"
fi

# 10. Build e start dos containers
info "Construindo e iniciando containers..."
docker compose build
docker compose up -d

# 11. Aguardar containers ficarem healthy
info "Aguardando containers iniciarem..."
sleep 10

# 12. Verificar status
info "Verificando status dos containers..."
docker compose ps

# 13. Mostrar logs
echo ""
info "Setup concluído!"
echo ""
echo "=================================================="
echo "  Próximos passos:"
echo "=================================================="
echo ""
echo "1. Editar .env com suas configurações:"
echo "   nano .env"
echo ""
echo "2. Reiniciar containers após editar .env:"
echo "   docker compose restart"
echo ""
echo "3. Ver logs em tempo real:"
echo "   docker compose logs -f"
echo ""
echo "4. Acessar dashboard:"
echo "   http://$(hostname -i)"
echo ""
echo "5. Escanear QR Code do WhatsApp no dashboard"
echo ""
echo "=================================================="
echo ""

# 14. Mostrar QR Code se possível
if command -v qrencode > /dev/null 2>&1; then
    info "Para exibir QR Code no terminal, instale: apk add qrencode"
fi

exit 0
