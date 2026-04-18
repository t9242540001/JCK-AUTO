# Стек технологий
> Обновлено: 2026-04-18

## Фреймворк и рантайм

- **Next.js 16.1.6** — App Router, TypeScript strict (`ignoreBuildErrors: true`), Turbopack default для `next build`, RSC + client components
- **Node.js v20.20.0** — runtime на VDS
- **TypeScript** — strict mode, ignoreBuildErrors: true в next.config.ts

## Стилизация

- **Tailwind CSS 4** — utility-first
- **shadcn/ui** — компоненты (components.json в корне jck-auto/)
- **Framer Motion** — анимации (motion.div, whileInView, AnimatePresence)
- **Шрифты:** Space Grotesk (заголовки, font-heading), Inter (текст)
- **Цвета:** Primary #1E3A5F (navy), Secondary #C9A84C (gold)

## AI-сервисы

- **DashScope (Alibaba Cloud)** — Qwen Vision (аукционные листы), Text (статьи), Image (обложки)
- **DeepSeek** — deepseek-chat: новости, мощность авто, перевод Korean→Russian
- **Anthropic Claude** — Vision + Text, ТОЛЬКО через GitHub Actions runner (403 с VDS)

## Telegram бот

- **node-telegram-bot-api** — polling mode
- **tsx** — runtime для TypeScript (npx tsx -r dotenv/config)

## PDF генерация

- **PDFKit** — server-side, serverExternalPackages: ['pdfkit'] в next.config.ts
- **Roboto TTF** — public/fonts/Roboto-Regular.ttf + Roboto-Bold.ttf (Cyrillic support)
- Шрифты зарегистрированы как Body / BodyBold

## Хранилище

- **JSON файлы на диске** — /var/www/jckauto/storage/
  - catalog/catalog.json — каталог авто (flat array [])
  - catalog/{carId}/ — фото авто
  - news/YYYY-MM-DD.json — новости
  - users.json — пользователи бота
- **Нет базы данных** — текущий масштаб (~50 авто, ~500 юзеров) не требует

## Ключевые конфигурации

- `next.config.ts`: serverExternalPackages: ['pdfkit'], images: { unoptimized: true }
- `vercel.json` — в проекте, но деплой на VDS через PM2, не Vercel
- Рендеринг: `/catalog` и `/catalog/cars/[id]` — force-dynamic (SSR, без ISR)

## Очередь запросов (in-memory)

- **`src/lib/auctionSheetQueue.ts`** — серверная in-memory очередь для
  `/api/tools/auction-sheet` (Pass 0 + 3-pass OCR + DeepSeek Step 2).
  Concurrency=1, max queue=10, completed-jobs TTL=15min, jobId = UUID v4.
- **Контракт:** POST возвращает `202 {jobId, statusUrl, position, etaSec}`,
  клиент поллит `GET /api/tools/auction-sheet/job/[jobId]` каждые 2s.
- **Persistence:** отсутствует — состояние живёт в памяти PM2-процесса;
  при рестарте очередь теряется, активная задача отменяется.
- **Тесты:** `src/lib/auctionSheetQueue.test.ts` (Node `node:test`).
