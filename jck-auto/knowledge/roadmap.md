<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources + strategic initiatives
  @updated:     2026-04-23
  @version:     1.18
  @lines:       285
-->

# Roadmap

> For detailed open bugs see bugs.md

## Done

- [x] **2026-04-23 — Series 2.4 complete: bot result-message keyboards unified via `inlineKeyboards.ts` helpers.** Seven prompts (2.4.1–2.4.7) migrated four terminal-result handlers (auction-sheet, encar, calculator, customs, noscut) from literal `inline_keyboard: [...]` to three shared helpers (`siteAndRequestButtons`, `siteRequestAndAgainButtons`, `noscutResultButtons`). Button text, ordering, callback_data now centralized in `src/bot/lib/inlineKeyboards.ts`. Side-effect: URL bug in `noscutResultButtons()` fixed in 2.4.6 (`catalog/noscut` instead of nonexistent `tools/noscut`, `@fix 2026-04-23` marker in code). New process discipline codified in rules.md: `@fix` code marker, `@series` header marker, Conventional Commits format, mid-series bug variant B. Commits: `9639ba3` (2.4.1), `b18e117` (2.4.2), 2.4.3 closed, 2.4.4 closed, `6ab3f6e` (2.4.5), `cba938b` (2.4.6), this commit (2.4.7). See ADR `[2026-04-23] Series 2.4 complete` for full context. Out of series scope: `/noscut` state bug (empty-argument input does not transition to "awaiting query" state) still open — remains in Planned — Bot.
- [x] 2026-04-23: Cloudflare Worker `tg-proxy` migrated from Dashboard-only to git. Three new files: `worker/tg-proxy.js` (4-mode routing code copied verbatim), `worker/wrangler.toml` (placement pinned via `mode = "smart"` + `region = "gcp:europe-west1"`), `.github/workflows/deploy-worker.yml` (auto-deploy on push to `worker/**` via `cloudflare/wrangler-action@v3`). GitHub Secrets added: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Closes Etap 1 of Cloudflare infrastructure migration. Production-verified: `cf-placement: local-ARN` (Stockholm), 0.193s latency (better than 0.227s baseline). Supersedes ADR [2026-04-20] Smart Placement via Dashboard. See ADR [2026-04-23] for full trace of the drift incident that triggered this migration. Commits: `bdc5a611` (Infra-1), `b162b2b` (Infra-1-Fix-1).
- [x] **2026-04-22 — Customs handler refactored to use `siteRequestAndAgainButtons` helper (Prompt 2.4.5).**
  `src/bot/handlers/customs.ts` no longer builds a literal
  `inline_keyboard: [...]` for its result message. Now uses
  `siteRequestAndAgainButtons('https://jckauto.ru/tools/customs',
  'cust_again')` from `src/bot/lib/inlineKeyboards.ts`. Site-button
  label unified from 'Подробнее на сайте' to '🌐 Подробный отчёт
  на сайте', matching what auction-sheet, encar, and calculator
  already show. Two navigation keyboards (country-select in
  `startCustoms`, age-select in the message handler) stay
  literal — they are navigation / wizard-step, not result
  messages, which is out of the helper's documented scope.
  Series 2.4 progress: 2.4.1 done, 2.4.2 done, 2.4.3 done,
  2.4.4 done, 2.4.5 done — noscut (2.4.6) and series finalization
  (2.4.7) still pending.
- [x] **2026-04-22 (evening) — Б-13 closed: stale jckauto-bot process replaced after 13 hours.**
  A manually-started bot process from 13 hours earlier survived
  commit `59555b8` (ecosystem.config.js introduction) and every
  subsequent `pm2 startOrReload ecosystem.config.js --only
  jckauto-bot` throughout the session — three reload calls total,
  zero applied. Cause: `pm2 startOrReload` is graceful reload for
  already-online processes; it re-uses their existing in-memory
  `pm_exec_path` / `script_args` / env snapshot and does not re-read
  the file. Users experienced 20-second latency per `/calc` step
  and `ETELEGRAM: query is too old` errors. `pm2 delete jckauto-bot
  && pm2 startOrReload ecosystem.config.js --only jckauto-bot`
  replaced the stale process; latency returned to normal. See
  `bugs.md` Б-13 and ADR `[2026-04-22] pm2 startOrReload is
  graceful reload — pm2 delete required to apply any
  ecosystem.config.js change`.
- [x] **2026-04-22 — Calculator handler refactored to use `siteRequestAndAgainButtons` helper (Prompt 2.4.4).**
  `src/bot/handlers/calculator.ts` no longer builds a literal
  `inline_keyboard: [...]` for its result message. Now uses
  `siteRequestAndAgainButtons(siteUrl, againCallback)` from
  `src/bot/lib/inlineKeyboards.ts`. Site-button label unified from
  "На сайт" → "🌐 Подробный отчёт на сайте", matching what encar
  and auction-sheet already show. Two navigation keyboards
  (country-select in `startCalc`, age-select in the message
  handler) stay literal — they are navigation, not result
  messages, which is out of the helper's documented scope. Series
  2.4 progress: 2.4.1 ✓ 2.4.2 ✓ 2.4.3 ✓ 2.4.4 ✓ — customs (2.4.5)
  and noscut (2.4.6) still pending.
- [x] **2026-04-22 — mcp-gateway entry in ecosystem.config.js corrected (Prompt 2.4.3.6.1).**
  The initial 2.4.3.6 entry carried a speculative
  `args: ['-c', 'exec npx -y
  @modelcontextprotocol/server-filesystem "$FILESYSTEM_ROOTS"']`
  block — wrong server, wrong package, would have broken
  mcp-gateway on first clean start. Fixed to the real
  `script: '/opt/ai-knowledge-system/server/start.sh'` with
  `interpreter: 'bash'` and no args (the shell script is
  self-sufficient). FILESYSTEM_ROOTS env preserved. Post-merge
  operator action required `pm2 delete mcp-gateway && pm2 start
  ecosystem.config.js --only mcp-gateway` to actually apply the
  corrected entry — `pm2 startOrReload` alone preserved the old
  speculative args. This was the first real observation of the
  graceful-reload behaviour that later produced Б-13.
- [x] **2026-04-22 — PM2 ecosystem.config.js introduced (replaces manual pm2 commands).**
  Committed `ecosystem.config.js` at the project root is now the single
  source of truth for all three PM2 processes (jckauto, jckauto-bot,
  mcp-gateway). Raw `pm2 start <bash> --name X -- -c "…"` is FORBIDDEN
  going forward; `bash -c` wrapper retained only as Emergency Manual
  Deploy fallback. See ADR `[2026-04-22] Move PM2 process management
  to committed ecosystem.config.js`.
- [x] **2026-04-22 — Б-11 closed (MCP gateway FILESYSTEM_ROOTS lost and recovered).**
  `pm2 delete all` on VDS wiped `mcp-gateway` along with the bots; its
  `FILESYSTEM_ROOTS` env (passed inline at first start, never persisted)
  was lost, and Claude's MCP file-serving broke. Fixed by declaring
  `env: { FILESYSTEM_ROOTS: '/var/www/jckauto/app/jck-auto' }` on the
  mcp-gateway entry in `ecosystem.config.js` — every reload re-applies
  it.
- [x] **2026-04-22 — deploy.yml simplified: single pm2 reload call.**
  The previous separate `pm2 restart jckauto` + `pm2 delete jckauto-bot`
  + `pm2 start bash --name jckauto-bot -- -c "…"` triple collapsed into
  a single `pm2 startOrReload ecosystem.config.js --only
  jckauto,jckauto-bot`. `[build] step N` marker count reduced from 8 to
  7.
- [x] **2026-04-22 — С-8 registered: encar handler hangs indefinitely on DeepSeek timeout**
  Live verification of Prompt 2.4.3 surfaced an indefinite hang in
  `src/bot/handlers/encar.ts` when DeepSeek translation/power calls run
  in an unbounded `Promise.allSettled`. Documented in `bugs.md` as С-8
  with root cause + planned fix (wrap each arm in `Promise.race(call,
  timeout(30000))`). Refactor itself (Prompt 2.4.3) is innocent — the
  hang occurs before the helper is invoked.
- [x] **2026-04-22 — Encar handler refactored to use `siteAndRequestButtons` helper**
  `src/bot/handlers/encar.ts` no longer builds a literal
  `inline_keyboard: [...]` for its result message. Now uses
  `siteAndRequestButtons(siteUrl)` from `src/bot/lib/inlineKeyboards.ts`,
  matching the architecture rule introduced in Prompt 2.4.1. Pure
  refactor — text and button order already matched the helper output.
  Series 2.4 progress: 2.4.1 ✓ 2.4.2 ✓ 2.4.3 ✓ — calculator/customs/
  noscut still pending (2.4.4–2.4.6).
- [x] **2026-04-21 — Bot user store lazy-load race fixed (Б-9 closed)**
  `src/bot/store/users.ts` is an async-load store: the in-memory `users` Map
  is populated only inside the async `loadUsers()` function. The sync
  `getUser(chatId)` accessor did not trigger the load, so immediately after
  every `pm2 delete + pm2 start` cycle, existing users tapping inline
  "Оставить заявку" buttons received the spurious "Нажмите /start" fallback
  until some other code path awaited loadUsers. Fix: exposed
  `ensureUsersLoaded()` from `users.ts`; `handleRequestCommand` became async
  and awaits `ensureUsersLoaded()` before calling `getUser`. Callback_query
  listener invokes the handler with `void` (intentional non-await). Bug
  surfaced via live verification of Prompt 2.4.2 — the new keyboard added
  there made the race reproducible on every bot restart. See ADR
  `[2026-04-21] Bot user store lazy-load race — minimal lazy-await fix`.
- [x] **2026-04-21 — Auction-sheet bot handler wired to inline-keyboards helper**
  `src/bot/handlers/auctionSheet.ts` now appends the result CTA buttons via
  `siteAndRequestButtons(siteUrl)` from `src/bot/lib/inlineKeyboards.ts`
  instead of building a literal `inline_keyboard: [...]` block. Buttons are
  attached to the LAST chunk of the report (multi-message split case
  preserved). Behaviourally identical for users; eliminates the divergence
  risk caught in the 2026-04-21 audit. Pairs with the architecture rule
  added in Prompt 2.4.1.
- [x] **2026-04-21 — Bot inline-keyboards helper introduced (single source of truth)**
  Created `src/bot/lib/inlineKeyboards.ts` with three helpers:
  `siteAndRequestButtons`, `siteRequestAndAgainButtons`,
  `noscutResultButtons`. Result-message keyboards across all bot handlers
  must now be built through these helpers — direct literal
  `inline_keyboard: [...]` for terminal result messages is forbidden
  (rules.md → Architecture Rules). Navigation/wizard keyboards (catalog
  paging, customs wizard) are out of scope by design. Series 2.4.3–2.4.7
  will migrate the remaining handlers (encar, calculator, customs, noscut)
  one at a time.
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
- [ ] Bot: clarify queue and rate-limit semantics for auction-sheet and encar in the bot — currently unclear whether the bot enforces the same async queue / 2-minute cooldown contract as the website, or whether it bypasses them. If bypassed, system overload is possible under concurrent bot+site traffic. Audit and, if needed, route bot calls through the same queue + rate-limiter layer used by `/api/tools/*`.
- [ ] Bot: `/noscut` command — after the user sends `/noscut` without an argument, the next plain-text message (e.g. `Hyundai`) is not recognized as the query. User must resend with `/noscut Hyundai` explicitly. Fix: set a per-user "awaiting noscut query" state in bot storage after empty `/noscut`, then treat the next plain message as the noscut query.

## Planned — Infrastructure

- [ ] Set up monitoring/alerting for PM2 processes
- [ ] Allion-specific auction sheet stabilization (see bugs.md С-5 — DeepSeek JSON parse fail diagnostics)
- [ ] Middleware-manifest regression investigation — PM2 720+ restart loop (see bugs.md Б-7)
- [ ] Capture-deploy-log workflow registration verification (see bugs.md Б-8)
- [ ] OCR label-swap mitigation in auction-sheet Pass 1 — qwen-vl-ocr occasionally misassigns adjacent label/value pairs on auction sheets (example observed 2026-04-18: 最大積載量 label paired with 寒冷地仕様 value that belongs to a different field). Result: seats / bodyType / salesPoints often arrive empty on test sheets. Two candidate fixes: (a) post-process in Step 2 DeepSeek parser with reasoning prompt that catches mismatches, or (b) replace Pass 1 model with qwen3-vl-flash (already used in Pass 2 with good results). Requires diagnostic comparison before choosing.
- [ ] Cloudflare Worker: harmonize Telegram default-branch header forwarding with Anthropic branch pattern. Currently `worker/tg-proxy.js` default branch forwards `request.headers` wholesale (the Telegram API accepts this), while the `/anthropic/` branch uses a clean 4-header pattern (`Content-Type`, `x-api-key`, `anthropic-version`, `anthropic-beta` only — Anthropic API rejects extra CF-* / X-Forwarded-* headers). Defense-in-depth: apply the clean pattern to the Telegram branch as well — no functional change expected, but reduces future risk if Telegram API tightens header validation. Out of scope for Etap 1 (migration); pick up as a follow-up prompt on `worker/tg-proxy.js` when next touching it.
- [ ] Cloudflare Worker: add `console.log` at ingress (request received) and egress (response returned) of each of the four routing branches in `worker/tg-proxy.js`. Format: `[tg-proxy] {branch} in: {url.pathname}` and `[tg-proxy] {branch} out: {status} {elapsed_ms}ms`. Purpose: future latency debugging via Cloudflare Dashboard's Worker logs tab, without needing SSH into VDS. Currently the Worker has zero logging; any latency regression requires external `curl` reproduction to diagnose. Small-scope follow-up prompt.

## Planned — Technical debt

> Quality-of-life follow-ups discovered during the 2026-04-21 work session.
> None blocking, all worth doing before the next major refactor.

- [ ] **Refactor `src/bot/store/users.ts` to sync-init style.** The 2026-04-21
  fix for Б-9 (`ensureUsersLoaded()` lazy-await) is the minimal patch — it
  closes the user-visible regression but leaves the async-load class of races
  in place. Long-term direction is to load users synchronously at module
  import time, the same pattern used by `src/bot/store/botStats.ts`. Removes
  the entire race class, no lazy-await needed at any call site. See
  `bugs.md` Б-9 long-term follow-up for the original analysis.
- [ ] **Add `void` prefix to `handleRequestCommand` invocation in
  `src/bot/handlers/catalog.ts:375`.** Currently a floating promise — works
  behaviourally but stylistically inconsistent with `request.ts:89` which
  uses `void` explicitly. One-line fix; make sure any noscut/customs
  handlers that call request through callback_query use the same pattern.

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
