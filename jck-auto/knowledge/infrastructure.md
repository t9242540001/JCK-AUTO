<!--
  @file:        knowledge/infrastructure.md
  @project:     JCK AUTO
  @description: Server config, PM2 processes, deploy procedures, constraints
  @updated:     2026-04-08
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

## Deploy — Site

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/review-project-structure-RtYyX
npm run build && pm2 restart jckauto
```

## Deploy — Bot

**IMPORTANT:** `pm2 restart` does NOT reload `.env.local`. Must use delete + start:

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/review-project-structure-RtYyX
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

## Deploy — Full (site + bot)

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin && git reset --hard origin/claude/review-project-structure-RtYyX
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
