<!--
  @file:        knowledge/tools.md
  @project:     JCK AUTO
  @description: API tools documentation — auction-sheet (multi-pass OCR + DeepSeek parse), DashScope fallback chain, nginx constraints
  @updated:     2026-04-16
  @version:     1.2
  @lines:       165
-->

# Tools API — /tools/*

## Auction Sheet Analyzer

**Route:** `POST /api/tools/auction-sheet`  
**File:** `src/app/api/tools/auction-sheet/route.ts`  
**Page:** `src/app/tools/auction-sheet/page.tsx`

### Назначение

AI-расшифровка японских аукционных листов. Двухшаговый pipeline: Step 1 — три параллельных OCR-прохода (text fields / damages / free text) через DashScope; Step 2 — структурирование результата в JSON через DeepSeek (primary) или qwen3.5-flash (fallback). На выходе — JSON с оценкой кузова, дефектами, пробегом, комплектацией и рекомендацией.

### Форматы файлов

| Тип | MIME | Примечание |
|-----|------|-----------|
| JPEG | image/jpeg | основной |
| PNG | image/png | |
| WebP | image/webp | |
| HEIC | image/heic | поддерживается через libheif 1.20.2 в sharp 0.34.5 |

Максимальный размер: **10 МБ**

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

Текущий nginx timeout: 60 с. Ограничение закрыто комбинацией: Sharp-сжатие (`route.ts`) + `REQUEST_TIMEOUT_MS = 60_000` на попытку в `dashscope.ts` + параллельные OCR-вызовы (общее время ≈ время самого медленного pass). При DeepSeek primary на Step 2 (~10 с) общее время запроса укладывается в nginx-лимит даже в пессимистичном сценарии.

### Диагностический curl

```bash
curl -X POST https://jckauto.ru/api/tools/auction-sheet \
  -F "image=@/path/to/photo.jpg" \
  -H "Cookie: tg_auth=<JWT>" \
  -w "\nHTTP %{http_code} in %{time_total}s\n"
```
