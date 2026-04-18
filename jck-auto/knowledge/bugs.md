<!--
  @file:        knowledge/bugs.md
  @project:     JCK AUTO
  @description: Open bugs tracker — site and bot, with symptom/file/hypothesis/action
  @updated:     2026-04-18
  @version:     1.4
  @lines:       ~230
-->

# Bugs — open issues tracker

> Updated: 2026-04-18
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

### С-3 — wrong CTA on all services pages
- **Pages:** /services/* (all)
- **Symptom:** "Позвонить" button instead of standard <LeadFormTrigger>. Not centered, action unclear.
- **File:** shared services page template or CTA component (verify before fix)
- **Action:** locate shared CTA component → replace with <LeadFormTrigger> → verify centering

## Important (noticeable but workarounds exist)

### С-2 — cursor does not change to pointer on clickable elements
- **Pages:** site-wide. Confirmed example: file upload button on /tools/auction-sheet
- **Cause:** clickable elements rendered as <div> or <a> without href, missing cursor: pointer
- **Action:** audit site-wide, ensure either <button> or Tailwind `cursor-pointer` class.
  Add to shared-mechanics.md design system: every clickable element must show pointer cursor.

### С-4 — site applications via /api/lead bypass Cloudflare Worker
- **File:** src/app/api/lead/route.ts
- **Symptom:** requests go directly to api.telegram.org, blocked by VDS provider —
  applications may not reach managers' group
- **Fix:** replace hardcoded https://api.telegram.org with process.env.TELEGRAM_API_BASE_URL
- **Reference:** telegram-bot.md → "Исходящий трафик"

### С-6 — cross-tab session leak in auction-sheet client
- **Page:** /tools/auction-sheet
- **Symptom:** When two browser tabs on https://jckauto.ru are open to
  /tools/auction-sheet, starting an analysis in tab A causes tab B to
  automatically pick up the same job and display the identical result on
  refresh (or on initial mount if opened after tab A started). The user
  may not realise their analysis result is visible to a sibling tab.
- **Reproduction:**
  1. Open /tools/auction-sheet in tab A. Log in (or stay anonymous).
  2. Upload a sheet in tab A. The client spinner starts.
  3. Open /tools/auction-sheet in tab B (same browser, same origin,
     any time before the 15-minute TTL expires).
  4. Tab B auto-starts polling the same job and renders the same result
     when it completes.
- **Root cause:** `AuctionSheetClient.tsx` persists active jobId to
  `localStorage['jckauto.auction_sheet.active_job']` for session-restore
  after screen-off / tab-switch (ADR [2026-04-18] Async-only contract
  for POST /api/tools/auction-sheet). On mount, the client reads this
  key unconditionally and starts polling if a value is present. There is
  no per-tab ownership — localStorage is shared across all tabs of the
  same origin by browser design. The server job-status endpoint
  (`/api/tools/auction-sheet/job/[jobId]`) validates only jobId format,
  not caller identity, so whoever asks gets the data.
- **Impact:**
  - Security (same-user cross-tab): a user's analysis result is visible
    in any sibling tab of the same browser for up to 15 minutes
    (server-side completed-jobs TTL), regardless of the sibling tab's
    Telegram auth state.
  - Security (scope limit): this variant-B fix addresses the same-user
    cross-tab case only. The server endpoint will still serve any
    jobId to any caller with the UUID — a separately tracked concern
    if jobIds are ever leaked (they are not currently exposed outside
    the client's own DOM / XHR).
  - UX: a user who accidentally opens the site in two tabs cannot start
    a fresh analysis in the second tab until the first completes or
    TTL expires — the second tab will always grab the existing job.
  - Economy: quota is consumed once per job (correct). Sibling tabs
    see the result without being charged — no extra quota leak, but
    also no isolation.
- **Hypothesis:** single hypothesis — session-restore logic with shared
  localStorage and no tab ownership. Confirmed by code read
  (`AuctionSheetClient.tsx` — `ACTIVE_JOB_STORAGE_KEY` constant and the
  on-mount effect that reads it without guards).
- **Fix plan (deferred, variant B — tab-id ownership):**
  1. On first mount in a given tab, generate `tabId = crypto.randomUUID()`,
     persist to `sessionStorage['jckauto.auction_sheet.tab_id']`
     (sessionStorage is per-tab by browser design).
  2. Change the shared localStorage entry structure from `"<jobId>"`
     (string) to `{jobId: string, ownerTabId: string}` (JSON).
  3. On mount: read localStorage + sessionStorage. Start polling only if
     `localStorage.ownerTabId === sessionStorage.tabId`. Otherwise
     (including when sessionStorage has no tabId — i.e. fresh tab),
     ignore the entry and behave as a fresh tab.
  3a. Orphan handling: if localStorage has an entry but no tab in the
     browser claims ownership (owner tab closed without cleanup before
     job completion), the UX should offer an explicit "Resume previous
     analysis?" action rather than auto-polling. Implementation detail
     for the fix prompt — may be as simple as showing a banner on the
     upload screen when an orphan is detected.
  4. On submit: write both `jobId` and this tab's `ownerTabId` to
     localStorage.
  5. On done / failed / explicit reset: clear both storage entries (as
     today).
  Alternatives considered and rejected:
  - sessionStorage only (variant A) — loses session-restore if the user
    accidentally closes the tab and reopens. Worse on mobile.
  - BroadcastChannel coordination (variant C) — more robust, but
    significantly more complex. Reserve for future if variant B proves
    insufficient.
- **When:** fix scheduled for AFTER commit landing the final cleanup of
  `AuctionSheetClient.tsx` (prompt 07 of the auction-sheet refactor
  series 02–07 tracked in `decisions.md § Active iterations`). Will
  likely be prompt 08 of the same series, or a new standalone series.
  Rationale: touching session-restore logic mid-refactor mixes concerns
  and inflates regression risk.
- **References:**
  - `src/app/tools/auction-sheet/AuctionSheetClient.tsx` —
    `ACTIVE_JOB_STORAGE_KEY` constant (near line ~108) and the mount
    effect that reads it.
  - `decisions.md` ADR [2026-04-18] Async-only contract for POST
    /api/tools/auction-sheet (defines session-restore as a feature).
  - `decisions.md § Active iterations` — [WIP 2026-04-18] Split
    AuctionSheetClient (context for why the fix is deferred).

### Б-2 — auction sheet handler in bot does not respond on photo
- **File:** src/bot/handlers/* (see tg-integration-plan.md Step 7)
- **Status:** code exists, but no response on photo in production
- **Blocked by:** Б-1 (test only after webhook fix to separate delay vs. real failure)
- **Action:** after Б-1 — live test, `pm2 logs jckauto-bot --lines 50 --nostream`, diagnose → fix

### Б-3 — Encar handler in bot does not respond on link
- **File:** src/bot/handlers/* (see tg-integration-plan.md Step 12)
- **Status:** code exists, but no response on encar.com link
- **Blocked by:** Б-1
- **Action:** same diagnostic protocol as Б-2

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

### Б-1 — bot reply delay (was: 2-5 minute delay)
- **Cause:** webhook was registered on jckauto.ru directly; VDS provider
  intermittently blocks Telegram IP ranges.
- **Applied fix:** 2026-04-10 — re-registered webhook to point at Cloudflare
  Worker URL (`tg-proxy.t9242540001.workers.dev/webhook/bot{TOKEN}`).
  See decisions.md ADR `[2026-04-10] Telegram webhook via Cloudflare Worker`.
- **Verification status:** NOT verified in 2026-04-15/16 session.
- **Action:** live test — send /start to @jckauto_help_bot, confirm
  <1s response. If delay still present, run getWebhookInfo and confirm
  url starts with `tg-proxy.t9242540001.workers.dev/webhook/`.
