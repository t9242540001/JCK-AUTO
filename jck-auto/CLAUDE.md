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

## Execution Discipline

Universal behavioral standard for every task in this project. Applies in addition to Critical Rules above.

1. **Don't guess — ask.** If the task allows multiple valid implementations, stop and ask before coding.
2. **Senior-engineer simplicity filter.** Before finalizing implementation, ask: "Would a senior engineer call this overengineered?" If yes, simplify.
3. **Strict scope discipline.** Touch only what the task explicitly names. No improvements to adjacent code, no opportunistic refactors, no consistency fixes outside the stated scope.
4. **Goal over steps.** When the user describes the goal, find the right algorithm yourself. When the user prescribes steps and they don't reach the goal — flag the contradiction, don't blindly follow.
5. **Sustainable solutions.** Prefer fixes that prevent recurrence over fixes that just stop the symptom. If a quick fix and a durable fix differ — name both, recommend the durable one, let the user choose.

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
