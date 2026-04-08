# Knowledge Base — JCK AUTO
> Обновлено: 2026-04-08
> Точка входа для любой задачи. Читай только то, что нужно для текущей задачи.

## Оглавление

| Файл | Описание | Когда читать |
|------|----------|--------------|
| [infrastructure.md](infrastructure.md) | Сервер, PM2, деплой, nginx, ограничения | Деплой, инфра-задачи |
| [architecture.md](architecture.md) | Навигатор файлов, URL-структура, связи модулей | Любая задача — найти нужный файл |
| [stack.md](stack.md) | Стек технологий, версии, библиотеки | Выбор инструмента, обновление зависимостей |
| [exchange-rates.md](exchange-rates.md) | Курсы валют: VTB scraper → CBR fallback → markup | Задачи с курсами, калькулятором, ценами |
| [calculator.md](calculator.md) | Формула «под ключ», calculateTotal(), CalcInput | Задачи с калькулятором |
| [customs-reference.md](customs-reference.md) | ЕТС, утильсбор, брекеты, нормативные документы | Изменение тарифов, проверка расчётов |
| [encar-analyzer.md](encar-analyzer.md) | Encar API, перевод, мощность, PDF | Задачи с анализатором Encar |
| [catalog-pipeline.md](catalog-pipeline.md) | Google Drive → AI → catalog.json, 5-step sync | Задачи с каталогом авто |
| [news-pipeline.md](news-pipeline.md) | RSS → DeepSeek → обложки → JSON → /news | Задачи с новостями и статьями |
| [telegram-bot.md](telegram-bot.md) | Команды, ADMIN_IDS, хранилище, ограничения | Задачи с ботом |
| [decisions.md](decisions.md) | Архитектурные решения (ADR) | Понять «почему так сделано» |
| [roadmap.md](roadmap.md) | Сделано / В работе / Запланировано | Приоритизация, статус задач |
| [shared-mechanics.md](shared-mechanics.md) | Rate limiter, BetaBadge, PDF, дизайн-система | Переиспользуемые механики |

## Правило обновления

При любых изменениях в коде — обновлять соответствующие файлы knowledge/.
Это часть Acceptance Criteria каждого промпта.
