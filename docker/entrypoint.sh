#!/bin/sh
# ==================================================
# CONTAINER ENTRYPOINT
# ==================================================
# Waits for the database, applies the schema and seeds the lab accounts,
# then hands over to the server. Set SKIP_BOOTSTRAP=1 to start the server
# without any of that (useful when the database is managed elsewhere).
# ==================================================

set -e

if [ "${SKIP_BOOTSTRAP:-0}" != "1" ]; then
  node /app/docker/bootstrap.mjs
else
  echo "[entrypoint] SKIP_BOOTSTRAP=1, starting without schema or seeding"
fi

exec "$@"
