#!/usr/bin/env bash
# Runs every migration and the database tests against a throwaway local Postgres.
# Needs Postgres 15+ binaries (initdb, pg_ctl). In CI these come from the runner image.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { ${AS:-} pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
if [ "$(id -u)" = 0 ]; then chown postgres "$DATA"; AS="runuser -u postgres --"; else AS=""; fi
$AS initdb -D "$DATA" -U postgres -A trust >/dev/null
$AS pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -w start >/dev/null
export PGHOST="$DATA" PGPORT="$PORT" PGUSER=postgres
createdb doorstep_test
PSQL="psql -X -q -v ON_ERROR_STOP=1 -d doorstep_test"
$PSQL -f "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate $(basename "$f")"
  $PSQL -f "$f"
done
echo "test    supabase/seed.sql"; $PSQL -f "$ROOT/supabase/seed.sql"
for f in "$ROOT"/tests/db/[1-9]*.sql; do
  echo "test    $(basename "$f")"
  $PSQL -f "$f"
done
if [ -f "$ROOT/tests/db/concurrency.mjs" ]; then
  echo "test    concurrency.mjs"
  DATABASE_URL="postgresql://postgres@localhost/doorstep_test?host=$DATA&port=$PORT" node "$ROOT/tests/db/concurrency.mjs"
fi
# The staging sample events must load cleanly against the current schema, and show every flag banner.
echo "test    supabase/sample-events.sql"
$PSQL -f "$ROOT/supabase/sample-events.sql" >/dev/null
[ "$($PSQL -At -c "select string_agg(distinct flag, ',' order by flag) from event_listings where slug like 'sample-%'")" = "last_few,new,selling_fast" ] \
  || { echo "sample events do not show all three flags"; exit 1; }
echo "database tests passed"
