<!--
  @file:        knowledge/infrastructure.md
  @project:     JCK AUTO
  @description: Server config, PM2 processes, deploy procedures, constraints
  @updated:     2026-04-10
  @version:     1.4
  @lines:       119
-->

# Infrastructure

## Server

- **IP:** 94.250.249.104
- **OS:** Ubuntu 24.04
- **Node:** v20.20.0
- **RAM:** 1.8 GB total / ~1.1 GB available (swap: 2.9 GB)
- **Working directory:** `/var/www/jckauto/app/jck-auto`
- **Storage:** `/var/www/jckauto/storage/` (catalog JSON, user data, news)
  - `users.json` — bot users + web auth records (id, firstName, registeredAt, source, webAuthAt)
  - `bot-stats.json` — command/source counters (atomic write via .tmp rename)
  - `catalog/` — car photos synced from Google Drive
  - `noscut/` — noscut catalog JSON + images
- **GitHub:** https://github.com/t9242540001/JCK-AUTO
- **Site URL:** https://jckauto.ru

## PM2 Processes

| Process | Purpose | Port |
|---------|---------|------|
| jckauto | Next.js site | 3000 |
| jckauto-bot | Telegram bot (webhook, port 8443) | 8443 |

## Cron Jobs

| Script | Schedule | Log |
|--------|----------|-----|
| generate-news.ts | daily 07:00 MSK (cron: `0 4 * * *`) | /var/log/jckauto-news.log |
| generate-article.ts | every 3 days 09:00 MSK (cron: `0 6 */3 * *`) | /var/log/jckauto-articles.log |
| update-noscut-prices.ts | Sunday 10:00 MSK (cron: `0 7 * * 0`) | /var/log/jckauto-noscut-prices.log |

```bash
# Noscut price update cron (add to VDS crontab):
0 7 * * 0 cd /var/www/jckauto/app/jck-auto && npx tsx -r dotenv/config scripts/update-noscut-prices.ts dotenv_config_path=.env.local >> /var/log/jckauto-noscut-prices.log 2>&1
```

## Deploy

### Automatic (normal workflow)
Push to any `claude/**` branch — GitHub Actions handles everything:
1. `auto-merge.yml` merges the branch into `main`
2. `deploy.yml` SSHs into VDS and runs:
   - `set -e` (bash errexit, NOT appleboy script_stop)
   - `git fetch origin && git reset --hard origin/main`
   - `npm ci` via `if npm ci; then ... else ... fi` wrapper (npm 10.8.2 reify exit code bug protection)
   - Verifies `node_modules/{next,react,sharp,@next/swc-linux-x64-gnu}` exist
   - Self-healing: if `.next` is a directory (not symlink), restores two-slot setup
   - Two-slot build: `NEXT_DIST_DIR="$NEXT_SLOT" npm run build` into inactive slot
   - Atomic symlink swap: `ln -sfn "$NEXT_SLOT" .next`
   - `pm2 restart jckauto`
   - `pm2 delete jckauto-bot` + `pm2 start` (bot requires delete+start, never restart)
   - `pm2 save`
   - `[wrapper] step 1-6` and `[build] step 1-8` echo markers for observability

**VDS is synced to `main`.** Claude Code always commits to `claude/**` branches — GitHub Actions auto-merges them into `main` and deploys automatically.

### Emergency manual deploy (fallback only)

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin && git reset --hard origin/main
rm -rf node_modules && npm install --no-audit --no-fund
CURRENT_SLOT=$(readlink .next 2>/dev/null || echo "none")
if [ "$CURRENT_SLOT" = ".next-a" ]; then NEXT_SLOT=".next-b"; else NEXT_SLOT=".next-a"; fi
rm -rf "$NEXT_SLOT"
NEXT_DIST_DIR="$NEXT_SLOT" npm run build
ln -sfn "$NEXT_SLOT" .next
pm2 restart jckauto
pm2 delete jckauto-bot || true
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save && pm2 status
```

**IMPORTANT:** `pm2 restart` does NOT reload `.env.local` for the bot.
Always use `pm2 delete` + `pm2 start` for jckauto-bot.
**NEVER** run `npm run build` without `NEXT_DIST_DIR` — it destroys the `.next` symlink.

## Nginx

- Reverse proxy: port 80/443 → localhost:3000
- SSL: Let's Encrypt auto-renewal
- No custom rewrite rules — Next.js handles routing

## Known Constraints

| Constraint | Impact |
|-----------|--------|
| Anthropic API blocked from Russian IP (403) | All Claude API calls run on GitHub Actions runner only |
| DashScope API works from VDS | Singapore region, no IP restrictions |
| `pm2 restart` doesn't reload `.env.local` | Must `pm2 delete` + `pm2 start` for bot |
| Bot uses webhook mode (port 8443 via TELEGRAM_API_BASE_URL Worker proxy) | Webhook traffic proxied through Cloudflare Worker tg-proxy — never direct to api.telegram.org |
| Exchange rates cached 6 hours | Sravni.ru VTB scraper + CBR fallback with markup |
| VDS has only 1.8 GB RAM | Build uses uncapped V8 heap with swap fallback (2.9 GB swap available). Never add `--max-old-space-size=*` below measured build peak — it silently truncates Turbopack manifest writes on the final phase. |
| PM2 jckauto runs as `bash -c npm start` (not node directly) | 29+ restarts observed after failed builds — process crashes on missing .next manifests |

## CI/CD

- **Auto-merge:** `.github/workflows/auto-merge.yml` merges `claude/**` branches into `main` on every push.
- **Auto-deploy:** `.github/workflows/deploy.yml` deploys to VDS after auto-merge (`workflow_run` trigger) or direct push to `main`. Uses `set -e`, npm ci wrapper, two-slot build, symlink swap, self-healing. `[wrapper]` and `[build]` step markers provide observability.
- **Catalog sync:** `.github/workflows/sync-catalog.yml` runs daily at 03:00 UTC. Syncs Google Drive → VDS photos, processes AI-pending cars on runner (Anthropic API), uploads catalog.json back. Does NOT build or restart PM2 — catalog pages are force-dynamic.

## Active Bugs

### Internal Server Error — missing client reference manifests (RESOLVED 2026-04-09)

**Symptom:** All routes returned HTTP 500 with `InvariantError: The client reference manifest for route X does not exist`. PM2 process `jckauto` looped with ~70s uptime cycles.

**Root cause:** `deploy.yml` ran `next build` with `NODE_OPTIONS="--max-old-space-size=1536"` on a 1.8 GB RAM VDS. Next.js 16 Turbopack writes `page_client-reference-manifest.js` files in the FINAL phase of the build. The 1536 MB heap cap caused V8 to OOM mid-phase. `npm run build` exited with code 0 but `.next/server/app/<route>/page_client-reference-manifest.js` was missing for most routes. `next start` crashed on first request.

**Fix (2026-04-09):** Removed `NODE_OPTIONS` from `.github/workflows/deploy.yml` — V8 now uses uncapped heap with swap fallback. Also removed `rm -rf .next` (was a workaround for the broken-state symptom) and bumped `command_timeout: 15m → 20m` to accommodate slower swap-using builds. Commit: `fix(deploy): remove heap cap causing Turbopack manifest OOM truncation`. Verified: 21 route manifests present, all production URLs return 200.

**Prevention rule:** Do NOT re-introduce any `--max-old-space-size=*` cap to the production build without first measuring the actual build peak via `/usr/bin/time -v npx next build` and setting the cap at least 30% above that peak. A slow build is always preferable to a truncated one.

