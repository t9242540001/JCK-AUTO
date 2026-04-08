# Инфраструктура
> Обновлено: 2026-04-08

## Сервер

- **IP:** 94.250.249.104
- **OS:** Ubuntu 24.04
- **Node:** v20.20.0
- **Рабочая директория:** `/var/www/jckauto/app/jck-auto`
- **Хранилище:** `/var/www/jckauto/storage/` (catalog/, news/, articles/, users.json)
- **GitHub:** https://github.com/t9242540001/JCK-AUTO
- **Сайт:** https://jckauto.ru

## PM2 процессы

| Процесс | Назначение | Порт |
|---------|------------|------|
| jckauto | Next.js сайт | 3000 |
| jckauto-bot | Telegram бот (polling) | 8443 |

## Деплой — Сайт

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/news-pipeline
npm run build && pm2 restart jckauto
```

## Деплой — Бот

**ВАЖНО:** `pm2 restart` НЕ перечитывает `.env.local`. Только delete + start:

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/news-pipeline
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

## Деплой — Полный (сайт + бот)

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin && git reset --hard origin/claude/news-pipeline
rm -rf .next && npm run build
pm2 delete jckauto && pm2 start "npm start" --name jckauto
pm2 delete jckauto-bot && pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 status
```

## Nginx

- Reverse proxy: 80/443 → localhost:3000
- SSL: Let's Encrypt (auto-renewal)
- Маршрутизация — через Next.js, кастомных rewrite нет

## Ключевые ограничения

| Ограничение | Последствие |
|------------|-------------|
| Anthropic API заблокирован с VDS (403) | Claude Vision/Text — только на GitHub Actions runner |
| Telegram API заблокирован на VDS | Бот через Worker URL: `https://tg-proxy.t9242540001.workers.dev` |
| DashScope работает с VDS | Singapore region, без ограничений |
| DeepSeek работает с VDS | Без geo-ограничений |
| `pm2 restart` не перечитывает `.env.local` | Бот: только `pm2 delete` + `pm2 start` |
| На VDS нет GitHub credentials | Git push только через Claude Code |
| Курсы валют кэшируются 6 часов | Sravni.ru VTB scraper + CBR fallback с markup |

## Env-переменные (имена, НЕ значения)

```
DEEPSEEK_API_KEY
DASHSCOPE_API_KEY
TELEGRAM_BOT_TOKEN
GOOGLE_DRIVE_FOLDER_ID
GOOGLE_SERVICE_ACCOUNT_KEY
ANTHROPIC_API_KEY          # только на GitHub Actions runner
EXCHANGE_MARKUP_USD=3.0
EXCHANGE_MARKUP_EUR=3.0
EXCHANGE_MARKUP_CNY=4.5
EXCHANGE_MARKUP_JPY=7.0
EXCHANGE_MARKUP_KRW=5.0
```
