#!/usr/bin/env bash
# @file noscut-watchdog.sh
# @description Watchdog for generate-noscut.ts — detects hangs and auto-restarts.
#              Monitors log file byte count. If no progress in MAX_IDLE_SEC,
#              kills the process and restarts. Exits when [done] appears in log.
# @run nohup bash scripts/noscut-watchdog.sh --delay=5 >> /var/log/jckauto-noscut-watchdog.log 2>&1 &

set -euo pipefail

LOGFILE="/var/log/jckauto-noscut-generate.log"
WORKDIR="/var/www/jckauto/app/jck-auto"
MAX_IDLE_SEC=300
CHECK_INTERVAL=30
RESTART_DELAY=10
EXTRA_ARGS="${*}"

log() { echo "[watchdog $(date '+%H:%M:%S')] $*" | tee -a "$LOGFILE"; }

cd "$WORKDIR"

if grep -q "\[done\]" "$LOGFILE" 2>/dev/null; then
  log "Already complete. Delete log to re-run."
  exit 0
fi

log "Starting watchdog. MAX_IDLE=${MAX_IDLE_SEC}s, CHECK=${CHECK_INTERVAL}s"

while true; do
  npx tsx -r dotenv/config scripts/generate-noscut.ts \
    dotenv_config_path=.env.local $EXTRA_ARGS >> "$LOGFILE" 2>&1 &
  GEN_PID=$!
  log "Started PID $GEN_PID"

  IDLE_SEC=0
  LAST_SIZE=$(wc -c < "$LOGFILE" 2>/dev/null || echo 0)

  while kill -0 "$GEN_PID" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    CURRENT_SIZE=$(wc -c < "$LOGFILE" 2>/dev/null || echo 0)
    if [ "$CURRENT_SIZE" -gt "$LAST_SIZE" ]; then
      IDLE_SEC=0
      LAST_SIZE="$CURRENT_SIZE"
    else
      IDLE_SEC=$((IDLE_SEC + CHECK_INTERVAL))
      log "No progress for ${IDLE_SEC}s (max: ${MAX_IDLE_SEC}s)"
      if [ "$IDLE_SEC" -ge "$MAX_IDLE_SEC" ]; then
        log "HANG DETECTED — killing PID $GEN_PID"
        kill -9 "$GEN_PID" 2>/dev/null || true
        break
      fi
    fi
  done

  wait "$GEN_PID" 2>/dev/null || true

  if grep -q "\[done\]" "$LOGFILE" 2>/dev/null; then
    log "Generation complete!"
    exit 0
  fi

  log "Process ended without [done]. Restarting in ${RESTART_DELAY}s..."
  sleep "$RESTART_DELAY"
done
