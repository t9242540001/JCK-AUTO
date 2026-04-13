<!--
  @file:        knowledge/bugs.md
  @project:     JCK AUTO
  @description: Open bugs tracker — site and bot, with symptom/file/hypothesis/action
  @updated:     2026-04-14
  @version:     1.0
  @lines:       91
-->

# Bugs — open issues tracker

> Updated: 2026-04-14
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

### С-3 — wrong CTA on all services pages
- **Pages:** /services/* (all)
- **Symptom:** "Позвонить" button instead of standard <LeadFormTrigger>. Not centered, action unclear.
- **File:** shared services page template or CTA component (verify before fix)
- **Action:** locate shared CTA component → replace with <LeadFormTrigger> → verify centering

### Б-1 — bot replies with 2-5 minute delay
- **Cause:** webhook may be registered on jckauto.ru directly instead of Cloudflare Worker URL.
  VDS provider blocks Telegram IP ranges.
- **Verification command:** see telegram-bot.md → "Проверка статуса webhook"
- **Fix command:** see telegram-bot.md → "Команда регистрации webhook"
- **Action:** getWebhookInfo → if url does not start with
  tg-proxy.t9242540001.workers.dev/webhook/, run setWebhook per documented command

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

## Verify status (potentially stale)

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
