<!--
  @file:        knowledge/tg-integration-plan.md
  @project:     JCK AUTO
  @description: Plan for Telegram Login Widget, bot rate limiting, new bot tools (customs/auction/noscut)
  @updated:     2026-04-10
  @version:     1.9
  @lines:       175
-->

# Telegram Integration Plan

## Status legend
- [ ] not started
- [~] in progress
- [x] done

---

## Block 0 — Prerequisites (manual, no code)

- [ ] Step 0. Regenerate bot token in BotFather → replace in .env.local on VDS → pm2 delete + pm2 start jckauto-bot

---

## Block A — Rate Limiting Layer (implement BEFORE any new features)

- [x] Step 1. Create src/lib/botRateLimiter.ts
  - In-memory Map, key = telegram_id
  - Global limit: 20 requests/day per telegram_id (blocks automation scripts)
  - AI command cooldown (auction sheet, Encar): 1 request per 2 minutes per telegram_id
  - Calculator cooldown (/calc, /customs): 1 request per 10 seconds per telegram_id
  - Cleanup: delete records older than 24h on every check
  - Response on limit: generic message without disclosing limit values

- [x] Step 2. Extend src/lib/rateLimiter.ts (site)
  - ANONYMOUS mode: key = "ip:{ip}", limit = 3 TOTAL (lifetime, no reset).
    After 3 uses the counter is permanent — it does NOT reset after 24h or any period.
    Purpose: 3 free tries to evaluate the tool, then must authenticate. Not a daily quota.
  - AUTHENTICATED mode: key = "tg:{telegram_id}", limit = 10/day (resets every 24h).
    Authenticated users identified by httpOnly JWT cookie set after Telegram Login.
  - Add lastRequest: number to UsageRecord for 2-minute cooldown between AI requests.
  - checkRateLimit(ip, telegramId?) — if telegramId present, use tg-key and daily quota;
    otherwise use ip-key and lifetime quota.
  - @rule: anonymous ip-key records must NEVER be deleted or reset — they are permanent.
    Deletion of ip-key record = user gets 3 free tries again = bypass of the auth gate.

- [x] Step 3. Create src/app/api/auth/telegram/route.ts
  - Verify Telegram HMAC-SHA256 (key = SHA256 of bot token)
  - Reject if auth_date older than 86400 seconds (replay attack protection)
  - Rate limit: max 5 auth attempts per IP per hour (separate in-memory Map)
  - Save to storage/users.json: add fields source (encar/auction/customs/calculator), webAuthAt
  - Return httpOnly secure JWT cookie, 30-day expiry, contains telegram_id
  - Return deep link: https://t.me/jckauto_help_bot?start=web_{source}
  - @important: cookie is the only way site recognises returning authenticated users across
    different IPs (mobile networks, VPN, corporate proxy). Without cookie, user hits ip-key
    limit again on new IP even after authenticating. Cookie = auth persistence layer.

---

## Block B — Telegram Login Widget on Site

- [~] Step 4. Update rate limit exceeded UI on all /tools/* pages
  - **Step 4a done:** TelegramAuthBlock component created at src/components/TelegramAuthBlock.tsx
  - **Step 4b done:** TelegramAuthBlock integrated in AuctionSheetClient.tsx
  - **Step 4c done:** TelegramAuthBlock integrated in EncarClient.tsx
  - **Step 4d done:** auction-sheet/route.ts + encar/route.ts read tg_auth cookie, pass telegramId to rate limiter.
    Cooldown message (remaining > 0): "Подождите немного" for both modes. Quota message is auth-aware.
  - Blur last result (CSS filter: blur + pointer-events: none overlay)
  - Show block: "Get 10 requests/day — sign in via Telegram" + Telegram Login Widget
  - Counter "X/3 free uses" visible from first request (soft reminder, not pressure)
  - On successful auth: remove blur, update quota to tg-mode (10/day), show "Open in bot" button (deep link)
  - Fallback if Telegram script fails to load: show "Write to bot" button (direct link)

- [x] Step 5. Create src/app/privacy/page.tsx
  - Simple page at /privacy — required by Telegram for Login Widget (BotFather domain check)
  - Content: what is collected (Telegram ID, name, first contact date, which tool referred),
    what is not done (no selling, no third parties, no spam)
  - Checkbox "I agree to data processing" embedded in the auth screen (Step 4)

---

## Block C — New Bot Commands

- [x] Step 6. Add /customs command to bot (src/bot/handlers/customs.ts)
  - Same pattern as existing /calc handler
  - Calls calculateCustoms() from calculator.ts — do not change calculator logic
  - Apply botRateLimiter: 10-second cooldown
  - Label: "Ориентировочный курс" (NOT "Курс ЦБ РФ") — same rule as /calc
  - Button at end: "Подробнее на сайте" → https://jckauto.ru/tools/customs

- [x] Step 7. Add auction sheet via photo to bot (src/bot/handlers/auctionSheet.ts)
  - Handler on message.photo
  - Check botRateLimiter first — 2-minute cooldown. If too soon: reply and return
  - Reject photos > 5MB with message "Сожмите фото и отправьте снова"
  - Download photo to in-memory buffer via Telegram Worker URL (NOT api.telegram.org)
  - Pass buffer to /api/tools/auction-sheet — same endpoint as website
  - Return analysis as text; split into chunks if > 4096 chars
  - Clear buffer immediately after response — do not write temp files to disk

- [ ] Step 8. Add /noscut command to bot (src/bot/handlers/noscut.ts)
  - User sends: /noscut Toyota RAV4 (or just make)
  - Read storage/noscut/noscut-catalog.json
  - Fuzzy search: toLowerCase + includes on make and model fields
  - Return up to 5 cards: model name, price, inline button "Оставить заявку" (→ request flow)
  - If nothing found: "По этой модели ноускатов нет — оставьте заявку" + button
  - Apply botRateLimiter: 5-second cooldown

- [ ] Step 9. Update src/bot/handlers/start.ts — deep link handling
  - Extend /start handler: if message.text matches /\/start web_(.+)/, extract source
  - Save source to user record in users.json
  - Show special welcome: "Вы авторизовались через jckauto.ru. Теперь у вас 10 запросов в день на сайте."
  - Add button: "Подписаться на канал" → t.me/jckauto_import_koreya
  - Add button: "Поделиться номером" (request_contact, optional) with text "Чтобы менеджер мог связаться с вами"
  - Do NOT duplicate /start logic — add branch only

---

## Block D — Stats Improvement

- [ ] Step 10. Extend /stats command (src/bot/handlers/admin.ts + new storage/bot-stats.json)
  - New file storage/bot-stats.json: { commands: { calc, customs, auction, noscut, catalog }, sources: { web_encar, web_auction, direct }, webAuthCount }
  - Every command handler increments corresponding counter on execution
  - Write atomically: write to bot-stats.tmp.json → rename (prevents corrupt JSON on crash)
  - /stats displays new counters below existing user stats

---

## Block E — Knowledge Updates

- [ ] Step 11. After each step above: update relevant knowledge/*.md files
  - bot.md: new commands, botRateLimiter rules, bot-stats.json structure
  - shared-mechanics.md: extended rateLimiter.ts (two key modes, permanent ip-key, daily tg-key)
  - roadmap.md: mark completed steps
  - rules.md: new @rule entries for bot rate limiting and permanent anonymous counter
  - infrastructure.md: new storage files (bot-stats.json)

---

## Key rules for all steps in this plan

- @rule: bot ALWAYS calls Telegram API through Worker URL (tg-proxy.t9242540001.workers.dev), never api.telegram.org
- @rule: pm2 restart does NOT reload .env.local — use pm2 delete + pm2 start
- @rule: rate label is "Ориентировочный курс", never "Курс ЦБ РФ"
- @rule: client components must NOT call fetchCBRRates() — use /api/exchange-rates
- @rule: botRateLimiter must be checked BEFORE any API call in every bot handler
- @rule: bot photo handler must clear buffer immediately after sending response
- @rule: anonymous ip-key in rateLimiter NEVER resets — permanent lifetime counter

---

## Strategic Note — Future Auth Gate

When site traffic grows and anonymous API load becomes significant, the 3-free-tries
model will be replaced with a hard gate: **no access to AI tools without Telegram auth**.

What this means in practice:
- Auction sheet, Encar analyzer, and any future AI scanners will require login before
  the first use — no anonymous tries at all.
- Calculator tools (/calc, /customs) remain free and anonymous — they are lightweight
  and do not call external AI APIs.
- The rateLimiter.ts architecture already supports this: switching anonymous quota from
  3 to 0 is a one-line constant change (MAX_ANONYMOUS_REQUESTS = 0).
- UI change: instead of a counter "X/3 free uses", show "Sign in via Telegram to use
  this tool" immediately on page load.

This is a deliberate design decision: current 3-try model is for the growth phase
(lower friction, wider top of funnel). Hard gate is for the scale phase (cost control,
higher-quality lead capture). No architectural changes needed to switch — only config.

- @todo: when switching to hard gate, set MAX_ANONYMOUS_REQUESTS = 0 in rateLimiter.ts
  and update UI copy on all /tools/auction-sheet and /tools/encar pages.

---
