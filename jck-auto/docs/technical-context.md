Ты — ведущий разработчик проекта JCK AUTO. Компания импортирует автомобили из Китая, Кореи и Японии в Россию.

## Инфраструктура

- VDS: 94.250.249.104, Ubuntu 24.04, Node v20.20.0
- Рабочая папка: /var/www/jckauto/app/jck-auto
- GitHub: https://github.com/t9242540001/JCK-AUTO
- Ветка сайта: claude/review-project-structure-RtYyX
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
git pull origin claude/review-project-structure-RtYyX
npm run build && pm2 restart jckauto
```

## Стек

* Next.js 15, App Router, TypeScript strict
* Tailwind CSS 4, shadcn/ui, Framer Motion
* node-telegram-bot-api (polling режим)
* Хранилище: JSON-файлы на VDS (/var/www/jckauto/storage/)

## Дизайн-система

* Primary: #1E3A5F (тёмно-синий)
* Secondary: #C9A84C (золото)
* Шрифты: Space Grotesk + Inter
* Акценты стран: Китай #DE2910, Корея #003478, Япония #BC002D

## Telegram-бот @jckauto_help_bot

Файлы бота: src/bot/

* handlers/start.ts — /start, кнопка «🏠 Главное меню»
* handlers/calculator.ts — калькулятор (Китай/Корея/Япония, 4 возраста)
* handlers/catalog.ts — каталог с фото, кнопки «Подробнее» + «🚗 Заказать». При нажатии «Заказать» записывает в pendingSource URL: https://jckauto.ru/catalog/{carId}
* handlers/contact.ts — контакты
* handlers/request.ts — заявка через «Поделиться контактом» или текстовый ввод номера.
   * pendingSource Map<number, string> — хранит URL источника (https://jckauto.ru/catalog/{id} или "Telegram-бот (прямая заявка)")
   * pendingPhone Set<number> — пользователи в ожидании ввода телефона текстом
   * await savePhone() — телефон гарантированно сохраняется до отправки заявки
   * Поле в заявке: 🔗 Источник: вместо 🚘 Автомобиль:
* handlers/admin.ts — /stats, кнопка «📊 Статистика», /broadcast
* store/users.ts — сохранение пользователей в /var/www/jckauto/storage/users.json
* config.ts — ADMIN_IDS = [1664298688, 355285735]

Группа заявок: chat_id -1003706902240
Заявки приходят в формате: имя, username, телефон, 🔗 источник (URL страницы авто или текст)

## Ключевые ограничения

* ⚠️ Anthropic API заблокирован с российского IP (403) — AI-обработка только на GitHub Actions runner
* Бот использует polling, не webhook
* pm2 restart не перечитывает .env.local — только pm2 delete + pm2 start

## Эталонный дисклеймер калькулятора

"* Цена может измениться как в меньшую, так и в большую сторону в зависимости от курса валют и других факторов. Точную стоимость уточняйте у менеджера."

## Контакты компании (src/lib/constants.ts)

* Telegram: https://t.me/jck_auto_manager
* WhatsApp: https://wa.me/79147321950
* Max: https://max.ru/u/f9LHodD0cOLzVgiZtaFsnUXs9xjCpONlBJckZEFrB4uSKvcaySNMCN6ghIA
* Phone: +7 (914) 732-19-50
* YouTube: https://youtube.com/@JCK_AUTO
* Бот: @jckauto_help_bot
* Сайт: jckauto.ru

## Где искать логику — навигатор по проекту

| Задача | Файл | Тег для поиска |
|--------|------|----------------|
| Расчёт цены авто | src/lib/calculator.ts | @section: price-calculation |
| Расчёт таможни | src/lib/priceCalculator.ts | @section: customs |
| Выбор обложки каталога | src/lib/catalogSync.ts | @section: cover-selection |
| Определение скриншота | src/lib/googleDrive.ts | @section: screenshot-detection |
| AI-парсинг скриншотов | src/lib/screenshotParser.ts | @section: ai-parsing |
| Генерация описаний | scripts/generate-descriptions.ts | @section: description-gen |
| Синхронизация с Drive | scripts/sync-catalog.ts | @section: drive-sync |
| Курсы валют ЦБР | src/lib/currency.ts | @section: cbr-rates |
| Заявки с сайта | src/app/api/lead/route.ts | @section: lead-api |
| Команды бота | src/bot/handlers/*.ts | @section: bot-handler |
| Константы/контакты | src/lib/constants.ts | — |
| Пользователи бота | src/bot/store/users.ts | @section: user-store |

## Логика каталога авто (критично знать перед правками)

### Именование файлов в папке авто на Google Drive

| Имя файла | Роль | Как распознаётся |
|-----------|------|------------------|
| 1.jpg / 1.jpeg / 1.png | Обложка карточки | findCoverPhotoIndex() в catalogSync.ts |
| 2.jpg / 2.jpeg / 2.png | Скриншот для AI-парсинга | isScreenshot() в googleDrive.ts |
| 3.jpg, 4.jpg... | Фото галереи | всё остальное → photos[] |

### Цепочка синхронизации каталога (5 шагов)

```
Шаг 1 — VDS: sync-catalog.ts → скачивает Drive, пишет catalog.json (SKIP_BUILD)
Шаг 2 — runner: SCP скачивает catalog.json + скриншоты с VDS
Шаг 3 — runner: process-ai-pending.ts → Claude Vision API → priceRub
Шаг 3.5 — runner: generate-descriptions.ts → Claude Text API → description
Шаг 4 — runner: SCP загружает catalog.json обратно на VDS
Шаг 5 — VDS: npm run build && pm2 restart jckauto
```

⚠️ Claude Vision вызывается ТОЛЬКО на GitHub runner (US IP). С VDS — 403.

### Приоритет выбора скриншота для AI

1. Файл 2.* (любое расширение) — скриншот листинга маркетплейса
2. Файл screenshot.* или содержащий скрин, screen, spec, info
3. Все файлы папки (до 5 штук, сортировка по размеру DESC) — multi-image режим

## Стандарты разметки кода

### Шапка каждого нового файла

```ts
/**
 * @file имя-файла.ts
 * @description Одна строка — что делает этот файл
 * @runs VDS | GitHub Actions runner | browser | bot
 * @triggers cron | GitHub Actions | PM2 | пользователь
 * @input что принимает
 * @output что отдаёт / куда пишет
 * @next следующий файл в цепочке (если есть)
 * @cost стоимость API если есть
 */
```

### Регион-комментарии (файлы >100 строк)

```ts
// ─── TYPES ────────────────────────────────────────────────────────────────
// ─── CONSTANTS ────────────────────────────────────────────────────────────
// ─── HELPERS ──────────────────────────────────────────────────────────────
// ─── MAIN LOGIC ───────────────────────────────────────────────────────────
// ─── EXPORTS ──────────────────────────────────────────────────────────────
```

### Теги-маркеры (grep-ready)

```ts
// @section: cover-selection       — логический блок
// @todo: добавить логику Кореи    — задача
// @bug: jpeg не как jpg           — известная проблема
// @important: не менять без OK    — критичное поведение
// @cost: Claude Vision ~$0.01     — стоимость API
// @calls: src/lib/calculator.ts   — вызываемый файл
// @writes: /storage/catalog.json  — куда пишем
```

### JSDoc на экспортируемых функциях

```ts
/**
 * Краткое описание функции
 * @section имя-секции
 * @input тип и смысл входных данных
 * @output тип и смысл результата
 * @important критичные детали поведения
 */
export function myFunction(...)
```

### Правила для Claude Code

1. Каждый новый файл → шапка @file
2. Каждая экспортируемая функция → JSDoc с @input / @output
3. Файлы >100 строк → регион-комментарии
4. Логические блоки → тег @section
5. Зависимости → @calls / @writes
6. При добавлении новой логики → обновить таблицу "Где искать"

## TODO — что осталось сделать

### Бот

* [ ] Смержить все рабочие ветки в одну (сайт на claude/review-project-structure-RtYyX, бот на claude/analyze-catalog-cover-logic-0IxVK)
* [ ] Перегенерировать токен бота — засветился в чатах
* [ ] Автопостинг новых авто в канал t.me/jckauto_import_koreya
* [ ] AI-консультант (Claude API + база знаний)

### Сайт

* [ ] Калькулятор для Кореи и Японии
* [ ] Мобильная адаптивность — полная проверка
* [ ] Добавить изображения к первым 12 статьям блога
* [ ] Мессенджеры в header и footer
* [ ] Регистрация в Yandex.Webmaster и Google Search Console
* [ ] Merge всех веток в main

## Правила работы

1. Не вноси изменения без явного согласования
2. Один промт = одна логическая единица
3. Plan before code — сначала план, потом реализация
4. Все тексты на русском, код на английском
5. Git коммит после каждого шага
6. Не скачивай и не распознавай повторно то что уже есть локально
7. Если ошибка не решается со второго раза — предложи 3 разных варианта решения
