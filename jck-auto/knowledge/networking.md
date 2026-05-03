<!--
  @file:        knowledge/networking.md
  @project:     JCK AUTO
  @description: Network architecture — nginx config, Cloudflare Worker tg-proxy, provider restrictions, Yandex Metrika MCP install
  @updated:     2026-05-02
  @version:     1.0
  @lines:       ~225
-->

# Networking

> Network and proxy architecture for JCK AUTO. nginx config + reverse-proxy
> rules; Cloudflare Worker tg-proxy (4 routing modes); provider network
> restrictions and the proxy chains that work around them; Yandex Metrika
> MCP install procedure (proxy chain via supergateway + nginx). For server
> identity, PM2 processes, deploy pipeline, see `infrastructure.md`.

## Nginx

- Reverse proxy: port 80/443 → localhost:3000
- SSL: Let's Encrypt auto-renewal
- No custom rewrite rules — Next.js handles routing

### Конфигурационный файл

- **Путь:** `/etc/nginx/sites-enabled/jckauto`

### Ключевые `location`-блоки

```nginx
location /bot-webhook/ {
    proxy_pass http://127.0.0.1:8443/;
    # Срезает префикс /bot-webhook/ — бот получает путь /bot{TOKEN}
    # node-telegram-bot-api требует токен в пути URL (иначе 401 и молчание)
}

location /storage/ {
    alias /var/www/jckauto/storage/;
    expires 30d;
}

location / {
    proxy_pass http://127.0.0.1:3000;  # Next.js app
}
```

### Таймауты nginx

- **Дефолт:** 60 секунд (`proxy_read_timeout` явно не задан).
- **Затрагивает:** большинство API-маршрутов сайта.
- **Митигация:** сжатие изображений через Sharp в `route.ts` (resize до 2000px + JPEG 85).
- **Note:** **НЕ** увеличивать таймаут nginx в качестве обходного решения — чинить размер изображения.
- **Исключения:** для `/api/tools/auction-sheet` действует per-endpoint override — см. ниже.

### Per-endpoint nginx overrides

#### `/api/tools/auction-sheet`

Long-running AI pipeline (Pass 0 classifier + 3 parallel OCR passes +
DeepSeek parse + future queue wait). Requires extended timeouts and
larger body size for HEIC uploads.

- `proxy_read_timeout 200s` (default was 60s)
- `proxy_send_timeout 200s` (default was 60s)
- `proxy_connect_timeout 10s`
- `client_body_timeout 60s`
- `client_max_body_size 15M` (default was 1M)
- `proxy_buffering off` (for future queue-status streaming)
- `proxy_request_buffering off`

Config file: `/etc/nginx/sites-available/jckauto` — regex location
block `location ~ ^/api/tools/auction-sheet(/|$)` placed BEFORE the
general `location /` block (regex matches take priority over prefix
matches in nginx).

Last backup: `/etc/nginx/sites-available/jckauto.backup-2026-04-18`
(before the timeout increase). Restore with:
`sudo cp /etc/nginx/sites-available/jckauto.backup-2026-04-18 /etc/nginx/sites-available/jckauto && sudo nginx -t && sudo systemctl reload nginx`

@rule Do NOT remove this block without updating DeepSeek timeout in
      `src/lib/deepseek.ts` simultaneously. 180s DeepSeek + OCR +
      classifier can exceed default 60s nginx timeout.

### SSL

- **Let's Encrypt:** `/etc/letsencrypt/live/jckauto.ru/`
- **Покрывает:** `jckauto.ru` + `www.jckauto.ru`
- **Порт 80:** `301 redirect` на `https://jckauto.ru`

## Cloudflare Worker — tg-proxy

- **Worker URL:** `https://tg-proxy.t9242540001.workers.dev`
- **Cloudflare account:** `T9242540001@gmail.com`
- **Worker name:** `tg-proxy`
- **Назначение:** прокси-слой, необходимый потому что провайдер VDS блокирует:
  - **исходящие** соединения от VDS к `api.telegram.org`;
  - **входящие** соединения от IP-диапазонов Telegram к VDS.

### Логика маршрутизации Worker (4 режима)

**Режим 1 — входящий webhook (Telegram → VDS):**
- Шаблон: `/webhook/*`
- Действие: пересылает POST на `https://jckauto.ru/bot-webhook/{rest}`
- Пример: `/webhook/bot{TOKEN}` → `https://jckauto.ru/bot-webhook/bot{TOKEN}`
- Назначение: приём Telegram updates

**Режим 2 — прокси фото (VDS → внешний мир):**
- Шаблон: `/photo/*`
- Действие: fetch с `https://jckauto.ru/{path}` с fallback по расширениям (`.jpg` / `.jpeg` / `.png` / `.webp` / `.gif`)
- Cache-Control: `public, max-age=86400`

**Режим 3 — прокси Anthropic API:**
- Шаблон: `/anthropic/*`
- Действие: пересылает POST на `https://api.anthropic.com/{path}`
- Оставляет только заголовки: `x-api-key`, `anthropic-version`, `anthropic-beta`, `Content-Type` (остальные вырезаются)

**Режим 4 — исходящие запросы бота (default, catch-all):**
- Шаблон: всё остальное (например, `/bot{TOKEN}/sendMessage`)
- Действие: переписывает host на `api.telegram.org`, пересылает запрос
- Назначение: все вызовы Bot API (`sendMessage`, `getMe`, `setWebhook` и т.д.)

### Конфигурация Worker в git

- **Код:** `worker/tg-proxy.js` в репозитории (4-режимная маршрутизация, описана выше).
- **Конфигурация:** `worker/wrangler.toml` — включая `[placement] mode = "smart"` + `region = "gcp:europe-west1"` (Belgium GCP edge hint, детерминированное размещение в Европе).
- **Deploy:** `.github/workflows/deploy-worker.yml` через `cloudflare/wrangler-action@v3`. Триггеры: автоматический на push в `worker/**`, ручной — `workflow_dispatch` в GitHub Actions UI.
- **Secrets:** `CLOUDFLARE_API_TOKEN` (scope: Workers Scripts Edit, создан из template "Edit Cloudflare Workers"), `CLOUDFLARE_ACCOUNT_ID` = `604d9a5c5413693bbb859f1ffab5fc99` (non-secret идентификатор аккаунта, хранится в Secrets для единообразия).
- **Runtime placement:** `cf-placement: local-ARN` (Stockholm Arlanda edge). Latency к `api.telegram.org`: ~0.2s.
- **Источник истины:** `worker/wrangler.toml` в git. Cloudflare Dashboard — НЕ источник; каждый `wrangler deploy` перезаписывает живую версию Worker'а из git.

### Не править Worker в Dashboard

- Редактирование кода или placement в Cloudflare Dashboard будет потеряно на следующем deploy.
- Чтобы внести изменение: редактировать файлы в `worker/` в репозитории → commit → push (в `claude/**` или напрямую в `main`) → workflow автоматически выполнит deploy.
- Чтобы откатиться к предыдущей версии: Cloudflare Dashboard → Workers & Pages → tg-proxy → Deployments → история деплоев → "Rollback to this deployment". Откат в Dashboard — временный; при следующем push в `worker/**` wrangler снова перезапишет. Если откат должен быть постоянным, нужен git revert коммита в `worker/**`.
- См. ADR `[2026-04-23] Cloudflare Worker tg-proxy moved to git + Placement Hints` для полной архитектурной трактовки.

## Provider network restrictions

Ограничения сетевого доступа VDS-провайдера:

**1. Исходящие на `api.telegram.org` — ЗАБЛОКИРОВАНО**
- Обход: все вызовы Bot API идут через Worker `tg-proxy` (переменная `TELEGRAM_API_BASE_URL`).

**2. Входящие от IP-диапазонов Telegram — ПЕРИОДИЧЕСКИ БЛОКИРУЮТСЯ**
- Симптом: таймауты webhook, задержки ответов бота 2–5 минут.
- Обход: регистрировать webhook на URL Worker, а **не** напрямую на `jckauto.ru`.
- Правильный webhook: `https://tg-proxy.t9242540001.workers.dev/webhook/bot{TOKEN}`.

**3. Прямой `curl` на `api.telegram.org` из shell VDS — ЗАБЛОКИРОВАН**
- Диагностический обход: использовать URL Worker:
  ```bash
  curl "https://tg-proxy.t9242540001.workers.dev/bot{TOKEN}/getMe"
  ```

## Yandex Metrika MCP — install steps

Этот MCP-сервер оборачивает Yandex Metrika API для доступа из Claude.ai Custom Connector. Запускается как PM2-процесс `yandex-metrika-mcp` на внутреннем порту 8765 (Streamable HTTP). Установка — однократная операция per-VDS-instance; после неё процесс управляется через `ecosystem.config.js` так же, как остальные PM2-процессы. OAuth-токен (`metrika:read` scope) обязателен — без него MCP вернёт 401 на любой запрос.

**Prerequisites:**

- SSH-доступ к VDS.
- `YANDEX_API_KEY` (OAuth-токен Yandex Metrika со scope `metrika:read`) — у Vasily.
- Counter ID `106847609` для jckauto.ru (передаётся атомкрафтовским MCP'ом через API-параметр на каждом инструменте, embed'инг в env не требуется — указано здесь для справки).

**One-time install commands** (выполнять последовательно на VDS):

```bash
# 1. Clone the fork into mcp-servers directory
cd /var/www/jckauto
git clone https://github.com/t9242540001/yandex-metrika-mcp mcp-servers/yandex-metrika-mcp

# 2. Install dependencies (npm install, NOT npm ci — fork has no package-lock.json on first clone)
cd mcp-servers/yandex-metrika-mcp
npm install

# 3. Install supergateway as local dev dependency for HTTP wrapping
npm install supergateway

# 4. Build atomkraft TypeScript sources to build/index.js
npm run build

# 5. Add token to .env.local (replace <TOKEN> with actual OAuth token)
#    NEVER paste this command with the actual token into chat, screenshots,
#    or non-encrypted storage. Only run it directly on VDS shell.
echo "YANDEX_API_KEY=<TOKEN>" >> /var/www/jckauto/app/jck-auto/.env.local

# 6. Load env into shell, register PM2 entry from committed ecosystem.config.js
cd /var/www/jckauto/app/jck-auto
set -a
source .env.local
set +a
pm2 startOrReload ecosystem.config.js --only yandex-metrika-mcp

# 7. Persist PM2 state across reboots
pm2 save
```

**Verification commands:**

```bash
# Process is online and uptime > 0
pm2 list | grep yandex-metrika-mcp

# Logs show supergateway listening on :8765
pm2 logs yandex-metrika-mcp --lines 30 --nostream

# Local smoke test — Streamable HTTP endpoint responds
curl -i -X POST http://localhost:8765/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0"}}}'
# Expected: HTTP 200 with JSON-RPC response containing serverInfo and protocolVersion.
```

**Token rotation.** Канонический порядок задокументирован как `@rule` в `ecosystem.config.js` (entry `yandex-metrika-mcp`). Кратко — `pm2 restart` НЕ перечитывает env, нужен полный delete + startOrReload цикл:

1. Отредактировать `.env.local` с новым значением `YANDEX_API_KEY`.
2. `set -a; source .env.local; set +a` — загрузить новое значение в shell env.
3. `pm2 delete yandex-metrika-mcp` — снести старый процесс со старым env-snapshot'ом.
4. `pm2 startOrReload ecosystem.config.js --only yandex-metrika-mcp` — поднять с новым env.

**Troubleshooting:**

- **"supergateway not found"** в логах PM2 → пропущен step 3, выполнить `npm install supergateway` в `/var/www/jckauto/mcp-servers/yandex-metrika-mcp`.
- **"YANDEX_API_KEY undefined"** в логах supergateway → env не был загружен в shell перед `pm2 startOrReload`. Повторить step 6 явно: `set -a; source .env.local; set +a` затем `pm2 delete yandex-metrika-mcp && pm2 startOrReload ecosystem.config.js --only yandex-metrika-mcp`.
- **"401 Unauthorized"** от Yandex API в ответах MCP → токен истёк или отозван. Запустить процедуру ротации токена выше.

