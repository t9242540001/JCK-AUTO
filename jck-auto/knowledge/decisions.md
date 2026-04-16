<!--
  @file:        knowledge/decisions.md
  @project:     JCK AUTO
  @description: Architectural Decision Records (ADR log) — append-only
  @updated:     2026-04-16
  @version:     1.3
  @lines:       ~790
  @note:        File exceeds the 200-line knowledge guideline.
                Accepted: ADR logs are append-only history;
                splitting by date harms searchability. If file
                grows past ~600 lines, archive entries older than
                one year to decisions-archive.md.
-->

# Architectural Decisions

## [2026-04-16] Pass 2 uses qwen3-vl-flash (visual reasoning), not qwen-vl-ocr

**Status:** Accepted

**Context:**
In the three-pass OCR pipeline (see separate ADR of same date), Pass 2
extracts body damage codes from the damage diagram — a task that
requires identifying alphanumeric tokens on a drawn schematic and
mapping each to a body part. With qwen-vl-ocr as the primary model for
all three passes, Pass 2 consistently returned "no codes" (chars=17)
on every production test sheet, regardless of prompt phrasing
(verified across three prompt revisions — see git log
094baa8..ef12ea4). qwen-vl-ocr is specialized for text character
extraction from documents, not for visual-spatial reasoning about
which code is located on which part of a diagram.

**Decision:**
Pass 2 uses a dedicated model chain `['qwen3-vl-flash', 'qwen-vl-ocr']`
instead of the shared `ocrOptionsBase.models` used by Pass 1 and
Pass 3. qwen3-vl-flash is a general vision-language model with
visual reasoning; qwen-vl-ocr remains as a fallback only.

**Rationale:**
- Right tool per task: Pass 1 (label extraction) and Pass 3 (free
  text transcription) are character extraction, suited to qwen-vl-ocr.
  Pass 2 is visual-spatial QA, suited to qwen3-vl-flash.
- Production verification on Toyota Wish sheet: chars=17 → chars=366
  with 14 damage codes correctly localized (front fender, hood,
  wheels, windshield, etc.) after model change alone. No prompt
  changes needed.
- Parallel execution unchanged (Promise.allSettled), so total OCR
  elapsed time not materially affected.

**Alternatives considered:**
- Further prompt engineering on qwen-vl-ocr: exhausted across three
  revisions, did not unlock the capability — model limitation, not
  prompt limitation.
- Claude Vision via GitHub Actions proxy: 10× cost, added
  infrastructure complexity, only considered if VL-flash had failed.

**Consequences:**
- `+` Damage code extraction now works on typical sheets.
- `+` Pass 1 and Pass 3 unchanged — no regression to text fields.
- `−` Pass 2 cost per call slightly higher than qwen-vl-ocr
  (negligible: both models priced similarly at this volume).
- `−` Quality on damage diagrams is still imperfect on handwritten
  low-contrast sheets (see separate bug tracking Allion instability).

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts` (Pass 2 models
  array).

**`@rule` enforced in route.ts:**
`RULE: Pass 2 uses qwen3-vl-flash primary (visual reasoning),
qwen-vl-ocr as fallback. qwen-vl-ocr alone returns "no codes" for
every sheet — it cannot visually parse damage diagrams. Do NOT
switch back to ocrOptionsBase.models here.`

---

## [2026-04-16] Multi-pass parallel OCR for auction sheets

**Status:** Accepted

**Context:**
Earlier iterations tried single-pass OCR: one qwen-vl-ocr call with a
large system prompt asking the model to simultaneously extract header
fields, interpret the damage diagram, transcribe inspector notes, and
structure the output as Markdown. Production testing on two sheets
(Toyota Wish / USS, Toyota Allion / HAA) revealed the model handles
text extraction acceptably but collapses under multi-objective
instructions: damage codes localized incorrectly, sections missing,
~30 unrecognized tokens per sheet. Three separate prompt revisions on
a single-pass architecture failed to improve this.

Root cause: qwen-vl-ocr is a small model. Multi-task prompts exceed
its effective capacity; a single narrow task per call produces clean
output.

**Decision:**
Replace single OCR call with three parallel narrow OCR calls via
`Promise.allSettled`:
- Pass 1 (text fields) — REQUIRED: extract label:value pairs for all
  header fields. If this pass fails, the request returns 502.
- Pass 2 (damages) — SOFT-FAIL: extract damage codes from the diagram
  with body-part localization. Failure → `=== DAMAGES UNAVAILABLE ===`
  marker passed to Step 2.
- Pass 3 (free text) — SOFT-FAIL: transcribe inspector notes and
  free-text sections verbatim, preserving original Japanese section
  labels in square brackets as markers. Failure → `=== FREE TEXT
  UNAVAILABLE ===` marker.

The three results are concatenated with `=== SECTION ===` markers
and passed as a single text block to Step 2 (DeepSeek text parse).

**Rationale:**
- Narrow single-task prompts fit within the model's capacity.
- Parallel execution: total OCR elapsed time ≈ slowest pass, not sum.
  Observed: ~5s for all three passes combined.
- Soft-fail policy: partial data is still useful to the user.
  Required-Pass-1 policy: a request with no header fields is useless.
- Section markers give Step 2 (DeepSeek) explicit boundaries,
  eliminating a class of parse errors.

**Alternatives considered:**
- Single-pass with smarter prompt: tried three revisions, did not work
  — model capacity is the binding constraint, not prompt phrasing.
- Sequential passes: same cost, worse latency — no benefit.
- Merging all OCR into one vision+parse combined call with a larger
  model: DashScope text models time out from VDS, so this path is
  closed until that changes.

**Consequences:**
- `+` Clean structured input for DeepSeek, measurably better output.
- `+` Graceful degradation: Pass 2 or Pass 3 failure does not block
  the user from getting header data.
- `−` 3× cost per request on OCR side (~$0.004-0.006 total per
  request including Step 2). At current volume, negligible.
- `−` More logging surface to monitor (three pass-result logs).

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts` (six new OCR
  prompt constants, Promise.allSettled orchestration, three
  pass-result logs).

**`@rule` enforced in route.ts:**
`RULE: Three parallel OCR passes, each with one narrow task. Do NOT
merge into a single multi-task prompt — qwen-vl-ocr is a small model
that fails on multi-objective instructions.`

---

## [2026-04-15] DeepSeek primary for auction-sheet Step 2 text parse

**Status:** Accepted

**Context:**
Two-pass auction-sheet pipeline uses Step 1 (OCR via DashScope vision)
and Step 2 (text parse of OCR output into JSON). Initial Step 2
implementation used DashScope text models as primary (qwen3.5-plus,
then qwen3.5-flash). Production logs over two days showed both models
consistently exceed 25s, then 60s timeout with "The operation was
aborted due to timeout" from DashScope API. Failure is deterministic
per request, not intermittent. DashScope vision models (qwen-vl-ocr,
qwen3-vl-flash) work reliably from the same VDS — the issue is
specific to text models.

Hypothesized cause: qwen3.5-plus has hybrid thinking mode (internal
chain-of-thought before response) that inflates effective generation
time. But qwen3.5-flash, which lacks thinking mode, also timed out —
so the root cause may be broader (DashScope text-service regional
availability or account-tier limitation from VDS origin). Not fully
diagnosed; the observation is reproducible.

DeepSeek API (api.deepseek.com, direct, no DashScope dependency)
responds in ~10s for the same prompts and returns valid JSON.

**Decision:**
Step 2 order: DeepSeek primary → DashScope qwen3.5-flash fallback.
Both calls use identical prompts (`PARSE_SYSTEM_PROMPT` +
`parseUserPrompt`) and identical parameters (maxTokens 4096,
temperature 0.1).

Log lines distinguish primary success vs fallback success. `meta.model`
in the response reflects which path actually produced the result.

**Rationale:**
- Primary = most reliable path observed in production; DeepSeek works
  consistently from VDS.
- Fallback keeps DashScope in the chain so if DeepSeek has regional
  issues, the request has a second chance before 502.
- Compatible interfaces on both clients (`callDeepSeek` and
  `callQwenText`) made swap mechanical.
- No permanent commitment to DeepSeek — if DashScope text stability
  changes later, swap direction again.

**Alternatives considered:**
- Keep DashScope primary, debug timeout cause: blocker is
  undocumented/external; could not isolate without Alibaba support.
  Production users were blocked meanwhile.
- OpenAI / Anthropic: geo-blocked from VDS, same class of issue as
  original Anthropic-on-VDS decision (see 2026-01 ADR).
- Reasoning model (deepseek-reasoner): overkill for structured
  extraction from already-parsed OCR text.

**Consequences:**
- `+` Step 2 completes in ~10s on typical input, well within nginx
  60s proxy_read_timeout.
- `+` Lower cost than DashScope text ($0.28/M input for DeepSeek vs
  higher DashScope rates).
- `−` Dependency on DeepSeek uptime. DeepSeek has had regional
  incidents producing non-JSON responses (see bugs.md C-5 for
  current known instability on certain OCR content). Fallback
  partially mitigates.
- `−` Two independent API providers in the Step 2 path — monitoring
  surface doubled.

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts` (Step 2
  call order, fallback logic).

**`@rule` enforced in route.ts:**
`RULE: DeepSeek is primary for Step 2 — DashScope text models
(qwen3.5-flash/plus) timeout from VDS. Do NOT swap back without
verifying DashScope text API availability first.`

---

## [2026-04-15] REQUEST_TIMEOUT_MS 25s → 60s in dashscope.ts

**Status:** Accepted

**Context:**
Previous value: 25000ms per attempt. Chosen when the pipeline was
single-pass (one OCR call, tight budget, three retries within nginx
60s total). With two-pass pipeline and text-model parse attempts
consistently running longer than 25s, 25s-per-attempt caused
premature failure even on requests that would eventually succeed.

**Decision:**
`REQUEST_TIMEOUT_MS = 60_000` (60s per single attempt) in
`src/lib/dashscope.ts`.

**Rationale:**
- Nginx proxy_read_timeout is 60s. A single attempt exceeding 60s
  will never return to the client anyway, so 60s is an upper bound
  on useful per-attempt timeout.
- With DeepSeek primary on Step 2 (see separate ADR), DashScope
  timeouts happen only on the fallback path, where one extra attempt
  is still worth waiting for.
- Value is a ceiling, not an expectation. Typical successful calls
  complete in 3–10s.

**Consequences:**
- `+` Eliminates premature cutoff of in-progress successful calls.
- `−` Worst-case failed request now takes up to 60s per retry instead
  of 25s. Mitigated by MAX_RETRIES policy (see call sites).

**Files changed:**
- `jck-auto/src/lib/dashscope.ts` (single constant).

---

## [2026-04-15] finish_reason=length detection in analyzeImage

**Status:** Accepted

**Context:**
DashScope API can return `finish_reason: "length"` when the model hits
`max_tokens` before completing its response. Previous behavior:
`analyzeImage` treated any 200 response as success, returning
whatever partial content was produced. Downstream code (JSON parser in
route.ts) then failed on truncated JSON, emitting a parse_error to
the user — symptom pointed at the parser, root cause was upstream
truncation.

**Decision:**
In `analyzeImage` after extracting `choices[0].finish_reason`, if the
value is `"length"`, throw an error explicitly naming truncation.
`analyzeImageWithFallback` then treats this as a failure mode eligible
for fallback model retry (same class as timeout/5xx).

**Rationale:**
- Truncation is a failure, not a success with incomplete data.
- Surfacing the right error class at the right layer improves
  diagnosability.
- Fallback chain gets a chance to succeed — maybe the next model
  fits the output in its budget.

**Consequences:**
- `+` Diagnostic logs now distinguish "bad JSON from the model" vs
  "JSON was cut off".
- `+` Fallback model gets a retry on a previously silently-failed
  class of input.
- `−` Slightly higher cost when truncation occurs (extra fallback
  call). In practice rare.

**Files changed:**
- `jck-auto/src/lib/dashscope.ts` (`analyzeImage` function).

---

## [2026-04-15] Capture Deploy Log: workflow_dispatch to force registration

**Status:** Pending verification (file pushed; GitHub registration status not yet confirmed in current session — see bugs.md)

**Context:**
`.github/workflows/capture-deploy-log.yml` was added (ADR
[2026-04-15] Separate workflow for runner-side deploy log capture)
but GitHub Actions did not register it in the workflow registry. Two
post-add Deploy runs completed without triggering Capture; the
workflows API returned only three workflows (Auto-merge, Deploy, Sync
Catalog). Community discussions (GitHub issues #25219, #8140, #25756,
#25179) document that workflows whose only triggers are non-push
events (workflow_run, workflow_dispatch, schedule) may fail to
register when the file lands in `main` via merge rather than a
triggering push. Recommended fix: add `workflow_dispatch` to "wake"
the indexer.

**Decision:**
Add `workflow_dispatch:` as a second trigger in capture-deploy-log.yml
alongside the existing `workflow_run:`. Bare trigger (no `inputs:`).
This provides: (a) side-effect registration of the workflow in the
GitHub Actions registry; (b) manual run button for testing.

**Rationale:**
- Minimal change (one added line).
- Does not alter existing `workflow_run:` behavior.
- Standard industry workaround for this GitHub Actions quirk.
- Adds genuine utility (manual re-run of capture for a specific
  deploy without waiting for a new deploy).

**Alternatives considered:**
- Rename the capture workflow file: more disruptive, harder to
  track in git history. Reserved as fallback if workflow_dispatch
  does not succeed in registration.

**Consequences:**
- `+` Expected: workflow appears in Actions UI registry, workflow_run
  subscription activates, next deploy triggers a capture run.
- `−` Verification pending in a future session. If workflow still
  fails to register, execute fallback (rename).

**Files changed:**
- `.github/workflows/capture-deploy-log.yml` (single `workflow_dispatch:`
  line added).

---

## [2026-01] DashScope over Anthropic for VDS AI calls

**Context:** Site needs AI capabilities (vision, text generation) running on the VDS.
**Decision:** Use Alibaba DashScope (Qwen models) instead of Anthropic Claude for all VDS-side AI.
**Rationale:** Anthropic API returns 403 from Russian IPs. DashScope Singapore region has no IP restrictions.
**Alternatives:** Proxy through US server (latency, cost), OpenAI (also geo-restricted).

## [2026-01] JSON file storage instead of database

**Context:** Site needs to persist catalog data, user records, news articles.
**Decision:** Use JSON files on disk (`/var/www/jckauto/storage/`).
**Rationale:** Current scale (~50 cars, ~500 bot users) doesn't justify database overhead. JSON is human-readable, easy to debug, zero config.
**Alternatives:** SQLite (overkill for now), PostgreSQL (unnecessary complexity).

## [2026-02] calculator.ts as single engine for both site and bot

**Context:** Calculator logic was duplicated — site had its own implementation, bot had another.
**Decision:** Unified `calculateTotal()` function in `src/lib/calculator.ts` consumed by both.
**Rationale:** Single source of truth prevents rate/formula drift. Both consumers get identical results.

## [2026-03] Rename tariffs.ts and currencyRates.ts

**Context:** Files were named `calculator-data.ts` and `currency.ts` — unclear purpose.
**Decision:** Renamed to `tariffs.ts` and `currencyRates.ts`.
**Rationale:** Names now describe content, not usage context.

## [2026-03] GitHub Actions runner for Anthropic API calls

**Context:** Claude Vision API needed for catalog screenshot parsing. Can't call from VDS (403).
**Decision:** Run AI processing scripts on GitHub Actions runner (US IP), SCP files to/from VDS.
**Rationale:** Free GitHub runner minutes, US IP bypasses geo-block. 5-step sync chain handles data transfer.

## [2026-04] VTB sell rate from sravni.ru as primary exchange rate source

**Context:** CBR rates understate real cost by 3-7%. Customers see unrealistically low prices.
**Decision:** Scrape VTB sell rate from sravni.ru as primary source. Fall back to CBR × configurable markup per currency.
**Rationale:** VTB sell rate reflects actual bank pricing. Per-currency fallback ensures no single point of failure.
**Alternatives:** Hardcoded markup only (less accurate), multiple bank scraping (over-engineering).

## [2026-04] /api/exchange-rates endpoint for client components

**Context:** Client components importing fetchCBRRates() directly caused sravni.ru CORS errors in browser.
**Decision:** Created `/api/exchange-rates` server route. Client components fetch from there.
**Rationale:** Server-side fetch has no CORS. Cache-Control headers (5min) reduce load. Bot still calls fetchCBRRates() directly (server-side, no CORS).

## [2026-04] CalculatorCore as shared component

**Context:** Homepage calculator section and /tools/calculator page had duplicated calculator code.
**Decision:** Extract `CalculatorCore.tsx` as shared body. Both pages are thin wrappers.
**Rationale:** Single source of truth for form state, rate loading, and result rendering. Eliminates homepage CORS bug (old section imported fetchCBRRates directly).

## [2026-04] PDFKit with Roboto TTF for Cyrillic

**Context:** PDFKit default Helvetica has no Cyrillic glyphs — all Russian text rendered as garbage.
**Decision:** Bundle Roboto-Regular.ttf and Roboto-Bold.ttf in `public/fonts/`, register as Body/BodyBold.
**Rationale:** Roboto has full Cyrillic coverage, is free (Google Fonts), and adds only ~1MB to repo.
**Alternatives:** System fonts (unreliable in Docker/server), custom font subset (complex build).

## [2026-04] GitHub Actions auto-merge for claude/** branches

**Status:** SUPERSEDED on 2026-04-15 — see [2026-04-15] PAT_AUTO_MERGE for auto-merge to trigger downstream workflows.

**Context:** All development happens on `claude/**` branches. Merging into `main` was manual and often forgotten.
**Decision:** Add `.github/workflows/auto-merge.yml` that triggers on push to `claude/**` branches and merges into `main` with `--no-ff`.
**Rationale:** Zero manual merge steps. Every push to a claude branch automatically lands in main. Uses GITHUB_TOKEN (no extra secrets). Workflow fails gracefully on merge conflicts — developer resolves manually.
**Alternatives:** Branch protection with auto-merge PRs (more ceremony), manual merges (status quo, error-prone).

## [2026-04] Auto-deploy via workflow_run after auto-merge

**Status:** SUPERSEDED on 2026-04-15 — see [2026-04-15] Push trigger only for deploy.yml.

**Context:** After auto-merge lands code in `main`, deployment to VDS was still manual (SSH + pull + build + restart).
**Decision:** Add `.github/workflows/deploy.yml` triggered by `workflow_run` (after auto-merge completes) and direct push to `main`. SSHs into VDS via `appleboy/ssh-action`, pulls, builds, restarts both PM2 processes.
**Rationale:** `workflow_run` is required because GITHUB_TOKEN pushes don't trigger `on: push` workflows. Bot uses `pm2 delete` + `pm2 start` (never `pm2 restart`) because `pm2 restart` does not reload `.env.local`. Build requires `NODE_OPTIONS="--max-old-space-size=1536"` due to server memory constraints.
**Alternatives:** Manual deploy.sh (status quo, error-prone), webhook-triggered deploy (requires inbound port).

## [2026-04-10] Image compression before DashScope vision API

**Status:** Accepted

**Context:**
`/api/tools/auction-sheet` accepts user-uploaded auction sheet photos (up to 10MB).
Large or high-resolution images sent directly to DashScope `qwen3.5-plus` vision model
caused processing time to exceed 60 seconds — nginx default `proxy_read_timeout`.
Result: users received *«Ошибка сети. Проверьте подключение.»* on every request.
Increasing nginx timeout to 120s was rejected: users will not wait 2 minutes for a result.

**Decision:**
Compress images server-side using Sharp before sending to DashScope.
Parameters chosen to balance speed vs. text legibility on auction sheets:

- Resize: max `2000×2000px`, `fit: 'inside'`, `withoutEnlargement: true`
- Format: JPEG, `quality: 85`
- Sharpen: `sigma 0.5` (restores fine text sharpness lost during downscale)
- Output: always `image/jpeg` regardless of input format (PNG, WebP, HEIC)

HEIC support: confirmed via `libheif` in installed Sharp version.

**Consequences:**

- `+` Processing time reduced from 60+ seconds to approximately 10–20 seconds
- `+` All input formats (JPG, PNG, WebP, HEIC) normalized to JPEG before API call
- `+` Small images (already under 2000px) only undergo format conversion, not resize
- `+` Sharp was already in `devDependencies` — no new dependency added
- `−` Slight quality loss on very high-res source images (acceptable for OCR use case)

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts`

## [2026-04-10] Telegram webhook via Cloudflare Worker (bidirectional proxy)

**Status:** Accepted

**Context:**
VDS provider (Selectel / similar) blocks both directions of Telegram traffic:

1. **Outgoing:** VDS → `api.telegram.org` (bot cannot send messages directly)
2. **Incoming:** Telegram IP ranges → VDS (webhook delivery times out intermittently)

Outgoing was already solved via Cloudflare Worker (`TELEGRAM_API_BASE_URL` env var).
Incoming was initially registered directly on `jckauto.ru` — causing 2–5 minute delays
in bot responses as Telegram retried timed-out webhook deliveries.

The existing `tg-proxy` Worker already contained incoming webhook routing code:

```js
if (url.pathname.startsWith("/webhook/")) {
  const vdsUrl = "https://jckauto.ru/bot-webhook/" + url.pathname.slice("/webhook/".length);
  return fetch(vdsUrl, { method, headers, body });
}
```

This code was present but unused — webhook was registered on `jckauto.ru` directly.

**Decision:**
Register Telegram webhook on Worker URL instead of directly on VDS:

- WRONG: `https://jckauto.ru/bot-webhook/bot{TOKEN}`
- CORRECT: `https://tg-proxy.t9242540001.workers.dev/webhook/bot{TOKEN}`

Worker receives POST from Telegram (Cloudflare is always reachable),
then forwards to `https://jckauto.ru/bot-webhook/bot{TOKEN}` as an internal request.
Provider restrictions do not apply to Cloudflare → VDS traffic.

Registration command:

```bash
TOKEN=$(grep TELEGRAM_BOT_TOKEN /var/www/jckauto/app/jck-auto/.env.local | cut -d= -f2)
curl -s "https://tg-proxy.t9242540001.workers.dev/bot${TOKEN}/setWebhook?url=https://tg-proxy.t9242540001.workers.dev/webhook/bot${TOKEN}" | jq .
```

**Consequences:**

- `+` Bot response latency reduced from 2–5 minutes (retry delays) to `<1 second`
- `+` No code changes required — Worker routing was already implemented
- `+` Telegram → Worker connection uses Cloudflare infrastructure (reliable, no blocking)
- `−` `setWebhook` must be re-run manually after: token change, Worker URL change
- `−` Worker code is not in git — lives only in Cloudflare Dashboard (single point of truth risk)

**Files changed:**
- None — configuration change only (`setWebhook` API call).

## [2026-04-15] PAT_AUTO_MERGE for auto-merge to trigger downstream workflows

**Status:** Accepted

**Context:**
GitHub built-in protection: pushes authenticated by `GITHUB_TOKEN` do
NOT fire `on: push` workflows in the same repository. Auto-merge of
`claude/**` branches into `main` was authenticating with `GITHUB_TOKEN`,
so the merge commit pushed to `main` never triggered `deploy.yml`'s
`on: push` listener. The original ADR `[2026-04] Auto-deploy via
workflow_run after auto-merge` worked around this with a `workflow_run`
trigger — which itself caused a separate problem
(see `[2026-04-15] Push trigger only for deploy.yml`).

**Decision:**
Create a fine-grained Personal Access Token (Contents: read+write,
Workflows: read+write, Metadata: read), scoped only to this repository,
store it as repository secret `PAT_AUTO_MERGE`, and use it in
`actions/checkout@v4` `token:` parameter inside auto-merge.yml. Pushes
authenticated with this PAT count as user pushes and DO fire downstream
workflows.

**Rationale:**
- Native solution to GitHub's built-in protection — no exotic workarounds.
- Minimal blast radius: PAT is scoped to one repo with narrow
  permissions.
- Works with the standard `on: push` trigger model — predictable.

**Alternatives considered:**
- Reusable workflow via `workflow_call`: requires deploy to run
  synchronously inside auto-merge, ties up runner slot, complicates
  permission model.
- Manual deploy after merge: defeats the purpose of auto-merge.

**Consequences:**
- `+` Deploy fires reliably on every auto-merge via the standard
  `push: branches: [main]` trigger.
- `+` Deploy uses the workflow file from the just-pushed commit, not
  a stale main-tip version.
- `−` PAT expires (1 year by default) — needs calendar reminder for
  rotation. Failure mode if expired: auto-merge returns 401, deploy
  silently does not fire.
- `−` Adds a manual secret to the repo (vs. zero-secret GITHUB_TOKEN
  approach).

**Files changed:**
- `.github/workflows/auto-merge.yml` (token reference).

---

## [2026-04-15] Push trigger only for deploy.yml (workflow_run removed)

**Status:** Accepted

**Context:**
`deploy.yml` originally had two triggers: `workflow_run` (after
auto-merge completes) and `push: branches: [main]`. After PAT_AUTO_MERGE
activation (see preceding ADR), `push:` fires reliably on every merge.
The `workflow_run` trigger then became actively harmful for two
reasons:

1. **Stale workflow-file execution.** GitHub resolves `workflow_run`
   triggers using the workflow file as it exists in main at the moment
   the originating workflow STARTS, NOT the file pushed by the merge
   commit. For a workflow that frequently edits itself (deploy.yml),
   this means each iteration ran the previous version of the deploy
   script. We lost ~24h of attempted improvements that were committed
   to main but never executed at runtime.
2. **Duplicate deploys.** Each auto-merge produced two Deploy runs —
   one from `push:` (using the new file) and one from `workflow_run:`
   (using the stale file). The stale one always ran second due to
   `concurrency: deploy-${repo}` serialization, overwriting the
   correct build's `.next` symlink with a directory.

**Decision:**
Remove the entire `workflow_run:` block from `on:` in deploy.yml. Keep
only `push: branches: [main]`. Direct hotfix pushes to main also
continue to work via the same trigger.

**Rationale:**
- Eliminates stale-execution class of bugs entirely.
- Eliminates duplicate deploys — one merge → one run.
- Manual hotfixes (rare) still work through the same trigger path.

**Alternatives considered:**
- Keep workflow_run with `if:` condition gating on workflow file SHA:
  fragile, hard to reason about.
- Move build into `auto-merge.yml` directly: violates separation of
  concerns (merge ≠ deploy).

**Consequences:**
- `+` Single deploy per merge.
- `+` Always uses the just-pushed workflow file.
- `−` GitHub still holds an old `workflow_run` subscription for stale
  reference if the auto-merge workflow name remains the same. Fully
  removing this requires renaming the auto-merge workflow (planned
  follow-up). Until then, residual stale-trigger duplicates may
  intermittently appear and must be ignored.

**Files changed:**
- `.github/workflows/deploy.yml` (trigger block, job-level `if:`).

**`@rule` enforced in deploy.yml:**
Comment block above `on:` forbids re-adding `workflow_run` without a
new ADR.

---

## [2026-04-15] Two-slot atomic build with self-healing

**Status:** Accepted (formalized 2026-04-15 — implementation existed since 2026-04-09)

**Context:**
Original deploy schema built directly into `.next/`. During the build's
final phase Next.js 16 Turbopack writes `page_client-reference-manifest.js`
files. Any GET request between "old manifest deleted" and "new manifest
written" returned `InvariantError: client reference manifest does not
exist` → 500/502 on all routes for ~100 seconds per deploy. Combined
with PM2 `bash -c npm start` wrapping, this caused crash loops with
~70s restart cycles after every deploy.

**Decision:**
Two-slot atomic build:
- `.next-a` and `.next-b` are real directories.
- `.next` is a symlink pointing to whichever slot is currently active.
- Build runs into the INACTIVE slot via `NEXT_DIST_DIR="$NEXT_SLOT"
  npm run build`. Server keeps reading the active slot.
- After build completes, `ln -sfn "$NEXT_SLOT" .next` atomically
  switches the symlink. `pm2 restart jckauto` picks up the new bundle.
- Downtime reduced from ~100s to ~5–10s (PM2 restart only).

Self-healing block: if the deploy script finds `.next` as a regular
directory (someone ran `npm run build` without `NEXT_DIST_DIR`), it
auto-restores the two-slot setup before proceeding. WARNING-marker logs
make the recovery visible.

**Rationale:**
- Atomic symlink swap is a `rename(2)` syscall — invisible to running
  Node processes.
- Self-healing prevents one bad actor (manual build, broken cron) from
  permanently breaking deploys.

**Alternatives considered:**
- Blue-green deployment with two PM2 processes on different ports +
  nginx switch: more moving parts, requires nginx reload on every
  deploy.
- Build offline, rsync to VDS: requires building elsewhere, complicates
  secrets handling for build-time env.

**Consequences:**
- `+` Zero meaningful downtime on every deploy.
- `+` Self-healing absorbs accidental damage to symlink state.
- `−` Two slots take ~2× disk space for `.next/`.
- `−` Anyone running `npm run build` outside deploy.yml without
  `NEXT_DIST_DIR` triggers a self-healing WARNING on next deploy. Rule
  enforced in `knowledge/deploy.md §8` and `infrastructure.md`.

**Files changed:**
- `.github/workflows/deploy.yml` (full SSH script).
- `jck-auto/next.config.ts` (`distDir: process.env.NEXT_DIST_DIR || '.next'`).

---

## [2026-04-15] Article cron writes MDX only — no build/restart

**Status:** Accepted

**Context:**
`scripts/generate-article.ts` previously ended with:

    execSync('npm run build', { cwd: PROJECT_ROOT, ... });
    execSync('pm2 restart jckauto', ...);

These calls did NOT pass `NEXT_DIST_DIR`, so each invocation created
`.next/` as a regular directory, destroying the two-slot symlink.
Confirmed root cause of intermittent two-slot breakage observed in
production logs (e.g., 2026-04-15 05:31 UTC — separate BUILD_ID in
`.next` not matching `.next-a`/`.next-b`, no GitHub Actions deploy in
that window).

**Decision:**
Remove the entire build/restart block from `generate-article.ts`. The
script now only:
1. Generates the topic and article text.
2. Generates the cover image.
3. Publishes the MDX file to `content/blog/{slug}.mdx`.
4. Appends to the published log.

A new article appears on https://jckauto.ru/blog (SSG route) only after
the next deploy. To force immediate appearance, push any trivial commit
to main — auto-deploy rebuilds with proper `NEXT_DIST_DIR`.

**Rationale:**
- Single responsibility: content generation ≠ deployment.
- Eliminates the only known mechanism that bypasses two-slot protection.
- Cron runs every 3 days; immediate visibility was never the actual
  requirement.

**Alternatives considered:**
- Wrap the build inside a correct two-slot sequence in this script:
  duplicates deploy.yml logic in a fragile place.
- Migrate `/blog/[slug]` to `force-dynamic` (like `/catalog`,
  `/news`): correct long-term solution, planned in roadmap.md as a
  separate task.

**Consequences:**
- `+` Two-slot symlink no longer broken by cron-generated articles.
- `+` Article generation script is simpler, safer, and faster
  (no longer waits on full Next.js build).
- `−` New articles have a delivery latency equal to the next deploy
  cycle. Acceptable until force-dynamic migration.

**Files changed:**
- `jck-auto/scripts/generate-article.ts` (removed execSync block,
  removed `child_process` import, renumbered "Шаг N/4" → "Шаг N/3").

**`@rule` enforced in generate-article.ts:**
Comment stub explicitly forbids any process-spawning mechanism in this
script.

---

## [2026-04-15] Separate workflow for runner-side deploy log capture

**Status:** Accepted

**Context:**
Diagnosing deploy failures required the user to manually copy-paste
the Actions UI log into chat — slow, error-prone, blocks fast iteration.
Embedded log-capture steps inside `deploy.yml` failed for two reasons:
(1) `gh run view --log` cannot read its own in-progress run, returning
a 34-byte stub; (2) `appleboy/scp-action` runs as a separate Docker
container without access to the host's `/tmp/`, so the upload step
failed with `tar: empty archive`.

**Decision:**
Add a separate workflow `.github/workflows/capture-deploy-log.yml`
triggered by `workflow_run` on `Deploy to VDS` with
`types: [completed]`. The capture workflow runs AFTER the deploy is
fully finished, so `gh run view` returns the complete log. File paths
use `${{ runner.temp }}/deploy-log/`, which IS mounted into action
containers (verified empirically).

The capture workflow then `scp`'s the log to
`/var/www/jckauto/deploy-logs/` on VDS and updates a `deploy-latest.log`
symlink. Logs are accessible via the JCK AUTO Files MCP connector for
direct Claude reading without copy-paste.

**Rationale:**
- Clean separation: deploy executes, capture observes — neither blocks
  the other.
- `workflow_run` trigger is appropriate here (unlike in deploy.yml)
  because this workflow rarely changes after creation and only reads
  data; stale-execution risk is minimal.

**Alternatives considered:**
- Ship logs to GitHub Artifact: requires UI/API roundtrip on each
  diagnosis, no MCP access from VDS context.
- Stream SSH output to a file inside the SSH script: tested in earlier
  attempts, fails because `appleboy/ssh-action` `script_stop: true`
  intercepts redirection setup.

**Consequences:**
- `+` Every deploy log persists on VDS, readable via MCP.
- `+` Diagnosis cycle drops from minutes (copy-paste) to seconds
  (one MCP read).
- `−` Adds one more workflow run per deploy in Actions UI.
- `−` Stale `workflow_run` subscription class of bug applies in
  principle, but capture workflow is small and stable, so risk is
  accepted.

**Files changed:**
- `.github/workflows/capture-deploy-log.yml` (new file).

**Follow-up:**
- Three broken post-SSH steps remain in `deploy.yml`. They do not
  block deploys (just mark runs as failed status because exit codes
  are non-zero). Removal scheduled for a separate cosmetic prompt.
- `strip_components: 4` for scp source path is empirically tuned. If
  the first run lands the file in a wrong subdirectory on VDS, adjust
  ±1 in a follow-up.
