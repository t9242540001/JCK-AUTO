<!--
  @file:        knowledge/integrations.md
  @project:     JCK AUTO
  @description: External APIs — usage, files, rate limits, costs, env vars (DeepSeek 180s/2 retries, DashScope local limit 60 RPM)
  @updated:     2026-04-18
  @version:     1.3
  @lines:       ~150
-->

# External Integrations

## DashScope (Alibaba Cloud — Qwen models)

- **Workspace:** JCKAUTO (Singapore region, dashscope-intl.aliyuncs.com)
- **Env:** `DASHSCOPE_API_KEY`
- **Runs from:** VDS directly (Singapore region — no IP block from Russia)
- **Console:** https://modelstudio.console.alibabacloud.com/ → switch to Singapore

### Used in production

| API name | Type | Where used | Notes |
|----------|------|------------|-------|
| qwen3.5-plus | Multimodal (text + vision) | src/lib/dashscope.ts (default vision + text), src/app/api/tools/auction-sheet/route.ts | **Hybrid thinking mode enabled by default** — slow on vision, scheduled to be replaced by qwen-vl-ocr/qwen3-vl-flash via fallback chain (С-1 fix) |
| qwen3.5-flash | Text generation | src/lib/dashscope.ts (cheaper text option) | Fast, no reasoning by default |
| qwen-image-2.0-pro | Image generation | src/lib/dashscope.ts (generateImage) | News/article cover images, ~$0.04/image |

### Activated for fallback chain (С-1 fix in progress)

| API name | Type | Status | Notes |
|----------|------|--------|-------|
| qwen-vl-ocr | OCR (image-only) | Verified via curl on 2026-04-14 | Specialized for text extraction from documents/photos. Supports Japanese, Korean, Russian, English etc. Image-only model — text-only requests return HTTP 400 (by design). |
| qwen3-vl-flash | Vision (multimodal, fast) | Verified via curl on 2026-04-14 (HTTP 200, no reasoning_content) | Universal vision model, answers without reasoning step → faster than qwen3.5-plus for OCR tasks |

### Activated, available for future use (no detailed integration yet)

Names below are taken from the Model Studio UI (capitalized form). Before using in code,
verify the exact API name with curl — the API typically accepts the lowercase form
(e.g. UI "Qwen3-VL-235B-A22B" → API "qwen3-vl-235b-a22b").

Authorized in JCKAUTO workspace as of 2026-04-14:
Qwen3-Max, Qwen3-Omni-Plus, Qwen3-Omni-Flash, Qwen3-Omni-Flash-Realtime, Qwen3-VL-235B-A22B,
Qwen3.5-35B-A3B, Qwen3.5-27B, Qwen3.5-122B-A10B, Qwen3.5-397B-A17B, Qwen3-Rerank,
Qwen3-Coder-Plus, Qwen-Image-2.5, Qwen-Image-2.5-Pro, Qwen-Image-Edit-Plus-2025-12-13,
Z-Image-Turbo.

When choosing a model for a new task — check this list first. If the model needed is NOT here,
verify activation in Model Studio console before writing code.

### Cost summary (current usage)

- ~$0.002 per vision call (qwen3.5-plus or fallback)
- ~$0.01 per article (qwen3.5-plus text)
- ~$0.04 per cover image (qwen-image-2.0-pro)

### Rate limits

**Alibaba upstream (per Account, verified 2026-04-18 in Model Studio console):**

| Model | RPM | Tokens/60s |
|---|---|---|
| Qwen3-VL-Flash | 1,200 | 1,000,000 |
| Qwen-VL-OCR | 600 | 6,000,000 |
| Qwen3-VL-Flash-2026-01-22 (snapshot) | 60 | 100,000 |
| Qwen3-VL-Flash-2025-10-15 (snapshot) | 120 | 1,000,000 |

**Our local limit (`src/lib/dashscope.ts:RATE_LIMIT_PER_MINUTE`):** 60 RPM.

Intentionally ~10× below the strictest active model — serves as
defense against runaway loops and abuse, NOT against upstream
throttling. One auction-sheet user-request issues 4 DashScope calls
(Pass 0 + Pass 1 + Pass 2 + Pass 3), so 60 RPM = 15 concurrent
user-requests/minute before local waits kick in.

See ADR `[2026-04-18] Raise dashscope.ts RATE_LIMIT_PER_MINUTE 6 → 60`
(decisions.md).

## DeepSeek

- **Used for:** News processing (3 parallel summary calls), Encar engine power estimation, Encar field translation (Korean→Russian), auction-sheet Step 2 parse
- **Files:** `src/lib/deepseek.ts`, `src/lib/encarClient.ts`, `src/services/news/processor.ts`, `src/app/api/tools/auction-sheet/route.ts`
- **Model:** deepseek-chat
- **Rate limit:** 10 req/min (internal limiter in deepseek.ts)
- **Timeout:** **180s** per attempt (was 60s — raised 2026-04-18 for heavy Japanese auction sheets with 1700+ output tokens).
- **Retries:** **2** (was 3 — reduced 2026-04-18 so worst-case total latency stays reasonable).
- **Worst-case total:** was ~180s (3 × 60s) → now up to ~360s (2 × 180s), but nginx caps `/api/tools/auction-sheet` at 200s → the second retry effectively only runs on fast failures (4xx rejected, 429/5xx that fail fast). For other callers (news cron, article generator) the 360s ceiling is acceptable — they run outside user-facing latency budgets.
- **Cost:** input $0.28/M tokens, output $0.42/M tokens (~$0.002/news digest)
- **Env:** `DEEPSEEK_API_KEY`
- **See ADR:** `[2026-04-18] DeepSeek timeout 60s → 180s, retries 3 → 2, nginx proxy_read_timeout 60s → 200s for /api/tools/auction-sheet` (decisions.md).

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
