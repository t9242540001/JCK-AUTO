<!--
  @file:        knowledge/roadmap-archive-1.md
  @project:     JCK AUTO
  @description: Archived historical "Done" entries from roadmap.md (one-liners without dates, reference-only).
  @archived_from: knowledge/roadmap.md (sections "## Done")
  @archived_on: 2026-04-26
  @updated:     2026-04-26
  @version:     1.0
-->

# Roadmap — Archive 1 (historical Done entries)

> Reference-only. Not read by default at session start.
> Dated detailed entries stay in the active roadmap.md.

## Done (archived 2026-04-26)

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
