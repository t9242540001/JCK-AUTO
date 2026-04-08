# Курсы валют — VTB scraper + CBR fallback
> Обновлено: 2026-04-08

## Архитектура

```
Клиентские компоненты ──→ /api/exchange-rates (GET) ──→ fetchCBRRates()
                                                          ├──→ vtbRatesScraper.ts (sravni.ru, 5 валют параллельно)
                                                          └──→ CBR API (fallback с markup)

Бот ──→ fetchCBRRates() (напрямую, server-side, без CORS)
```

## Файлы

| Файл | Роль |
|------|------|
| src/lib/vtbRatesScraper.ts | Парсер VTB sell rate из __NEXT_DATA__ на sravni.ru |
| src/lib/currencyRates.ts | Оркестратор: VTB → CBR fallback → кэш 6ч |
| src/app/api/exchange-rates/route.ts | GET endpoint для клиентских компонентов |
| src/components/calculator/CalculatorCore.tsx | Потребитель (через /api/exchange-rates) |
| src/app/tools/customs/CustomsClient.tsx | Потребитель (через /api/exchange-rates) |
| src/bot/handlers/calculator.ts | Потребитель (fetchCBRRates напрямую) |

## Как работает scraper

1. Fetch `https://www.sravni.ru/bank/vtb/valjuty/{currency}` (8s timeout)
2. Извлечь `<script id="__NEXT_DATA__">` → JSON.parse
3. Рекурсивно собрать ВСЕ массивы `rates[]` (один на ветку банка)
4. Фильтр: `entry.currency === target` (case-sensitive: 'USD', 'EUR', 'CNY', 'JPY', 'KRW')
5. Сортировка по `updateDate` desc → взять самый свежий `sell`
6. KRW: массив пуст → no-data (тихо) → fallback CBR + 5%

## Fallback markups (env-переменные)

| Валюта | Переменная | Дефолт |
|--------|-----------|--------|
| USD | EXCHANGE_MARKUP_USD | 3.0% |
| EUR | EXCHANGE_MARKUP_EUR | 3.0% |
| CNY | EXCHANGE_MARKUP_CNY | 4.5% |
| JPY | EXCHANGE_MARKUP_JPY | 7.0% |
| KRW | EXCHANGE_MARKUP_KRW | 5.0% |

## Критические правила

1. **Возвращённые курсы УЖЕ включают наценку** — НЕ умножать на дополнительные коэффициенты
2. **Клиентские компоненты** → fetch `/api/exchange-rates`. НЕ импортировать fetchCBRRates (CORS с sravni.ru)
3. **Бот** → fetchCBRRates() напрямую (server-side, CORS нет)
4. **Два режима ошибки:** no-data (тихий, для KRW) и error (console.warn, для сбоев)
5. **Никаких if по имени валюты** в scraper/currencyRates — все 5 валют через единый путь
6. **Кэш:** 6 часов in-memory. PM2 restart = холодный старт (первый запрос триггерит 5 scrapers)

## UI-лейблы

- Показывать: **«Ориентировочный курс: 1 CNY ≈ 11.89 ₽»** (НЕ «Курс ЦБ РФ»)
- KRW: 4 знака после запятой (`0.0548`), остальные: 2 знака
- Дисклеймер: «Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки — он зависит от дня сделки и канала перевода.»

## Имя функции fetchCBRRates — legacy

Имя сохранено для обратной совместимости (19 import sites). Фактически возвращает VTB rates / CBR+markup.
