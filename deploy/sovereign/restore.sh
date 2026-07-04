#!/bin/sh
# Restore a sovereign instance from a backup.sh artifact — used both for
# disaster recovery and to seed the travel/cloud replica.
#
#   ./restore.sh <db-backup.sql.gz.enc>
#
# DESTRUCTIVE for the target instance: wipes its DB volume, then restores.
# Run on a FRESH or intentionally-replaced deployment only.
# Requires BACKUP_PASSPHRASE in .env (same one that encrypted the artifact).
set -eu
cd "$(dirname "$0")"

DB_BK="${1:?usage: restore.sh <db.sql.gz.enc>}"
# .env is a docker-compose env file, not a shell script — unquoted values
# may contain spaces (e.g. NEXT_PUBLIC_BRAND_NAME=DPO Central), so it must
# never be sourced. Extract only the keys this script needs.
env_get() { { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -1; } || true; }
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-$(env_get BACKUP_PASSPHRASE)}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-$(env_get BACKUP_RCLONE_REMOTE)}"
export BACKUP_PASSPHRASE
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE in deploy/sovereign/.env}"

printf 'This WIPES the current instance and restores from backup. Type RESTORE to continue: '
read -r answer
[ "$answer" = "RESTORE" ] || { echo "aborted"; exit 1; }

echo "[restore] stopping stack, dropping volumes…"
docker compose down -v

echo "[restore] starting db only…"
docker compose up -d db
until docker compose exec -T db pg_isready -U dpocentral >/dev/null 2>&1; do sleep 2; done

echo "[restore] loading database…"
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$DB_BK" \
  | gunzip \
  | docker compose exec -T db psql -U dpocentral -d dpocentral -f - >/dev/null

echo "[restore] starting the full stack…"
# The migrator sees existing users in the restored DB and skips the seed.
docker compose up -d
echo "[restore] done. Verify: sign in, open the privacy dashboard."
