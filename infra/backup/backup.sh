#!/bin/sh
# One compressed logical backup of the PMTool database, then delete backups older than BACKUP_KEEP_DAYS.
# Reads the standard PG* environment variables. Output: /backups/pmtool-YYYYmmdd-HHMMSS.sql.gz
set -eu
DIR="${BACKUP_DIR_IN_CONTAINER:-/backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP="$DIR/.pmtool-$STAMP.sql.gz.partial"
OUT="$DIR/pmtool-$STAMP.sql.gz"

mkdir -p "$DIR"
# --clean/--if-exists make the dump restorable over an existing database.
pg_dump --no-owner --clean --if-exists | gzip -9 > "$TMP"
# A dump that failed half-way must never look like a valid backup.
gzip -t "$TMP"
mv "$TMP" "$OUT"
find "$DIR" -name 'pmtool-*.sql.gz' -mtime "+$KEEP" -delete
echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
