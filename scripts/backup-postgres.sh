#!/usr/bin/env bash
# Backup de PostgreSQL del CRM Emprendedores → servidor remoto (opcional).
#
# Variables requeridas:
#   DATABASE_URL          — conexión PostgreSQL
#
# Variables opcionales (copia remota):
#   BACKUP_REMOTE_HOST    — host SSH del servidor de backup
#   BACKUP_REMOTE_USER    — usuario SSH
#   BACKUP_REMOTE_PATH    — ruta destino en el servidor remoto
#   BACKUP_RETENTION_DAYS — días a conservar backups locales (default: 7)
#
# Uso:
#   ./scripts/backup-postgres.sh
#
# Restaurar:
#   gunzip -c emprendedores_YYYYMMDD_HHMM.sql.gz | psql "$DATABASE_URL"

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está definida." >&2
  exit 1
fi

RETENTION="${BACKUP_RETENTION_DAYS:-7}"
STAMP="$(date +%Y%m%d_%H%M)"
BACKUP_DIR="${BACKUP_LOCAL_DIR:-/tmp/emprendedores-backups}"
mkdir -p "$BACKUP_DIR"

FILE="$BACKUP_DIR/emprendedores_${STAMP}.sql.gz"

echo "Generando backup en $FILE ..."
pg_dump "$DATABASE_URL" | gzip > "$FILE"
echo "Backup local listo: $FILE ($(du -h "$FILE" | cut -f1))"

if [[ -n "${BACKUP_REMOTE_HOST:-}" && -n "${BACKUP_REMOTE_USER:-}" && -n "${BACKUP_REMOTE_PATH:-}" ]]; then
  echo "Copiando a ${BACKUP_REMOTE_USER}@${BACKUP_REMOTE_HOST}:${BACKUP_REMOTE_PATH} ..."
  scp "$FILE" "${BACKUP_REMOTE_USER}@${BACKUP_REMOTE_HOST}:${BACKUP_REMOTE_PATH}/"
  echo "Copia remota completada."
fi

find "$BACKUP_DIR" -name 'emprendedores_*.sql.gz' -mtime +"$RETENTION" -delete 2>/dev/null || true
echo "Limpieza local (> ${RETENTION} días) aplicada."
