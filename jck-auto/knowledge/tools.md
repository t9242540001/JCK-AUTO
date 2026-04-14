<!--
  @file:        knowledge/tools.md
  @project:     JCK AUTO
  @description: API tools documentation — auction-sheet, DashScope fallback chain, nginx constraints
  @updated:     2026-04-14
  @version:     1.1
  @lines:       118
-->

# Tools API — /tools/*

## Auction Sheet Analyzer

**Route:** `POST /api/tools/auction-sheet`  
**File:** `src/app/api/tools/auction-sheet/route.ts`  
**Page:** `src/app/tools/auction-sheet/page.tsx`

### Назначение

AI-расшифровка японских аукционных листов. Пользователь загружает фото, модель Qwen-VL возвращает JSON с оценкой кузова, дефектами, пробегом, комплектацией и рекомендацией.

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

### DashScope — конфигурация

**Endpoint:** `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`  
**Регион:** Сингапур (international). Не использовать китайский endpoint (`dashscope.aliyuncs.com`).

**Fallback-цепочка (по умолчанию):** `qwen-vl-ocr` → `qwen3-vl-flash` → `qwen3.5-plus`

| Порядок | Модель | Причина |
|---------|--------|---------|
| 1 | `qwen-vl-ocr` | Специализированная OCR-модель, самая быстрая для текста на фото |
| 2 | `qwen3-vl-flash` | Универсальная vision-модель без reasoning-шага — быстрее, чем qwen3.5-plus |
| 3 | `qwen3.5-plus` | Fallback последнего уровня; имеет hybrid thinking, что делает её медленнее при vision |

**Параметры:** `maxTokens: 4096`, `temperature: 0.1`, `REQUEST_TIMEOUT_MS = 25_000` (на попытку)  
**Стоимость:** ~$0.002/запрос (первая успешная модель из цепочки)

**Логика переключения:**
- Каждая попытка имеет timeout 25 с (укладывается в nginx 60 с даже при двух неудачных).
- 4xx-ошибки (кроме 429) — фатальные, fallback не запускается (означает логическую ошибку запроса).
- 429 / 5xx / timeout / сетевые — переход к следующей модели.
- В ответе возвращается поле `usedModel` — именно её клиент видит в `meta.model`.

Реализация: `src/lib/dashscope.ts` → функция `analyzeImageWithFallback(dataUrl, userPrompt, options)`.  
Используется в `src/app/api/tools/auction-sheet/route.ts`.

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

Текущий nginx timeout: 60 с. Ограничение закрыто комбинацией: Sharp-сжатие (`route.ts`) + `REQUEST_TIMEOUT_MS = 25_000` на попытку в fallback-цепочке (`analyzeImageWithFallback`). В худшем случае две неудачных попытки укладываются в ~50 с, третья успешная добивает до корректного ответа в пределах nginx-лимита.

### Диагностический curl

```bash
curl -X POST https://jckauto.ru/api/tools/auction-sheet \
  -F "image=@/path/to/photo.jpg" \
  -H "Cookie: tg_auth=<JWT>" \
  -w "\nHTTP %{http_code} in %{time_total}s\n"
```
