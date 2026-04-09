<!--
  @file:        knowledge/infrastructure.md
  @project:     JCK AUTO
  @description: Server config, PM2 processes, deploy procedures, constraints
  @updated:     2026-04-09
  @version:     1.0
  @lines:       138
-->

# Infrastructure

## Server

- **IP:** 94.250.249.104
- **OS:** Ubuntu 24.04
- **Node:** v20.20.0
- **RAM:** 1.8 GB total / ~1.1 GB available (swap: 2.9 GB)
- **Working directory:** `/var/www/jckauto/app/jck-auto`
- **Storage:** `/var/www/jckauto/storage/` (catalog JSON, user data, news)
- **GitHub:** https://github.com/t9242540001/JCK-AUTO
- **Site URL:** https://jckauto.ru

## PM2 Processes

| Process | Purpose | Port |
|---------|---------|------|
| jckauto | Next.js site | 3000 |
| jckauto-bot | Telegram bot (polling) | — |

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
   - `git fetch origin && git reset --hard origin/main`
   - `npm install`
   - `NODE_OPTIONS="--max-old-space-size=1536" npm run build`
   - `pm2 restart jckauto`
   - `pm2 delete jckauto-bot` + `pm2 start` (bot requires delete+start, never restart)
   - `pm2 save`

**VDS is synced to `main`.** Claude Code always commits to `claude/**` branches — GitHub Actions auto-merges them into `main` and deploys automatically.

### Emergency manual deploy (fallback only)

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin && git reset --hard origin/main
npm install
NODE_OPTIONS="--max-old-space-size=1536" npm run build
pm2 restart jckauto
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
pm2 status
```

**IMPORTANT:** `pm2 restart` does NOT reload `.env.local` for the bot.
Always use `pm2 delete` + `pm2 start` for jckauto-bot.

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
| Bot uses polling, not webhook | No inbound port/nginx config needed for bot |
| Exchange rates cached 6 hours | Sravni.ru VTB scraper + CBR fallback with markup |
| VDS has only 1.8 GB RAM | `NODE_OPTIONS="--max-old-space-size=1536"` may cause incomplete Next.js builds — manifests missing for some routes. See Active Bug below. |
| PM2 jckauto runs as `bash -c npm start` (not node directly) | 29+ restarts observed after failed builds — process crashes on missing .next manifests |

## CI/CD

- **Auto-merge:** GitHub Actions workflow `.github/workflows/auto-merge.yml` merges `claude/**` branches into `main` on every push. No manual merge needed.
- **Auto-deploy:** GitHub Actions workflow `.github/workflows/deploy.yml` deploys to VDS after every successful auto-merge (via `workflow_run` trigger) or direct push to `main`. SSHs into VDS, pulls code, builds with `NODE_OPTIONS="--max-old-space-size=1536"`, restarts site (`pm2 restart jckauto`) and bot (`pm2 delete` + `pm2 start` — never `pm2 restart` for bot due to .env.local not reloading).

## Active Bugs

### Internal Server Error — missing client reference manifests (OPEN)

**Symptom:** All routes return 500 "Internal Server Error". PM2 logs show:
Error [InvariantError]: Invariant: The client reference manifest for route "/tools" does not exist.
Process jckauto restarts 29+ times with ~70s uptime cycles.

**Root cause (hypothesis):** Next.js 16.1.6 production build with
`NODE_OPTIONS="--max-old-space-size=1536"` on a 1.8 GB RAM VDS runs out of heap
during the client reference manifest generation phase. The build exits 0 (no error)
but produces an incomplete `.next` — route manifests exist on disk at
`.next/server/app/{route}/page_client-reference-manifest.js` but the runtime
cannot resolve them. The `.next/turbopack` marker file and `_xx._.js` chunk naming
suggest Next.js 16 uses Turbopack-style output even in production webpack mode,
which may have a different manifest resolution path than what `next start` expects.

**What was tried:**
- Added `rm -rf .next` before build in deploy.yml — did not fix (build still OOMs)
- Increased NODE_OPTIONS — not yet tried
- Manual build without NODE_OPTIONS on VDS — not yet tried

**Diagnostic commands:**
```bash
# Check if build completes cleanly without memory constraint
cd /var/www/jckauto/app/jck-auto && npm run build 2>&1 | tail -30

# Check RAM during build
watch -n2 free -h

# Verify manifests after build
ls .next/server/app/tools/
# Should contain: page_client-reference-manifest.js
```

**Next steps to try (in order):**
1. Run `npm run build` WITHOUT `NODE_OPTIONS` on VDS — check if build completes and site works
2. If that works: remove `NODE_OPTIONS` from deploy.yml entirely
3. If OOM without NODE_OPTIONS: add swap or upgrade RAM
4. If manifests still missing: investigate Next.js 16 Turbopack/webpack manifest resolution

