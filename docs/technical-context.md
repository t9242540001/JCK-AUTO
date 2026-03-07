# JCK AUTO — Технический контекст проекта

> Документация для разработчиков и AI-ассистентов.
> Последнее обновление: 2026-03-06

---

## 1. Общее описание

**JCK AUTO** — корпоративный сайт компании по импорту автомобилей из Китая, Кореи и Японии.
Светлая чистая тема, premium feel, mobile-first. Акценты: темно-синий (#1E3A5F) + золото (#C9A84C).

- **Домен:** jckauto.ru
- **Хостинг:** VDS (self-hosted), Next.js запущен через PM2
- **Каталог:** авто из Google Drive, данные парсятся AI (Claude Vision)
- **Блог:** MDX-файлы в `content/blog/`

---

## 2. Технологический стек

| Категория | Технология | Версия |
|-----------|-----------|--------|
| Фреймворк | Next.js (App Router) | 16.1.6 |
| Язык | TypeScript (strict) | 5.x |
| UI | Tailwind CSS | 4.x |
| Компоненты | shadcn/ui (Radix UI) | — |
| Анимации | Framer Motion | 12.x |
| AI | Anthropic SDK (Claude Vision + Claude Sonnet) | 0.74.x |
| Хранилище | Google Drive API (googleapis) | 171.x |
| Блог | MDX (next-mdx-remote + gray-matter) | 6.x |
| Формы | react-hook-form + zod | 7.x / 4.x |
| Иконки | lucide-react | 0.563.x |
| Шрифты | Inter (body), Space Grotesk (headings) | fontsource |
| Процесс-менеджер | PM2 | — |

---

## 3. Структура проекта

```
JCK-AUTO/
├── docs/                          # Документация проекта
├── jck-auto/                      # Основное Next.js приложение
│   ├── content/blog/              # MDX-статьи блога (14 файлов)
│   ├── public/images/             # Статические изображения
│   ├── scripts/                   # CLI-скрипты для VDS
│   │   ├── sync-catalog.ts        # Синхронизация каталога с Google Drive
│   │   ├── process-ai-pending.ts  # Допарсинг авто с needsAiProcessing
│   │   ├── fix-ai-pending.ts      # Фикс для зависших AI-записей
│   │   ├── diagnose-photos.ts     # Аудит фото в каталоге
│   │   ├── fix-photo-order.ts     # Фикс порядка фото для 14 авто
│   │   ├── remove-cars.ts         # Удаление авто из каталога
│   │   ├── process-car-images.ts  # Обработка изображений
│   │   └── test-calculator.ts     # Тест калькулятора растаможки
│   ├── src/
│   │   ├── app/                   # Страницы (App Router)
│   │   │   ├── page.tsx           # Главная (9 секций)
│   │   │   ├── about/             # О компании
│   │   │   ├── blog/              # Блог (список + [slug])
│   │   │   ├── calculator/        # Калькулятор растаможки
│   │   │   ├── catalog/           # Каталог (список + [id])
│   │   │   ├── privacy/           # Политика конфиденциальности
│   │   │   ├── terms/             # Условия использования
│   │   │   └── api/catalog/       # API-эндпоинты каталога
│   │   ├── components/
│   │   │   ├── catalog/           # Компоненты каталога
│   │   │   ├── layout/            # Header, Footer, MobileMenu, JsonLd
│   │   │   ├── sections/          # Секции главной страницы
│   │   │   └── ui/                # shadcn/ui (button, card, dialog, etc.)
│   │   ├── data/                  # Статические данные
│   │   │   ├── mockCars.ts        # Заглушка каталога для dev
│   │   │   ├── faq.ts             # Вопросы-ответы
│   │   │   └── testimonials.ts    # Отзывы клиентов
│   │   ├── lib/                   # Бизнес-логика и утилиты
│   │   └── types/                 # TypeScript типы
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── tsconfig.json
├── plan.md                        # SEO-план (аудит + задачи)
└── README.md
```

---

## 4. Серверная архитектура (VDS)

```
/var/www/jckauto/
├── storage/
│   └── catalog/
│       ├── catalog.json              # Основная БД каталога (массив Car[])
│       └── {car-slug}/              # Папка с фото каждого авто
│           ├── 1.jpg                # Обложка
│           ├── 2.png                # Скриншот (не в галерее)
│           ├── 3.jpg                # Фото галереи
│           └── ...
├── .env.local                       # Переменные окружения
├── package.json
└── ... (Next.js build output)
```

**PM2-процесс:** `pm2 restart jckauto`

**Типичный workflow после изменений:**
```bash
cd /var/www/jckauto
npm run build && pm2 restart jckauto
```

---

## 5. Модули `src/lib/`

### blobStorage.ts
Чтение/запись каталога и фото на диск VDS.
- `readCatalogJson()` — читает `/var/www/jckauto/storage/catalog/catalog.json`
- `writeCatalogJson(cars)` — записывает каталог
- `uploadCarPhoto(slug, fileName, buffer, mime)` — сохраняет фото, возвращает URL
- `deleteCarPhotos(slug)` — удаляет папку с фото
- `getCarPhotoUrls(slug)` — список URL фото из папки

### googleDrive.ts
Интеграция с Google Drive API (read-only).
- `listCarFolders()` — список папок-авто в корневой папке Drive
- `listFolderFiles(folderId)` — файлы в папке, разделённые на `screenshots` и `photos`
- `downloadFile(fileId)` — скачивание файла как Buffer
- `isScreenshot(name)` — определение скриншота по имени файла (2.*, screen*, spec*, etc.)

### catalogSync.ts
Главная логика синхронизации каталога.
- `syncCatalog()` — полный цикл: Drive → AI парсинг → сохранение
- `findCoverPhotoIndex(files)` — поиск обложки по ключевым словам (1, front, cover, обложка)
- Дедупликация по slug: `generateSlug(folderName)`
- Лимит: `MAX_NEW_PER_RUN = 10` новых авто за запуск

### screenshotParser.ts
Парсинг скриншотов маркетплейсов через Claude Vision.
- Принимает Buffer скриншота, возвращает `Partial<Car>`
- Извлекает: бренд, модель, год, цену, пробег, характеристики
- При недоступности API ставит `needsAiProcessing: true`

### descriptionGenerator.ts
Генерация описаний через Claude Sonnet.
- `generateCarDescription(car)` — вызывает Anthropic API
- При ошибке — fallback на шаблонное описание

### priceCalculator.ts
Калькулятор полной стоимости авто из Китая.
5 шагов расчёта:
1. Стоимость авто + логистика в Китае (+16,000 CNY)
2. Перевод в рубли (курс ЦБ × 1.02)
3. Таможня: оформление + ЕТС + утилизационный сбор
4. Расходы в РФ: СБКТС, СВХ, брокер, логистика (100,000 ₽)
5. Комиссия JCK AUTO (50,000 ₽)

### currency.ts
Получение курсов ЦБ РФ.
- `fetchCBRRates()` — курсы EUR, CNY, KRW, JPY с cbr-xml-daily.ru
- Fallback-значения при недоступности ЦБ

### calculator-data.ts
Справочные таблицы для калькулятора: ЕТС, утильсбор, таможенные сборы.

### blog.ts
Работа с MDX-статьями.
- `getAllPosts()` — все статьи из `content/blog/`, сортировка по дате
- `getPostBySlug(slug)` — конкретная статья

### carUtils.ts
Утилиты для работы с данными авто.
- `generateSlug(folderName)` — slug из имени папки (lowercase, пробелы→дефисы, только a-z0-9-)
- `formatPrice(price, currency)` — форматирование цены с символом валюты
- `getCountryLabel/Flag/Genitive(country)` — локализация стран
- `cleanBrand(brand)` — удаление префикса "Used"

### config.ts
Доступ к env-переменным:
- `GOOGLE_SERVICE_ACCOUNT_KEY` — JSON ключ сервисного аккаунта Google
- `GOOGLE_DRIVE_FOLDER_ID` — ID корневой папки Drive
- `ANTHROPIC_API_KEY` — ключ API Anthropic

### constants.ts
Контактные данные компании: телефон, Telegram, YouTube.

### utils.ts
Общие утилиты (cn для Tailwind classnames).

---

## 6. API-эндпоинты

| Эндпоинт | Метод | Назначение |
|----------|-------|-----------|
| `/api/catalog` | GET | Список всех авто (JSON). Revalidate: 1 час |
| `/api/catalog/sync` | GET/POST | Запуск полной синхронизации. GET — для Vercel Cron (CRON_SECRET). POST — ручной (CATALOG_SYNC_SECRET) |
| `/api/catalog/sync-manual` | POST | Ручной запуск синхронизации (production: CATALOG_SYNC_SECRET) |
| `/api/catalog/resync-photos` | POST | Пересинхронизация фото для всех авто с Google Drive (CATALOG_SYNC_SECRET) |

---

## 7. Типы данных

### Car (src/types/car.ts)

```typescript
interface Car {
  id: string;                  // slug из имени папки Drive
  folderName: string;          // оригинальное имя папки
  brand: string;
  model: string;
  year: number;
  price: number;               // цена в оригинальной валюте
  currency: "CNY" | "KRW" | "JPY";
  country: "china" | "korea" | "japan";
  mileage: number;             // км
  engineVolume: number;        // литры
  transmission: "AT" | "MT";
  drivetrain: string;          // 2WD, 4WD, AWD
  fuelType: string;
  color: string;
  power: number;               // л.с.
  bodyType: string;
  photos: string[];            // URL-пути: /storage/catalog/{slug}/{file}
  features: string[];
  condition: string;
  location: string;
  isNativeMileage: boolean;
  hasInspectionReport: boolean;
  description?: string;        // AI-сгенерированное описание
  needsAiProcessing?: boolean; // true = ждёт допарсинга
  priceRub?: number;           // итоговая цена в рублях
  exchangeRate?: number;
  priceCalculatedAt?: string;  // ISO date
  priceBreakdown?: {
    carPriceRub: number;
    customsFee: number;
    customsDuty: number;
    recyclingFee: number;
    deliveryCost: number;
    serviceFee: number;
  };
  createdAt: string;           // ISO date
}
```

---

## 8. Логика синхронизации каталога

### Полный цикл (`syncCatalog()`)

1. Получить список папок с Google Drive
2. Загрузить текущий `catalog.json`
3. Сравнить по slug → определить новые, удалённые, существующие
4. Для каждой новой папки (макс. 10 за запуск):
   a. Найти скриншот (файл `2.*` или fallback)
   b. Скачать и распарсить через Claude Vision → характеристики
   c. Сгенерировать описание через Claude Sonnet
   d. Скачать и сохранить фото (обложка `1.*` первой, остальные по алфавиту)
   e. Рассчитать цену в рублях по курсу ЦБ
5. Re-sync фото для авто с `needsAiProcessing=true`
6. Удалить авто, чьих папок нет на Drive
7. Пересчитать устаревшие цены (>24 часа)
8. Сохранить `catalog.json`

### Дедупликация

- Ключ: `car.id === generateSlug(folder.name)`
- Существующие авто **пропускаются** (кроме re-sync при needsAiProcessing)
- Нет защиты от concurrent запуска (no file lock)

### Порядок фото

- Файл `1.*` → обложка (`photos[0]`)
- Файл `2.*` → скриншот, **не попадает в photos[]**
- Остальные → по алфавиту

---

## 9. Компоненты каталога

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| CatalogClient | catalog/CatalogClient.tsx | Обёртка с фильтрами и сеткой (client) |
| CatalogFilters | catalog/CatalogFilters.tsx | Фильтры: страна, бренд, цена, год |
| CarGrid | catalog/CarGrid.tsx | Сетка карточек с анимацией |
| CarCard | catalog/CarCard.tsx | Карточка авто (фото, цена, характеристики) |
| CarGallery | catalog/CarGallery.tsx | Галерея фото на странице авто |
| CarSpecs | catalog/CarSpecs.tsx | Таблица характеристик |
| CarTrustBlock | catalog/CarTrustBlock.tsx | Блок доверия (гарантия, проверка) |

---

## 10. Секции главной страницы

| # | Компонент | Описание |
|---|-----------|---------|
| 1 | Hero | Главный баннер с CTA |
| 2 | Countries | Три страны: Китай, Корея, Япония |
| 3 | HowItWorks | Этапы работы (5 шагов) |
| 4 | CatalogPreview | Превью каталога |
| 5 | Calculator | Мини-калькулятор стоимости |
| 6 | Values | Ценности компании |
| 7 | Warranty | Гарантия ВСК |
| 8 | Testimonials | Отзывы клиентов |
| 9 | FAQ | Частые вопросы |
| 10 | ContactCTA | CTA с контактами |
| 11 | SocialFollow | Соцсети (Telegram, YouTube) |

---

## 11. Layout-компоненты

| Компонент | Файл | Описание |
|-----------|------|---------|
| Header | layout/Header.tsx | Навигация + кнопка Telegram |
| Footer | layout/Footer.tsx | Футер с контактами и ссылками |
| MobileMenu | layout/MobileMenu.tsx | Мобильное меню (Sheet) |
| JsonLd | layout/JsonLd.tsx | Structured data (Organization, WebSite) |
| FloatingCTA | layout/FloatingCTA.tsx | Плавающая кнопка CTA |
| TelegramWidget | layout/TelegramWidget.tsx | Виджет Telegram |
| YandexMetrika | layout/YandexMetrika.tsx | Яндекс.Метрика |

---

## 12. Блог

- **Формат:** MDX-файлы в `content/blog/`
- **Frontmatter:** title, description, date, author, country, image, tags
- **14 статей** на темы: растаможка, импорт, обзоры, гарантия, СБКТС/ЭПТС
- **Рендеринг:** next-mdx-remote, reading-time для оценки времени чтения
- **Страницы:** `/blog` (список) и `/blog/[slug]` (статья)

---

## 13. Переменные окружения

```env
# Обязательные
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=1abc...
ANTHROPIC_API_KEY=sk-ant-...

# Опциональные
CATALOG_SYNC_SECRET=...          # Bearer-токен для API синхронизации
CRON_SECRET=...                  # Для Vercel Cron
SKIP_BUILD=true                  # Пропустить build после sync
```

---

## 14. npm-скрипты

| Скрипт | Команда | Описание |
|--------|---------|---------|
| `dev` | `next dev` | Dev-сервер |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Проверка кода |
| `sync-catalog` | `tsx scripts/sync-catalog.ts` | Синхронизация каталога |
| `fix-pending` | `tsx scripts/fix-ai-pending.ts` | Фикс зависших AI-записей |
| `process-pending` | `tsx scripts/process-ai-pending.ts` | Допарсинг AI-записей |

---

## 15. Цветовая палитра (Tailwind custom colors)

| Токен | Цвет | Использование |
|-------|------|-------------|
| background | #FFFFFF | Фон страниц |
| surface | #F8F9FA | Фон секций |
| surface-alt | #F1F3F5 | Альтернативный фон |
| border | #E5E7EB | Границы |
| primary | #1E3A5F | Основной (темно-синий) |
| primary-hover | #2A4A73 | Hover состояние |
| secondary | #C9A84C | Акцент (золото) |
| secondary-hover | #D4B85A | Hover состояние |
| text | #111827 | Основной текст |
| text-muted | #6B7280 | Вторичный текст |
| china | #DE2910 | Флаг Китая |
| korea | #003478 | Флаг Кореи |
| japan | #BC002D | Флаг Японии |

**Шрифты:**
- Body: `Inter` (var --font-inter)
- Headings: `Space Grotesk` (var --font-space-grotesk)

---

## 16. Стандарты разметки кода

### Общие правила
- **TypeScript strict** для всех файлов
- **Только Tailwind CSS** (без inline-стилей и CSS-модулей)
- Компоненты именуются в **PascalCase**
- Все страницы **мобильно-адаптивные** (mobile-first)
- **Framer Motion** для анимаций (scroll-triggered)
- Минимум зависимостей, максимум производительности

### Секционные метки в коде

Для навигации по длинным файлам используются комментарии-метки:
```typescript
// @section: cover-selection
// @section: screenshot-detection
// @todo: описание задачи
```

### Структура компонентов
```
src/components/
├── catalog/    # Компоненты каталога (CarCard, CarGallery, etc.)
├── layout/     # Layout (Header, Footer, MobileMenu, JsonLd)
├── sections/   # Секции главной страницы (Hero, FAQ, etc.)
└── ui/         # shadcn/ui базовые компоненты (Button, Card, Dialog, etc.)
```

### Правила для API routes
- Защита Bearer-токеном (`CATALOG_SYNC_SECRET` / `CRON_SECRET`)
- `maxDuration = 300` для тяжёлых операций (sync)
- `revalidate` для кэширования (3600 = 1 час)
- Обязательный error handling с логированием в `console.error`

### Правила для скриптов (scripts/)
- Формат: TypeScript, запуск через `tsx -r tsconfig-paths/register`
- Используют абсолютные пути из `@/` благодаря tsconfig-paths
- Standalone — не зависят от running Next.js server
- Обязательный `process.exit(1)` при ошибках
