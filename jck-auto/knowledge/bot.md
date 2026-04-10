<!--
  @file:        knowledge/bot.md
  @project:     JCK AUTO
  @description: Telegram bot commands, admin config, user storage, constraints
  @updated:     2026-04-10
  @version:     1.1
  @lines:       60
-->

# Telegram Bot — @jckauto_help_bot

## Commands

| Command | File | Function |
|---------|------|----------|
| `/start` | `src/bot/handlers/start.ts` | Welcome message + inline keyboard |
| `/calc` | `src/bot/handlers/calculator.ts` | Calculator (China/Korea/Japan, 4 age brackets) |
| `/customs` | `src/bot/handlers/customs.ts` | Customs-only costs (no delivery). 10s cooldown via botRateLimiter |
| `/catalog` | `src/bot/handlers/catalog.ts` | Show 5 cars with photos |
| `/contact` | `src/bot/handlers/contact.ts` | Company contacts |
| Request flow | `src/bot/handlers/request.ts` | Collect info → forward to managers group |
| `/stats` | `src/bot/handlers/admin.ts` | Statistics (ADMIN_IDS only) |
| `/broadcast` | `src/bot/handlers/admin.ts` | Mass message (ADMIN_IDS only) |

## Configuration

- **ADMIN_IDS:** `[1664298688, 355285735]` — in `src/bot/config.ts`
- **Managers group:** chat_id `-1003706902240`
- **User storage:** `/var/www/jckauto/storage/users.json`
- **Entry point:** `scripts/start-bot.ts` → `src/bot/index.ts`

## Key Constraints

- Bot uses **polling** mode (not webhook) — no inbound port needed
- `pm2 restart` does NOT reload `.env.local` — must use `pm2 delete` + `pm2 start`
- Bot token has been exposed in chats — needs regeneration (security issue)
- Bot runs as PM2 process `jckauto-bot` via tsx runtime

## Rate Labels

Bot output uses "Ориентировочный курс" (not "Курс ЦБ РФ") to match site wording.
Disclaimer: "Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки"

## Env Variables

- `TELEGRAM_BOT_TOKEN` — bot token (in .env.local)
- Bot reads rates via `fetchCBRRates()` directly (server-side, no CORS issue)

## Start/Restart

```bash
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```
