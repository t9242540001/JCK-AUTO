<!--
  @file:        knowledge/bugs.md
  @project:     JCK AUTO
  @description: Open bugs tracker — site and bot, with symptom/file/hypothesis/action
  @updated:     2026-04-27
  @version:     1.22
  @lines:       386
-->

# Bugs — open issues tracker

> Updated: 2026-04-27
> Source of truth for open bugs. After fix → ADR in decisions.md, entry removed from this file.
> Hypotheses listed only when diagnosis requires choosing between alternatives.
> Related: roadmap.md (high-level status), telegram-bot.md (bot architecture), tools.md.

## Critical (visible to all users, blocks core flows)

### С-1 — auction sheet analyzer returns "network error" on small images
- **Page:** /tools/auction-sheet
- **Symptom:** "Ошибка сети. Проверьте подключение." even on 170 KB photos
- **Started after:** Telegram auth + Sharp compression deploys (week of 2026-04-10)
- **Hypotheses (priority order):**
  1. Rate limiter exhausted for testing IP (3 lifetime for anonymous)
  2. Broken tg_auth cookie handling — exception instead of treating as anonymous
  3. DashScope or nginx-level failure unrelated to Sharp
- **Action:** diagnostic before fix — `pm2 logs jckauto --lines 50 --nostream`,
  DevTools Network response body, `cat /var/www/jckauto/storage/rate-limits.json | head -50`
- **Status Update 2026-04-16:** RESOLVED for generic case. Three layered fixes:
  (1) Sharp compression (ADR [2026-04-10] Image compression before DashScope),
  (2) multi-pass parallel OCR pipeline (ADR [2026-04-16] Multi-pass parallel OCR),
  (3) DeepSeek primary for Step 2 text parse (ADR [2026-04-15] DeepSeek primary).
  Generic "Ошибка сети" no longer reproduces on normal-size auction sheet photos.
  Remaining edge case — see С-5 (handwritten HAA sheets trigger DeepSeek JSON
  parse fail, cascade exceeds nginx 60s timeout).
  **Status Update 2026-04-18:** User-visible symptom fully closed by the
  async queue contract (ADR [2026-04-18] Async-only contract for POST
  /api/tools/auction-sheet) + per-endpoint nginx 200s timeout + 15MB body —
  slow cascades no longer cause "Ошибка сети", because the client polls
  a job status endpoint instead of holding an HTTP request open. С-1 closed.

### Б-11 — mcp-gateway lost FILESYSTEM_ROOTS env after `pm2 delete all` [Closed 2026-04-22]
- **Process:** mcp-gateway (PM2)
- **Severity:** Critical for diagnostics — without `FILESYSTEM_ROOTS`
  the MCP connector returns `Filesystem access disabled —
  FILESYSTEM_ROOTS is empty` to every read, breaking the deploy-log
  workflow (`/var/www/jckauto/deploy-logs/deploy-latest.log` becomes
  inaccessible via MCP) and any other read against the project tree.
- **Symptom:** On 2026-04-22, while clearing duplicate jckauto-bot
  processes from the cwd-inheritance incident, the operator ran
  `pm2 delete all` — wiping the running `mcp-gateway` process along
  with the bots. Restarting `mcp-gateway` brought it up with empty
  `FILESYSTEM_ROOTS`. The JCK AUTO Files MCP connector returned
  `Filesystem access disabled` to every read until the env was
  manually re-passed inline.
- **Root cause:** `mcp-gateway`'s `FILESYSTEM_ROOTS` value was passed
  inline on the original `pm2 start` command line weeks earlier and
  never persisted anywhere — no `.env` file, no `dump.pm2` capture, no
  hardcode in `/opt/ai-knowledge-system/server/start.sh`. Once the
  PM2 process was deleted, the value was gone. PM2 has no mechanism
  to recover env from a runtime-only source.
- **Discovered:** 2026-04-22 (the `pm2 delete all` incident).
- **Fix (2026-04-22):** declared `env: { FILESYSTEM_ROOTS:
  '/var/www/jckauto/app/jck-auto' }` on the mcp-gateway entry in the
  committed `ecosystem.config.js`. All future restarts go through
  `pm2 startOrReload ecosystem.config.js --only mcp-gateway`, which
  re-applies the declared env every time. Raw `pm2 restart
  mcp-gateway` is now FORBIDDEN by `rules.md` Infrastructure Rules.
  Source code for the MCP server still lives in
  `/opt/ai-knowledge-system/`; only the PM2 process definition (with
  env) lives in this repo. See ADR `[2026-04-22] Move PM2 process
  management to committed ecosystem.config.js`.

### Б-13 — Stale jckauto-bot process survived ecosystem.config.js reload for 13 hours [Closed 2026-04-22]
- **Process:** jckauto-bot (PM2), port 8443
- **Severity:** Critical for users — 20-second latency per callback
  in `/calc`, with `ETELEGRAM: query is too old` errors on the
  server. Bot effectively unusable during the window.
- **Symptom:** After commit `59555b8` (ecosystem.config.js
  introduction, 2026-04-22) merged and deploy.yml ran, the bot
  continued running on a 13-hour-old manual startup command
  (`/usr/bin/bash -c "npx tsx -r dotenv/config
  scripts/start-bot.ts dotenv_config_path=.env.local"`). The
  ecosystem.config.js file declares a different form
  (`script: 'node_modules/.bin/tsx'`, `interpreter: 'none'`, args
  without the bash wrapper). Each post-merge `pm2 startOrReload
  ecosystem.config.js --only jckauto-bot` executed during the
  session preserved the stale process definition unchanged. A
  second process kept trying to spawn under the new form, failing
  with `EADDRINUSE: 0.0.0.0:8443` because port was held by the
  stale one, then quieting down after burning through
  `max_restarts: 5`. The stale process served callbacks but slowly
  due to 13 hours of accumulated runtime state.
- **Root cause:** `pm2 startOrReload <ecosystem-file>` is graceful
  reload for already-online processes. It re-spawns the running
  process using its EXISTING in-memory `pm_exec_path`,
  `script_args`, and env snapshot — the values PM2 captured when
  the process was first started. It does NOT re-read any field
  from the ecosystem file for an already-online process.
  `pm2 delete <name>` before the next `pm2 start` is the only
  way to apply changes from ecosystem.config.js to an existing
  process. This applies to every field: script, interpreter, args,
  cwd, env, max_restarts.
- **Fix (2026-04-22 evening):**
  ```bash
  pm2 delete jckauto-bot
  cd /var/www/jckauto/app/jck-auto
  pm2 startOrReload ecosystem.config.js --only jckauto-bot
  pm2 save
  ```
  Verified via `pm2 describe jckauto-bot | grep -E "script
  path|script args|uptime|restart"`: fresh script path
  `node_modules/.bin/tsx`, correct args, uptime 3s, 0 restarts.
  Bot latency returned to normal; live verification of `/calc`
  confirmed instant per-step responsiveness.
- **Preventive action (same commit as this entry):** new
  Infrastructure Rule in `rules.md`; new subsection in
  `infrastructure.md` PM2 Processes section; one-phrase correction
  in the existing infrastructure.md Deploy section (removing a
  misleading `(re)spawns` wording that suggested reload did what
  it does not); new ADR in `decisions.md` documenting the
  semantics and the pm2 delete requirement.
- **Related historical evidence:** during Prompt 2.4.3.6.1
  post-merge, a plain `pm2 startOrReload --only mcp-gateway`
  preserved the old (wrong) args; only the explicit `pm2 delete
  mcp-gateway && pm2 start ecosystem.config.js --only
  mcp-gateway` applied the corrected entry. That signal was
  present in the session but not generalized until Б-13 made the
  pattern production-visible.
- **Discovered:** 2026-04-22 evening by Vasily reporting
  "calculator very slow, every request 20 seconds" after the 2.4.4
  live verification attempt.
- **Status:** Closed 2026-04-22 (same-session fix).
- **Related ADR:** `[2026-04-22] pm2 startOrReload is graceful
  reload — pm2 delete required to apply any ecosystem.config.js
  change`.

## Important (noticeable but workarounds exist)

### Б-12 — Articles stopped publishing on the site since 2026-04-08 [Closed 2026-04-24]
- **Symptom:** No new articles appearing on the site since 2026-04-08.
  Noted by Vasily on 2026-04-22.
- **Root cause (2026-04-24):** DashScope text-generation systematically
  timed out from VDS on large requests (`qwen3.5-plus`, 6000+ output
  tokens). Small DashScope requests (5-token ping) returned 200 so the
  key and network were fine; but every cron run from ~2026-04-11
  onward died at the first AI call in `topicGenerator.ts`
  (`generateTopic`) with `DashScope API failed after 2 retries: The
  operation was aborted due to timeout`. Even after prompt 01 fixed
  that call site, the article body call in `generator.ts` had the
  same failure mode at 8192 output tokens.
- **Fix (2026-04-24):** migrated both AI calls in the article pipeline
  from `callQwenText` (DashScope) to `callDeepSeek`. Two commits:
  - Prompt 01 commit `c3e8513` — `topicGenerator.ts` (1024 maxTokens).
  - Prompt 02 (this commit) — `generator.ts` (8192 maxTokens).
  `knowledge/rules.md` → API Economy Rules now bans `callQwenText` in
  the content text pipeline. See ADRs `[2026-04-24] Migrate article
  text generation to DeepSeek — step 1/2 (topicGenerator)` and
  `[2026-04-24] Migrate article text generation to DeepSeek —
  step 2/2 (generator)`.
- **Class precedent:** DashScope text-generation from VDS had already
  been replaced with DeepSeek for the auction-sheet pipeline (ADRs
  `[2026-04-15] DeepSeek primary for Step 2 text parse` and
  `[2026-04-18] DeepSeek timeout 60s→180s`). This fix applies the
  same class fix to the article pipeline.
- **Discovered:** 2026-04-22 by Vasily (noted during session
  stabilization after the PM2 incident).
- **Status:** Closed 2026-04-24 after both migration commits land.
  Post-deploy verification: operator runs the article cron manually
  and confirms both steps (topic + article body) complete via
  DeepSeek logs (`[DeepSeek] model=deepseek-chat tokens=…`).

### С-8 — encar handler hangs indefinitely on DeepSeek translation/power timeout [Closed 2026-04-25]
- **File:** src/bot/handlers/encar.ts
- **Severity:** Critical — bot becomes unresponsive for the affected user
  for the duration of the hang (observed 2026-04-22: indefinite, only
  resolved by `pm2 delete + pm2 start`).
- **Symptom:** User sends an encar.com link, bot replies
  "🔍 Получаю данные с Encar...", AI enrichment partially completes (logs
  show `[encar] estimateEnginePower: ... → N hp (...)`), then NO further
  log lines and NO message back to the user. Other user messages to the
  bot may also stall because the event loop is waiting on the unresolved
  promise.
- **Root cause:** `registerEncarHandler` runs power estimation and Korean
  translation in parallel via
  `await Promise.allSettled([estimateEnginePower(...), translateEncarFields(...)])`
  with NO timeout wrapper on either call. `Promise.allSettled` returns
  only when BOTH promises settle. When DeepSeek (used by both
  `estimateEnginePower` and `translateEncarFields` indirectly) is slow
  or hangs (likely cause: concurrent auction-sheet job in the shared
  queue saturating the DeepSeek connection), the handler blocks
  indefinitely.
- **Discovered:** 2026-04-22 during live verification of Prompt 2.4.3.
  Initially suspected as a regression from the inline-keyboards refactor,
  but log analysis confirmed the hang occurs BEFORE the
  `bot.sendMessage` call where the helper is used — the refactor is
  innocent.
- **Workaround:** `pm2 delete jckauto-bot && pm2 start ...` per the
  canonical form in `infrastructure.md` PM2 Processes. Restores
  responsiveness immediately. The user's hung request is lost — they
  must retry.
- **Action:** separate prompt AFTER series 2.4 completes. Wrap each
  `Promise.allSettled` arm in `Promise.race([call(), timeout(30000)])`;
  on timeout set `result.translationFailed = true` (or skip power
  estimate) and continue to `formatEncarResult` + `bot.sendMessage`.
  Do NOT change to `Promise.race` of the whole thing — that loses the
  partial success path. Single-file fix (`src/bot/handlers/encar.ts`).
- **Related:** the auction-sheet pipeline already has timeouts
  (DeepSeek 180s, polling 180s) — encar handler is the outlier.
- **Fix (2026-04-25):** `withTimeout` helper in `src/bot/handlers/encar.ts` bounds each arm of the AI-enrichment `Promise.allSettled` at 30s; orphaned original promises receive a `.catch(() => {})` to silence late rejections. Handler now completes within ~40s worst case. See ADR `[2026-04-25] С-8 closed — 30s per-arm timeout on encar AI enrichment`.
- **Status:** Closed 2026-04-25.

### Б-6 — bot applications can be sent without phone [Closed 2026-04-25]
- **File:** src/bot/handlers/request.ts
- **Symptom:** applications arrive with "Телефон: не указан" if user types text
  instead of pressing "Поделиться контактом" button
- **First reported:** March 2026 (case @danitsov)
- **Action:** read current request.ts → if no validation, add: reject application without phone
  OR fallback to (name + telegram username)
- **Fix (2026-04-25):** introduced `normalizePhone`/`hasValidPhone` helpers in `src/bot/handlers/request.ts`; applied at four entry points (handleRequestCommand truthy check, bot.on("contact") Telegram payload, bot.on("message") manual digits, post-savePhone getUser lookup). 10–15 digit format. EP-4 silent-exit replaced with user-visible "/start" recovery + console.error breadcrumb. Half 1 of 2 — submit-without-phone fallback follows in a separate prompt.
- **Fix half 2 (2026-04-25):** added "📝 Без телефона (через Telegram)" button on the phone-prompt screen. Tapping submits a lead identified by `@username`, marked with `⚠️ Заявка без телефона` banner and `📨 Связь: @username (без телефона)` line in the operator group. Refuses cleanly when `msg.from.username` is absent. Race-skip added to `bot.on("message")` for the new button text. `finishRequest` gained an optional `{ withoutPhone?: boolean }` parameter; existing call sites unchanged. See ADR `[2026-04-25] Б-6/2 — submit-without-phone fallback`.
- **Status:** Closed 2026-04-25.
- **Related ADR:** `[2026-04-25] Б-6 closed — phone validation single source of truth (lead flow, half 1 of 2)`.

### Б-15 — Lead audit log [Closed 2026-04-25]
- **Files:** `src/bot/handlers/request.ts`, `${STORAGE_PATH}/leads/leads.log` (default `/var/www/jckauto/storage/leads/leads.log`)
- **Symptom:** Lead delivery failures (Telegram API error, rate-limit, network drop) logged only to stderr; user saw `✅ Заявка принята` while operator received nothing. No audit trail outside the group chat — group purge / message deletion lost lead history. No analytics surface.
- **Reported:** 2026-04-25 by Vasily during Б-6 series — "лучше записывать логи заявок пользователей в будущем, чтобы ничего не терялось".
- **Fix (2026-04-25):** added module-private `appendLeadLog(entry)` helper to `src/bot/handlers/request.ts`. Called from `finishRequest` BEFORE `bot.sendMessage`, so a delivery failure still records the lead. Path follows project `STORAGE_PATH` convention: `${STORAGE_PATH}/leads/leads.log`. Format: one JSON line per attempt with `{ timestamp, telegramUserId, username, firstName, lastName, phone, source, withoutPhone }`. Auto-creates `${STORAGE_PATH}/leads/` on first write. Fail-open: any FS error caught, logged to stderr, swallowed — bot continues.
- **Status:** Closed 2026-04-25.
- **Related ADR:** `[2026-04-25] Б-15 closed — lead audit log (append-only JSON-line file)`.
- **Operational note:** if the bot runs under a different `STORAGE_PATH` than the default, set the env var in `ecosystem.config.js`. `logrotate.conf` should add the new path if not already covered.

### С-2 — cursor does not change to pointer on clickable elements [Closed 2026-04-26]
- **Pages:** site-wide. Confirmed example: file upload button on /tools/auction-sheet
- **Cause:** clickable elements rendered as <div> or <a> without href, missing cursor: pointer
- **Action:** audit site-wide, ensure either <button> or Tailwind `cursor-pointer` class.
  Add to shared-mechanics.md design system: every clickable element must show pointer cursor.
- **Fix (2026-04-26):** site-wide audit + targeted fixes in commit `196ac3d`. Five `<div onClick>` elements in `LeadFormTrigger.tsx`, `LeadFormModal.tsx`, `catalog/CarCard.tsx`, `noscut/NoscutCard.tsx`, `tools/encar/EncarClient.tsx` received `cursor-pointer` Tailwind class. Other `<div onClick>` occurrences are stopPropagation-only modal-body wrappers (not user-clickable in UX sense). Native `<button>`, `<a href>`, and `<Link>` elements left untouched (browser default cursor is correct). Verification audit on the same day confirmed 0 remaining clickable non-button elements without cursor-pointer.
- **Prevention:** new `@rule cursor-pointer on clickable non-button elements` entry added to `knowledge/rules.md` (UI/UX section) — same commit. Captures the rule so future code with `<div onClick>` carries cursor-pointer by default.
- **Long-term follow-up:** strategic initiative #4 registered in roadmap.md (commit `7d0d0e4`) — full a11y migration of clickable non-button elements to native `<button>` for keyboard navigation, screen-reader semantics, and focus styles. Cursor-pointer was the visible symptom; that initiative will address the underlying accessibility gap.
- **Status:** Closed 2026-04-26.

### Б-4 — no menu buttons for auction sheet and Encar in bot [Closed 2026-04-26]
- **File:** src/bot/handlers/start.ts
- **Symptom:** features exist but users do not know how to invoke them
- **Action:** add 2 inline buttons to start menu + callback handlers with usage instruction
- **Fix (2026-04-26):** добавлены два inline-кнопки в стартовую клавиатуру (`src/bot/handlers/start.ts`): `🔍 Расшифровать аукционный лист` (callback `auction_info`) и `🇰🇷 Анализ авто с Encar` (callback `encar_info`). Обе кнопки шлют instruction-сообщение объясняющее как использовать фичу. Финальная структура клавиатуры: [Calc][Catalog] / [Auction][Encar] / [Связаться] / [📤 Поделиться]. Коммит `502d818`.
- **Status:** Closed 2026-04-26.

### Б-7 — middleware-manifest ENOENT / 720+ PM2 restarts
- **File:** /var/www/jckauto/app/jck-auto/.next/server/middleware-manifest.json
- **Symptom:** pm2 error log contains hundreds of:
  `Error: Cannot find module '.../.next/server/middleware-manifest.json'`
  and `Error: ENOENT: no such file or directory, open '.../.next/BUILD_ID'`.
  `pm2 status` shows 720+ restarts on `jckauto` process.
- **Hypothesis:** race condition during two-slot symlink swap — in-flight
  Next.js requests read the old slot path cached in memory while the symlink
  points to the new slot whose build is mid-generation. Does NOT manifest
  as user-visible downtime because PM2 restarts fast.
- **Impact:** log spam, restart counter inflation, unclear whether any
  user requests return 500. Not blocking production.
- **Action:** separate bug-hunt session. Diagnose via correlation of restart
  timestamps with deploy timestamps. Candidate fix: pm2 graceful reload
  (pm2 reload instead of restart), or hold symlink swap until next start
  completes (harder).

### Б-9 — user store race on bot restart [Closed 2026-04-21]
- **File:** src/bot/store/users.ts, src/bot/handlers/request.ts
- **Severity:** High — silently breaks "Оставить заявку" CTAs after every bot restart.
- **Symptom:** After `pm2 delete + pm2 start`, existing users tapping an
  inline "Оставить заявку" button receive "Нажмите /start чтобы начать."
  instead of the phone-request keyboard. Starts working after the user
  types /start (which triggers saveUser → loadUsers).
- **Root cause:** `src/bot/store/users.ts` is an async-load store: the
  in-memory `users` Map is populated only inside the async `loadUsers()`
  function, which is called only by async public accessors. The sync
  `getUser(chatId)` accessor does not trigger the load, so immediately
  after process restart it returns `undefined` until some other code
  path has awaited loadUsers. `handleRequestCommand` in
  `src/bot/handlers/request.ts` called `getUser` synchronously without
  pre-hydrating, resulting in a spurious fallback.
- **Fix (2026-04-21):** Exposed `ensureUsersLoaded()` from `users.ts`.
  `handleRequestCommand` became async and awaits `ensureUsersLoaded()`
  before calling `getUser`. Callback_query listener calls the handler
  with `void` to intentionally not await. See ADR
  `[2026-04-21] Bot user store lazy-load race — minimal lazy-await fix`.
- **Discovered by:** Live verification of Prompt 2.4.2 (adding result
  keyboard to auction-sheet handler) — the new keyboard made the race
  reproducible because each bot restart created a larger pool of
  "existing buttons on old messages" in the wild.
- **Long-term follow-up:** Consider rewriting users.ts in the
  synchronous-load-at-import style used by `botStats.ts` — removes
  the race class entirely. Deferred; not blocking.
  **Update 2026-04-26:** Phase 5a выполнен коммитом `f90d7e5` — `users.ts` теперь load на старте через sync `fs.readFileSync`. Async public API сохранён для backward compatibility (Phase 5b после 24h soak). Корень класса бугов структурно закрыт: race условие более невозможно даже если call site забывает `ensureUsersLoaded()`. Phase 5b — see roadmap.md → Planned — Technical debt.

### Б-8 — capture-deploy-log.yml registration verification pending
- **File:** .github/workflows/capture-deploy-log.yml
- **History:**
  - 2026-04-14: workflow file added in Prompt 05 (ADR [2026-04-15]
    Separate workflow for runner-side deploy log capture).
  - 2026-04-15 (Prompt 08.6): `workflow_dispatch:` added as second
    trigger to force GitHub Actions registration
    (ADR `[2026-04-15] Capture Deploy Log: workflow_dispatch`).
- **Symptom before fix:** workflow did NOT appear in GitHub Actions
  workflows API response; Deploy runs completed without triggering
  Capture runs; no log files written to /var/www/jckauto/deploy-logs/.
- **Verification status:** NOT verified after Prompt 08.6. Three indicators
  to check: (a) GitHub Actions registry (`curl api.github.com/.../actions/workflows`
  returns 4 workflows incl. Capture, not 3); (b) UI at
  `https://github.com/t9242540001/JCK-AUTO/actions/workflows/capture-deploy-log.yml`
  shows "Run workflow" button; (c) after a real Deploy run completes,
  a Capture run appears in Actions UI within ~60s and a log file
  appears on VDS.
- **Action:** next session — check all three indicators. If still
  unregistered → rename workflow file (fallback plan).

### Б-новый-A — Two inconsistent bot menus

- **Symptom:** Бот показывает два разных меню одновременно с разным набором сервисов:
  (1) **Inline-keyboard** в /start-сообщении содержит [Рассчитать стоимость, Каталог, Расшифровать аукцион, Анализ авто с Encar, Связаться, Поделиться ботом].
  (2) **BotFather command list** (нативное «Меню» в Telegram UI, кнопка слева от поля ввода) содержит [/start, /calc, /customs, /catalog, /noscut].
  Расхождения: в inline-меню НЕТ `/customs` (калькулятор таможни) и `/noscut` (поиск ноускатов). В command list НЕТ аукционного листа и Encar (потому что они триггерятся через `bot.on('message')`, не через slash-команды).
- **Impact:** Пользователь видит два разных набора функций в зависимости от того, на что нажал. Часть сервисов (`/customs`, `/noscut`) недоступна через основное inline-меню; часть (auction, encar) недоступна через командное меню. Пользователь не получает полной картины возможностей бота.
- **Discovered:** 2026-04-26 by Vasily (скриншот в чате стратегического партнёра).
- **Root cause hypothesis:** Inline-меню формируется в `src/bot/handlers/start.ts` (обновлено сегодня в Б-4). BotFather command list — отдельная конфигурация на стороне Telegram через `bot.setMyCommands()` или вручную через @BotFather, не попадает в git. Два источника не синхронизированы.
- **Action:** TBD при реализации. Обсудить дизайн меню (см. варианты ниже), затем серия промптов на синхронизацию. Кандидаты решений:
  (a) 6 сервисов в inline (3×2) + полный command list (`/calc /customs /catalog /noscut`);
  (b) Самые востребованные (Calc, Catalog, Auction, Encar) в inline (2×2) + полный command list со всеми + кнопка «Все возможности» открывает второе сообщение;
  (c) Что-то третье.
  Дополнительно: зафиксировать BotFather command list в коде (например, скрипт `scripts/sync-bot-commands.ts` который вызывает `bot.setMyCommands([...])` при деплое), чтобы избежать дрейфа в будущем.
- **Status:** Open.

## Verify status (potentially stale)

### С-5 — auction sheet fails on handwritten HAA sheets (Allion case)
- **Page:** /tools/auction-sheet
- **Symptom (original):** "Ошибка сети. Проверьте подключение." specifically on
  handwritten HAA-format sheets (reproducible on Toyota Allion test photo).
  Normal printed USS sheets (like Toyota Wish) work fine.
- **Started after:** Multi-pass OCR pipeline deployed 2026-04-16.
  Architecture itself is sound — the bug is in Step 2 fallback cascade.
- **Diagnostics captured:**
  - Pass 1 OCR: chars=271 (compared to 510 on printed sheets — OCR quality
    lower on handwritten input, but not empty)
  - Pass 2 OCR: chars=17 ("no codes") — OK for Allion, damages minimal
  - Pass 3 OCR: chars=71 — OK
  - Step 2 primary (DeepSeek): "Failed to parse DeepSeek API response as
    JSON" — 3 retries, all fail identically
  - Step 2 fallback (qwen3.5-flash): DashScope timeout after 60s (DashScope
    text models unreliable from VDS — see ADR [2026-04-15] DeepSeek primary)
  - Total: >70s, nginx closes connection, user sees "Ошибка сети"
- **Status Update 2026-04-18:** User-impact symptom closed. Async queue
  contract (ADR [2026-04-18]) + DeepSeek timeout 180s / 2 retries
  (ADR [2026-04-18]) + nginx 200s per-endpoint timeout together prevent
  the cascade from ever surfacing as "Ошибка сети". The underlying root
  cause — DeepSeek occasionally emitting non-JSON for specific OCR
  content patterns — is NOT yet explained, but no longer user-visible.
  Moved to Verify status: needs live retest on Allion photo to confirm
  it now produces a usable analysis (or a graceful `parse_error:` failure
  with result screen), not a timeout.
- **Action:** live retest on Toyota Allion handwritten sheet. If result
  card appears → close. If still fails → the old Prompt 09.3.7 plan
  (log first 500 chars of DeepSeek response on parse failure) resurfaces.

### Б-14 — /news route declares ISR but renders Dynamic (declaration↔runtime drift) [Closed 2026-04-25]
- **Files:** `src/app/news/page.tsx`, `src/app/news/[slug]/page.tsx`, `src/app/news/tag/[tag]/page.tsx`
- **Symptom:** All three /news files had `export const revalidate = 3600;` and a JSDoc header saying `@runs ... ISR revalidate=3600`. But the Next.js 16.1.6 build summary showed every /news route under the `ƒ (Dynamic)` marker — declared ISR, actually Dynamic at runtime.
- **Discovered:** 2026-04-24 (build output review during Blog ISR Migration verification).
- **Root cause (2026-04-25):** Two distinct mechanisms.
  - `/news/page.tsx` and `/news/tag/[tag]/page.tsx` use `searchParams: Promise<{ page?: string }>` for pagination. Reading `searchParams` is a Dynamic API in Next.js 16; it forces per-request rendering and silently overrides any `revalidate` export.
  - `/news/[slug]/page.tsx` does NOT use `searchParams`, but lacked `generateStaticParams`. A route with dynamic segments and no `generateStaticParams` opts out of static/ISR rendering by default.
- **Fix (2026-04-25):**
  - Added `generateStaticParams()` to `/news/[slug]/page.tsx` reading slugs from `getAllNewsDays()`. Build summary flipped this route from `ƒ (Dynamic)` to `● (SSG)` with on-demand ISR for new slugs (matches `/blog/[slug]`).
  - Updated JSDoc and added inline `@rule` comments on `/news/page.tsx` and `/news/tag/[tag]/page.tsx` documenting that `searchParams` access overrides `revalidate` at runtime. The export is kept as documentation of intent (it would become effective if pagination ever moves to a path-based form).
- **Status:** Closed 2026-04-25.
- **Related ADR:** `[2026-04-25] Б-14 closed — /news rendering mode reconciled with code shape`.
- **Out-of-scope follow-up:** moving `?page=` pagination to path-based `/news/page/[N]` would let `/news` and `/news/tag/[tag]` actually be ISR. Significant scope (URL shape, sitemap, internal links, possible SEO impact). Not currently scheduled.

### Б-5 — ~10-15% car photos rejected by Telegram
- **Symptom:** "wrong type of the web page content" via Worker, even though server returns valid JPEG
- **First reported:** March 2026
- **Status:** unknown — fallback to text card may have masked it
- **Action:** confirm with Vasily if still actual. If yes — investigate file_id caching
  (POST sendPhoto once, save returned file_id, reuse).

