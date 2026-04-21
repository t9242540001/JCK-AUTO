<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources + strategic initiatives
  @updated:     2026-04-21
  @version:     1.11
  @lines:       142
-->

# Roadmap

> For detailed open bugs see bugs.md

## Done

- [x] **2026-04-21 — Wire Telegram bot auction-sheet handler to shared service via queue**
  `src/bot/handlers/auctionSheet.ts` rewritten to delete the duplicated
  SYSTEM_PROMPT and the direct single-model `analyzeImage` call.
  The handler now compresses with Sharp (same params as the website),
  enqueues into `auctionSheetQueue` with
  `runAuctionSheetPipeline(buf, { channel: 'bot', telegramId })`, and
  polls the job status every 1s with a 180s hard timeout. Bot and
  website now share concurrency=1 and one source of truth for OCR +
  parse prompts. `formatAuctionResult`, `splitMessage`, and
  `severityLabel` stay bot-local (bot-surface concerns). Closes the
  regression bullet from In Progress (bot auction-sheet analysis via
  photo).
- [x] **2026-04-21 — Extract auction-sheet pipeline into shared service (`src/lib/auctionSheetService.ts`)**
  Bot was still calling a duplicated, single-model version of the
  decoder; website had the production pipeline inline in its route.
  Rolled the pipeline into `src/lib/auctionSheetService.ts` exporting
  `runAuctionSheetPipeline(buffer, {channel, ip?, telegramId?})`.
  Website route refactored to call the service through its existing
  queue. Pure refactor — website behaviour byte-identical. Unblocks
  Prompt 2.2 (wire the bot to the service).
- [x] Calculator for China, Korea, Japan (unified engine calculator.ts)
- [x] Tools section — /tools hub with 4 tool cards
- [x] Calculator "pod klyuch" (/tools/calculator)
- [x] Customs duty calculator (/tools/customs) — individual + company
- [x] AI auction sheet decoder (/tools/auction-sheet)
- [x] Encar.com analyzer (/tools/encar) — full analysis + translation + PDF
- [x] News pipeline (RSS → DeepSeek → covers → JSON → /news)
- [x] SEO article generator (topic → Qwen3.5-Plus → MDX → /blog)
- [x] News section on site (/news, /news/[slug], /news/tag/[tag])
- [x] Beta badges on all /tools/* pages (BETA_MODE flag)
- [x] VTB exchange rates via sravni.ru scraper + CBR fallback with markup
- [x] "Ориентировочный курс" labels on all calculators + bot
- [x] /api/exchange-rates endpoint (server-side, no CORS)
- [x] CalculatorCore shared component (homepage + /tools/calculator)
- [x] PDF reports with Roboto TTF (Cyrillic support) + jckauto.ru link
- [x] Encar Korean→Russian translation via DeepSeek (batch, cached 24h)
- [x] Каталог ноускатов: /catalog/noscut, /catalog/noscut/[slug], LeadForm, URL рефакторинг, AI-pipeline (research + generate + price-update)
- [x] Telegram Login Widget integration (TelegramAuthBlock, tg_auth JWT cookie, /api/auth/telegram)
- [x] Two-mode rate limiter: anonymous 3 lifetime / Telegram-auth 10/day (rateLimiter.ts)
- [x] Bot: /customs command — customs-only cost calculation
- [x] Bot: /noscut command — noscut catalog search with fuzzy match
- [x] Bot: /start deep link handling (web_encar, web_auction → special welcome + channel button)
- [x] Bot: extended /stats with command counters and traffic sources (botStats.ts)
- [x] Privacy page /privacy updated with Telegram data collection section
- [x] Auction-sheet multi-pass OCR architecture (three parallel passes + DeepSeek Step 2)
- [x] Deploy pipeline stabilization (PAT_AUTO_MERGE, push-trigger-only, two-slot atomic build, article cron decoupled)
- [x] Async queue for auction-sheet — server-side in-memory queue (concurrency=1, max 10, TTL 15min), POST /api/tools/auction-sheet returns 202 + jobId, client polls GET /api/tools/auction-sheet/job/[jobId] every 2s с localStorage session restore. См. ADR [2026-04-18] "Async-only contract..." и [2026-04-18] "Introduce server-side in-memory queue...".
- [x] Auction-sheet client modularization (series 02–08, 2026-04-18) — AuctionSheetClient.tsx split into 6 modules: auctionSheetTypes.ts (shared types), auctionSheetHelpers.ts (pure formatters), UploadZone.tsx (drag/drop + preview), ProcessingViews.tsx (submitting/queued/processing states), ErrorView.tsx (4 error sub-cases + CooldownTimer, closes bug С-7), ResultView.tsx (9 sections incl. new "Идентификация" + "Плюсы по заметкам аукциона" + collapsible "Дополнительный текст с листа"). 11 new parse-schema fields from Prompt 01 (VIN, modelCode, registrationNumber, inspectionValidUntil, recycleFee, seats, colorCode, dimensions, salesPoints, bodyType) now surface in the UI. Orchestrator 655 → 368 lines. See decisions.md ADR [2026-04-18] "AuctionSheetClient split complete".
- [x] Bot (2026-04-21): rename the Encar-result inline button `Открыть на сайте` → `Подробный отчёт на сайте` for clarity (user feedback, 2026-04-20).
- [x] Bot (2026-04-21): remove internal auction codes (W1, A1, G, S, etc.) from auction-sheet bot output — replaced with Russian severity labels (`незначительный` / `средний` / `серьёзный`). Codes remain in SYSTEM_PROMPT for AI recognition. Formatter is bot-specific, not shared with website's ResultView.tsx.

## In Progress

- [~] Phase 2: Tariff monitoring (check-tariffs.ts + cron)
- [~] Phase 5: Finalization (SEO audit, mobile check, sitemap)
- [~] Merge all branches into main
- [~] Regenerate bot token in BotFather (Step 0 — manual, pending)

## Planned — Site

- [ ] Mobile responsiveness — full page-by-page audit
- [ ] Add images to first 12 blog articles
- [ ] Register in Yandex.Webmaster and Google Search Console
- [ ] "Leave request" button on car detail page → /api/lead → managers group
- [ ] `/tools/auction-sheet` page texts honesty fix — hero subtitle, metadata.description, openGraph.description, webAppJsonLd.description all promise "15 seconds" but the real pipeline takes 20–60 seconds (up to 2 minutes for handwritten sheets). FAQ item #3 says "3 расшифровки в день бесплатно" — incorrect, the anonymous limit is 3 LIFETIME requests (verified in rateLimiter.ts @rule ANONYMOUS); authenticated users get 10/day. FAQ item #5 references the old "Не распознано" block, renamed to "Дополнительный текст с листа" in prompt 08. Single-file fix on src/app/tools/auction-sheet/page.tsx.
- [ ] AuctionSheetClient polling hook extraction — orchestrator is 368 lines post-series, target <200 lines requires extracting pollJob + session restore useEffect into a custom hook (useAuctionSheetJob). Deferred — accepted as out-of-scope in ADR [2026-04-18] "AuctionSheetClient split complete".
- [ ] Site: unify CTA style across conversion surfaces. Target pattern is **inline buttons** with site link + LeadFormTrigger ("Оставить заявку"), as used on `/tools/encar` result view. Audit candidates: all `/services`-labelled pages (/tools/*), car detail pages, noscut detail pages, any other result view that currently shows a plain text link or a lone phone button. Consistency gain: users always see the same "get-in-touch" affordance regardless of which tool they use.

## Planned — Bot

- [ ] **Prompt 2.3 — Bot progress indicator for auction-sheet.**
  `editMessageText` the "🔍 Анализирую…" message once at ~45s with
  "Занимает дольше обычного, ещё около минуты…". On final success —
  replace with full report; on error — replace with error + site link.
- [ ] Auto-post new cars to channel t.me/jckauto_import_koreya
- [ ] AI consultant (Claude API + knowledge base)
- [ ] Bot: add PDF download for auction-sheet and encar results, matching the website's PDF export. Goal: feature parity between bot and site. Investigate whether existing PDF generator (from `/api/tools/*/pdf` routes) can be reused server-side and streamed to Telegram.
- [ ] Bot: unify CTA after auction-sheet and encar results — Vasily-approved style is **inline buttons** (site link + "Оставить заявку" lead-form trigger). Auction-sheet currently shows only a plain text link with no form capture; bring it to encar-style inline-buttons pattern.
- [ ] Bot: clarify queue and rate-limit semantics for auction-sheet and encar in the bot — currently unclear whether the bot enforces the same async queue / 2-minute cooldown contract as the website, or whether it bypasses them. If bypassed, system overload is possible under concurrent bot+site traffic. Audit and, if needed, route bot calls through the same queue + rate-limiter layer used by `/api/tools/*`.
- [ ] Bot: `/noscut` command — after the user sends `/noscut` without an argument, the next plain-text message (e.g. `Hyundai`) is not recognized as the query. User must resend with `/noscut Hyundai` explicitly. Fix: set a per-user "awaiting noscut query" state in bot storage after empty `/noscut`, then treat the next plain message as the noscut query.

## Planned — Infrastructure

- [ ] Set up monitoring/alerting for PM2 processes
- [ ] Allion-specific auction sheet stabilization (see bugs.md С-5 — DeepSeek JSON parse fail diagnostics)
- [ ] Middleware-manifest regression investigation — PM2 720+ restart loop (see bugs.md Б-7)
- [ ] Capture-deploy-log workflow registration verification (see bugs.md Б-8)
- [ ] OCR label-swap mitigation in auction-sheet Pass 1 — qwen-vl-ocr occasionally misassigns adjacent label/value pairs on auction sheets (example observed 2026-04-18: 最大積載量 label paired with 寒冷地仕様 value that belongs to a different field). Result: seats / bodyType / salesPoints often arrive empty on test sheets. Two candidate fixes: (a) post-process in Step 2 DeepSeek parser with reasoning prompt that catches mismatches, or (b) replace Pass 1 model with qwen3-vl-flash (already used in Pass 2 with good results). Requires diagnostic comparison before choosing.
- [ ] Move Cloudflare Worker `tg-proxy` source code from Dashboard-only to the repository. Target files: `worker/tg-proxy.ts` + `wrangler.toml`. Put the Worker on the same git-versioning track as the rest of the codebase, deployable via `wrangler deploy` from GitHub Actions or the VDS. At the same time: (a) clean up the Telegram-branch headers to match the Anthropic-branch pattern (pass only minimum required headers, not `request.headers` wholesale), (b) add console.log at ingress/egress of each routing branch for future latency debugging, (c) document Smart Placement as a required deploy setting in `wrangler.toml` or a separate README. Pre-requisite: Cloudflare API token or `wrangler login` from VDS. See ADR `[2026-04-20] Enable Cloudflare Smart Placement on tg-proxy Worker (close Б-1)` "Consequences" section for rationale.

## Strategic initiatives

> Larger-scope initiatives that wait for the current bug list to clear. Each entry is an idea that **requires deep research and design before implementation** — not a ready-to-prompt task. Numbered for reference only, not priority-ordered.

### 1. Admin dashboard with analytics + mini CRM

Comprehensive admin dashboard covering the site's observable state:
- **Site traffic** — visitors, sessions, source breakdown (direct, search, social, referral, messenger).
- **Conversion actions** — leads submitted via `/api/lead`, auction-sheet decodes completed, encar analyses, calculator usages, PDF downloads, catalog card views.
- **Traffic sources** — UTM attribution, referrer breakdown, channel-level conversion funnel.
- **Bot statistics** — existing `botStats.ts` surfaced in a UI (currently `/stats` command only).
- **Service usage** — per-tool breakdown of `/tools/*` usage with rate-limiter state.
- **Subscription data** — channels, messaging platforms, newsletters (once introduced).
- **Mini CRM** — requests history, customer data, manager notes, pipeline state.

**Status:** Idea. Requires a dedicated discovery phase before the first prompt — data model, auth model, privacy compliance (152-ФЗ), storage strategy (current file-based `storage/` vs database migration), UI surface (separate admin route vs feature-flagged sections).

### 2. Page-by-page site audit

Full-site audit, one page at a time, against these criteria:
- **Mobile adaptation** — layout breakage, touch targets, readable font sizes.
- **Usability** — navigation clarity, information scent, primary-action visibility.
- **UI/content simplification** — remove overloaded sections, cut redundant copy, tighten visual hierarchy.
- **SEO** — metadata uniqueness, canonical URLs, structured data, internal linking, image alts.
- **Bugs** — visual regressions, broken interactions, console errors.
- **Conversion uplift** — CTA placement, form friction, trust signals near conversion points.
- **Company reputation** — testimonials, warranty claims, social proof consistency.

**Status:** Idea. Requires a page inventory first (`src/app/**/page.tsx` + dynamic routes from catalog/news/blog/noscut), then a per-page audit checklist, then prioritisation by traffic × conversion-impact. Likely a multi-prompt series, one page per prompt.

### 3. Growth analytics on services and sections

Analytics research to identify **which services and sections can further increase traffic or conversion**. Examples of the kind of questions this should answer:
- Which `/tools/*` page has the highest entry rate vs conversion rate — where is the funnel leaking?
- Are there underused sections (noscut, news, blog) that deserve more navigation prominence?
- Are there search intents that the site does not currently address but could (e.g., "растаможка BYD", "Hyundai из Кореи цена" — specific queries where a dedicated landing page would capture traffic)?
- Where does the catalog lose users — listing vs detail vs lead form?

**Status:** Idea. Requires (a) analytics integration first — the current site has no systematic analytics (Yandex.Metrika, GA, or equivalent). Depends on initiative #1 for data surface. Can also run partially on server-side access logs + bot stats.
