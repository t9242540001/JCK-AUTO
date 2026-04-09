<!--
  @file:        knowledge/infrastructure.md
  @project:     JCK AUTO
  @description: Server config, PM2 processes, deploy procedures, constraints
  @updated:     2026-04-09
  @version:     1.0
  @lines:       80
-->

# Infrastructure

## Server

- **IP:** 94.250.249.104
- **OS:** Ubuntu 24.04
- **Node:** v20.20.0
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

## Deploy — Site

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/init-nextjs-project-iK26t
npm run build && pm2 restart jckauto
```

## Deploy — Bot

**IMPORTANT:** `pm2 restart` does NOT reload `.env.local`. Must use delete + start:

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/init-nextjs-project-iK26t
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

## Deploy — Full (site + bot)

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin && git reset --hard origin/claude/init-nextjs-project-iK26t
rm -rf .next && npm run build
pm2 delete jckauto && pm2 start "npm start" --name jckauto
pm2 delete jckauto-bot && pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 status
```

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

## CI/CD

- **Auto-merge:** GitHub Actions workflow `.github/workflows/auto-merge.yml` merges `claude/**` branches into `main` on every push. No manual merge needed.
- **Auto-deploy:** GitHub Actions workflow `.github/workflows/deploy.yml` deploys to VDS after every successful auto-merge (via `workflow_run` trigger) or direct push to `main`. SSHs into VDS, pulls code, builds with `NODE_OPTIONS="--max-old-space-size=1536"`, restarts site (`pm2 restart jckauto`) and bot (`pm2 delete` + `pm2 start` — never `pm2 restart` for bot due to .env.local not reloading).
