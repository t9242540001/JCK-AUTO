Ты — ведущий разработчик проекта JCK AUTO. Компания импортирует автомобили из Китая, Кореи и Японии в Россию.

## Инфраструктура

- VDS: 94.250.249.104, Ubuntu 24.04, Node v20.20.0
- Рабочая папка: /var/www/jckauto/app/jck-auto
- GitHub: https://github.com/t9242540001/JCK-AUTO
- Ветка сайта: claude/news-pipeline (основная рабочая)
- Ветка бота: claude/analyze-catalog-cover-logic-0IxVK
- Сайт: https://jckauto.ru

## PM2 процессы

| Процесс | Назначение |
|---------|------------|
| jckauto | Next.js сайт |
| jckauto-bot | Telegram-бот |

## Деплой бота (ВАЖНО — только так, иначе env не подхватывается)

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin
git checkout claude/analyze-catalog-cover-logic-0IxVK
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

## Деплой сайта

```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/news-pipeline
npm run build && pm2 restart jckauto
```

## Стек

* Next.js 15, App Router, TypeScript strict
* Tailwind CSS 4, shadcn/ui, Framer Motion
* node-telegram-bot-api (polling режим)
* Хранилище: JSON-файлы на VDS (/var/www/jckauto/storage/)
* AI: DashScope (Qwen3.5-Plus Vision/Text, Qwen-Image-2.0-Pro), DeepSeek (deepseek-chat)
* PDF: PDFKit (server-side)

## Дизайн-система

* Primary: #1E3A5F (тёмно-синий)
* Secondary: #C9A84C (золото)
* Шрифты: Space Grotesk + Inter
* Акценты стран: Китай #DE2910, Корея #003478, Япония #BC002D

## Раздел «Сервисы» (/tools)

### Навигация

Единый конфиг: `src/lib/navigation.ts` — `NAV_ITEMS` с поддержкой `children` (подменю).
Импортируется в Header (dropdown на hover), MobileMenu (раскрывающаяся секция), Footer (плоский список с подпунктами).
Пункты: Главная, Каталог, **Сервисы** (подменю: 4 инструмента), О компании, Блог, Новости.

### Хаб /tools

Страница с 4 карточками инструментов. JSON-LD WebApplication.
Редирект 301: `/calculator` → `/tools/calculator` (next.config.ts + page.tsx redirect).

### Калькуляторы

**Единый движок `src/lib/calculator.ts`:**
- Функция `calculateTotal(input, rates)` — универсальная для обоих калькуляторов
- `CalcInput.currencyCode`: 5 валют (CNY/KRW/JPY/EUR/USD)
- `CalcInput.country?`: если указана → включает логистику/комиссию, если нет → только таможня
- `CalcInput.buyerType`: 'individual' | 'company'
- `breakdown` содержит `details?: string` — человекочитаемые пояснения расчётов (формулы, ставки)

**Тарифные данные `src/lib/tariffs.ts`** (бывший calculator-data.ts):
- TARIFF_META: lastUpdated, validUntil, sources (нормативные документы)
- Все ставки: ЕТС, пошлины, акциз, утильсбор, фиксированные расходы
- @rule: НЕ менять числа без проверки нормативки

**Курсы валют `src/lib/currencyRates.ts`** (бывший currency.ts):
- fetchCBRRates(): EUR, USD, CNY, KRW, JPY
- CURRENCIES: маппинг code → symbol/label (5 валют)
- COUNTRY_CURRENCY: маппинг country → currency

**Обёртка `src/lib/priceCalculator.ts`:**
- Тонкая обёртка для обратной совместимости (бот, скрипты синхронизации)
- Внутри вызывает calculateTotal() с country='china'

**Удалённые файлы:** calculator-data.ts → tariffs.ts, currency.ts → currencyRates.ts

| Калькулятор | URL | Описание |
|-------------|-----|----------|
| «Под ключ» | /tools/calculator | Страна + цена → полная стоимость с логистикой. Только физлицо. |
| Пошлин | /tools/customs | Валюта + цена → два столбца (физ/юрлицо). Без логистики. Details с формулами. |

### AI-инструменты

**Аукционные листы** — `/tools/auction-sheet`:
- Frontend: AuctionSheetClient.tsx — drag&drop, 5 состояний, секции результатов, PDF-кнопка
- API: POST /api/tools/auction-sheet → Qwen3.5-Plus Vision (systemPrompt с базой обозначений)
- PDF: POST /api/tools/auction-sheet/pdf → PDFKit server-side генерация
- Системный промпт: коды дефектов (A/U/W/S/X/Y), оценки (S-***), комплектация, японский календарь

**Rate limiter `src/lib/rateLimiter.ts`:**
- 3 запроса/день на IP, общий для всех AI-инструментов
- In-memory Map с auto-cleanup (24h window)

**DashScope `src/lib/dashscope.ts`:**
- analyzeImage(): 4 модели Vision (qwen3-vl-flash, qwen3.5-flash, qwen3.5-plus, qwen3.6-plus) + systemPrompt
- callQwenText(): текстовая генерация (qwen3.5-plus/flash)
- generateImage(): Qwen-Image-2.0-Pro
- DEFAULT_VISION_MODEL = 'qwen3.5-plus'

**Анализатор Encar** — `/tools/encar`: заглушка (Фаза 4, следующая)

## Новостной pipeline

```
RSS (21 источник) → collector.ts → processor.ts (DeepSeek ×3 параллельно) → coverGenerator.ts (DashScope) → publisher.ts → /storage/news/YYYY-MM-DD.json
```

| Файл | Описание |
|------|----------|
| src/lib/rssParser.ts | Парсер RSS/Atom с автодетектом кодировки |
| src/services/news/sources.ts | 24 источника (21 enabled), 3 языка |
| src/services/news/collector.ts | Сбор + дедупликация (Jaccard) |
| src/services/news/processor.ts | AI: 3 параллельных вызова DeepSeek по корзинам |
| src/services/news/publisher.ts | Сохранение JSON + cover meta |
| src/services/news/reader.ts | Чтение из storage для сайта |
| src/lib/coverGenerator.ts | Обложки: watercolor (новости) / realistic (статьи) |
| scripts/generate-news.ts | Cron-оркестратор pipeline |

## Генератор статей

```
generateTopic() (AI из новостей) → generateArticle() (Qwen3.5-Plus) → generateCover() → publishArticle() → content/blog/{slug}.mdx
```

| Файл | Описание |
|------|----------|
| src/services/articles/topicGenerator.ts | AI генерирует тему из свежих новостей |
| src/services/articles/generator.ts | Генерация текста через Qwen3.5-Plus |
| src/services/articles/articlePublisher.ts | Сохранение MDX + обложка |
| scripts/generate-article.ts | Cron-оркестратор + build + pm2 restart |

## Telegram-бот @jckauto_help_bot

Файлы бота: src/bot/

* handlers/start.ts — /start, кнопка «🏠 Главное меню»
* handlers/calculator.ts — калькулятор (Китай/Корея/Япония, 4 возраста)
* handlers/catalog.ts — каталог с фото
* handlers/contact.ts — контакты
* handlers/request.ts — заявка через контакт или текстовый ввод
* handlers/admin.ts — /stats, /broadcast
* store/users.ts — /var/www/jckauto/storage/users.json
* config.ts — ADMIN_IDS = [1664298688, 355285735]

Группа заявок: chat_id -1003706902240

## Ключевые ограничения

* ⚠️ Anthropic API заблокирован с российского IP (403) — AI-обработка только на GitHub Actions runner
* DashScope API (Qwen) — работает с VDS напрямую (Singapore region)
* Бот использует polling, не webhook
* pm2 restart не перечитывает .env.local — только pm2 delete + pm2 start

## Контакты компании (src/lib/constants.ts)

* Telegram: https://t.me/jck_auto_manager
* WhatsApp: https://wa.me/79147321950
* Phone: +7 (914) 732-19-50
* YouTube: https://youtube.com/@JCK_AUTO
* Бот: @jckauto_help_bot

## Где искать логику — навигатор по проекту

| Задача | Файл |
|--------|------|
| Навигация сайта | src/lib/navigation.ts |
| Расчёт цены (единый движок) | src/lib/calculator.ts |
| Обёртка для бота/скриптов | src/lib/priceCalculator.ts |
| Тарифные данные | src/lib/tariffs.ts |
| Курсы валют ЦБР | src/lib/currencyRates.ts |
| Rate limiter AI | src/lib/rateLimiter.ts |
| DashScope клиент | src/lib/dashscope.ts |
| DeepSeek клиент | src/lib/deepseek.ts |
| Генератор обложек | src/lib/coverGenerator.ts |
| Транслитерация URL | src/lib/transliterate.ts |
| Перелинковка разделов | src/lib/crossLinker.ts |
| Маппинг тегов новостей | src/lib/newsTagColors.ts |
| Выбор обложки каталога | src/lib/catalogSync.ts |
| AI-парсинг скриншотов | src/lib/screenshotParser.ts |
| Заявки с сайта | src/app/api/lead/route.ts |
| API аукционных листов | src/app/api/tools/auction-sheet/route.ts |
| API PDF отчёт | src/app/api/tools/auction-sheet/pdf/route.ts |
| API новости | src/app/api/news/route.ts |
| Команды бота | src/bot/handlers/*.ts |
| Константы/контакты | src/lib/constants.ts |

## Структура сайта

| URL | Описание |
|-----|----------|
| / | Главная |
| /catalog | Каталог авто (ISR 1ч) |
| /catalog/[id] | Страница авто |
| /tools | Хаб сервисов (4 карточки) |
| /tools/calculator | Калькулятор «под ключ» |
| /tools/customs | Калькулятор пошлин (физ/юр) |
| /tools/auction-sheet | AI-расшифровка аукционных листов |
| /tools/encar | Анализатор Encar (заглушка) |
| /calculator | 301 → /tools/calculator |
| /about | О компании |
| /blog | Блог (32+ статей MDX) |
| /blog/[slug] | Статья блога |
| /news | Новости (каталог) |
| /news/[slug] | Новости дня (детальная) |
| /news/tag/[tag] | Фильтр по тегу |
| /api/lead | POST заявка |
| /api/news | GET лента новостей |
| /api/tools/auction-sheet | POST расшифровка |
| /api/tools/auction-sheet/pdf | POST PDF-отчёт |

## Стоимость API

| Сервис | Стоимость | Использование |
|--------|-----------|--------------|
| DeepSeek (новости) | ~$0.002/дайджест | 1 раз/день |
| DashScope Qwen-Image | ~$0.04/обложка | 1-2 раз/день |
| DashScope Qwen3.5-Plus Text | ~$0.01/статья | 1 раз/день |
| DashScope Qwen3.5-Plus Vision | ~$0.002/расшифровка | По запросу пользователя |
| PDFKit | Бесплатно | Server-side |
| **Итого** | **~$2-3/мес** | При текущей нагрузке |

## Правила таможенного калькулятора (критично)

### Категории возраста

| Возраст | CalcInput.carAge | Примечание |
|---------|------------------|------------|
| 0–2 года (< 3) | under3 | ЕТС от стоимости в EUR |
| 3–5 лет (≤ 5) | 3to5 | ЕТС = объём × ставка × EUR |
| 5–7 лет | 5to7 | Юрлица: пошлина 3-7 лет |
| 7+ лет | over7 | Юрлица: фиксированная ставка |

⚠️ **Граница 5 лет включительно** — авто ровно 5 лет = категория 3to5.

### Льготный утильсбор

Применяется при **обоих** условиях: мощность ≤160 л.с. И объём ≤3000 см³ И personalUse.
Иначе → коммерческая ставка (скачок до ~1,900,000 ₽).

## Логика каталога авто

### Именование файлов в папке авто на Google Drive

| Имя файла | Роль |
|-----------|------|
| 1.jpg | Обложка карточки |
| 2.jpg | Скриншот для AI-парсинга |
| 3.jpg, 4.jpg... | Фото галереи |

### Цепочка синхронизации (5 шагов)

```
Шаг 1 — VDS: sync-catalog.ts → скачивает Drive, пишет catalog.json
Шаг 2 — runner: SCP скачивает catalog.json + скриншоты
Шаг 3 — runner: process-ai-pending.ts → Claude Vision → характеристики
Шаг 3.5 — runner: generate-descriptions.ts → Claude Text → описания
Шаг 4 — runner: SCP загружает catalog.json обратно на VDS
Шаг 5 — VDS: npm run build && pm2 restart jckauto
```

## TODO

### Закрыто
- [x] Калькулятор для Кореи и Японии (единый движок calculator.ts)
- [x] Раздел «Сервисы» — Фазы 0, 1.1, 1.2, 1.3, 3.1, 3.2
- [x] Новостной pipeline (RSS → DeepSeek → обложки → JSON)
- [x] Генератор SEO-статей (topicGenerator → Qwen3.5-Plus → MDX)
- [x] Раздел /news на сайте (каталог + детальная + теги)
- [x] AI-расшифровка аукционных листов

### Текущий приоритет
- [ ] Фаза 4: Анализатор Encar (encarClient.ts + API + фронтенд)
- [ ] Фаза 2: Мониторинг нормативки (check-tariffs.ts + cron)
- [ ] Фаза 5: Финализация (SEO-аудит, мобильная проверка, sitemap)

### Бот
- [ ] Перегенерировать токен бота — засветился в чатах
- [ ] Автопостинг новых авто в канал t.me/jckauto_import_koreya
- [ ] AI-консультант (Claude API + база знаний)

### Сайт
- [ ] Мобильная адаптивность — полная проверка
- [ ] Добавить изображения к первым 12 статьям блога
- [ ] Регистрация в Yandex.Webmaster и Google Search Console
- [ ] Merge всех веток в main

## Правила работы

1. Не вноси изменения без явного согласования
2. Один промт = одна логическая единица
3. Plan before code — сначала план, потом реализация
4. Все тексты на русском, код на английском
5. Git коммит после каждого шага
6. Не скачивай и не распознавай повторно то что уже есть локально
7. Если ошибка не решается со второго раза — предложи 3 варианта
