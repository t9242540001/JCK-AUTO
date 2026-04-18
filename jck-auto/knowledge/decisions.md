<!--
  @file:        knowledge/decisions.md
  @project:     JCK AUTO
  @description: Architectural Decision Records (ADR log) — append-only
  @updated:     2026-04-18
  @version:     1.12
  @lines:       ~1270
  @note:        File exceeds the 200-line knowledge guideline.
                Accepted: ADR logs are append-only history;
                splitting by date harms searchability. If file
                grows past ~600 lines, archive entries older than
                one year to decisions-archive.md.
-->

# Architectural Decisions

## § Active iterations

> Section for multi-prompt refactors that are not yet complete. Each entry
> stays here until its final commit lands, at which point it gets promoted
> to a full Accepted ADR below and this entry is removed.

### [WIP 2026-04-18] Split AuctionSheetClient into types + helpers + view modules

**Status:** WIP (in progress, prompts 02–07)

**Context:** AuctionSheetClient.tsx is 655 lines and owns: inline types, inline helpers, upload zone, processing views, error view, result view, orchestrator. The universal file-size guideline is 200 lines. Splitting in one prompt would touch 7+ files and violate the one-file-per-prompt rule.

**Plan:**
- Prompt 02 — extract types to `auctionSheetTypes.ts`, pure helpers to `auctionSheetHelpers.ts`. No imports yet. ✅ done (commit 13e2be8)
- Prompt 02.5 (out-of-band) — track С-6 cross-tab session leak ✅ done (commit 5781c0d)
- Prompt 03 — extract `UploadZone` component. ✅ done (this commit)
- Prompt 04 — extract `ProcessingViews` component.
- Prompt 05 — extract `ErrorView` component.
- Prompt 06 — extract `ResultView` component, add UI for 11 new fields, replace "Не распознано" with a collapsible "Дополнительный текст с листа" block.
- Prompt 07 — final cleanup: switch AuctionSheetClient to imports, remove inline duplicates, re-verify under 200 lines.

**Decision (expected at closure):** to be promoted to Accepted ADR after prompt 07 lands, documenting the final module boundaries.

## [2026-04-18] Async-only contract for POST /api/tools/auction-sheet (jobId + polling)

**Status:** Accepted

**Confidence:** High

**Context:**
The server-side queue (P-0.2a), job-status endpoint (P-0.2b), and admin stats
endpoint (P-0.2c) are all in place, but the POST route still runs the full AI
pipeline synchronously — blocking the HTTP connection for 30–200 seconds per
request. Under real concurrency this means nginx workers are tied up waiting
for DashScope/DeepSeek, the user holds an open connection for minutes, and
mobile clients lose the result if the screen sleeps. We also can't actually
enforce concurrency=1 (the whole point of the queue) while POST itself invokes
the AI directly and bypasses the queue.

**Decision:**
POST `/api/tools/auction-sheet` becomes async-only. The handler now runs only
synchronous, bounded-time work: rate-limit check, formData parse, file
validation, Sharp compression. On success it calls
`auctionSheetQueue.enqueue(() => runPipeline(compressed, ip, telegramId))` and
returns `202 Accepted` with `{jobId, statusUrl, position, etaSec}` plus a
`Location` header pointing at the job-status endpoint. The full AI pipeline
(Pass 0 classifier + 3 parallel OCR passes + Step 2 parse) is extracted into
a private `runPipeline()` helper that lives only inside the queue worker;
POST never calls DashScope or DeepSeek directly. `recordUsage` and the second
`checkRateLimit` for `remaining` move inside `runPipeline` so quota is only
consumed on full success — failed jobs (thrown errors) leave the user's quota
intact.

Error mapping is deliberately reshuffled:
- `429` → per-user rate-limit exhaustion (unchanged)
- `400` → malformed request or unreadable image (`invalid_request`,
  `no_file`, `file_too_large`, `invalid_type`, `invalid_image`)
- `503` + `Retry-After: 300` → `QueueFullError` (server capacity
  exhaustion, affects all users)
- `500` → unexpected enqueue failure
- Pipeline errors (`ai_error:` / `parse_error:`) never escape to HTTP —
  they surface via the job polling endpoint as `{status:'failed', error}`.

Sharp compression stays in the POST handler, before enqueue: this lets us
reject corrupt uploads synchronously with 400 instead of burning a queue slot
on a doomed job.

**Alternatives considered:**
- Hybrid contract (POST blocks on job if queue is empty, returns 202 only
  when another job is ahead): rejected. Creates two execution paths and two
  error surfaces; nginx `proxy_read_timeout` still has to cover the long
  path; clients still need polling logic for the queued case. Pure async
  simplifies both sides.
- 429 for QueueFullError instead of 503: rejected. 429 means "you are
  sending too many requests" — a specific user signal. Queue-full is a
  shared-capacity event that affects every caller regardless of their
  individual request rate, which is precisely what 503 with `Retry-After`
  describes in RFC 9110.
- Keep pipeline inside POST and just wrap it in a semaphore: rejected.
  Doesn't solve the "connection held for 3+ minutes" problem or
  mobile-polling friendliness.

**Consequences:**
- Clients (web + future bot integration) must poll
  `/api/tools/auction-sheet/job/[jobId]` — required UI/client refactor in
  follow-up prompt P-0.2e.
- Queue concurrency=1 is now actually enforced end-to-end; DashScope
  upstream soft-throttling no longer affects concurrent users.
- nginx `proxy_read_timeout=200s` for the POST endpoint becomes vastly
  over-spec (POST now returns in ~200ms) — we leave it in place because it
  still applies to the polling path for long-running jobs.
- Error observability splits: transport errors stay in nginx/PM2 logs for
  POST; AI-pipeline errors are available both via the job record and the
  `[auction-sheet]` console logs emitted by the queue worker.
- (+) Client-side resilience: jobId persisted in `localStorage` enables
  session restore after screen-off / tab-switch / browser crash. Full
  client flow documented in `architecture.md` → "Client-side: async
  pipeline with session restore" (3-stage processing UI, exponential
  backoff on polling failures, 15-min server TTL as recovery window).

## [2026-04-18] Introduce server-side in-memory queue for auction-sheet (concurrency=1, TTL=15min)

**Status:** Accepted

**Confidence:** High

**Context:**
Even with local `RATE_LIMIT_PER_MINUTE=60` in `dashscope.ts`, parallel
user requests hit DashScope upstream soft-throttling (no HTTP 429,
just elongated latency per concurrent call on the same API key),
causing timeouts and "Ошибка сети" for users. Published RPM limits
(Qwen-VL-OCR 600, Qwen3-VL-Flash 1200) are not relevant — the
bottleneck is concurrent-calls-per-key, not requests-per-minute. The
auction-sheet pipeline makes 4 DashScope calls + 1 DeepSeek call per
user request, so two overlapping users mean ~8 concurrent DashScope
calls on one key.

**Decision:**
Introduce `AuctionSheetQueue` singleton in
`src/lib/auctionSheetQueue.ts`. Concurrency=1 (strict). Max queue
size=10 (`queue_full` rejection beyond). Completed-jobs kept in
memory for 15 minutes (TTL) so mobile clients can poll results after
screen turn-off or tab switch. jobId via `crypto.randomUUID()`
(RFC 9562 v4, 122 bits entropy, built into Node 20, zero deps).
In-memory only — no Redis/DB; single PM2 process is our runtime.
State loss on restart is accepted trade-off. This prompt P-0.2a
delivers the queue module + tests only; integration into the API
route happens in P-0.2d.

**Alternatives considered:**
- Concurrency=2 or higher: rejected — doesn't solve soft-throttling
  (still competing calls per key), merely reduces the problem.
  Strict serialization guarantees zero upstream contention.
- Nanoid or `crypto.randomBytes` for jobId: rejected —
  `crypto.randomUUID()` is built-in, ~4× faster than nanoid,
  RFC-standard, zero deps. Short IDs are not a feature we need
  (jobId goes into an API path, not a URL slug).
- Redis or Postgres persistence: rejected — single-process
  deployment, state loss on restart is rare and acceptable. Adding
  Redis would mean new infra, new failure mode, new config.
  Reconsider only if we move to multi-process.
- In-memory library (p-queue): rejected — small amount of custom
  code gives us exact control over stats, TTL, logging, and
  `queue_full` semantics. p-queue would require customization for
  all of these anyway.

**Consequences:**
- `+` Zero concurrent DashScope calls per key → no soft-throttling
  → predictable latency.
- `+` Queue position and ETA become observable → UX can show a
  progress bar in future prompt P-0.2e.
- `+` Stats (peak size, throughput, failure rate) available for
  future Telegram alerting (P-0.6).
- `−` During peak load, users wait. At 30s per job × 10 jobs =
  5 min max wait for the last. Acceptable for our use case
  (thoughtful car purchase research).
- `−` Process restart loses pending jobs. Mitigations: PM2
  auto-restart is fast (~5s), clients show "Попробуйте ещё" button.
  Acceptable.
- `−` Jobs running in a single process memory means result objects
  consume RAM. At 15-min TTL × worst case ~40 jobs/hour × few KB per
  result = negligible (under 1MB). Verified by computed upper bound.

**Files added:**
- `jck-auto/src/lib/auctionSheetQueue.ts` (queue class + singleton,
  3 `@rule` anchors, under 200 lines).
- `jck-auto/src/lib/auctionSheetQueue.test.ts` (9 test cases via
  `node:test`, run with `npx tsx --test`).

**Files changed:**
- `jck-auto/knowledge/architecture.md` (new "Request Queues" →
  "Auction-sheet request queue" section).
- `jck-auto/knowledge/INDEX.md` (dates/versions bumped).

**`@rule` enforced in auctionSheetQueue.ts header:**
`Concurrency MUST stay 1 — DashScope upstream soft-throttles
concurrent requests per API key, and concurrency=1 is the whole
point of this module.`

---

## [2026-04-18] Raise dashscope.ts RATE_LIMIT_PER_MINUTE 6 → 60

**Status:** Accepted (temporary)

**Confidence:** High

**Context:**
Production logs showed Pass 0 classifier calls taking up to 19.4s
(normal: 2–4s) and user requests returning 504 Gateway Time-out
after 1.1 minutes. Root cause: local rate limiter in `dashscope.ts`
set to `RATE_LIMIT_PER_MINUTE = 6`, while the auction-sheet pipeline
now issues 4 DashScope calls per user-request (Pass 0 classifier
added in prior commit). 6/4 = 1.5 user-requests/minute before
`waitForRateLimit()` blocks for 10–50 seconds.

**Real upstream limits (verified in Alibaba Model Studio console,
JCKAUTO workspace, Singapore region):** Qwen-VL-OCR 600 RPM,
Qwen3-VL-Flash 1200 RPM. Our 6/min was ~100× lower than the
strictest active model — no defensive value.

**Decision:**
Raise `RATE_LIMIT_PER_MINUTE` from 6 to 60. 60/4 = 15 concurrent
user-requests/minute before local throttling kicks in, with a 10×
margin below real upstream limits. Three `@rule` anchor comments
added above the constant in code to prevent accidental regression.

**Alternatives considered:**
- Remove local rate limiter entirely: rejected — defense against
  runaway loops or abuse scenarios has non-zero value, even if
  Alibaba would reject eventually. Local rejection is faster and
  doesn't cost API calls.
- Raise to 120 or higher: rejected — no current justification, and
  higher values risk hitting upstream limits on parallel users. 60
  gives generous headroom for current single-digit daily traffic.

**Consequences:**
- `+` Immediate restoration of auction-sheet service.
- `+` News pipeline / article generator / Encar translator inherit
  the same uplift — they share the limiter. Acceptable since they
  run on cron, didn't suffer user-facing issues, but benefit from
  no throttling.
- `−` Still NOT a real solution. Parallel users or rapid sequential
  requests will still compete for API slots, just with more room.
  **True fix is a server-side queue with concurrency=1 (planned as
  P-0.2).** This ADR is a stopgap until that lands.
- `−` If traffic grows significantly without the queue being
  implemented, the limiter may need another uplift — `@rule` anchors
  ensure we re-evaluate carefully rather than blindly raising.

**Files changed:**
- `jck-auto/src/lib/dashscope.ts` (`RATE_LIMIT_PER_MINUTE = 60`,
  three `@rule` anchor comments above the constant).
- `jck-auto/knowledge/integrations.md` (new "Rate limits" subsection
  in DashScope section).
- `jck-auto/knowledge/INDEX.md` (dates/versions bumped).

---

## [2026-04-18] DeepSeek timeout 60s → 180s, retries 3 → 2, nginx proxy_read_timeout 60s → 200s for /api/tools/auction-sheet

**Status:** Accepted

**Confidence:** High

**Context:**
Production logs showed systematic DeepSeek failures during Step 2 of
the auction-sheet pipeline: repeated "Failed to read response body"
(3 retries) and "Failed to parse JSON" (3 retries) entries. Root
cause — response times for heavy Japanese auction sheets (1700+
output tokens) exceed the 60s fetch timeout; `controller.abort()`
fires, fetch throws, and the wrapper logs "Failed to read body" with
no further context. Combined with three retries (up to 180s on
DeepSeek alone) and nginx 60s cap, requests routinely failed with
"Ошибка сети" before the qwen3.5-flash fallback could complete.

**Decision:**
1. Raise `REQUEST_TIMEOUT_MS` in `src/lib/deepseek.ts` from 60_000 to
   180_000.
2. Reduce `MAX_RETRIES` from 3 to 2 so worst-case total stays
   reasonable.
3. On nginx: add per-endpoint regex location for
   `/api/tools/auction-sheet` with `proxy_read_timeout 200s`
   (was 60s default) and `client_max_body_size 15M` (was 1M default).
4. Improve DeepSeek error diagnostics: distinguish AbortError
   (timeout), HTTP non-2xx, body read failure, and generic network
   errors. Log actual error type, elapsed time, and attempt number.

**Alternatives considered:**
- Keep 60s and only switch fallback faster: rejected — wasted
  DeepSeek's primary advantage (~$0.001 per call vs qwen3.5-flash
  ~$0.002).
- Move Step 2 to qwen3.5-plus: rejected — its thinking mode was the
  exact cause of the original С-1 incident.
- Skip retries entirely (`MAX_RETRIES = 1`): rejected — transient
  5xx from DeepSeek is common; one retry is cheap insurance.

**Consequences:**
- `+` User-facing "Ошибка сети" on heavy sheets should drop
  significantly.
- `+` Better ops diagnostics: future incidents show real error type,
  not "read body failed".
- `−` Worst-case total time per request rises from ~180s to up to
  ~360s, but hard-capped by nginx at 200s → second retry effectively
  only runs on fast failures.
- `−` Affects ALL callers of `callDeepSeek` (news pipeline, article
  generator), not just auction-sheet. Benefit is the same (longer
  timeout, better logs), but they inherit 180s. Acceptable because
  they run on cron outside user-facing latency budgets.

**Files changed:**
- `jck-auto/src/lib/deepseek.ts` (`REQUEST_TIMEOUT_MS`, `MAX_RETRIES`,
  typed catch-block diagnostics, per-attempt elapsed logging,
  final retry-exhaustion log, `@rule` header update).
- `/etc/nginx/sites-available/jckauto` (VDS-side) — new regex
  `location ~ ^/api/tools/auction-sheet(/|$)` with 200s timeouts,
  15M body size, buffering off. Backup at
  `/etc/nginx/sites-available/jckauto.backup-2026-04-18`.
- `jck-auto/knowledge/infrastructure.md` ("Per-endpoint nginx overrides").
- `jck-auto/knowledge/integrations.md` (DeepSeek timeout/retries updated).
- `jck-auto/knowledge/tools.md` (nginx 200s / 15MB mention, DeepSeek 180s).

**`@rule` enforced in deepseek.ts header:**
`retry only on network/5xx/429; max 2 attempts; 180s timeout per
attempt; never log prompts or API key; check key at call-time, not
at import`

**`@rule` enforced in infrastructure.md:**
`Do NOT remove this block without updating DeepSeek timeout in
src/lib/deepseek.ts simultaneously. 180s DeepSeek + OCR + classifier
can exceed default 60s nginx timeout.`

---

## [2026-04-17] Introduce Pass 0 sheet-type classifier for auction-sheet pipeline

**Status:** Accepted

**Confidence:** High

**Context:**
Handwritten auction sheets (HAA, parts of TAA/CAA) currently fail on
Pass 1 because `qwen-vl-ocr` and `qwen3-vl-flash` have weak
handwriting recognition. Different sheet types need different model
chains, but a routing decision requires a signal: the pipeline has no
visibility today into whether an incoming sheet is printed (USS, CAA)
or handwritten (HAA, some TAA).

**Decision:**
Introduce a new Pass 0 — a lightweight classifier that categorizes
the incoming sheet as `printed`, `handwritten`, or `mixed`, using
`qwen3-vl-flash` with a narrow, single-token output prompt
(`maxTokens: 20`, `temperature: 0`). Classifier is advisory and
non-blocking: any failure (timeout, unexpected output, exception)
defaults to `'printed'` so the current pipeline continues to work.
Result is returned via `meta.sheetType` (plus `meta.classifierModel`
and `meta.classifierElapsed`) for observability in this iteration;
subsequent iterations will use it for per-pass model routing.

**Alternatives considered:**
- Route all sheets through the stronger model (`qwen3.5-plus`):
  rejected — 6–10× cost increase and nginx timeout risk for the
  70–80% of sheets that are printed.
- Content-based fallback after Pass 1 (retry on stronger model if
  Pass 1 output is too short): rejected as primary approach —
  unbounded latency for handwritten sheets and fragile heuristic.
  May be added later as a secondary safety net.

**Consequences:**
- `+` Observability improves immediately — logs and API `meta`
  show sheet type for every request.
- `+` Enables per-type model routing in the next prompt without
  further architectural change.
- `−` +~$0.001 and +2–3 seconds per request on every sheet.
- `−` One more external call in the request path, adds a failure
  surface (mitigated by soft-fail policy).

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts` (two new
  prompt constants, `classifySheet` helper, Pass 0 call, three new
  `meta` fields).
- `jck-auto/knowledge/tools.md` (new Pass 0 subsection).
- `jck-auto/knowledge/INDEX.md` (updated dates and descriptions).

**`@rule` enforced in route.ts:**
`RULE: Classifier output is advisory, NOT blocking. On any failure
(timeout, unexpected output, exception) return type='printed'.`
`RULE: Classifier uses ONLY qwen3-vl-flash — fast and cheap. Do NOT
add qwen3.5-plus to the classifier chain; the whole point of routing
is to avoid paying qwen3.5-plus cost on every request.`
`RULE: maxTokens=20 is intentional. If the model outputs more than
one short word, the prompt is not being followed and we treat it as
failure (default to 'printed').`

---

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

## [2026-04-18] Extend parse schema for auction-sheet with 10 new fields

**Status:** Accepted

**Confidence:** High

**Context:**
Pass 1 of the multi-pass OCR pipeline (`OCR_TEXT_FIELDS_SYSTEM` in
`src/app/api/tools/auction-sheet/route.ts`) already instructed the model
to extract `車台番号` (chassis/VIN), `型式` (model code), `登録番号`
(registration plate), `車検` (inspection date), `リサイクル預託金`
(recycle fee), `乗車定員` (seats), `カラーNo.` (color code) and `諸元`
(dimensions) from every sheet. Pass 3 (`OCR_FREE_TEXT_SYSTEM`) already
captured `[セールスポイント]` (sales points) as a bracketed block. None
of these had a corresponding field in `PARSE_SYSTEM_PROMPT`'s JSON
schema, so the data was either silently lost or pushed into the generic
`unrecognized` bucket. Production telemetry confirmed this: the
user-visible "Не распознано" block regularly contained VIN,
registration plate and dimension values — data that belongs in
structured fields. Additionally, `ドア形状` (body type code like 3D /
4SD / 5W) was missing from the Pass 1 explicit label enumeration, so
the OCR model was not reliably picking it up.

**Decision:**
Extend `PARSE_SYSTEM_PROMPT` JSON schema with 10 new structured fields
(11 properties, since VIN is split into value + confidence):

- `vin` + `vinConfidence` — VIN string plus a three-state confidence
  enum (`high` / `medium` / `unreadable` / `null`).
- `modelCode` — Japanese model classification code from `型式`.
- `registrationNumber` — registration plate from `登録番号`.
- `inspectionValidUntil` — shaken validity in ISO-8601 `YYYY-MM`
  precision after Japanese-calendar conversion.
- `recycleFee` — recycle fee from `リサイクル預託金` as a JSON integer
  (yen).
- `seats` — seating capacity from `乗車定員` as a JSON integer.
- `colorCode` — manufacturer color code from `カラーNo.`.
- `dimensions` — object `{length, width, height}` in centimeters
  (JSON integers) from `諸元`.
- `salesPoints` — array of Russian-translated sales points from the
  `[セールスポイント]` block of Pass 3.
- `bodyType` — Russian decoding of `ドア形状` (3D → 3-дверный, 4SD →
  4-дверный седан, 5W → 5-дверный универсал, 5D → 5-дверный хэтчбек,
  2D → 2-дверный купе; unknown codes passed through as-is).

Add `ドア形状` to the `OCR_TEXT_FIELDS_SYSTEM` "Include (if visible)"
enumeration so Pass 1 reliably surfaces the body-type code. Append six
STRICT RULES (8–13) to `PARSE_SYSTEM_PROMPT` covering VIN three-state
semantics, integer-typing for numeric fields, sales-points sourcing,
body-type fallback, and Japanese-calendar conversion for inspection
date.

Introduce a three-state VIN confidence so the UI can honestly surface
"VIN is physically present on the sheet but photo quality prevented a
reliable read" — distinct from "the sheet has no VIN cell at all".

No changes to pipeline orchestration, error handling, rate limits, or
the queue. The other OCR prompts (`OCR_DAMAGES_SYSTEM`,
`OCR_FREE_TEXT_SYSTEM`, `CLASSIFIER_SYSTEM`) are untouched.

**Alternatives considered:**
- Postprocess the OCR blob with regex after Step 2: rejected. Creates a
  second source of truth outside the model's schema contract and drifts
  whenever OCR output format shifts.
- Wait for the full client refactor before extending the schema:
  rejected. Backend extension is backward-compatible — old clients and
  cached bundles silently ignore unknown JSON fields. Serializing the
  work helps rollback isolation and allows the client UI (prompts 02–07)
  to reference a stable schema contract.
- Migrate the bot handler (`src/bot/handlers/auctionSheet.ts`) schema in
  the same commit: rejected. The bot handler runs its own legacy prompt
  on a separate code path; migrating it is tracked as a future effort
  (see `bugs.md` Б-2 / Б-3). Scope-creep kept out of this prompt.
- Duplicate `セールスポイント` into Pass 1 for structured access:
  rejected. Pass 1 output format is strict `label: value` per line,
  whereas sales points are a multi-line bracketed block. Leaving the
  block in Pass 3 and reading it from the `[セールスポイント]` marker
  in Step 2 is architecturally cleaner.

**Consequences:**
- (+) Data that OCR already extracts becomes available to downstream
  consumers (web UI, future bot PDF export, tg-integration).
- (+) The "Не распознано" block shrinks to genuinely leftover text once
  the client renders the new fields.
- (+) VIN confidence semantics give the UI an honest way to surface
  "sheet shows VIN but photo quality insufficient" without silently
  dropping the signal.
- (+) Future bot handler migration inherits the richer schema for free.
- (−) DeepSeek output token budget grows an estimated 200–400 tokens per
  parse. Well within the `maxTokens: 4096` cap, no impact on nginx
  timeout.
- (−) Cached client bundles continue rendering only the old field set
  until users refresh. Not a breaking change because the old fields are
  unchanged.

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts` —
  `OCR_TEXT_FIELDS_SYSTEM` (enum only) and `PARSE_SYSTEM_PROMPT`
  (schema + STRICT RULES 8–13) constants. No other part of the file
  was modified.
- `jck-auto/knowledge/tools.md` — new paragraph in "Step 2 —
  структурирование в JSON" subsection listing the 10 fields.
- `jck-auto/knowledge/INDEX.md` — `tools.md` and `decisions.md` row
  descriptions and dates updated.
