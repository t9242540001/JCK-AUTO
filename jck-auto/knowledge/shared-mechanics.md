<!--
  @file:        knowledge/shared-mechanics.md
  @project:     JCK AUTO
  @description: Reusable mechanics: rate limiter, Telegram auth, TelegramAuthBlock, BetaBadge, PDF, design system
  @updated:     2026-04-10
  @version:     1.1
-->

# Переиспользуемые механики
> Обновлено: 2026-04-10

## Rate Limiter (src/lib/rateLimiter.ts)

Two-mode operation:

**ANONYMOUS mode** (no Telegram auth):
- Key: `ip:{ip}` in ipMap
- Limit: 3 requests TOTAL, lifetime — NEVER resets
- Purpose: 3 free evaluations, then must authenticate
- @rule: ip-key records MUST NEVER be deleted — deletion = user gets 3 free tries again

**AUTHENTICATED mode** (has tg_auth JWT cookie):
- Key: `tg:{telegram_id}` in tgMap
- Limit: 10 requests/day, resets every 24h
- AI cooldown: 2 minutes between requests
- Both limits shared across ALL AI tools (auction sheet + Encar combined)

Functions:
- `checkRateLimit(ip, telegramId?)` — returns `{ allowed, remaining, usedCount, resetIn?, isLifetimeLimit? }`
- `recordUsage(ip, telegramId?)` — call AFTER successful response only
- `MAX_ANONYMOUS_REQUESTS = 3` (exported constant — set to 0 for hard auth gate)

Rate limit error messages (in API routes):
- cooldown (remaining > 0): "Подождите немного — запросы принимаются раз в 2 минуты."
- quota exhausted, authenticated: "Дневной лимит запросов исчерпан (10 в день)..."
- quota exhausted, anonymous: "Лимит бесплатных расшифровок исчерпан. Войдите через Telegram..."

## Telegram Auth (src/app/api/auth/telegram/route.ts)

- Endpoint: POST /api/auth/telegram
- Verifies Telegram HMAC-SHA256 (key = SHA256(bot_token))
- Rejects auth_date older than 86400s (replay protection)
- Rate limit: 5 auth attempts per IP per hour
- Saves to /var/www/jckauto/storage/users.json: id, firstName, lastName?, username?,
  registeredAt, lastSeenAt, source (encar|auction|...), webAuthAt
- Returns: httpOnly JWT cookie `tg_auth` (30 days), payload `{ telegramId, firstName }`
- Returns: deep link `https://t.me/jckauto_help_bot?start=web_{source}`

## TelegramAuthBlock (src/components/TelegramAuthBlock.tsx)

Reusable component shown when rate limit is reached on /tools/* pages.
Props: usedCount, maxCount, isLimitReached, source, onAuthSuccess?

States:
1. Limit not reached → counter badge only ("Использовано: X / Y")
2. Limit reached, not agreed → privacy checkbox + "Отметьте согласие..."
3. Limit reached, agreed → Telegram Login Widget (script injected into DOM)
4. Auth success → "Авторизация успешна!", "Открыть в боте" deep link button

Key rules:
- window.onTelegramAuth MUST be set BEFORE script appended to DOM
- Checkbox is disabled after first check (prevents script re-injection)
- useEffect deps: [isLimitReached, privacyAgreed] — widget injected only when both true
- Fallback if widget fails to load: "Открыть бот" direct link button

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
