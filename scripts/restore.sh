#!/bin/sh
# FILE: scripts/restore.sh
# Script de restore do backup

set -e

if [ -z "$1" ]; then
    echo "Uso: ./scripts/restore.sh <arquivo_backup>"
    echo ""
    echo "Backups disponíveis:"
    ls -lh ./backups/imperio_backup_*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  ATENÇÃO: Este processo irá sobrescrever os dados atuais!"
echo "Backup a ser restaurado: $BACKUP_FILE"
echo ""
read -p "Continuar? (s/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Operação cancelada."
    exit 0
fi

echo "🔄 Parando containers..."
docker compose down

echo "🔄 Restaurando backup..."
tar -xzf "$BACKUP_FILE"

echo "✅ Backup restaurado!"
echo ""
echo "Iniciando containers..."
docker compose up -d

echo "✅ Restore concluído!"
exit 0
