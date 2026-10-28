#!/usr/bin/env bash
# Daily dump of every Spark CRM database (one central DB plus one per company),
# kept for 7 days. Restore: see deploy/spark/README.md.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/spark-crm-backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$BACKUP_DIR"
DOCKER=(docker)
docker info >/dev/null 2>&1 || DOCKER=(sudo -n docker)

target="$BACKUP_DIR/spark-crm-$(date +%Y%m%d-%H%M%S).sql.gz"
"${DOCKER[@]}" compose -f "$REPO_DIR/deploy/spark/docker-compose.yml" exec -T mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases --single-transaction --routines --events' \
  | gzip > "$target.partial"
mv "$target.partial" "$target"

find "$BACKUP_DIR" -name 'spark-crm-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $target ($(du -h "$target" | cut -f1))"
