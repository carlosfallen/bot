#!/bin/bash
# FILE: scripts/clear-session.sh

echo "🗑️  Limpando sessão do WhatsApp..."

# Parar container
docker compose stop whatsapp-bot 2>/dev/null

# Limpar apenas sessions (manter creds se possível)
if [ -d "./auth_info" ]; then
    # Backup do creds
    if [ -f "./auth_info/creds.json" ]; then
        cp ./auth_info/creds.json /tmp/creds_backup.json 2>/dev/null
    fi
    
    # Limpar tudo
    rm -rf ./auth_info/*
    
    echo "✅ Sessão limpa!"
    echo ""
    echo "Próximos passos:"
    echo "1. docker compose up -d"
    echo "2. docker compose logs -f"
    echo "3. Digite o número quando pedido"
    echo "4. Use o código de pareamento no WhatsApp"
else
    echo "⚠️  Pasta auth_info não encontrada"
fi