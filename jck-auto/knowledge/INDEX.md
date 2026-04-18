<!--
  @file:        knowledge/INDEX.md
  @project:     JCK AUTO
  @description: Registry of all knowledge files with descriptions and dates
  @updated:     2026-04-18
  @version:     1.20
  @lines:       48
-->

# Knowledge Base — JCK AUTO

> **Reading guide:** Read only what you need for the current task. Each file is self-contained.

| File | Description | Updated |
|------|-------------|---------|
| [infrastructure.md](infrastructure.md) | Server, PM2 (3 processes), deploy commands, nginx (default 60s + per-endpoint overrides for /api/tools/auction-sheet: 200s timeout + 15MB body), Cloudflare Worker tg-proxy (4 routing modes), VDS provider network restrictions | 2026-04-18 |
| [deploy.md](deploy.md) | Deploy pipeline: two-slot build, self-healing, runtime log observability, diagnostic order | 2026-04-14 |
| [architecture.md](architecture.md) | Stack, file navigator, URL structure, key relationships + queue | 2026-04-18 |
| [integrations.md](integrations.md) | External APIs: DashScope, DeepSeek (180s timeout / 2 retries), CBR, Google Drive, Telegram, rate limits | 2026-04-18 |
| [calculator.md](calculator.md) | Customs/price calculation business logic, formulas, rules | 2026-04-08 |
| [catalog.md](catalog.md) | Google Drive conventions, 5-step sync chain, screenshot priority | 2026-04-08 |
| [bot.md](bot.md) | Telegram bot commands, admin config, user storage | 2026-04-10 |
| [roadmap.md](roadmap.md) | Done / In progress / Planned features | 2026-04-16 |
| [decisions.md](decisions.md) | Architectural Decision Records (ADR log) — latest: Introduce server-side in-memory queue for auction-sheet (concurrency=1, TTL=15min), Raise dashscope.ts RATE_LIMIT_PER_MINUTE 6 → 60, DeepSeek timeout 60s→180s / retries 3→2 / nginx 200s+15MB for auction-sheet, Pass 0 sheet-type classifier, multi-pass OCR, Pass 2 qwen3-vl-flash, DeepSeek primary Step 2, finish_reason=length, capture workflow registration | 2026-04-18 |
| [rules.md](rules.md) | All critical rules with locations and consequences | 2026-04-10 |
| [stack.md](stack.md) | Tech stack: Next.js 15, Node.js, AI services (DashScope/DeepSeek/Claude), storage, key configs | 2026-04-08 |
| [exchange-rates.md](exchange-rates.md) | VTB scraper + CBR fallback, markups, /api/exchange-rates endpoint, UI labels, CORS rules | 2026-04-08 |
| [customs-reference.md](customs-reference.md) | ETS brackets, recycling fee conditions, legal entity logic, normative sources | 2026-04-08 |
| [encar-analyzer.md](encar-analyzer.md) | Encar API data flow, Korean→Russian translation, power estimation, rate limiter | 2026-04-08 |
| [news-pipeline.md](news-pipeline.md) | RSS → DeepSeek → covers → JSON pipeline, article generator, page URLs, costs | 2026-04-08 |
| [catalog-pipeline.md](catalog-pipeline.md) | Drive naming conventions, 4-step sync chain, screenshot priority (Russian) | 2026-04-09 |
| [catalog.md](catalog.md) | Drive naming conventions, 5-step sync chain, screenshot priority (English, with headers) | 2026-04-08 |
| [shared-mechanics.md](shared-mechanics.md) | Rate limiter (two-mode), Telegram auth, TelegramAuthBlock, BetaBadge, PDF, design system | 2026-04-10 |
| [telegram-bot.md](telegram-bot.md) | Bot commands, admin IDs, config, limitations, restart commands, bidirectional Worker webhook architecture, correct setWebhook via Worker URL, 401 silent-failure symptom, diagnostic commands, `node_modules/.bin/tsx` startup rationale | 2026-04-10 |
| [noscut-spec.md](noscut-spec.md) | ТЗ ноускаты: бизнес-логика, структуры данных, URL, компоненты, форма захвата | 2026-04-09 |
| [noscut-plan.md](noscut-plan.md) | ТЗ ноускаты: этапы реализации, список файлов, порядок промптов | 2026-04-08 |
| [noscut-fixes.md](noscut-fixes.md) | Post-launch fixes: 20 issues — UX, SEO, security, content. All 12 prompts completed | 2026-04-09 |
| [tg-integration-plan.md](tg-integration-plan.md) | Telegram Login Widget, bot rate limiting, new bot commands — step-by-step implementation plan | 2026-04-10 |
| [tools.md](tools.md) | /tools/* API endpoints: auction-sheet pipeline (Pass 0 classifier + 3 parallel OCR + DeepSeek Step 2 180s/2 retries), Sharp compression, nginx per-endpoint 200s/15MB, rate limiting, diagnostics + job status endpoint | 2026-04-18 |
| [bugs.md](bugs.md) | Open bugs tracker — С-1 (partial fix), С-2–С-5, Б-1–Б-8. С-6 closed. Includes Allion instability (С-5), middleware-manifest (Б-7) | 2026-04-17 |

## Quick Links

- **Need to deploy?** → [deploy.md](deploy.md)
- **Need to find a file?** → [architecture.md](architecture.md)
- **Need to change calculator logic?** → [calculator.md](calculator.md)
- **Need to understand an API?** → [integrations.md](integrations.md)
- **Need to understand a past decision?** → [decisions.md](decisions.md)
