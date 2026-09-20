#!/bin/sh
# Runs backup.sh once a day at BACKUP_HOUR_UTC (default 20:00 UTC = 03:00 Vietnam time), and once at start-up.
set -u
HOUR="$(printf '%02d' "${BACKUP_HOUR_UTC:-20}")"
sh /usr/local/bin/backup.sh || echo "backup FAILED at start-up" >&2
while true; do
  NOW_H="$(date -u +%H)"
  NOW_M="$(date -u +%M)"
  # Run in the first minutes of the chosen hour; check twice a minute-ish, and never twice in one window.
  if [ "$NOW_H" = "$HOUR" ] && [ "$NOW_M" -lt 5 ]; then
    sh /usr/local/bin/backup.sh || echo "backup FAILED" >&2
    sleep 600
  else
    sleep 120
  fi
done
