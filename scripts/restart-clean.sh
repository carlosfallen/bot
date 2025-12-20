#!/bin/bash
# FILE: scripts/restart-clean.sh

echo "🔄 Reiniciando bot com sessão limpa..."

# Parar
docker compose down

# Limpar sessões (não creds)
if [ -d "./auth_info" ]; then
    find ./auth_info -type f ! -name 'creds.json' -delete 2>/dev/null
    find ./auth_info -type d -empty -delete 2>/dev/null
    echo "✅ Sessions limpas (creds.json mantido)"
fi

# Rebuild e iniciar
docker compose up -d --build

# Mostrar logs
docker compose logs -f