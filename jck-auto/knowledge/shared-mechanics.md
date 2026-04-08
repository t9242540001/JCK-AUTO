# Переиспользуемые механики
> Обновлено: 2026-04-08

## Rate Limiter (src/lib/rateLimiter.ts)

- 3 запроса/день на IP
- Общий для ВСЕХ AI-инструментов (Encar, аукционные листы)
- In-memory Map с auto-cleanup (24h window)
- Функции: `checkRateLimit(ip)`, `recordUsage(ip)`

## BetaBadge (src/components/BetaBadge.tsx)

- **BETA_MODE = true** — глобальный флаг
- Компонент `BetaBadge` — inline badge «БЕТА» рядом с заголовком
- Компонент `BetaBanner` — тонкая полоска вверху контентной области
- Отключение: `BETA_MODE = false` → все badge и баннеры исчезают
- Используется на всех /tools/* страницах

## PDF генерация

### Шрифты
- `public/fonts/Roboto-Regular.ttf` → зарегистрирован как `Body`
- `public/fonts/Roboto-Bold.ttf` → зарегистрирован как `BodyBold`
- **НЕ использовать** `font('Helvetica')` — кириллица будет мусором

### serverExternalPackages
В `next.config.ts`: `serverExternalPackages: ['pdfkit']`
Без этого PDFKit падает с ENOENT на Helvetica.afm (Turbopack бандлинг).

### Футер PDF
- Кликабельная ссылка «jckauto.ru» (#1e3a8a, BodyBold, 12pt, underline)
- Контакты: `CONTACTS.company | CONTACTS.phone | CONTACTS.telegramHandle`
- Слоган: «Импорт автомобилей из Китая, Кореи и Японии»
- `doc.fillColor('black')` после цветного URL (сброс цвета)

### Файлы PDF
| Файл | Генерирует |
|------|-----------|
| src/app/api/tools/encar/pdf/route.ts | PDF отчёт Encar |
| src/app/api/tools/auction-sheet/pdf/route.ts | PDF отчёт аукционного листа |

## Дизайн-система

### Цвета
- Primary: `#1E3A5F` (тёмно-синий / navy)
- Secondary: `#C9A84C` (золото)
- Акценты стран: Китай `#DE2910`, Корея `#003478`, Япония `#BC002D`
- Контрастные секции (Footer, ВСК): bg-primary, текст белый

### Шрифты
- **Space Grotesk** — заголовки (`font-heading`)
- **Inter** — основной текст

### Компоненты
- Кнопки: `rounded-xl`, primary/secondary варианты
- Карточки: `rounded-2xl border border-border bg-surface p-6`
- Инпуты: `rounded-xl border border-border bg-white px-4 py-3`

## Контакты (src/lib/constants.ts)

```typescript
CONTACTS = {
  company: "JCK AUTO",
  telegram: "https://t.me/jck_auto_manager",
  telegramHandle: "@jck_auto_manager",
  whatsapp: "https://wa.me/79147321950",
  phone: "+7 (914) 732-19-50",
  phoneRaw: "+79147321950",
}
```

- YouTube: https://youtube.com/@JCK_AUTO
- Telegram-канал: t.me/jckauto_import_koreya
- Бот: @jckauto_help_bot

## Навигация сайта

Единый конфиг: `src/lib/navigation.ts` — `NAV_ITEMS` с поддержкой `children`.
Импортируется в Header (dropdown), MobileMenu (аккордеон), Footer (плоский список).
Пункты: Главная, Каталог, Сервисы (подменю: 4 инструмента), О компании, Блог, Новости.
