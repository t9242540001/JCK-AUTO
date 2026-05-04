#!/usr/bin/env bash
#
# @file        scripts/install-crontab.sh
# @description Install root crontab from committed scripts/crontab.root file.
#              Idempotent — safe to run repeatedly; same input produces same
#              crontab state.
# @runs        VDS (manual ops, root)
# @rule        Crontab is committed at scripts/crontab.root. NEVER edit via
#              `crontab -e` on VDS — changes get lost on next install run.
#              All edits go through git → Claude Code → this script.
# @rule        Always creates a timestamped backup at /root/crontab-backup-*.txt
#              before replacement. Recovery: `crontab /root/crontab-backup-<ts>.txt`.
# @lastModified 2026-05-04

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRONTAB_FILE="$SCRIPT_DIR/crontab.root"
BACKUP_DIR="/root"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crontab-backup-$TIMESTAMP.txt"

if [ ! -f "$CRONTAB_FILE" ]; then
  echo "[install-crontab] FATAL: $CRONTAB_FILE not found" >&2
  exit 1
fi

# Backup current crontab (empty if no crontab exists yet — that's fine).
if crontab -l 2>/dev/null > "$BACKUP_FILE"; then
  echo "[install-crontab] backed up current crontab to $BACKUP_FILE"
else
  # crontab -l returns 1 if no crontab exists; that is not an error here.
  echo "[install-crontab] no existing crontab to back up (or empty)"
  : > "$BACKUP_FILE"
fi

# Install. crontab(1) validates syntax and rejects on parse error.
if crontab "$CRONTAB_FILE"; then
  echo "[install-crontab] installed $CRONTAB_FILE"
else
  echo "[install-crontab] FATAL: crontab rejected $CRONTAB_FILE — current crontab unchanged" >&2
  echo "[install-crontab] backup is at $BACKUP_FILE" >&2
  exit 2
fi

# Verify result.
echo ""
echo "[install-crontab] active crontab now:"
echo "─────────────────────────────────────"
crontab -l
echo "─────────────────────────────────────"
echo "[install-crontab] done. Backup: $BACKUP_FILE"
