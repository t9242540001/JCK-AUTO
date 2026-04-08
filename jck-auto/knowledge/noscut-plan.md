<!--
  @file:        knowledge/noscut-plan.md
  @project:     JCK AUTO
  @description: ТЗ на каталог ноускатов — этапы реализации, файлы, порядок промптов
  @updated:     2026-04-08
  @version:     1.0
  @lines:       173
-->

# ТЗ: Каталог ноускатов — план реализации

**Связан с:** `knowledge/noscut-spec.md`

---

## Этапы реализации

### Этап −1 — Починка `/api/lead`
`name` сделать необязательным, добавить поле `subject`. Проверить `TELEGRAM_GROUP_CHAT_ID` в `.env.local`.
**Файл:** `src/app/api/lead/route.ts`
**Критерий:** POST `{phone: "+7..."}` → 200, сообщение в группе.

---

### Этап 0-А — Рефакторинг URL каталога
Перенести `/catalog/[id]` → `/catalog/cars/[id]`, добавить 301-редирект.

**Файлы:**
- `src/app/catalog/[id]/` → `src/app/catalog/cars/[id]/`
- `src/app/catalog/cars/[id]/page.tsx` — canonical: `jckauto.ru/catalog/cars/${id}`
- `src/components/catalog/CarCard.tsx` — `href=/catalog/cars/${car.id}`
- `src/components/sections/CatalogPreview.tsx` — ссылки на карточки
- `src/bot/handlers/catalog.ts` — ссылки на карточки
- `src/lib/crossLinker.ts` — ссылки на авто из статей
- `next.config.ts` — `{ source: '/catalog/:id', destination: '/catalog/cars/:id', permanent: true }`
- `knowledge/architecture.md` — обновить URL-таблицу

**Критерий:** `/catalog/toyota-camry-123` → 301 → `/catalog/cars/toyota-camry-123`. Build OK.

---

### Этап 0-Б — Компонент `LeadForm`
**Файл:** `src/components/LeadForm.tsx`
**Критерий:** рендерится с пропсами, форма отправляет заявку, приходит в группу с полем `source` = значение `subject`.

---

### Этап 1 — Скрипт `research-noscut-models.ts`
**Файл:** `scripts/research-noscut-models.ts`

**Логика:**
1. Seed-список (вшит): Toyota Land Cruiser Prado, Lexus RX, Lexus LX, Lexus NX — попадают всегда
2. DeepSeek + web search: топ импортных авто в России по продажам
3. Фильтр: `yearEnd >= new Date().getFullYear() - 5`
4. Union(seed, research), дедупликация по `slug`
5. Запись в `/storage/noscut/models.json`

**Параллельно:** DeepSeek генерирует `DELIVERY_CITIES` — 5 городов России + 3 столицы СНГ → `src/lib/deliveryConfig.ts` как TypeScript-константа + дисклеймер + «Отправим в любой город».

**Критерий:** `models.json` содержит 80–120 записей без дублей. `deliveryConfig.ts` содержит 8 записей.

---

### Этап 2 — Скрипт `generate-noscut.ts`
**Файл:** `scripts/generate-noscut.ts`

**Логика (инкрементальная — только новые модели):**
1. DeepSeek → текст 80–120 слов: состав → совместимость → срок 30 дней → опт
2. Qwen-Image-2.0-Pro → exploded view изображение конкретной модели
3. Resume-логика: если `/storage/noscut/{slug}.jpg` существует — пропустить генерацию фото
4. `inStock` из `noscut-instock.json`
5. Результат в `noscut-catalog.json`

**Критерий:** все записи `models.json` присутствуют в `noscut-catalog.json` с `image`, `description`, `priceFrom`. Файлы изображений существуют.

---

### Этап 3 — Компоненты ноускатов
- `src/components/noscut/NoscutCard.tsx` — карточка (фото без lightbox, h3, цена, бейдж «В наличии», CTA)
- `src/components/noscut/NoscutGrid.tsx` — сетка 24 карточки + «Показать ещё»
- `src/components/noscut/NoscutDelivery.tsx` — таблица доставки из `deliveryConfig.ts` + дисклеймер
- `src/components/noscut/NoModelFound.tsx` — блок «Не нашли модель?» + Telegram + `LeadForm compact`

**Критерий:** все 4 компонента рендерятся с тестовыми данными.

---

### Этап 4-А — Страница `/catalog/noscut`
**Файл:** `src/app/catalog/noscut/page.tsx`

h1 + подзаголовок-расшифровка для B2C, breadcrumbs, фильтры (марка/страна/сортировка), `NoscutGrid`, `NoModelFound`, sitemap, SEO.

**Критерий:** страница открывается, карточки отображаются, пагинация работает.

---

### Этап 4-Б — Карточка `/catalog/noscut/[slug]`
**Файл:** `src/app/catalog/noscut/[slug]/page.tsx`

Breadcrumbs, фото среднего размера, h1, состав комплекта, совместимость + VIN-дисклеймер, блок цены (+ сравнение если есть `marketPriceRu`), срок ~30 дней prominently, `NoscutDelivery`, `LeadForm` с subject, вторичная CTA для СТО, trust-блок, `NoModelFound`, JSON-LD Product, canonical, OG.

**Критерий:** карточка открывается по slug, все блоки рендерятся, форма работает.

---

### Этап 5 — Хаб `/catalog` + блок на главной
- `src/app/catalog/page.tsx` — плашки категорий вверху (авто + ноускаты), существующее без изменений
- `src/app/page.tsx` — секция 4–6 карточек ноускатов после блока авто, CTA «Смотреть все →`/catalog/noscut`»

**Критерий:** хаб показывает категории, главная — блок ноускатов.

---

### Этап 6 — `update-noscut-prices.ts` + cron
**Файл:** `scripts/update-noscut-prices.ts`

Web search → DeepSeek агрегирует цены (Авито, Дром, exist.ru) → медиана → `marketPriceRu`. Если источников < 2 — поле `null`.

**Cron** (воскресенье 10:00 MSK):
`0 7 * * 0 cd /var/www/jckauto/app/jck-auto && npx tsx -r dotenv/config scripts/update-noscut-prices.ts dotenv_config_path=.env.local >> /var/log/jckauto-noscut-prices.log 2>&1`

**Критерий:** после первого запуска ≥60% моделей имеют `marketPriceRu`.

---

## Полный список файлов

### Новые
| Файл | Этап |
|------|------|
| `src/components/LeadForm.tsx` | 0-Б |
| `src/lib/deliveryConfig.ts` | 1 (генерируется скриптом) |
| `src/components/noscut/NoscutCard.tsx` | 3 |
| `src/components/noscut/NoscutGrid.tsx` | 3 |
| `src/components/noscut/NoscutDelivery.tsx` | 3 |
| `src/components/noscut/NoModelFound.tsx` | 3 |
| `src/app/catalog/noscut/page.tsx` | 4-А |
| `src/app/catalog/noscut/[slug]/page.tsx` | 4-Б |
| `scripts/research-noscut-models.ts` | 1 |
| `scripts/generate-noscut.ts` | 2 |
| `scripts/update-noscut-prices.ts` | 6 |
| `storage/noscut/noscut-instock.json` | 2 |

### Изменяемые
| Файл | Этап | Что меняется |
|------|------|--------------|
| `src/app/api/lead/route.ts` | −1 | `name` необязателен, добавлен `subject` |
| `src/app/catalog/[id]/` | 0-А | Перемещается в `catalog/cars/[id]/` |
| `src/components/catalog/CarCard.tsx` | 0-А | href на `/catalog/cars/` |
| `src/components/sections/CatalogPreview.tsx` | 0-А | href на `/catalog/cars/` |
| `src/bot/handlers/catalog.ts` | 0-А | href на `/catalog/cars/` |
| `src/lib/crossLinker.ts` | 0-А | href на `/catalog/cars/` |
| `next.config.ts` | 0-А | 301 redirect |
| `src/app/catalog/page.tsx` | 5 | Плашки категорий |
| `src/app/page.tsx` | 5 | Блок ноускатов |

---

## Порядок промптов
```
Промпт 1  — Этап −1:  Починка /api/lead
Промпт 2  — Этап 0-А: Рефакторинг URL каталога
Промпт 3  — Этап 0-Б: Компонент LeadForm
Промпт 4  — Этап 1:   research-noscut-models.ts + deliveryConfig.ts
Промпт 5  — Этап 2:   generate-noscut.ts
Промпт 6  — Этап 3:   4 компонента носкатов
Промпт 7  — Этап 4-А: Страница /catalog/noscut
Промпт 8  — Этап 4-Б: Карточка /catalog/noscut/[slug]
Промпт 9  — Этап 5:   Хаб /catalog + блок на главной
Промпт 10 — Этап 6:   update-noscut-prices.ts + cron
```

Каждый промпт — один commit, независимо проверяем перед следующим.
