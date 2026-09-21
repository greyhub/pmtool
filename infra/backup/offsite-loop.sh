#!/bin/sh
# Copies the newest backups to a remote you configured with rclone (Google Drive, Backblaze B2, S3, another machine...).
# A backup that lives only on the server's own disk is lost with the server. Runs 30 minutes after the nightly dump and once at start-up.
#   RCLONE_REMOTE       e.g.  gdrive:pmtool-backups   (required)
#   OFFSITE_KEEP_DAYS   delete remote copies older than this (default 60)
set -u
: "${RCLONE_REMOTE:?set RCLONE_REMOTE, e.g. gdrive:pmtool-backups}"
KEEP="${OFFSITE_KEEP_DAYS:-60}"
HOUR="$(printf '%02d' "${BACKUP_HOUR_UTC:-20}")"
push() {
  # copy (never sync): deleting or rotating a local file must not delete the remote copy.
  if rclone copy /backups "$RCLONE_REMOTE" --include "pmtool-*.sql.gz" --immutable -v \
     && rclone delete "$RCLONE_REMOTE" --min-age "${KEEP}d" --include "pmtool-*.sql.gz" -v; then
    echo "offsite ok: $(date -u +%FT%TZ)"
  else
    echo "offsite FAILED: $(date -u +%FT%TZ)" >&2
  fi
}
sleep 60 # let the start-up backup finish first
push
while true; do
  if [ "$(date -u +%H)" = "$HOUR" ] && [ "$(date -u +%M)" -ge 30 ] && [ "$(date -u +%M)" -lt 35 ]; then
    push
    sleep 600
  else
    sleep 120
  fi
done
