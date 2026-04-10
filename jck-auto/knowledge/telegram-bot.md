# Telegram бот — @jckauto_help_bot
> Обновлено: 2026-04-10

## Команды

| Команда | Файл | Функция |
|---------|------|---------|
| `/start` | src/bot/handlers/start.ts | Приветствие + inline-клавиатура |
| `/calc` | src/bot/handlers/calculator.ts | Калькулятор (Китай/Корея/Япония, 4 возраста) |
| `/catalog` | src/bot/handlers/catalog.ts | 5 авто с фото |
| `/contact` | src/bot/handlers/contact.ts | Контакты компании |
| Заявка | src/bot/handlers/request.ts | Сбор данных → пересылка в группу менеджеров |
| `/stats` | src/bot/handlers/admin.ts | Статистика (только ADMIN_IDS) |
| `/broadcast` | src/bot/handlers/admin.ts | Массовая рассылка (только ADMIN_IDS) |

## Конфигурация

- **ADMIN_IDS:** `[1664298688, 355285735]` — в `src/bot/config.ts`
- **Группа заявок:** chat_id `-1003706902240`
- **Хранилище пользователей:** `/var/www/jckauto/storage/users.json`
- **Entry point:** `scripts/start-bot.ts` → `src/bot/index.ts`
- **Telegram API:** через Worker URL `https://tg-proxy.t9242540001.workers.dev`

## Калькулятор в боте

- Вызывает `fetchCBRRates()` напрямую (server-side, без CORS)
- Вызывает `calculateTotal()` из calculator.ts
- Лейбл: «Ориентировочный курс: 1 CNY ≈ 11.89 ₽» (НЕ «Курс ЦБ РФ»)
- Дисклеймер: «Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки»
- Кнопка «На сайт» → https://jckauto.ru/tools/calculator

## Ограничения

- Режим **webhook** (порт 8443, nginx проксирует `/bot-webhook/` → `127.0.0.1:8443`)
- `pm2 restart` НЕ перечитывает `.env.local` — только `pm2 delete` + `pm2 start`
- Токен бота засветился в чатах — **нужна перегенерация** (security issue)
- `api.telegram.org` заблокирован у провайдера VDS — исходящие вызовы идут через Cloudflare Worker

## Запуск / перезапуск

```bash
cd /var/www/jckauto/app/jck-auto
pm2 delete jckauto-bot || true
pm2 start "node_modules/.bin/tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

**ВАЖНО:** использовать `node_modules/.bin/tsx`, а НЕ `npx tsx`.
`npx tsx` падает на глобальный tsx, который не находит локальный `dotenv` →
`Error: Cannot find module 'dotenv/config'`. `tsx` должен быть в `devDependencies` и
устанавливаться через `npm ci`.

---

## Webhook — архитектура и обслуживание

### Входящий трафик (Telegram → бот)

```
Telegram
  → https://jckauto.ru/bot-webhook/bot{TOKEN}
  → nginx  (location /bot-webhook/ → proxy_pass http://127.0.0.1:8443/)
  → jckauto-bot (порт 8443)
```

### Исходящий трафик (бот → Telegram API)

```
jckauto-bot
  → https://tg-proxy.t9242540001.workers.dev
  → api.telegram.org
```

Cloudflare Worker проксирует исходящие запросы, обходя блокировку `api.telegram.org` провайдером VDS.

### КРИТИЧЕСКОЕ ПРАВИЛО — токен в URL webhook

`node-telegram-bot-api` валидирует входящие запросы, проверяя что `req.url` содержит токен бота:

```
✅ Правильно: https://jckauto.ru/bot-webhook/bot{TOKEN}
❌ Неправильно: https://jckauto.ru/bot-webhook/
```

Если токен отсутствует в URL → библиотека возвращает 401 Unauthorized → обновления игнорируются.
Бот может писать `[bot] message: /start` в логи (глобальный listener сработал),
но `onText` коллбэки не вызываются и `sendMessage` не выполняется.

### Регистрация webhook (ручная операция)

Регистрация НЕ автоматическая — выполнять вручную при смене токена или домена:

```bash
TOKEN=<значение из .env.local>
curl "https://tg-proxy.t9242540001.workers.dev/bot${TOKEN}/setWebhook?url=https://jckauto.ru/bot-webhook/bot${TOKEN}"
```

### Проверка статуса webhook

```bash
TOKEN=<значение из .env.local>
curl "https://tg-proxy.t9242540001.workers.dev/bot${TOKEN}/getWebhookInfo" | jq .
```

Ожидаемый ответ:
- `"url"` содержит токен
- `"pending_update_count"` = 0
- `"last_error_message"` отсутствует или пустой

### Переменные окружения (`.env.local`)

| Переменная | Обязательная | Значение |
|-----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | да | токен бота |
| `TELEGRAM_GROUP_CHAT_ID` | да | `-1003706902240` |
| `WEBHOOK_PORT` | нет | `8443` (по умолчанию) |
| `TELEGRAM_API_BASE_URL` | да | `https://tg-proxy.t9242540001.workers.dev` |

### Конфигурация nginx (справочно)

```nginx
location /bot-webhook/ {
    proxy_pass http://127.0.0.1:8443/;
}
```

### Поведение deploy.yml

- При каждом деплое: `pm2 delete jckauto-bot` + `pm2 start`
- `setWebhook` **не вызывается** — регистрация webhook ручная
- После смены токена: выполнить команду `setWebhook` вручную (см. выше)
