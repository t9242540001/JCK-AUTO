# Стек технологий
> Обновлено: 2026-04-08

## Фреймворк и рантайм

- **Next.js 15** — App Router, TypeScript strict, RSC + client components
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
- ISR: `/catalog` revalidate=3600 (1ч)
