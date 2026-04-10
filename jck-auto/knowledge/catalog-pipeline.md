# Каталог авто — pipeline синхронизации
> Обновлено: 2026-04-09

## Именование файлов на Google Drive

| Имя файла | Роль | Детектор |
|-----------|------|----------|
| `1.jpg` / `1.jpeg` / `1.png` | **Обложка** карточки | `findCoverPhotoIndex()` в catalogSync.ts |
| `2.jpg` / `2.jpeg` / `2.png` | **Скриншот** для AI | `isScreenshot()` в googleDrive.ts |
| `3.jpg`, `4.jpg`... | Фото **галереи** | всё остальное → photos[] |
| `front*.jpg` / `cover*.jpg` | Альт. обложка | `findCoverPhotoIndex()` |
| `screen*.png` / `скрин*.png` | Альт. скриншот | `isScreenshot()` |

`.jpg` и `.jpeg` обрабатываются одинаково.
Скриншот **НЕ** попадает в галерею — исключается из photos[].

## 5-шаговая цепочка синхронизации

```
Шаг 1 — VDS: sync-catalog.ts
  → скачивает с Drive, разделяет на обложку/скриншот/галерею
  → лимиты за прогон: MAX_NEW_PER_RUN=10 (новые машины), MAX_RESYNC_PER_RUN=5 (pending машины)
  → пишет catalog.json (без AI-обработки на VDS)
  → НЕ запускает билд: страницы /catalog и /catalog/cars/[id] force-dynamic,
    изменения видны мгновенно при следующем HTTP-запросе

Шаг 2 — GitHub Actions runner:
  → SCP скачивает catalog.json + скриншоты с VDS

Шаг 3 — GitHub Actions runner: process-ai-pending.ts
  → Claude Vision API → характеристики авто из скриншота
  → CBR курс → priceRub
  → exit(1) если 0 обработано и есть ошибки

Шаг 3.5 — GitHub Actions runner: generate-descriptions.ts
  → Claude Text API → описание (80-150 слов)
  → rate limit: 2 сек между запросами
  → НЕ перезаписывает существующие описания

Шаг 4 — GitHub Actions runner:
  → SCP загружает catalog.json обратно на VDS
  → изменения видны на сайте мгновенно — force-dynamic читает файл на каждом запросе
```

## Приоритет выбора скриншота для AI

1. Файл `2.*` (любое расширение)
2. `screenshot.*` или содержащий `скрин`, `screen`, `spec`, `info`
3. Первый из screenshots[]
4. Первый PNG среди photos[]
5. Все файлы папки (до 5, сортировка по размеру DESC) — multi-image

## Хранилище

- catalog.json: `/var/www/jckauto/storage/catalog/catalog.json`
- Фото авто: `/var/www/jckauto/storage/catalog/{carId}/`
- **catalog.json — flat array `[]`, NOT `{ cars: [] }`**
- Рендеринг: /catalog и /catalog/cars/[id] — force-dynamic (читают catalog.json на каждом запросе, no-cache, ~275 ms/запрос). Изменения в catalog.json видны мгновенно. @rule: не возвращать ISR/prerender без согласования — это вернёт пересборку в sync-catalog.ts.

## Ключевые файлы

| Файл | Роль |
|------|------|
| src/lib/catalogSync.ts | Синхронизация, выбор обложки |
| src/lib/googleDrive.ts | Drive API, детекция скриншотов |
| src/lib/screenshotParser.ts | AI-парсинг изображений |
| scripts/sync-catalog.ts | Cron-оркестратор (VDS) |
| scripts/process-ai-pending.ts | AI-обработка (runner) |
| scripts/generate-descriptions.ts | AI-описания (runner) |
