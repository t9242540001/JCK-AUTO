<!--
  @file:        knowledge/tools.md
  @project:     JCK AUTO
  @description: API tools documentation — auction-sheet, DashScope, nginx constraints
  @updated:     2026-04-10
  @version:     1.0
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

Результат: время ответа DashScope снизилось с 60+ с до ~15 с.

### DashScope — конфигурация

**Endpoint:** `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`  
**Регион:** Сингапур (international). Не использовать китайский endpoint (`dashscope.aliyuncs.com`).

**Модель:** `qwen3.5-plus` (Vision)  
**Параметры:** `maxTokens: 4096`, `temperature: 0.1`  
**Стоимость:** ~$0.002/запрос  

Реализация: `src/lib/dashscope.ts` → функция `analyzeImage(dataUrl, userPrompt, options)`.

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

Текущий nginx timeout: 60 с. DashScope на несжатых изображениях может превышать это значение.  
Решение применено: Sharp-сжатие в `route.ts` до вызова `analyzeImage`.

### Диагностический curl

```bash
curl -X POST https://jckauto.ru/api/tools/auction-sheet \
  -F "image=@/path/to/photo.jpg" \
  -H "Cookie: tg_auth=<JWT>" \
  -w "\nHTTP %{http_code} in %{time_total}s\n"
```
