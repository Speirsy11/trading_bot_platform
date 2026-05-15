#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/trading-bot-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$OUT"
find "$BACKUP_DIR" -type f -name 'trading-bot-*.dump' -mtime +"$RETENTION_DAYS" -delete

echo "Wrote $OUT"
