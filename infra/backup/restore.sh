#!/bin/sh
# Restore a backup into a database. DESTRUCTIVE for the target database: it drops and recreates its tables.
#   ./infra/backup/restore.sh <backup.sql.gz> <target-database-url>
# Practise this against a SCRATCH database, never the live one, before you need it:
#   createdb -h localhost -U pmtool pmtool_restore_test
#   ./infra/backup/restore.sh infra/backup/data/pmtool-2026....sql.gz postgresql://pmtool:PASS@localhost:5432/pmtool_restore_test
set -eu
FILE="${1:?usage: restore.sh <backup.sql.gz> <target-database-url>}"
TARGET="${2:?usage: restore.sh <backup.sql.gz> <target-database-url>}"
gzip -t "$FILE"
echo "Restoring $FILE into ${TARGET%%\?*} — this replaces its contents."
printf 'Type the word RESTORE to continue: '
read -r ANSWER
[ "$ANSWER" = "RESTORE" ] || { echo "aborted"; exit 1; }
gunzip -c "$FILE" | psql "$TARGET" -v ON_ERROR_STOP=1
echo "restore finished"
