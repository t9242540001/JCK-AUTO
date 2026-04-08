<!--
  @file:        knowledge/integrations.md
  @project:     JCK AUTO
  @description: External APIs — usage, files, rate limits, costs, env vars
  @updated:     2026-04-08
  @version:     1.0
  @lines:       100
-->

# External Integrations

## DashScope (Alibaba Cloud — Qwen models)

- **Used for:** Vision AI (auction sheets, screenshot parsing), text generation (articles), image generation (covers)
- **Files:** `src/lib/dashscope.ts`, `src/lib/coverGenerator.ts`, `src/lib/screenshotParser.ts`
- **Models:** qwen3.5-plus (default vision), qwen3.5-flash, Qwen-Image-2.0-Pro
- **Runs from:** VDS (Singapore region, no IP block)
- **Cost:** ~$0.002/vision call, ~$0.01/article, ~$0.04/cover
- **Env:** `DASHSCOPE_API_KEY`

## DeepSeek

- **Used for:** News processing (3 parallel summary calls), Encar engine power estimation, Encar field translation (Korean→Russian)
- **Files:** `src/lib/deepseek.ts`, `src/lib/encarClient.ts`, `src/services/news/processor.ts`
- **Model:** deepseek-chat
- **Rate limit:** 10 req/min (internal limiter in deepseek.ts)
- **Cost:** input $0.28/M tokens, output $0.42/M tokens (~$0.002/news digest)
- **Env:** `DEEPSEEK_API_KEY`

## CBR (Central Bank of Russia)

- **Used for:** Baseline exchange rates (EUR, USD, CNY, KRW, JPY) — fallback when VTB scraper fails
- **Files:** `src/lib/currencyRates.ts`
- **Endpoint:** `https://www.cbr-xml-daily.ru/daily_json.js`
- **No auth required**
- **Cache:** 6 hours in-memory

## Sravni.ru (VTB rate scraper)

- **Used for:** Real VTB bank sell rates (primary source for exchange rates)
- **Files:** `src/lib/vtbRatesScraper.ts`
- **Endpoints:** `https://www.sravni.ru/bank/vtb/valjuty/{usd,eur,cny,jpy,krw}`
- **Method:** Parse `__NEXT_DATA__` JSON → filter rates by currency → most recent sell
- **No auth required**
- **Timeout:** 8s per currency, all 5 run in parallel
- **KRW:** Always returns no-data (no Russian banks trade KRW) → falls back to CBR + markup

## Google Drive

- **Used for:** Car catalog photo storage
- **Files:** `src/lib/googleDrive.ts`, `scripts/sync-catalog.ts`
- **Env:** `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`

## Telegram Bot API

- **Used for:** @jckauto_help_bot (calculator, catalog, leads)
- **Files:** `src/bot/index.ts`, `src/bot/handlers/*.ts`
- **Mode:** Long polling (not webhook)
- **Env:** `TELEGRAM_BOT_TOKEN`

## Encar API

- **Used for:** Korean car marketplace data (vehicle details, inspection, photos)
- **Files:** `src/lib/encarClient.ts`
- **Endpoints:** `https://api.encar.com/v1/readside/vehicle/{id}`, `.../inspection/vehicle/{id}`
- **No auth required**
- **Timeout:** 15s with 2 retries

## Anthropic Claude API

- **Used for:** Catalog AI processing (screenshot parsing, description generation)
- **Files:** `scripts/process-ai-pending.ts`, `scripts/generate-descriptions.ts`
- **CRITICAL:** Blocked from Russian IP (403). Runs ONLY on GitHub Actions runner (US IP)
- **Env:** `ANTHROPIC_API_KEY` (on runner only)

## Monthly Cost Summary

| Service | Cost | Frequency |
|---------|------|-----------|
| DeepSeek (news) | ~$0.06/mo | 1x/day |
| DashScope covers | ~$1.20/mo | 1-2x/day |
| DashScope text | ~$0.30/mo | 1x/day |
| DashScope vision | ~$0.06/mo | On demand |
| **Total** | **~$2-3/mo** | Current load |
