# JCK AUTO — Инструкция для Claude Code
> Обновлено: 01.03.2026
> Этот файл читается автоматически при каждом запуске Claude Code.
> Синхронизирован с техническим контекстом проекта (jck-auto-technical-context.md).

---

## О проекте

JCK AUTO — компания по импорту автомобилей из Китая, Кореи и Японии в Россию.
Сайт: https://jckauto.ru

---

## Инфраструктура

- **VDS:** 94.250.249.104, Ubuntu 24.04, Node v20.20.0
- **Рабочая папка:** `/var/www/jckauto/app/jck-auto`
- **GitHub:** https://github.com/t9242540001/JCK-AUTO
- **Рабочая ветка:** `claude/review-project-structure-RtYyX`
- **Хранилище каталога:** `/var/www/jckauto/storage/catalog/`
- **Пользователи бота:** `/var/www/jckauto/storage/users.json`

---

## Деплой

### Сайт
```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/review-project-structure-RtYyX
npm run build && pm2 restart jckauto
```

### Бот (ВАЖНО — только так, иначе env не подхватывается)
```bash
cd /var/www/jckauto/app/jck-auto
git pull origin claude/review-project-structure-RtYyX
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```

---

## Стек

- Next.js 15, App Router, TypeScript strict
- Tailwind CSS 4, shadcn/ui, Framer Motion
- node-telegram-bot-api (polling режим)
- Хранилище: JSON-файлы на VDS

---

## Дизайн-система

- Primary: #1E3A5F (тёмно-синий)
- Secondary: #C9A84C (золото)
- Шрифты: Space Grotesk + Inter
- Акценты стран: Китай #DE2910, Корея #003478, Япония #BC002D
- Контрастные секции (Footer, ВСК): bg-primary, текст белый

---

## Ключевые ограничения

- ⚠️ **Anthropic API заблокирован с российского IP (403)** — AI-обработка ТОЛЬКО на GitHub Actions runner (US IP). С VDS напрямую не вызывать.
- Бот работает в режиме **polling**, не webhook
- `pm2 restart` не перечитывает `.env.local` — только `pm2 delete` + `pm2 start`

---

## Где искать логику — навигатор по проекту

| Задача | Файл | Тег для поиска |
|--------|------|----------------|
| Расчёт цены авто | `src/lib/calculator.ts` | `@section: price-calculation` |
| Расчёт таможни | `src/lib/priceCalculator.ts` | `@section: customs` |
| Выбор обложки каталога | `src/lib/catalogSync.ts` | `@section: cover-selection` |
| Определение скриншота | `src/lib/googleDrive.ts` | `@section: screenshot-detection` |
| AI-парсинг скриншотов | `src/lib/screenshotParser.ts` | `@section: ai-parsing` |
| Генерация описаний | `scripts/generate-descriptions.ts` | `@section: description-gen` |
| Синхронизация с Drive | `scripts/sync-catalog.ts` | `@section: drive-sync` |
| Курсы валют ЦБР | `src/lib/currency.ts` | `@section: cbr-rates` |
| Заявки с сайта | `src/app/api/lead/route.ts` | `@section: lead-api` |
| Команды бота | `src/bot/handlers/*.ts` | `@section: bot-handler` |
| Константы/контакты | `src/lib/constants.ts` | — |
| Пользователи бота | `src/bot/store/users.ts` | `@section: user-store` |

---

## Логика каталога авто

### Именование файлов в папке авто на Google Drive

| Имя файла | Роль | Как распознаётся |
|-----------|------|-----------------|
| `1.jpg` / `1.jpeg` / `1.png` | **Обложка** карточки | `findCoverPhotoIndex()` в catalogSync.ts |
| `2.jpg` / `2.jpeg` / `2.png` | **Скриншот** для AI-парсинга (цена, характеристики) | `isScreenshot()` в googleDrive.ts |
| `3.jpg`, `4.jpg`... | Фото **галереи** | всё остальное → photos[] |
| `front*.jpg` / `cover*.jpg` | Альтернативное имя обложки | `findCoverPhotoIndex()` |
| `screen*.png` / `скрин*.png` | Альтернативное имя скриншота | `isScreenshot()` |

**Важно:** расширения `.jpg` и `.jpeg` обрабатываются одинаково — strip-ается всё после последней точки.

### Цепочка синхронизации каталога (5 шагов)

```
Шаг 1 — VDS: sync-catalog.ts
  → скачивает Drive, разделяет на обложку/скриншот/галерею
  → пишет catalog.json (SKIP_BUILD=true, без AI)

Шаг 2 — GitHub runner:
  → SCP скачивает catalog.json + скриншоты с VDS

Шаг 3 — GitHub runner: process-ai-pending.ts
  → Claude Vision API → характеристики авто из скриншота
  → CBR курс → priceRub
  → exit(1) если 0 обработано и есть ошибки

Шаг 3.5 — GitHub runner: generate-descriptions.ts
  → Claude Text API → description (80-150 слов)
  → rate limit: 2 сек между запросами
  → не перезаписывает существующие описания

Шаг 4 — GitHub runner:
  → SCP загружает обновлённый catalog.json обратно на VDS

Шаг 5 — VDS:
  → npm run build && pm2 restart jckauto
```

### Приоритет выбора скриншота для AI-парсинга

1. Файл `2.*` (любое расширение) — @section: screenshot-detection
2. Файл `screenshot.*` или содержащий `скрин`, `screen`, `spec`, `info`
3. Первый файл из screenshots[]
4. Первый PNG среди photos[]
5. Все файлы папки (до 5 штук, сортировка по размеру DESC) — multi-image режим

**Скриншот НЕ попадает в галерею** — исключается из photos[] перед формированием orderedPhotos.

---

## Формула цены «под ключ» (Китай)

```
Шаг 1: totalYuan = priceYuan + 16000 (логистика по Китаю до Уссурийска)
Шаг 2: carValueRub = totalYuan × (CBR_CNY × 1.02)
Шаг 3: customs = customsFee + ETS + recyclingFee
Шаг 4: russiaExpenses = 100,000₽ (СБКТС, СВХ, брокер, логистика)
Шаг 5: commission = 50,000₽ (комиссия JCK AUTO)
ИТОГО: priceRub = carValueRub + customs + russiaExpenses + commission
```

Единый источник формул: `src/lib/calculator.ts` — используется и сайтом, и ботом.

### Правила таможенного калькулятора (критично — не менять без проверки)

#### Категории возраста ЕТС (физлица)

| Возраст | Категория | Примечание |
|---------|-----------|------------|
| 0–2 года (< 3) | under3 | ETS от стоимости в EUR |
| 3–5 лет (**≤ 5**) | 3to5 | ETS = объём × ставка × EUR |
| 6+ лет (> 5) | over5 | ETS = объём × ставка × EUR |

⚠️ **Граница 5 лет включительно** — авто ровно 5 лет = категория 3to5.
Был баг: `years < 5` вместо `years <= 5` — завышение цены ~218,000 ₽ для авто 2021 года.

#### Льготный утильсбор (физлица)

Применяется когда **оба** условия выполнены одновременно:
- Мощность **≤ 160 л.с.** (включительно)
- Объём **≤ 3000 см³ / 3.0L** (включительно)

Если хотя бы одно условие нарушено → коммерческая ставка (скачок до ~1,900,000 ₽).

#### Брекеты ЕТС — логика включения

`findBracket` использует `value <= row[key]` — верхняя граница **включительно**.
Пример: 1500cc → брекет "до 1500" (ставка 1.7), 1501cc → брекет "до 1800" (ставка 2.5).

#### Источник эталонных данных

Таблицы ЕТС, утильсбора и таможенного оформления — в файле:
`Калькулятор_и_полный_справочник_нормативных_данных_для_расчёта_таможенных_платежей.xlsx`
При изменении ставок — сверяй с этим файлом и обновляй `src/lib/calculator-data.ts`.

### Таблица утильсбора (ключевое)

- **Льготный** (≤160 л.с. И ≤3 л): до 3 лет → 3 400 ₽, 3+ лет → 5 200 ₽
- **Коммерческий** (>160 л.с. ИЛИ >3 л): от ~1 млн до ~4 млн руб.

### Эталонный дисклеймер калькулятора

> * Цена может измениться как в меньшую, так и в большую сторону в зависимости от курса валют и других факторов. Точную стоимость уточняйте у менеджера.

---

## Telegram-бот @jckauto_help_bot

| Команда | Файл | Функция |
|---------|------|---------|
| `/start` | `src/bot/handlers/start.ts` | Приветствие + inline-клавиатура |
| `/calc` | `src/bot/handlers/calculator.ts` | Калькулятор (Китай/Корея/Япония, 4 возраста) |
| `/catalog` | `src/bot/handlers/catalog.ts` | 5 авто с фото |
| `/contact` | `src/bot/handlers/contact.ts` | Контакты |
| Заявка | `src/bot/handlers/request.ts` | Сбор → группа менеджеров |
| `/stats` | `src/bot/handlers/admin.ts` | Статистика (только ADMIN_IDS) |

- **ADMIN_IDS:** [1664298688, 355285735] в `src/bot/config.ts`
- **Группа заявок:** chat_id `-1003706902240`
- **Пользователи:** `/var/www/jckauto/storage/users.json`

---

## Контакты (src/lib/constants.ts)

```typescript
CONTACTS = {
  telegram: "https://t.me/jck_auto_manager",
  whatsapp: "https://wa.me/79147321950",
  max: "https://max.ru/u/f9LHodD0cOLzVgiZtaFsnUXs9xjCpONlBJckZEFrB4uSKvcaySNMCN6ghIA",
  phone: "+7 (914) 732-19-50",
  phoneRaw: "+79147321950",
}
```

- YouTube: https://youtube.com/@JCK_AUTO
- Telegram-канал: t.me/jckauto_import_koreya

---

## Структура сайта

| URL | Описание |
|-----|----------|
| `/` | Главная: Hero → Countries → HowItWorks → Calculator → Values → Warranty → Testimonials → FAQ → ContactCTA |
| `/calculator` | Калькулятор растаможки (JSON-LD WebApplication + FAQPage) |
| `/catalog` | Каталог авто (ISR revalidate=3600) |
| `/catalog/[id]` | Страница авто (3 мессенджера, описание, заявка) |
| `/about` | О компании |
| `/blog` | Список статей (32 статьи MDX) |
| `/blog/[slug]` | Статья блога |
| `/api/lead` | POST → заявка в Telegram группу |

---

## Стандарты разметки кода

### Шапка каждого нового файла (обязательно)

```typescript
/**
 * @file имя-файла.ts
 * @description Одна строка — что делает этот файл
 * @runs VDS | GitHub Actions runner | browser | bot
 * @triggers cron | GitHub Actions | PM2 | пользователь
 * @input что принимает на вход
 * @output что отдаёт / куда пишет
 * @next следующий файл в цепочке (если есть)
 * @cost стоимость API-запросов если есть
 */
```

### Регион-комментарии (файлы >100 строк)

```typescript
// ─── TYPES ────────────────────────────────────────────────────────────────
// ─── CONSTANTS ────────────────────────────────────────────────────────────
// ─── HELPERS ──────────────────────────────────────────────────────────────
// ─── MAIN LOGIC ───────────────────────────────────────────────────────────
// ─── EXPORTS ──────────────────────────────────────────────────────────────
```

### Теги-маркеры (grep-ready)

```typescript
// @section: cover-selection       — логический блок
// @todo: описание задачи          — задача к реализации
// @bug: описание проблемы         — известная проблема
// @important: критичное поведение — не менять без согласования
// @cost: Claude Vision ~$0.01     — стоимость API
// @calls: src/lib/calculator.ts   — вызываемый файл
// @writes: /storage/catalog.json  — куда пишем
// @reads: .env.local              — откуда читаем
```

### JSDoc на экспортируемых функциях

```typescript
/**
 * Краткое описание что делает функция
 * @section имя-секции
 * @input тип и смысл входных данных
 * @output тип и смысл результата
 * @important критичные детали поведения
 */
export function myFunction(...) {}
```

### Явные связи между файлами

```typescript
// @calls src/lib/currency.ts → fetchCBRRates()
// @writes /var/www/jckauto/storage/catalog/catalog.json
// @reads .env.local → GOOGLE_DRIVE_FOLDER_ID
```

---

## Правила для Claude Code

1. **Не вноси изменения без явного согласования** — меняй только то, о чём просил пользователь
2. **Один промпт = одна логическая единица** — не добавляй «бонусные» изменения
3. **Plan before code** — сначала план, потом реализация
4. **Все тексты на русском, код на английском**
5. **Git коммит после каждого шага**
6. **Не скачивай и не распознавай повторно** то, что уже есть локально
7. **Если ошибка не решается со второго раза** — предложи 3 разных варианта решения
8. **Каждый новый файл** начинается с шапки `@file`
9. **Каждая экспортируемая функция** имеет JSDoc с `@input` / `@output`
10. **Файлы >100 строк** разбиваются регион-комментариями

---

## Правило экономии API-запросов

1. **Не скачивай повторно** — если файл уже на VDS, работай с локальной копией
2. **Не распознавай повторно** — если данные есть в catalog.json, используй их
3. **Кэшируй результаты** — курсы валют (24ч TTL), распознанные данные (бессрочно)
4. **Сравнивай хеши** перед скачиванием с Google Drive
5. **Приоритет:** локальные данные → кэш → новый API-запрос

---

## TODO — что осталось сделать

### Бот
- [ ] Автопостинг новых авто в канал t.me/jckauto_import_koreya
- [ ] AI-консультант (Claude API + база знаний)
- [ ] Перегенерировать токен бота — засветился в чатах, обновить в .env.local

### Сайт
- [ ] Калькулятор для Кореи и Японии (разная логистика, разные сборы)
- [ ] Мобильная адаптивность — полная проверка всех страниц
- [ ] Добавить изображения к первым 12 статьям блога
- [ ] Мессенджеры в header и footer
- [ ] Регистрация в Yandex.Webmaster и Google Search Console
- [ ] Merge ветки claude/review-project-structure-RtYyX в main
- [ ] Кнопка «Оставить заявку» на странице авто → /api/lead → группа менеджеров
