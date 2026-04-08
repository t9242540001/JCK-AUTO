# JCK AUTO

Импорт автомобилей из Китая, Кореи и Японии в Россию.
Сайт: https://jckauto.ru | GitHub: t9242540001/JCK-AUTO

## Stack

Next.js 15 (App Router, TypeScript strict), Tailwind 4, shadcn/ui, Framer Motion,
node-telegram-bot-api, PDFKit, DashScope (Qwen), DeepSeek. Storage: JSON files on VDS.

## Critical Rules

1. **Anthropic API заблокирован с VDS (403)** — Claude Vision/Text только на GitHub Actions runner
2. **`pm2 restart` не перечитывает `.env.local`** — бот: только `pm2 delete` + `pm2 start`
3. **Курсы валют уже с наценкой** — НЕ умножать на дополнительные коэффициенты
4. **Клиентские компоненты** — курсы через `/api/exchange-rates`, НЕ через `fetchCBRRates()`
5. **Калькулятор** — граница 5 лет включительно, утильсбор: ОБА условия (≤160 л.с. И ≤3 л)

## Knowledge Base

Полная документация проекта: **[knowledge/INDEX.md](knowledge/INDEX.md)**

| Нужно | Читай |
|-------|-------|
| Деплой | knowledge/infrastructure.md |
| Найти файл | knowledge/architecture.md |
| Внешние API | knowledge/integrations.md |
| Калькулятор | knowledge/calculator.md |
| Каталог | knowledge/catalog.md |
| Бот | knowledge/bot.md |
| Решения | knowledge/decisions.md |
| Правила | knowledge/rules.md |
| Роадмап | knowledge/roadmap.md |

## Code Standards

- Шапка `@file` на каждом новом файле
- Регион-комментарии для файлов >100 строк
- JSDoc на экспортируемых функциях
- Тексты: русский. Код: английский.
