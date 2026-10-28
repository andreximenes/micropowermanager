#!/usr/bin/env bash
# Pull the checked-out branch and rebuild Spark CRM on the spark-paygops VPS.
# Safe to re-run: containers are recreated, the data volumes are kept.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
# The ict user operates Docker through sudo, like the PaygOps stack on this host.
DOCKER=(docker)
docker info >/dev/null 2>&1 || DOCKER=(sudo -n docker)
COMPOSE=("${DOCKER[@]}" compose -f "$REPO_DIR/deploy/spark/docker-compose.yml")
cd "$REPO_DIR"

# The local-development override disables the Spark SHS SSRF guard; it must never reach this host.
if [ -e .env.override.micropowermanager-backend ]; then
  echo "Refusing to deploy: .env.override.micropowermanager-backend exists in $REPO_DIR" >&2
  exit 1
fi

for file in backend frontend mysql; do
  if [ ! -s "deploy/spark/env/$file.env" ]; then
    echo "Missing deploy/spark/env/$file.env (see deploy/spark/README.md)" >&2
    exit 1
  fi
done

if [ "${1:-}" != "--no-pull" ]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  git fetch --quiet origin "$branch"
  git merge --ff-only "origin/$branch"
fi
echo "Deploying $(git log -1 --format='%h %s')"

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d --remove-orphans

echo "Waiting for the backend to report healthy..."
backend="$("${COMPOSE[@]}" ps -q backend)"
for _ in $(seq 1 60); do
  status="$("${DOCKER[@]}" inspect --format '{{.State.Health.Status}}' "$backend")"
  if [ "$status" = "healthy" ]; then
    "${COMPOSE[@]}" ps
    echo "Spark CRM is up: https://crm.sparkenergy.io"
    exit 0
  fi
  sleep 5
done

echo "Backend did not become healthy in 5 minutes; last logs:" >&2
"${COMPOSE[@]}" logs --tail 50 backend >&2
exit 1
