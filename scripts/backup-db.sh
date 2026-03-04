#!/usr/bin/env bash
# =============================================================================
# TransformHub - PostgreSQL Database Backup Script
# =============================================================================
#
# Creates a timestamped, gzip-compressed pg_dump backup and rotates old backups
# to keep only the last 7 daily copies.
#
# Usage:
#   # Run directly (requires pg_dump on PATH and connection to the database):
#   ./scripts/backup-db.sh
#
#   # Run via Docker against the running postgres container:
#   docker compose exec postgres bash -c 'pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip' \
#     > backups/transformhub_$(date +%Y%m%d_%H%M%S).sql.gz
#
#   # Or invoke this script with docker exec:
#   docker compose exec -T postgres /scripts/backup-db.sh
#
#   # Cron example (daily at 2:00 AM):
#   0 2 * * * cd /opt/transformhub && ./scripts/backup-db.sh >> /var/log/transformhub-backup.log 2>&1
#
# Environment variables (all have sensible defaults):
#   POSTGRES_HOST     - database host         (default: localhost)
#   POSTGRES_PORT     - database port         (default: 5432)
#   POSTGRES_DB       - database name         (default: transformhub)
#   POSTGRES_USER     - database user         (default: transformhub)
#   PGPASSWORD        - database password     (reads from .env if not set)
#   BACKUP_DIR        - backup output dir     (default: ./backups)
#   BACKUP_RETENTION  - number of backups     (default: 7)
#
# ---------------------------------------------------------------------------
# RESTORE INSTRUCTIONS
# ---------------------------------------------------------------------------
#
# 1. Stop services that use the database:
#      docker compose stop nextjs-app agent-service agent-worker
#
# 2. Decompress the backup:
#      gunzip backups/transformhub_20260220_020000.sql.gz
#
# 3. Drop and recreate the database (CAUTION: this is destructive):
#      docker compose exec postgres psql -U transformhub -c "DROP DATABASE IF EXISTS transformhub;"
#      docker compose exec postgres psql -U transformhub -c "CREATE DATABASE transformhub;"
#
# 4. Restore from the backup:
#      docker compose exec -T postgres psql -U transformhub transformhub \
#        < backups/transformhub_20260220_020000.sql
#
#    Or, if the backup is still gzipped:
#      gunzip -c backups/transformhub_20260220_020000.sql.gz | \
#        docker compose exec -T postgres psql -U transformhub transformhub
#
# 5. Restart services:
#      docker compose up -d nextjs-app agent-service agent-worker
#
# 6. Verify the restore:
#      docker compose exec postgres psql -U transformhub -c "\dt"
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-transformhub}"
POSTGRES_USER="${POSTGRES_USER:-transformhub}"

# If PGPASSWORD is not set, try to load it from .env
if [ -z "${PGPASSWORD:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    if [ -f "$PROJECT_ROOT/.env" ]; then
        PGPASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$PROJECT_ROOT/.env" | cut -d '=' -f2- | tr -d '\r')"
        export PGPASSWORD
    fi
fi

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "======================================"
echo "TransformHub Database Backup"
echo "======================================"
echo "Timestamp:   ${TIMESTAMP}"
echo "Database:    ${POSTGRES_DB}"
echo "Host:        ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "User:        ${POSTGRES_USER}"
echo "Backup dir:  ${BACKUP_DIR}"
echo "Retention:   ${BACKUP_RETENTION} backups"
echo "--------------------------------------"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Perform the backup
echo "[$(date '+%H:%M:%S')] Starting pg_dump..."

pg_dump \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    2>&1 | gzip > "${BACKUP_FILE}"

BACKUP_SIZE="$(du -sh "${BACKUP_FILE}" | cut -f1)"
echo "[$(date '+%H:%M:%S')] Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ---------------------------------------------------------------------------
# Rotate old backups (keep the most recent $BACKUP_RETENTION files)
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Rotating old backups (keeping last ${BACKUP_RETENTION})..."

BACKUP_COUNT=0
DELETED_COUNT=0

# List backups sorted by modification time (newest first), skip the first N
while IFS= read -r old_backup; do
    BACKUP_COUNT=$((BACKUP_COUNT + 1))
    if [ "${BACKUP_COUNT}" -gt "${BACKUP_RETENTION}" ]; then
        echo "  Removing: $(basename "${old_backup}")"
        rm -f "${old_backup}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done < <(ls -t "${BACKUP_DIR}"/${POSTGRES_DB}_*.sql.gz 2>/dev/null)

echo "[$(date '+%H:%M:%S')] Rotation complete: ${DELETED_COUNT} old backup(s) removed"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
REMAINING="$(ls "${BACKUP_DIR}"/${POSTGRES_DB}_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
echo "======================================"
echo "Backup successful!"
echo "  File:       ${BACKUP_FILE}"
echo "  Size:       ${BACKUP_SIZE}"
echo "  Remaining:  ${REMAINING} backup(s)"
echo "======================================"
