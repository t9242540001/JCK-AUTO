<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources
  @updated:     2026-04-08
  @version:     1.0
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

## In Progress

- [~] Phase 2: Tariff monitoring (check-tariffs.ts + cron)
- [~] Phase 5: Finalization (SEO audit, mobile check, sitemap)
- [~] Merge all branches into main

- [ ] Каталог ноускатов (10 промптов): /catalog/noscut, LeadForm, рефакторинг URL, AI-pipeline — knowledge/noscut-spec.md + noscut-plan.md

## Planned — Site

- [ ] Mobile responsiveness — full page-by-page audit
- [ ] Add images to first 12 blog articles
- [ ] Register in Yandex.Webmaster and Google Search Console
- [ ] "Leave request" button on car detail page → /api/lead → managers group

## Planned — Bot

- [ ] Regenerate bot token — exposed in chats (security issue)
- [ ] Auto-post new cars to channel t.me/jckauto_import_koreya
- [ ] AI consultant (Claude API + knowledge base)

## Planned — Infrastructure

- [ ] Set up monitoring/alerting for PM2 processes
- [ ] Automate deploy via GitHub Actions (push to branch → build → restart)
