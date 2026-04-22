<!--
  @file:        knowledge/bugs.md
  @project:     JCK AUTO
  @description: Open bugs tracker — site and bot, with symptom/file/hypothesis/action
  @updated:     2026-04-22
  @version:     1.13
  @lines:       ~240
-->

# Bugs — open issues tracker

> Updated: 2026-04-19
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

### С-8 — encar handler hangs indefinitely on DeepSeek translation/power timeout
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

### Б-11 — mcp-gateway loses FILESYSTEM_ROOTS env on raw `pm2 restart` [Closed 2026-04-22]
- **Process:** mcp-gateway (PM2)
- **Severity:** Critical for diagnostics — without `FILESYSTEM_ROOTS` the
  MCP connector serves no files, breaking the deploy-log workflow
  (`/var/www/jckauto/deploy-logs/deploy-latest.log` becomes inaccessible
  via MCP) and any other read against the project tree.
- **Symptom:** After `pm2 restart mcp-gateway`, the MCP connector starts
  with no `FILESYSTEM_ROOTS` env. All filesystem reads return
  permission errors or empty results. Fixed temporarily by manually
  re-running with the env inline:
  `FILESYSTEM_ROOTS=/var/www/jckauto pm2 restart mcp-gateway --update-env`,
  but the next `pm2 restart` (without `--update-env`) drops it again.
- **Root cause:** PM2 `restart` does NOT re-read env from a config file
  or any `.env` source. It only re-spawns `pm_exec_path` with the env
  snapshot saved at start time. mcp-gateway's startup command on VDS
  was `FILESYSTEM_ROOTS=… pm2 start <bin>` — env passed inline at
  start, not declared anywhere persistent. After the first
  `pm2 restart` the env was lost.
- **Discovered:** observed sporadically since the deploy-log workflow
  was added (2026-04-15); root cause confirmed 2026-04-22.
- **Fix (2026-04-22):** declared `env: { FILESYSTEM_ROOTS:
  '/var/www/jckauto' }` on the mcp-gateway entry in
  `ecosystem.config.js` (committed). All future restarts go through
  `pm2 startOrReload ecosystem.config.js --only mcp-gateway`, which
  re-applies the declared env every time. Raw `pm2 restart
  mcp-gateway` is now FORBIDDEN by `rules.md` Infrastructure Rules.
  See ADR `[2026-04-22] Move PM2 process management to committed
  ecosystem.config.js`.

## Important (noticeable but workarounds exist)

### С-2 — cursor does not change to pointer on clickable elements
- **Pages:** site-wide. Confirmed example: file upload button on /tools/auction-sheet
- **Cause:** clickable elements rendered as <div> or <a> without href, missing cursor: pointer
- **Action:** audit site-wide, ensure either <button> or Tailwind `cursor-pointer` class.
  Add to shared-mechanics.md design system: every clickable element must show pointer cursor.

### Б-4 — no menu buttons for auction sheet and Encar in bot
- **File:** src/bot/handlers/start.ts
- **Symptom:** features exist but users do not know how to invoke them
- **Action:** add 2 inline buttons to start menu + callback handlers with usage instruction

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

### Б-5 — ~10-15% car photos rejected by Telegram
- **Symptom:** "wrong type of the web page content" via Worker, even though server returns valid JPEG
- **First reported:** March 2026
- **Status:** unknown — fallback to text card may have masked it
- **Action:** confirm with Vasily if still actual. If yes — investigate file_id caching
  (POST sendPhoto once, save returned file_id, reuse).

### Б-6 — bot applications can be sent without phone
- **File:** src/bot/handlers/request.ts
- **Symptom:** applications arrive with "Телефон: не указан" if user types text
  instead of pressing "Поделиться контактом" button
- **First reported:** March 2026 (case @danitsov)
- **Action:** read current request.ts → if no validation, add: reject application without phone
  OR fallback to (name + telegram username)
