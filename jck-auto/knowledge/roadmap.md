<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources
  @updated:     2026-04-10
  @version:     1.1
  @lines:       65
-->

# Roadmap

## Done

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
- [x] Bot: auction sheet analysis via photo (Qwen-VL, in-memory buffer, Worker download)
- [x] Bot: /noscut command — noscut catalog search with fuzzy match
- [x] Bot: /start deep link handling (web_encar, web_auction → special welcome + channel button)
- [x] Bot: extended /stats with command counters and traffic sources (botStats.ts)
- [x] Privacy page /privacy updated with Telegram data collection section

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

## Planned — Bot

- [ ] Auto-post new cars to channel t.me/jckauto_import_koreya
- [ ] AI consultant (Claude API + knowledge base)

## Planned — Infrastructure

- [ ] Set up monitoring/alerting for PM2 processes
- [ ] Automate deploy via GitHub Actions (push to branch → build → restart)
