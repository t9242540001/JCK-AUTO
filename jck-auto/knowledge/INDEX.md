<!--
  @file:        knowledge/INDEX.md
  @project:     JCK AUTO
  @description: Registry of all knowledge files with descriptions and dates
  @updated:     2026-05-04
  @version:     2.13
  @lines:       75
-->

# Knowledge Base — JCK AUTO

> **Reading guide:** Read only what you need for the current task. Each file is self-contained.

| File | Description | Updated |
|------|-------------|---------|
| [infrastructure.md](infrastructure.md) | Server identity, PM2 processes (driven by committed ecosystem.config.js, logs at /var/log/pm2/ per INFRA-1), cron jobs, deploy pipeline, runtime constraints, CI/CD, active bugs. Network config (nginx, Cloudflare, Yandex MCP install) → networking.md | 2026-05-04 |
| [networking.md](networking.md) | Network architecture — nginx config (location blocks, per-endpoint timeouts, SSL), Cloudflare Worker tg-proxy (4 routing modes, deploy via worker/wrangler.toml), provider network restrictions, Yandex Metrika MCP install procedure | 2026-05-02 |
| [deploy.md](deploy.md) | Deploy pipeline: two-slot build, self-healing, runtime log observability, diagnostic order | 2026-04-14 |
| [architecture.md](architecture.md) | Stack, file navigator, URL structure, key relationships + queue + client async flow (poll + session restore) | 2026-04-18 |
| [integrations.md](integrations.md) | External APIs: DashScope, DeepSeek (180s timeout / 2 retries), CBR, Google Drive, Telegram, rate limits + admin access env | 2026-04-18 |
| [calculator.md](calculator.md) | Customs/price calculation business logic, formulas, rules | 2026-04-08 |
| [catalog.md](catalog.md) | Google Drive conventions, 5-step sync chain, screenshot priority | 2026-04-08 |
| [bot.md](bot.md) | Telegram bot commands, admin config, user storage | 2026-04-10 |
| [roadmap.md](roadmap.md) | Recent Activity (last sessions) + Done (active features completed 2026-04-29+) + In Progress + Active strategic work (NEW-1, NEW-2) + Planned — Site/Bot/Infrastructure/Technical debt + Strategic initiatives. Older entries → roadmap-archive-2.md (dated) and roadmap-archive-1.md (undated historical). Auto-archive trigger at 10 Recent Activity entries OR 400 lines. | 2026-05-02 |
| [roadmap-archive-2.md](roadmap-archive-2.md) | Archive 2 of roadmap.md — Recent Activity entries and Done bullets from 2026-04-28 and earlier. Read-only reference, NOT read at session start by default | 2026-05-02 |
| [roadmap-archive-1.md](roadmap-archive-1.md) | Archive: historical Done entries (one-liners without dates, reference-only). Not read at session start by default | 2026-04-26 |
| [decisions.md](decisions.md) | Architectural Decision Records (ADR log) — active section. Contains 16 most recent ADRs (2026-04-29 onward) + CRIT-1 + SALES-CRIT-2 + INFRA-1 (2026-05-04). Older 81 entries → [decisions-archive-1.md](decisions-archive-1.md). Auto-archive trigger at 1000 lines. | 2026-05-04 |
| [decisions-archive-1.md](decisions-archive-1.md) | Archive 1 of decisions.md — 81 ADRs from 2026-01..2026-04-28. Read-only reference, NOT read at session start by default | 2026-05-02 |
| [rules.md](rules.md) | All critical rules with locations and consequences + Architecture Rules (single-source-of-truth for auction-sheet pipeline, bot result inline-keyboards built only via src/bot/lib/inlineKeyboards.ts helpers) + UI Component Rules (LeadFormTrigger variant-to-background matching) + Cloudflare Worker tg-proxy config must live in `worker/wrangler.toml` with `[placement] mode = "smart"` + `region = "gcp:europe-west1"` (NEVER edit in Dashboard) + Infrastructure Rules requiring all PM2 startup via committed `ecosystem.config.js` (raw `pm2 start <bash> --name X -- -c "…"` forbidden outside Emergency Manual Deploy; `pm2 restart` of bot/mcp-gateway forbidden; PM2 change-discipline single-commit rule; bash -c form retained only for Emergency fallback) + ecosystem.config.js field changes require explicit pm2 delete before startOrReload + Code Standards rule on AC grep vs JSDoc + Process Discipline section (@fix code marker for mid-series bug fixes, @series header marker for files under active series transformation, Conventional Commits commit format) + Frontend & Debugging section (R-FE-1 browser-first verification, R-FE-2 allowlist completeness, R-FE-3 grid item min-width auto trap with diagnostic recipe, R-FE-4 async completion signal pattern) + Knowledge & Operations Discipline section (R-PROC-1 actionable auto-archive triggers, R-OPS-1 rollback commands with explicit guards, R-OPS-2 manual ops .txt files без markdown bash blocks) + Site Lead Route Rules (CRIT-1: route-local 5/15min limit on /api/lead, appendSiteLeadLog audit trail, single-process Map invariant; SALES-CRIT-2: fetch retry on AbortError/network only, 6s per-attempt timeout, 800ms backoff) + INFRA-1: PM2 logs at /var/log/pm2/{name}-{out,error}.log convention | 2026-05-04 |
| [virtual-team.md](virtual-team.md) | Virtual team roster + permanent participants + two work modes | 2026-04-26 |
| [stack.md](stack.md) | Tech stack: Next.js 16.1.6 (Turbopack), Node 20, AI services (DashScope/DeepSeek/Claude), in-memory queue for auction-sheet, storage, key configs | 2026-04-18 |
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
| [noscut-fixes-archive-1.md](noscut-fixes-archive-1.md) | Archive of completed post-launch ТЗ for /catalog/noscut — 20 issues, 12-prompt plan (all closed 2026-04-28). Read-only reference, NOT read at session start by default | 2026-05-02 |
| [tg-integration-plan.md](tg-integration-plan.md) | Telegram Login Widget, bot rate limiting, new bot commands — step-by-step implementation plan | 2026-04-10 |
| [tools-auction-sheet.md](tools-auction-sheet.md) | Auction Sheet Analyzer API — async-only contract (POST 202 + job polling), Pass 0 classifier + multi-pass OCR (3 passes) + DeepSeek Step 2 parse, DashScope fallback chain, rate limiting (3 anon lifetime / 10 daily auth), nginx per-endpoint timeouts (200s / 15MB body), HEIC support, diagnostic curl | 2026-05-02 |
| [bugs.md](bugs.md) | Open / verify-status / won't-fix bugs — site and bot. Closed entries → bugs-archive-1.md. Auto-archive trigger at 250 lines. | 2026-05-02 |
| [bugs-archive-1.md](bugs-archive-1.md) | Archive 1 of bugs.md — 11 closed bug entries (С-1, С-2, С-8, Б-4, Б-6, Б-9, Б-11, Б-12, Б-13, Б-14, Б-15). Read-only reference, NOT read at session start by default | 2026-05-02 |

## Per-tool documentation convention

Each `/tools/*` API has its own knowledge file named `tools-{slug}.md` —
e.g., `tools-auction-sheet.md` for `/tools/auction-sheet`. Files are
created on demand: when a tool's documentation outgrows brief reference
(over ~50 lines of operational details, business logic, or pipeline
architecture). Tools currently documented in this convention:

- **tools-auction-sheet.md** — `/tools/auction-sheet` API (Japanese auction sheet AI decoder).

Tools NOT yet under the convention (their docs live in legacy single-purpose files or are not yet documented):

- `/tools/encar` — see `encar-analyzer.md`.
- `/tools/calculator` — see `calculator.md`.
- `/tools/customs` — see `customs-reference.md`.
- `/tools/noscut` — see `noscut-spec.md`, `noscut-plan.md`.

When promoting any of these to the per-tool convention, rename the legacy
file to `tools-{slug}.md` via `git mv`, update INDEX.md description and
this section, and run cross-reference discovery via grep on the old name.

## Quick Links

- **Need to deploy?** → [deploy.md](deploy.md)
- **Need to find a file?** → [architecture.md](architecture.md)
- **Need to change calculator logic?** → [calculator.md](calculator.md)
- **Need to understand an API?** → [integrations.md](integrations.md)
- **Need to understand a past decision?** → [decisions.md](decisions.md)
