#!/bin/sh
# FILE: scripts/health-check.sh
# Script de verificação de saúde do sistema

set -e

echo "=================================================="
echo "  Império Lorde - Health Check"
echo "=================================================="

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_ok() {
    echo "${GREEN}✓${NC} $1"
}

check_fail() {
    echo "${RED}✗${NC} $1"
}

check_warn() {
    echo "${YELLOW}⚠${NC} $1"
}

# 1. Docker
if docker info > /dev/null 2>&1; then
    check_ok "Docker está rodando"
else
    check_fail "Docker NÃO está rodando"
    exit 1
fi

# 2. Containers
echo ""
echo "Containers:"
docker compose ps

# 3. Verificar containers healthy
APP_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' imperio-app 2>/dev/null || echo "not_found")
NGINX_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' imperio-nginx 2>/dev/null || echo "not_found")

echo ""
if [ "$APP_HEALTH" = "healthy" ]; then
    check_ok "App container: healthy"
elif [ "$APP_HEALTH" = "not_found" ]; then
    check_fail "App container: não encontrado"
else
    check_warn "App container: $APP_HEALTH"
fi

if [ "$NGINX_HEALTH" = "healthy" ]; then
    check_ok "Nginx container: healthy"
elif [ "$NGINX_HEALTH" = "not_found" ]; then
    check_fail "Nginx container: não encontrado"
else
    check_warn "Nginx container: $NGINX_HEALTH"
fi

# 4. Verificar endpoints
echo ""
echo "Endpoints:"

if curl -sf http://localhost/api/health > /dev/null 2>&1; then
    check_ok "API Health endpoint respondendo"
else
    check_fail "API Health endpoint não responde"
fi

if curl -sf http://localhost/api/status > /dev/null 2>&1; then
    check_ok "API Status endpoint respondendo"
else
    check_warn "API Status endpoint não responde"
fi

# 5. Verificar banco de dados
echo ""
if [ -f data/imperio.db ]; then
    SIZE=$(du -h data/imperio.db | cut -f1)
    check_ok "Banco de dados: $SIZE"
else
    check_fail "Banco de dados não encontrado"
fi

# 6. Verificar sessões WhatsApp
echo ""
if [ -d sessions ]; then
    SESSION_COUNT=$(ls -1 sessions 2>/dev/null | wc -l)
    if [ "$SESSION_COUNT" -gt 0 ]; then
        check_ok "Sessões WhatsApp: $SESSION_COUNT arquivo(s)"
    else
        check_warn "Nenhuma sessão WhatsApp encontrada (QR Code não escaneado)"
    fi
else
    check_warn "Diretório de sessões não encontrado"
fi

# 7. Uso de disco
echo ""
echo "Uso de disco:"
df -h / | tail -1

# 8. Memória
echo ""
echo "Uso de memória:"
free -h | grep Mem

# 9. Últimas 5 linhas de log
echo ""
echo "Últimas mensagens de log:"
docker compose logs --tail=5 app 2>/dev/null || echo "Sem logs disponíveis"

echo ""
echo "=================================================="
exit 0
