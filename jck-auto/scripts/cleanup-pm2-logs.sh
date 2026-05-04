#!/usr/bin/env bash
#
# @file        scripts/cleanup-pm2-logs.sh
# @description Delete PM2 log files older than 90 days from /var/log/pm2/.
#              Idempotent — safe to run repeatedly. Designed for quarterly
#              cron schedule (~4 runs/year).
# @runs        VDS (cron, root)
# @rule        Keep all log files inside /var/log/pm2/ — do not delete
#              the directory itself (PM2 needs it to keep writing).
# @rule        Hardcoded path /var/log/pm2 — do not parameterize. The
#              location is committed in ecosystem.config.js, this script
#              and that file move together.
# @lastModified 2026-05-04

set -euo pipefail

LOG_DIR="/var/log/pm2"
RETENTION_DAYS=90

if [ ! -d "$LOG_DIR" ]; then
  echo "[cleanup-pm2-logs] $LOG_DIR does not exist — nothing to clean" >&2
  exit 0
fi

# Use -mtime +N: files modified more than N days ago. Glob *.log only,
# not the directory itself. Print deleted file count for cron-mail audit.
DELETED=$(find "$LOG_DIR" -maxdepth 1 -type f -name '*.log' -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[cleanup-pm2-logs] deleted ${DELETED} files older than ${RETENTION_DAYS}d from ${LOG_DIR}"
