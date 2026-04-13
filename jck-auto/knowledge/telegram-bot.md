<!--
  @file:        knowledge/telegram-bot.md
  @project:     JCK AUTO
  @description: Telegram bot webhook architecture, Worker proxy, startup, diagnostics
  @updated:     2026-04-10
  @version:     1.1
-->

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
- Входящие соединения от Telegram IP-диапазонов также блокируются провайдером VDS —
  входящий webhook идёт через Cloudflare Worker (см. ниже)

## Запуск / перезапуск

### Правильная команда запуска PM2

```bash
cd /var/www/jckauto/app/jck-auto
pm2 delete jckauto-bot || true
pm2 start "node_modules/.bin/tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

### Почему `node_modules/.bin/tsx`, а не `npx tsx`

- `tsx` должен быть в `devDependencies` (добавлен 2026-04-10, версия `^4.21.0`).
- `npx tsx` проваливается в глобальный `tsx`, который не резолвит `dotenv` из локального `node_modules`.
- Ошибка при использовании глобального `tsx`: `Cannot find module 'dotenv/config'`.
- После `npm ci` в `deploy.yml` путь `node_modules/.bin/tsx` всегда доступен.

### Поведение deploy.yml

- При каждом деплое: `pm2 delete jckauto-bot` + `pm2 start` (см. команду выше).
- `deploy.yml` **НЕ регистрирует webhook** — это ручная разовая операция.
- Webhook нужно перерегистрировать вручную после:
  - смены токена бота
  - смены домена
  - смены URL Worker (`TELEGRAM_API_BASE_URL`)

---

## Webhook — архитектура и обслуживание

### Полная цепочка входящего трафика (Telegram → бот)

```
Telegram
  → https://tg-proxy.t9242540001.workers.dev/webhook/bot{TOKEN}
  → Cloudflare Worker (tg-proxy) пересылает POST на:
  → https://jckauto.ru/bot-webhook/bot{TOKEN}
  → nginx  (location /bot-webhook/ → proxy_pass http://127.0.0.1:8443/)
  → jckauto-bot (порт 8443)
```

### Зачем нужен Worker для входящего трафика

- Провайдер VDS блокирует входящие соединения от IP-диапазонов Telegram.
- **Без Worker:** `Telegram → jckauto.ru` — интермиттирующие таймауты, задержки 2–5 минут.
- **С Worker:** `Telegram → Cloudflare (всегда доступен) → VDS (внутренний forward)`.

### Исходящий трафик (бот → Telegram API)

```
jckauto-bot
  → https://tg-proxy.t9242540001.workers.dev/bot{TOKEN}/method
  → Cloudflare Worker пересылает на api.telegram.org
```

Провайдер VDS блокирует также и прямые исходящие соединения на `api.telegram.org`,
поэтому все исходящие вызовы Telegram Bot API идут через Worker.

### Логика маршрутизации Worker (код tg-proxy)

| Путь входящего запроса | Куда пересылает |
|------------------------|-----------------|
| `/webhook/*` | POST → `https://jckauto.ru/bot-webhook/{rest}` |
| `/photo/*` | проксирует фото с `jckauto.ru` с fallback на расширения |
| `/anthropic/*` | `api.anthropic.com` (убирает лишние заголовки) |
| любой другой | `api.telegram.org` (исходящие запросы бота) |

---

## Регистрация webhook

### КРИТИЧЕСКОЕ ПРАВИЛО — токен обязан быть в пути URL

`node-telegram-bot-api` валидирует входящие запросы следующим образом:

```js
req.url.indexOf(bot.token) !== -1
```

- Если токен **отсутствует** в URL → `401 Unauthorized`.
- Бот **получает** событие `message`, но `onText` обработчики **НЕ вызываются**.
- Внешний симптом: бот молча игнорирует все сообщения.
- В логах видно: `[bot] message: /start from ...`, но бот никогда не отвечает.

### Правильный webhook URL (через Worker)

```
https://tg-proxy.t9242540001.workers.dev/webhook/bot{TOKEN}
```

- Worker пересылает на: `https://jckauto.ru/bot-webhook/bot{TOKEN}`.
- nginx срезает префикс `/bot-webhook/` → бот получает путь `/bot{TOKEN}` → токен найден → OK.

### Неправильный webhook URL (прямой, вызывает интермиттирующие таймауты)

```
https://jckauto.ru/bot-webhook/bot{TOKEN}
```

- Обходит Worker → провайдер блокирует IP Telegram → задержки 2–5 минут.

### Команда регистрации webhook (выполнять при смене токена/домена)

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
curl -s "https://tg-proxy.t9242540001.workers.dev/bot${TOKEN}/setWebhook?url=https://tg-proxy.t9242540001.workers.dev/webhook/bot${TOKEN}" | jq .
```

Ожидаемый ответ:

```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

### Проверка статуса webhook

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
curl -s "https://tg-proxy.t9242540001.workers.dev/bot${TOKEN}/getWebhookInfo" | jq .
```

**Здоровое состояние:**
- `"url"` содержит URL Worker + токен
- `"pending_update_count"` = `0`
- `"last_error_message"` отсутствует (или `last_error_date` давно в прошлом)

**Проблемное состояние:**
- `"url"` = `""` → webhook не зарегистрирован
- `"last_error_message": "Connection timed out"` → использован прямой URL в обход Worker

---

## Диагностические команды

### 1. Проверить, что бот принимает сообщения

Отправить тестовый update напрямую в процесс бота (в обход Telegram):

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
curl -s -X POST "http://127.0.0.1:8443/bot${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"update_id":999,"message":{"message_id":999,"from":{"id":123,"is_bot":false,"first_name":"Test"},"chat":{"id":123,"type":"private"},"date":1234567890,"text":"/start"}}'
```

- Ожидаемый ответ: `OK`.
- Ожидаемая строка в pm2-логах: `[bot] message: /start from 123`.

### 2. Проверить, что бот слушает порт

```bash
ss -tlnp | grep 8443
```

- Ожидается: процесс `node`, слушает на `0.0.0.0:8443`.

### 3. Проверить исходящий трафик через Worker

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
WORKER=$(grep TELEGRAM_API_BASE_URL /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
curl -s "${WORKER}/bot${TOKEN}/getMe" | jq .ok
```

- Ожидается: `true`.

### 4. Проверить статус webhook (см. «Проверка статуса webhook» выше)

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
curl -s "https://tg-proxy.t9242540001.workers.dev/bot${TOKEN}/getWebhookInfo" | jq .
```

---

## Переменные окружения (`.env.local`)

| Переменная | Обязательная | Значение |
|-----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | да | токен бота |
| `TELEGRAM_GROUP_CHAT_ID` | да | `-1003706902240` |
| `WEBHOOK_PORT` | нет | `8443` (по умолчанию) |
| `TELEGRAM_API_BASE_URL` | да | `https://tg-proxy.t9242540001.workers.dev` |

## Конфигурация nginx (справочно)

```nginx
location /bot-webhook/ {
    proxy_pass http://127.0.0.1:8443/;
}
```
