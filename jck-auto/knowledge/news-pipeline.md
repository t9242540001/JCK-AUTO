# Новостной pipeline и генератор статей
> Обновлено: 2026-04-08

## Новостной pipeline

```
RSS (21 источник, 3 языка) → collector.ts → processor.ts (DeepSeek ×3 параллельно)
  → coverGenerator.ts (DashScope) → publisher.ts → /storage/news/YYYY-MM-DD.json
```

### Файлы

| Файл | Роль |
|------|------|
| src/lib/rssParser.ts | Парсер RSS/Atom с автодетектом кодировки |
| src/services/news/sources.ts | 24 источника (21 enabled), 3 языка |
| src/services/news/collector.ts | Сбор + дедупликация (Jaccard similarity) |
| src/services/news/processor.ts | AI: 3 параллельных вызова DeepSeek по корзинам |
| src/services/news/publisher.ts | Сохранение JSON + cover meta |
| src/services/news/reader.ts | Чтение из storage для сайта |
| src/lib/coverGenerator.ts | Обложки: watercolor (новости) / realistic (статьи) |
| scripts/generate-news.ts | Cron-оркестратор pipeline |

### Хранилище

- `/var/www/jckauto/storage/news/YYYY-MM-DD.json` — по файлу на каждый день
- Обложки: встроены как base64 или URL в JSON

## Генератор статей

```
generateTopic() (AI из новостей) → generateArticle() (Qwen3.5-Plus)
  → generateCover() → publishArticle() → content/blog/{slug}.mdx
```

### Файлы

| Файл | Роль |
|------|------|
| src/services/articles/topicGenerator.ts | AI генерирует тему из свежих новостей |
| src/services/articles/generator.ts | Генерация текста через Qwen3.5-Plus |
| src/services/articles/articlePublisher.ts | Сохранение MDX + обложка |
| scripts/generate-article.ts | Cron-оркестратор + build + pm2 restart |

### Контент

- 32+ MDX-статей в content/blog/
- Статьи на русском, SEO-оптимизированные
- Обложки: DashScope Qwen-Image-2.0-Pro

## Страницы сайта

| URL | Описание |
|-----|----------|
| /news | Каталог новостей |
| /news/[slug] | Дневной дайджест |
| /news/tag/[tag] | Фильтр по тегу |
| /blog | Список статей |
| /blog/[slug] | Статья |
| /api/news | GET — лента новостей |

## Стоимость

| Сервис | Цена | Частота |
|--------|------|---------|
| DeepSeek (новости) | ~$0.002/дайджест | 1 раз/день |
| DashScope обложки | ~$0.04/штука | 1-2 раза/день |
| DashScope текст | ~$0.01/статья | 1 раз/день |
| **Итого** | **~$2-3/мес** | При текущей нагрузке |
