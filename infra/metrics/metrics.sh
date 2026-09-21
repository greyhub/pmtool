#!/bin/sh
# Prints the product metrics report (read-only). Usage:
#   infra/metrics/metrics.sh                       # via the compose postgres service
#   DATABASE_URL=postgresql://... infra/metrics/metrics.sh   # any reachable database (needs psql)
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${DATABASE_URL:-}" ]; then
  exec psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$DIR/metrics.sql"
fi
COMPOSE="${COMPOSE_CMD:-docker compose -f $DIR/../docker-compose.prod.yml --env-file $DIR/../.env.prod}"
# shellcheck disable=SC2086
$COMPOSE exec -T postgres psql -U "${POSTGRES_USER:-pmtool}" -d "${POSTGRES_DB:-pmtool}" -X -v ON_ERROR_STOP=1 < "$DIR/metrics.sql"
