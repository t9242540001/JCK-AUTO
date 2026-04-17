<!--
  @file:        knowledge/architecture.md
  @project:     JCK AUTO
  @description: Stack, file navigator, URL structure, key file relationships
  @updated:     2026-04-18
  @version:     1.1
  @lines:       ~160
-->

# Architecture

## Stack

- **Framework:** Next.js 16.1.6, App Router, TypeScript strict
- **Styling:** Tailwind CSS 4, shadcn/ui, Framer Motion
- **Bot:** node-telegram-bot-api (polling mode)
- **Storage:** JSON files on VDS (`/var/www/jckauto/storage/`)
- **AI:** DashScope (Qwen Vision/Text), DeepSeek (deepseek-chat)
- **PDF:** PDFKit (server-side, Roboto TTF for Cyrillic)
- **Fonts:** Space Grotesk (headings) + Inter (body)

## Design System

- Primary: #1E3A5F (navy), Secondary: #C9A84C (gold)
- Country accents: China #DE2910, Korea #003478, Japan #BC002D

## File Navigator

| Task | File |
|------|------|
| Site navigation config | src/lib/navigation.ts |
| Price calculation (single engine) | src/lib/calculator.ts |
| Tariff reference data | src/lib/tariffs.ts |
| Currency rates (VTB + CBR fallback) | src/lib/currencyRates.ts |
| VTB rate scraper | src/lib/vtbRatesScraper.ts |
| Legacy price wrapper (bot/scripts) | src/lib/priceCalculator.ts |
| Rate limiter (AI tools) | src/lib/rateLimiter.ts |
| DashScope client | src/lib/dashscope.ts |
| DeepSeek client | src/lib/deepseek.ts |
| Encar API client | src/lib/encarClient.ts |
| Cover image generator | src/lib/coverGenerator.ts |
| URL transliteration | src/lib/transliterate.ts |
| Cross-linking helper | src/lib/crossLinker.ts |
| News tag colors | src/lib/newsTagColors.ts |
| Catalog sync / cover selection | src/lib/catalogSync.ts |
| Screenshot AI parsing | src/lib/screenshotParser.ts |
| Constants / contacts | src/lib/constants.ts |
| Lead API | src/app/api/lead/route.ts |
| Exchange rates API | src/app/api/exchange-rates/route.ts |
| Encar analysis API | src/app/api/tools/encar/route.ts |
| Auction sheet API | src/app/api/tools/auction-sheet/route.ts |
| News API | src/app/api/news/route.ts |
| Bot handlers | src/bot/handlers/*.ts |
| Bot user store | src/bot/store/users.ts |
| Calculator core (shared UI) | src/components/calculator/CalculatorCore.tsx |
| Beta badge system | src/components/BetaBadge.tsx |
| Noscut delivery config | src/lib/deliveryConfig.ts |
| Inline lead form (noscut pages) | src/components/LeadForm.tsx |
| Noscut card component | src/components/noscut/NoscutCard.tsx |
| Noscut grid (pagination) | src/components/noscut/NoscutGrid.tsx |
| Noscut delivery table | src/components/noscut/NoscutDelivery.tsx |
| No model found CTA | src/components/noscut/NoModelFound.tsx |
| Catalog redirect middleware | src/middleware.ts |
| Noscut model research script | scripts/research-noscut-models.ts |
| Noscut catalog generator | scripts/generate-noscut.ts |
| Noscut price updater (weekly cron) | scripts/update-noscut-prices.ts |

## URL Structure

| URL | Description |
|-----|-------------|
| `/` | Homepage (Hero → Countries → CatalogPreview → NoscutPreview → HowItWorks → Calculator → Values → Warranty → FAQ → CTA) |
| `/catalog` | Car catalog (ISR 1h) |
| `/catalog/cars/[id]` | Car detail page |
| `/catalog/noscut` | Noscut catalog (~131 models, ISR 1h) |
| `/catalog/noscut/[slug]` | Noscut detail page |
| `/catalog/[id]` | 308 redirect → /catalog/cars/[id] (via middleware) |
| `/tools` | Tools hub (4 cards) |
| `/tools/calculator` | "Pod klyuch" calculator |
| `/tools/customs` | Customs duty calculator (individual vs company) |
| `/tools/auction-sheet` | AI auction sheet decoder |
| `/tools/encar` | Encar.com analyzer |
| `/calculator` | 301 → /tools/calculator |
| `/about` | About company |
| `/blog` | Blog (32+ MDX articles) |
| `/blog/[slug]` | Blog article |
| `/news` | News catalog |
| `/news/[slug]` | Daily news digest |
| `/news/tag/[tag]` | News by tag |
| `/api/lead` | POST — lead to Telegram group |
| `/api/exchange-rates` | GET — operational exchange rates |
| `/api/news` | GET — news feed |
| `/api/tools/encar` | POST — Encar analysis |
| `/api/tools/encar/pdf` | POST — Encar PDF report |
| `/api/tools/auction-sheet` | POST — auction sheet decode |
| `/api/tools/auction-sheet/pdf` | POST — auction sheet PDF |

## Key Relationships

```
CalculatorCore.tsx ──→ /api/exchange-rates ──→ currencyRates.ts ──→ vtbRatesScraper.ts
                                                                  └──→ CBR API (fallback)
                   ──→ calculator.ts ──→ tariffs.ts

EncarClient.tsx ──→ /api/tools/encar ──→ encarClient.ts ──→ Encar API
                                       └──→ deepseek.ts (power + translation)
                                       └──→ calculator.ts (cost breakdown)

Bot /calc ──→ fetchCBRRates() (direct, server-side)
           └──→ calculator.ts

News pipeline: rssParser → collector → processor (DeepSeek) → coverGenerator (DashScope) → publisher
```

## Request Queues

### Auction-sheet request queue

Server-side in-memory queue in `src/lib/auctionSheetQueue.ts`.

- **Concurrency:** 1 (strict — one request processed at a time)
- **Max queue size:** 10 (11th rejected with `queue_full`)
- **Completed-jobs TTL:** 15 minutes (to survive mobile screen-off / tab switches)
- **jobId:** `crypto.randomUUID()` (RFC 9562 v4)
- **Persistence:** none — state lives in single PM2 process memory
- **On restart:** pending jobs lost; active job aborted; clients must resubmit

Why concurrency=1: DashScope upstream soft-throttles concurrent requests
on the same API key (not via HTTP 429, but via elongated response times),
which causes timeouts for users even when we're far below the published
RPM cap. See `decisions.md` — ADR "[2026-04-18] Introduce server-side
in-memory queue for auction-sheet (concurrency=1, TTL=15min)".

Tests: `src/lib/auctionSheetQueue.test.ts`, run via
`npx tsx --test src/lib/auctionSheetQueue.test.ts`.
