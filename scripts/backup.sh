#!/bin/sh
# FILE: scripts/backup.sh
# Script de backup do banco de dados e sessões

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="imperio_backup_${DATE}.tar.gz"

echo "🔄 Iniciando backup..."

# Criar diretório de backups
mkdir -p "$BACKUP_DIR"

# Backup do banco de dados e sessões
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
    data/ \
    sessions/ \
    .env \
    2>/dev/null || true

# Verificar se backup foi criado
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "✅ Backup criado: ${BACKUP_FILE} (${SIZE})"

    # Manter apenas últimos 7 backups
    cd "$BACKUP_DIR"
    ls -t imperio_backup_*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
    cd ..

    echo "📦 Backups disponíveis:"
    ls -lh "${BACKUP_DIR}"/imperio_backup_*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
else
    echo "❌ Erro ao criar backup!"
    exit 1
fi

exit 0
