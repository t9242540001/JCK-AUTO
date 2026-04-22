<!--
  @file:        knowledge/INDEX.md
  @project:     JCK AUTO
  @description: Registry of all knowledge files with descriptions and dates
  @updated:     2026-04-22
  @version:     1.62
  @lines:       48
-->

# Knowledge Base — JCK AUTO

> **Reading guide:** Read only what you need for the current task. Each file is self-contained.

| File | Description | Updated |
|------|-------------|---------|
| [infrastructure.md](infrastructure.md) | Server, PM2 (3 processes — now driven by committed `ecosystem.config.js` as single source of truth), deploy commands (single `pm2 startOrReload` call), nginx (default 60s + per-endpoint overrides for /api/tools/auction-sheet: 200s timeout + 15MB body), Cloudflare Worker tg-proxy (4 routing modes), VDS provider network restrictions, mcp-gateway env declared in ecosystem (closes Б-11); new "Applying ecosystem.config.js changes: pm2 delete required" subsection documenting graceful-reload semantics | 2026-04-22 |
| [deploy.md](deploy.md) | Deploy pipeline: two-slot build, self-healing, runtime log observability, diagnostic order | 2026-04-14 |
| [architecture.md](architecture.md) | Stack, file navigator, URL structure, key relationships + queue + client async flow (poll + session restore) | 2026-04-18 |
| [integrations.md](integrations.md) | External APIs: DashScope, DeepSeek (180s timeout / 2 retries), CBR, Google Drive, Telegram, rate limits + admin access env | 2026-04-18 |
| [calculator.md](calculator.md) | Customs/price calculation business logic, formulas, rules | 2026-04-08 |
| [catalog.md](catalog.md) | Google Drive conventions, 5-step sync chain, screenshot priority | 2026-04-08 |
| [bot.md](bot.md) | Telegram bot commands, admin config, user storage | 2026-04-10 |
| [roadmap.md](roadmap.md) | Done / In progress / Planned + Strategic initiatives section (3 large initiatives pending after bug list) + 2026-04-20 session follow-ups (Encar/auction-sheet UX, CTA unification, Worker-in-git) + Planned — Technical debt section (2 items: users.ts sync-init refactor, void prefix on catalog.ts:375). 2026-04-22 Done bullets: PM2 ecosystem.config.js introduced (replaces manual pm2 commands), Б-11 closed (MCP gateway FILESYSTEM_ROOTS lost and recovered), deploy.yml simplified to single pm2 reload call; Series 2.4 at 5/6 (customs done 2026-04-22, noscut pending); Б-13 closed (stale bot process replaced) | 2026-04-22 |
| [decisions.md](decisions.md) | Architectural Decision Records (ADR log) — latest: pm2 startOrReload is graceful reload — pm2 delete required to apply any ecosystem.config.js change (closes Б-13, corrects informal understanding from Б-11 closure), Move PM2 process management to committed ecosystem.config.js (closes Б-11 + structurally fixes the drift class behind 2026-04-22 PM2 cwd incident), Canonical bot startup change requires workflow grep — addendum to PM2 cwd ADR, PM2 cwd inheritance incident — duplicate jckauto-bot processes, Session close 2026-04-21 — delivery summary, Bot user store lazy-load race — minimal lazy-await fix, Wire Telegram bot to shared auction-sheet service, Architecture: shared auction-sheet service, Remove internal auction codes from bot report, Rename Encar bot inline button for clarity, Б-2 and Б-3 closed as side-effect of Smart Placement fix, Enable Cloudflare Smart Placement on tg-proxy Worker, Add on-primary CTA variant to LeadFormTrigger + fix hierarchy on /tools/* pages, Harden /api/lead contract: fail-loud env, sanitized logs, fallback phone, Cross-tab session ownership in auction-sheet client, Prompt-series strategy under auto-merge + ignoreBuildErrors, Per-tool FAQ heading across /tools/* pages, Sync /tools/auction-sheet UI texts with real system behaviour, AuctionSheetClient split complete, ErrorView + С-7 fix, Extend ApiError type for rate_limit sub-fields, Expose remaining + isLifetimeLimit in 429, File input reset fix (UploadZone), Extend parse schema for auction-sheet (10 fields), Async-only contract for POST /api/tools/auction-sheet (jobId + polling), Introduce server-side in-memory queue for auction-sheet (concurrency=1, TTL=15min), Raise dashscope.ts RATE_LIMIT_PER_MINUTE 6 → 60, DeepSeek timeout 60s→180s / retries 3→2 / nginx 200s+15MB for auction-sheet, Pass 0 sheet-type classifier, multi-pass OCR, Pass 2 qwen3-vl-flash, DeepSeek primary Step 2, finish_reason=length, capture workflow registration | 2026-04-22 |
| [rules.md](rules.md) | All critical rules with locations and consequences + Architecture Rules (single-source-of-truth for auction-sheet pipeline, bot result inline-keyboards built only via src/bot/lib/inlineKeyboards.ts helpers) + UI Component Rules (LeadFormTrigger variant-to-background matching) + Smart Placement requirement for tg-proxy Worker + Infrastructure Rules requiring all PM2 startup via committed `ecosystem.config.js` (raw `pm2 start <bash> --name X -- -c "…"` forbidden outside Emergency Manual Deploy; `pm2 restart` of bot/mcp-gateway forbidden; PM2 change-discipline single-commit rule; bash -c form retained only for Emergency fallback) + ecosystem.config.js field changes require explicit pm2 delete before startOrReload + Code Standards rule on AC grep vs JSDoc | 2026-04-22 |
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
| [noscut-fixes.md](noscut-fixes.md) | Post-launch fixes: 20 issues — UX, SEO, security, content. All 12 prompts completed | 2026-04-09 |
| [tg-integration-plan.md](tg-integration-plan.md) | Telegram Login Widget, bot rate limiting, new bot commands — step-by-step implementation plan | 2026-04-10 |
| [tools.md](tools.md) | /tools/* API endpoints: auction-sheet async-only contract (POST 202 + job polling), pipeline (Pass 0 classifier + 3 parallel OCR + DeepSeek Step 2 180s/2 retries), Sharp compression, nginx per-endpoint 200s/15MB, rate limiting, diagnostics + job status endpoint + stats endpoint, parse schema extended (10 new fields including VIN), client-side types/helpers modularization in progress, UploadZone extracted, ProcessingViews extracted + 429 body extended, ErrorView extracted (С-7 closed), ResultView extracted with new fields UI, series complete | 2026-04-18 |
| [bugs.md](bugs.md) | Open bugs tracker — Б-11 closed (mcp-gateway FILESYSTEM_ROOTS env loss after `pm2 delete all` — fixed by ecosystem.config.js declarative env), Б-9 closed (user store race on bot restart), С-1 closed, С-5 user-impact closed (moved to Verify), С-6 closed (cross-tab session leak fixed), С-4 closed (/api/lead hardened), С-3 closed (on-primary CTA variant), Б-1 closed (Cloudflare Smart Placement), Б-2 and Б-3 closed (side-effect of Smart Placement), С-2 open, Б-4, Б-5, Б-6, Б-7, Б-8 open, С-8 open (encar handler timeout), Б-12 open (articles not publishing since 2026-04-08 — diagnostic-first bug), Б-13 closed (stale jckauto-bot process survived startOrReload for 13h — pm2 delete required for any ecosystem.config.js field change). Middleware-manifest restart loop (Б-7), Capture workflow verification (Б-8) pending | 2026-04-22 |

## Quick Links

- **Need to deploy?** → [deploy.md](deploy.md)
- **Need to find a file?** → [architecture.md](architecture.md)
- **Need to change calculator logic?** → [calculator.md](calculator.md)
- **Need to understand an API?** → [integrations.md](integrations.md)
- **Need to understand a past decision?** → [decisions.md](decisions.md)
