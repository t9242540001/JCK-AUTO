# Архитектура — навигатор по файлам и URL
> Обновлено: 2026-04-08

## Навигатор по файлам

| Задача | Файл |
|--------|------|
| Навигация сайта | src/lib/navigation.ts |
| Расчёт цены (единый движок) | src/lib/calculator.ts |
| Тарифные данные | src/lib/tariffs.ts |
| Курсы валют (VTB + CBR fallback) | src/lib/currencyRates.ts |
| VTB rate scraper (sravni.ru) | src/lib/vtbRatesScraper.ts |
| Обёртка для бота/скриптов | src/lib/priceCalculator.ts |
| Rate limiter AI-инструментов | src/lib/rateLimiter.ts |
| DashScope клиент (Qwen) | src/lib/dashscope.ts |
| DeepSeek клиент | src/lib/deepseek.ts |
| Encar API клиент | src/lib/encarClient.ts |
| Генератор обложек | src/lib/coverGenerator.ts |
| Транслитерация URL | src/lib/transliterate.ts |
| Перелинковка разделов | src/lib/crossLinker.ts |
| Маппинг тегов новостей | src/lib/newsTagColors.ts |
| Синхронизация каталога | src/lib/catalogSync.ts |
| AI-парсинг скриншотов | src/lib/screenshotParser.ts |
| Константы / контакты | src/lib/constants.ts |
| Калькулятор (shared UI) | src/components/calculator/CalculatorCore.tsx |
| Beta badge система | src/components/BetaBadge.tsx |
| API: заявки | src/app/api/lead/route.ts |
| API: курсы валют | src/app/api/exchange-rates/route.ts |
| API: Encar анализ | src/app/api/tools/encar/route.ts |
| API: Encar PDF | src/app/api/tools/encar/pdf/route.ts |
| API: аукционные листы | src/app/api/tools/auction-sheet/route.ts |
| API: аукционные листы PDF | src/app/api/tools/auction-sheet/pdf/route.ts |
| API: новости | src/app/api/news/route.ts |
| Бот: обработчики | src/bot/handlers/*.ts |
| Бот: хранилище пользователей | src/bot/store/users.ts |

## URL-структура сайта

| URL | Описание |
|-----|----------|
| `/` | Главная (Hero → Countries → HowItWorks → Calculator → Values → Warranty → FAQ → CTA) |
| `/catalog` | Каталог авто (ISR 1ч) |
| `/catalog/[id]` | Страница авто |
| `/tools` | Хаб сервисов (4 карточки) |
| `/tools/calculator` | Калькулятор «под ключ» |
| `/tools/customs` | Калькулятор пошлин (физ/юр) |
| `/tools/auction-sheet` | AI-расшифровка аукционных листов |
| `/tools/encar` | Анализатор Encar.com |
| `/calculator` | 301 → /tools/calculator |
| `/about` | О компании |
| `/blog` | Блог (32+ MDX статей) |
| `/blog/[slug]` | Статья блога |
| `/news` | Новости (каталог) |
| `/news/[slug]` | Новость дня |
| `/news/tag/[tag]` | Фильтр по тегу |

## Ключевые связи модулей

```
CalculatorCore.tsx ──→ /api/exchange-rates ──→ currencyRates.ts ──→ vtbRatesScraper.ts (sravni.ru)
                                                                  └──→ CBR API (fallback)
                   ──→ calculator.ts ──→ tariffs.ts

CustomsClient.tsx ──→ /api/exchange-rates (тот же endpoint)
                  ──→ calculator.ts (buyerType: individual + company)

EncarClient.tsx ──→ /api/tools/encar ──→ encarClient.ts ──→ Encar API
                                       ├──→ deepseek.ts (мощность + перевод)
                                       └──→ calculator.ts (расчёт стоимости)

Bot /calc ──→ fetchCBRRates() (напрямую, server-side)
           └──→ calculator.ts

News: rssParser → collector → processor (DeepSeek) → coverGenerator (DashScope) → publisher
```
