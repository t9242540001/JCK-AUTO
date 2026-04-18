<!--
  @file:        knowledge/tools.md
  @project:     JCK AUTO
  @description: API tools documentation — auction-sheet async-only contract (POST 202 + job polling), Pass 0 classifier + multi-pass OCR + DeepSeek parse, DashScope fallback chain, nginx per-endpoint overrides (200s / 15MB), job status + admin stats endpoints
  @updated:     2026-04-18
  @version:     1.7
  @lines:       ~290
-->

# Tools API — /tools/*

## Auction Sheet Analyzer

**Route:** `POST /api/tools/auction-sheet`  
**File:** `src/app/api/tools/auction-sheet/route.ts`  
**Page:** `src/app/tools/auction-sheet/page.tsx`

### Endpoints

- **POST** `/api/tools/auction-sheet` — submit a photo. **Async-only contract.**
  The handler runs validation + Sharp compression synchronously, enqueues the
  AI pipeline into `auctionSheetQueue` (concurrency=1), and returns
  `202 Accepted` with `{jobId, statusUrl, position, etaSec}`. Headers:
  `Location: /api/tools/auction-sheet/job/{jobId}`, `Cache-Control: no-store`.
  Does NOT block on the AI pipeline — clients MUST poll `statusUrl`. Error
  statuses returned synchronously by POST:
  - `429` — per-user rate limit exhausted (`error: rate_limit`)
  - `400` — malformed upload (`no_file` / `file_too_large` / `invalid_type` /
    `invalid_request` / `invalid_image`)
  - `503` + `Retry-After: 300` — queue is full (`error: queue_full`)
  - `500` — unexpected enqueue failure (`error: enqueue_failed`)
  Pipeline errors (`ai_error:` / `parse_error:`) surface only via the job
  polling endpoint as `{status:'failed', error}`.
  See ADR `[2026-04-18] Async-only contract for POST /api/tools/auction-sheet
  (jobId + polling)`.
- **GET** `/api/tools/auction-sheet/job/[jobId]` — poll status of an enqueued job.
  File: `src/app/api/tools/auction-sheet/job/[jobId]/route.ts`. Returns `200`
  with JSON body:
  - `{status:'queued', position, etaSec, ...}` while waiting in line
  - `{status:'processing', etaSec, ...}` while being handled
  - `{status:'done', result, ...}` when finished — `result` is the same JSON
    previously returned synchronously by POST
  - `{status:'failed', error, ...}` when job threw
  Returns `400` for malformed `jobId`, `404` for unknown/expired `jobId`.
  Cache-Control: no-store. Intended polling interval: ~2 seconds.
  See ADR `[2026-04-18] Introduce server-side in-memory queue for auction-sheet`.
- **GET** `/api/tools/auction-sheet/stats` — admin-only aggregated queue metrics.
  File: `src/app/api/tools/auction-sheet/stats/route.ts`. Returns `200` with
  `QueueStatsSnapshot` JSON (peak size, throughput, rejection count, avg wait/
  processing times). Returns `401` without valid `tg_auth` cookie. Returns
  `403` if cookie's `telegramId` is not listed in `ADMIN_TELEGRAM_IDS` env
  var (CSV). Fail-closed: empty/missing env → always 403.

### Получение tg_auth cookie для admin-диагностики

Для вызова admin-эндпоинтов (например, `/api/tools/auction-sheet/stats`)
из curl нужен валидный JWT-cookie `tg_auth`:

1. Открыть https://jckauto.ru/tools/auction-sheet в обычном браузере.
2. Нажать кнопку «Войти через Telegram» (появляется при превышении
   анонимного лимита расшифровок, или можно вызвать форсированно
   через любой другой инструмент сайта).
3. После успешной авторизации — открыть DevTools → Application →
   Cookies → `https://jckauto.ru` → найти cookie `tg_auth` → скопировать
   значение.
4. Использовать в curl:
   ```bash
   curl -b "tg_auth=<скопированное_значение>" \
     https://jckauto.ru/api/tools/auction-sheet/stats
   ```

Cookie живёт 30 дней. При истечении — повторить шаги 1–3.

Необходимо, чтобы ваш `telegram_id` был в списке `ADMIN_TELEGRAM_IDS`
в `.env.local` на сервере (CSV через запятую). После правки env —
`pm2 restart jckauto`.

### Назначение

AI-расшифровка японских аукционных листов по **асинхронному контракту**: клиент
отправляет фото одним POST-запросом и сразу получает `202 Accepted` с `jobId`;
сама AI-обработка (Pass 0 classifier + три параллельных OCR-прохода + Step 2
parse) идёт под замком очереди `auctionSheetQueue` (concurrency=1). Клиент
периодически опрашивает GET `/api/tools/auction-sheet/job/[jobId]` и получает
в итоге `{status:'done', result}` — `result` содержит `{success:true, data, meta}`
с оценкой кузова, дефектами, пробегом, комплектацией и рекомендацией.

Step 1 OCR (три параллельных прохода через DashScope) и Step 2 parse (DeepSeek
primary, qwen3.5-flash fallback) живут ТОЛЬКО внутри `runPipeline()` — POST
handler не делает синхронных вызовов AI.

### Flow (async contract)

1. **POST** `/api/tools/auction-sheet` (multipart/form-data, поле `image`):
   - проверка rate-limit → 429 при исчерпании;
   - парсинг `formData` → 400 `invalid_request`;
   - валидация файла → 400 `no_file` / `file_too_large` / `invalid_type`;
   - **Sharp-сжатие СИНХРОННО** в том же хэндлере (2000×2000 JPEG q:85) —
     битый или нечитаемый файл отбрасывается **до** enqueue → 400 `invalid_image`;
   - `auctionSheetQueue.enqueue(() => runPipeline(compressed, ip, telegramId))`
     → `QueueFullError` → 503 + `Retry-After: 300`; иначе — `jobId`;
   - ответ `202 Accepted` с `{jobId, statusUrl, position, etaSec}`,
     заголовок `Location: /api/tools/auction-sheet/job/{jobId}`.
2. **Queue worker** (concurrency=1) вызывает `runPipeline(compressedBuffer, ip, telegramId)`:
   - Pass 0 classifier (advisory, soft-fail → 'printed');
   - Step 1 OCR: три параллельных прохода (Pass 1 REQUIRED — throw `ai_error:`
     при падении; Pass 2/3 soft-fail);
   - Step 2 parse (DeepSeek → qwen3.5-flash fallback);
   - при успехе: `recordUsage(ip, telegramId)` и второй `checkRateLimit()` для
     `remaining` → возвращается `{data, meta}`, job получает `status='done'`;
   - при ошибке внутри pipeline — `throw new Error('ai_error: ...')` или
     `throw new Error('parse_error: ...')`; квота клиента НЕ списывается,
     job получает `status='failed'` с полем `error`.
3. **GET** `/api/tools/auction-sheet/job/[jobId]` — клиент опрашивает раз в
   ~2 секунды, пока не получит `done` или `failed`.

Ключевая инвариант: **квота списывается только на успешных jobs**; любое
падение pipeline оставляет лимит пользователя нетронутым.

### Форматы файлов

| Тип | MIME | Примечание |
|-----|------|-----------|
| JPEG | image/jpeg | основной |
| PNG | image/png | |
| WebP | image/webp | |
| HEIC | image/heic | поддерживается через libheif 1.20.2 в sharp 0.34.5 |

Максимальный размер: **10 МБ** (жёсткий лимит проверяется в `route.ts`).
Nginx разрешает до **15 МБ** (`client_max_body_size 15M` в per-endpoint
location), чтобы `route.ts` оставался единой точкой правды для
пользовательского лимита и отдавал понятное JSON-сообщение вместо
nginx-овой 413.

### HEIC — статус поддержки

Sharp 0.34.5 установлен с libheif 1.20.2. Буферный ввод (`Buffer.from(bytes)`) работает для HEIC, несмотря на то что `fileSuffix` в vips показывает `['.avif']`. Сжатие HEIC → JPEG проверено.

### Сжатие изображений (Sharp)

**Проблема:** большие изображения (4–12 МБ) заставляют DashScope обрабатывать запрос 60+ секунд → nginx upstream timeout → клиент получает «Ошибка сети».

**Решение:** перед передачей в DashScope сжимать через Sharp:

```ts
const compressed = await sharp(Buffer.from(bytes))
  .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .sharpen({ sigma: 0.5 })
  .toBuffer();
```

Параметры:
- `2000×2000 fit:inside` — сохраняет пропорции, не увеличивает маленькие изображения
- `quality: 85` — достаточно для OCR, значительное уменьшение размера
- `sigma: 0.5` — лёгкое повышение резкости после сжатия (улучшает читаемость текста)

После сжатия: `data:image/jpeg;base64,...` (всегда JPEG, независимо от исходного формата).

Результат: размер полезной нагрузки уменьшился в 3–5 раз. Вместе с fallback-цепочкой DashScope (см. ниже) это позволяет уложиться в nginx timeout 60 с даже в худших сценариях.

### Архитектура pipeline

**Pass 0 — classifier**

Классифицирует входной лист как `printed` / `handwritten` / `mixed`
перед тремя параллельными OCR-проходами.

- Назначение: дать сигнал для per-type model routing в Pass 1–3
  (следующая итерация). Сейчас результат прокидывается только в
  `meta` ответа API — pipeline моделей он ещё не меняет.
- Модель: `qwen3-vl-flash` (single-model chain, без fallback).
  Параметры: `maxTokens: 20`, `temperature: 0`.
- Промпт: `CLASSIFIER_SYSTEM` требует вывести ровно один из трёх
  токенов без пояснений. `maxTokens=20` — осознанное ограничение:
  если модель вывела больше, промпт не выполнен → soft-fail.
- Политика отказа: soft-fail. На любую ошибку (таймаут, исключение,
  нераспознанный токен) возвращается `type: 'printed'` — безопасный
  дефолт, так как текущий pipeline оптимизирован под печатные листы.
  Классификатор НЕ блокирует запрос.
- Стоимость: ~$0.001 за классификацию (+2–3 с латентности).
- Выход: `meta.sheetType` / `meta.classifierModel` / `meta.classifierElapsed`
  в ответе API для наблюдаемости.
- См. ADR `[2026-04-17] Introduce Pass 0 sheet-type classifier for
  auction-sheet pipeline` в decisions.md.

**`@rule`-якоря в route.ts (classifySheet):**
- `RULE: Classifier output is advisory, NOT blocking.`
- `RULE: Classifier uses ONLY qwen3-vl-flash — fast and cheap.`
- `RULE: maxTokens=20 is intentional.`

**Step 1 — три параллельных OCR-прохода**

Один вызов OCR-модели не справляется с многозадачными промптами
(qwen-vl-ocr — малая модель). Вместо этого — три параллельных
вызова через `Promise.allSettled`, каждый со своим узким промптом.

| Pass | Задача | Модели (primary → fallback) | Политика отказа |
|------|--------|-----------------------------|-----------------|
| 1 | Text fields (label:value для всех заголовочных полей) | `qwen-vl-ocr` → `qwen3-vl-flash` | REQUIRED — падение → 502 |
| 2 | Damage codes (коды дефектов с локацией на кузове) | `qwen3-vl-flash` → `qwen-vl-ocr` | SOFT-FAIL → маркер `=== DAMAGES UNAVAILABLE ===` |
| 3 | Free text (заметки инспектора с japanese section labels) | `qwen-vl-ocr` → `qwen3-vl-flash` | SOFT-FAIL → маркер `=== FREE TEXT UNAVAILABLE ===` |

Результаты трёх passes объединяются в один текстовый блок с
разделителями `=== TEXT FIELDS ===`, `=== DAMAGES ===`,
`=== FREE TEXT ===` и передаются в Step 2.

**Важно про Pass 2:** использует отдельный model chain
`['qwen3-vl-flash', 'qwen-vl-ocr']`, НЕ общий `ocrOptionsBase.models`.
qwen-vl-ocr специализирован на извлечении текстовых символов и не
умеет визуальное reasoning о расположении кодов на диаграмме кузова.
qwen3-vl-flash — universal VL-модель, умеет. Смена модели
превратила выдачу Pass 2 с 17 chars ("no codes") в 366 chars с 14
корректно локализованными кодами (производственная проверка на
Toyota Wish / USS).

См. ADR `[2026-04-16] Multi-pass parallel OCR for auction sheets`
и `[2026-04-16] Pass 2 uses qwen3-vl-flash` в decisions.md.

**Step 2 — структурирование в JSON**

DeepSeek primary, DashScope `qwen3.5-flash` fallback. Оба получают
идентичные системный и пользовательский промпты и одинаковые
параметры (`maxTokens: 4096`, `temperature: 0.1`).

| Порядок | Модель | Endpoint | Обоснование |
|---------|--------|----------|-------------|
| 1 (primary) | `deepseek-chat` | `api.deepseek.com/v1/chat/completions` | DashScope text-модели таймаутят с VDS — см. ADR `[2026-04-15] DeepSeek primary for auction-sheet Step 2` |
| 2 (fallback) | `qwen3.5-flash` | DashScope `/multimodal-generation/generation` | Подстраховка на случай регионального отказа DeepSeek |

НЕ использовать `qwen3.5-plus` на Step 2 — её hybrid thinking mode
систематически превышает 60s timeout.

**Endpoint DashScope:** `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
Регион: Сингапур (international). Не использовать китайский
endpoint (`dashscope.aliyuncs.com`).

**Параметры:**
- Step 1 (vision): `maxTokens: 8192`, `temperature: 0.1`
- Step 2 (text): `maxTokens: 4096`, `temperature: 0.1`
- `REQUEST_TIMEOUT_MS = 60_000` (на одну попытку в `dashscope.ts`).
  См. ADR `[2026-04-15] REQUEST_TIMEOUT_MS 25s → 60s`.
- Step 2 (DeepSeek): `REQUEST_TIMEOUT_MS = 180_000` на попытку,
  `MAX_RETRIES = 2` (в `deepseek.ts`). Повышено 2026-04-18 под тяжёлые
  японские листы с 1700+ output-токенами.
  См. ADR `[2026-04-18] DeepSeek timeout 60s → 180s, retries 3 → 2`.

**Стоимость:** ~$0.004–0.006 за запрос (3 OCR passes + 1 text parse).

**Логика переключения в `analyzeImageWithFallback` (vision):**
- 4xx (кроме 429) — фатальные, fallback не запускается
- 429 / 5xx / timeout / сетевые — переход к следующей модели
- `finish_reason === 'length'` — трактуется как failure (truncation),
  fallback запускается. См. ADR `[2026-04-15] finish_reason=length detection`.
- Возвращает `usedModel` — клиент видит в `meta.model`

Реализация: `src/lib/dashscope.ts` (`analyzeImageWithFallback`,
`callQwenText`), `src/lib/deepseek.ts` (`callDeepSeek`). Оркестрация:
`src/app/api/tools/auction-sheet/route.ts`.

**`@rule`-якоря в route.ts:**
- `RULE: Three parallel OCR passes, each with one narrow task. Do NOT merge into a single multi-task prompt`
- `RULE: Pass 2 uses qwen3-vl-flash primary (visual reasoning), qwen-vl-ocr as fallback`
- `RULE: DeepSeek is primary for Step 2 — DashScope text models (qwen3.5-flash/plus) timeout from VDS`
- `@rule The full AI pipeline (Pass 0 classifier + three OCR passes + Step 2 parse) lives ONLY inside runPipeline`
- `@rule recordUsage and the second checkRateLimit call MUST happen inside runPipeline AFTER the full pipeline succeeds`
- `@rule Sharp compression MUST run BEFORE enqueue, inside the POST handler`
- `@rule POST returns 202 Accepted (NOT 200)` — see async contract above
- `@rule QueueFullError MUST map to HTTP 503 Service Unavailable + Retry-After: 300 (NOT 429)`

### Rate Limiting

Two-mode (см. `knowledge/shared-mechanics.md`):

| Режим | Ключ | Лимит |
|-------|------|-------|
| Анонимный | IP | 3 запроса lifetime |
| Telegram-auth | telegram_id | 10 запросов/день |

Cooldown между запросами: 2 минуты.  
Cookie `tg_auth` (JWT, `JWT_SECRET`) → `getTelegramIdFromCookie()`.

### Диагностика nginx timeout

Если клиент видит «Ошибка сети» при корректном файле:

```bash
# Проверить upstream timeout в nginx
grep -r "proxy_read_timeout\|proxy_send_timeout" /etc/nginx/

# Логи ошибок
tail -100 /var/log/nginx/error.log | grep "upstream timed out"
```

**Per-endpoint nginx для `/api/tools/auction-sheet`** (2026-04-18):
- `proxy_read_timeout 200s` (было 60s) — покрывает Pass 0 classifier
  (~2–3 с) + 3 параллельных OCR (~5–15 с на самый медленный) + DeepSeek
  Step 2 (до 180 с по таймауту).
- `client_max_body_size 15M` (было 1M) — устраняет тихий отказ при
  загрузке крупных HEIC до nginx-уровня. Пользовательский лимит 10 МБ
  остаётся в `route.ts`.

Full per-endpoint config и backup path — см.
`knowledge/infrastructure.md` → "Per-endpoint nginx overrides".

Пока nginx был 60 с, ограничение закрывалось комбинацией: Sharp-сжатие
(`route.ts`) + `REQUEST_TIMEOUT_MS = 60_000` на попытку в `dashscope.ts`
+ параллельные OCR-вызовы (общее время ≈ время самого медленного pass).
С 200 с — безопасный запас под DeepSeek 180 с + OCR + классификатор.

### Диагностический curl

```bash
curl -X POST https://jckauto.ru/api/tools/auction-sheet \
  -F "image=@/path/to/photo.jpg" \
  -H "Cookie: tg_auth=<JWT>" \
  -w "\nHTTP %{http_code} in %{time_total}s\n"
```
