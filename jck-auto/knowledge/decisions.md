<!--
  @file:        knowledge/decisions.md
  @project:     JCK AUTO
  @description: Architectural Decision Records (ADR log) — append-only
  @updated:     2026-04-21
  @version:     1.31
  @lines:       ~2470
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

## [2026-04-18] Fix file input value reset in UploadZone (pick-clear-pick-same-file bug)

**Status:** Accepted

**Confidence:** High

**Context:**
Users on production could not re-select the same file after clicking
"Убрать" — the upload zone silently ignored the pick. Browser refresh
worked around it. Bug was latent in the inline upload-zone code
(pre-prompt-03) and was preserved 1:1 during the extract refactor (per
prompt 03's "do not fix quirks mid-refactor" rule). Vasily found it
during the post-deploy smoke test on 2026-04-18.

Root cause: HTML `<input type="file">` does not fire a `change` event
when the selected file is the same as the previously captured one — the
element's internal `files` array is unchanged. When React state is
reset via `onClear`, the state says "no file", but the DOM input still
remembers the file. Reselecting the same filename is a no-op from the
browser's perspective.

**Decision:**
Reset `<input type="file">` value in two places inside `UploadZone.tsx`:
(1) at the end of `onChange`, after the captured file is handed to
`onFileSelect`; (2) at the start of the X-button `onClick`, before
calling `onClear`. Also annotate the `<input>` with a `@rule` comment
block explaining why both resets exist, to prevent future "cleanup"
passes from removing either one.

**Alternatives considered:**
- Reset value ONLY inside `onChange`: rejected — leaves a gap if the
  user never invokes `onChange` between picks (unusual but possible).
  The two-site reset is complete and costs two lines.
- Reset value ONLY inside X-button: rejected — covers the most visible
  symptom but leaves subtle cases (double-clicked dialog, programmatic
  close of file chooser) uncovered.
- Use `key={fileId}` on the `<input>` to force React to remount it on
  clear: rejected — works but ties DOM lifecycle to React reconciler
  timing, harder to reason about than a direct `.value = ""` reset.
- Listen to `click` on the input and pre-reset: rejected — doesn't help
  when the user picks via drag, plus adds another handler to maintain.

**Consequences:**
- (+) Pick → clear → pick-same-file now works without a page reload.
- (+) `@rule` anchor documents the reason, preventing regressions in
  prompts 04–07 (cleanup) or future refactors.
- (+) Behaviour for different-file picks and drag-and-drop is unchanged
  (drop path does not go through `input.value`).
- (−) Two extra lines of code in a small component. Acceptable overhead
  for a visible UX bug.
- Safety: `inputRef.current` is always non-null at the reset sites. The
  `<input>` is always present in the DOM, only visually hidden via
  `className="hidden"` — it is never conditionally rendered. Confirmed
  by reading the current `UploadZone.tsx`.

**Files changed:**
- `jck-auto/src/app/tools/auction-sheet/UploadZone.tsx` (three edits:
  `@rule` anchor + two value resets)

## [2026-04-18] Expose `remaining` and `isLifetimeLimit` in 429 response body for auction-sheet

**Status:** Accepted

**Confidence:** High

**Context:**
The 429 rate_limit body currently distinguishes three sub-cases (cooldown,
anon-exhausted, auth-exhausted) only in the Russian-language `message`
field. The client catch-all error branch for `rate_limit` renders
`TelegramAuthBlock` in all three cases, causing bug С-7 where cooldown
and authenticated-daily-exhausted users are incorrectly prompted to
re-authenticate. `rateLimiter.ts` already exposes both `remaining` and
`isLifetimeLimit` on `RateLimitResult` — we propagate them to HTTP.

**Decision:**
Add two fields to the 429 JSON body: `remaining: number` (copied from
`limit.remaining`) and `isLifetimeLimit: boolean` (coerced from
`limit.isLifetimeLimit ?? false` so the field is always a boolean, never
undefined). `resetIn`, `message`, `alternatives`, `error` fields
preserved unchanged. Additive non-breaking change — old clients ignore
the new fields.

**Alternatives considered:**
- Parse `message` on the client to detect sub-case: rejected — brittle,
  any Russian text tweak breaks the client.
- Use separate error codes (`rate_limit_cooldown`, `rate_limit_lifetime`,
  `rate_limit_daily`): rejected — more intrusive contract change, three
  new error codes to document, harder to roll back.
- Return the three distinct modes as an enum string field
  (`mode: "cooldown" | "lifetime" | "daily"`): rejected — derivable from
  the two boolean/number facts already exposed; adding a redundant enum
  creates a second source of truth.

**Scope:**
- auction-sheet endpoint ONLY. `/api/tools/encar` uses the same rate
  limiter but its error UX is not in scope for this series. Encar client
  will continue using the catch-all path until a separate update
  addresses it.

**Consequences:**
- (+) Client in Prompt 06 (ErrorView extract) can correctly route
  cooldown vs exhaustion vs daily-exhausted without text parsing.
- (+) Bug С-7 becomes fixable by the client without further API changes.
- (+) Backward-compatible: old clients that don't reference the new
  fields continue working unchanged.
- (−) Slightly more verbose 429 body (two extra fields, negligible
  payload impact).

**Files changed:**
- `jck-auto/src/app/api/tools/auction-sheet/route.ts` (three added
  fields in one JSON body block)
- `jck-auto/knowledge/tools.md` (endpoint bullet extended)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-18] Extend ApiError client type with rate_limit sub-fields

**Status:** Accepted

**Confidence:** High

**Context:**
The 429 response body was extended in Prompt 05 with `remaining: number`
and `isLifetimeLimit: boolean`. The client type `ApiError` in
`auctionSheetTypes.ts` has not yet caught up — `setError(body as ApiError)`
silently accepts the extra runtime fields, but type-safe access to them
in future components (Prompt 07 ErrorView) would require `as any` or
local type widening. To avoid scattered type hacks we extend the shared
client type once.

**Decision:**
Add two optional fields to `ApiError`: `remaining?: number` and
`isLifetimeLimit?: boolean`. Group them with the existing
`resetIn?: number` (all three are rate_limit-specific). Attach JSDoc
that states the fields are meaningful only when `error === "rate_limit"`
and spells out the three-case semantics (cooldown / anon-lifetime /
auth-daily).

**Alternatives considered:**
- Introduce a discriminated subtype `RateLimitError extends ApiError`
  with required fields: rejected — overengineering for two optional
  fields; forces a new `ApiError | RateLimitError` union across
  consumers with little safety gain.
- Parse `message` at the client: rejected in Prompt 05 already (brittle,
  locale-coupled).
- Leave the type untouched and use `as any` in Prompt 07: rejected —
  `as any` erodes type-safety project-wide, and we'd add this hack
  every time a new consumer of the rate_limit sub-cases appears.

**Consequences:**
- (+) Prompt 07 ErrorView can read `error.remaining` and
  `error.isLifetimeLimit` with full type-safety.
- (+) Future consumers (e.g. an error-analytics hook, a bot-client
  reader) inherit the structured type for free.
- (+) Backward-compatible: fields are optional, existing error objects
  (queue_full, network, submit_error, pipeline_failed, job_not_found)
  remain valid without the new fields.
- (−) Developers must remember the JSDoc constraint — the fields are
  only defined for `error === "rate_limit"`. Mitigation: explicit JSDoc
  on each field.

**Files changed:**
- `jck-auto/src/app/tools/auction-sheet/auctionSheetTypes.ts` (two
  optional fields added with JSDoc)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-18] Fix C-7 (rate_limit UI) and extract ErrorView

**Status:** Accepted

**Confidence:** High

**Context:**
Bug С-7 was reported 2026-04-18: after an authenticated user hits the
2-minute cooldown, the UI re-displays the Telegram auth block instead
of a cooldown message. Diagnosis revealed the error branch for
`rate_limit` was a single catch-all rendering `TelegramAuthBlock`
unconditionally, plus `handleAnalyze` 429 handler poisoned the
orchestrator state with `setIsLimitReached(true)` + `setUsedCount(3)`
even in cooldown scenarios. Further: an authenticated user exhausting
the daily 10-request quota was also (incorrectly) shown the auth block
— a case Vasily did not report but the diagnosis exposed as a sibling
issue. All three are fixed in this prompt.

**Decision:**
Extract ErrorView into its own component file with sub-case routing by
(`error.error`, `error.remaining`, `error.isLifetimeLimit`) triple.
Four sub-cases:
1. `queue_full` — unchanged (2 buttons).
2. `rate_limit` cooldown (`remaining > 0`) — live MM:SS countdown +
   retry button disabled until timer reaches 0.
3. `rate_limit` anonymous-lifetime exhausted (`remaining === 0 &&
   isLifetimeLimit === true`) — `TelegramAuthBlock` (unchanged UX).
4. `rate_limit` authenticated-daily exhausted (`remaining === 0 &&
   isLifetimeLimit === false`) — single "Написать менеджеру" CTA, no
   retry (useless until next day).

Plus the default branch (unchanged) for any other error code. Fix
`handleAnalyze` 429 handler to gate `setIsLimitReached(true)` +
`setUsedCount(3)` behind `if (body.isLifetimeLimit)` — cooldown and
daily-exhausted no longer poison global state. CooldownTimer is an
inner sub-component of ErrorView's file (not exported, implementation
detail).

**Alternatives considered:**
- Keep error branch inline, just add sub-case conditionals: rejected —
  the inline block is already ~40 lines and would grow to ~80 with the
  new cases, pushing orchestrator further over the 200-line guideline
  instead of toward it.
- Split CooldownTimer into a separate file: rejected — it's a 20-line
  implementation detail of ErrorView's cooldown case with no reuse
  potential, and adds a new importable surface for no benefit.
- Expose `setCooldownReady` through a callback instead of owning state
  in ErrorView: rejected — the readiness state is purely local to
  ErrorView's cooldown render, orchestrator doesn't care.
- Put the `if (body.isLifetimeLimit)` gate inside ErrorView instead of
  `handleAnalyze`: rejected — by the time ErrorView renders,
  `isLimitReached` and `usedCount` are already poisoned in the
  orchestrator. The fix has to happen at the source (the state setter).

**Consequences:**
- (+) Cooldown users see a concrete timer instead of confusing auth
  prompt.
- (+) Authenticated users with exhausted daily quota see the right CTA
  (manager contact).
- (+) Orchestrator state (`isLimitReached`, `usedCount`) no longer
  desynchronises across sub-cases.
- (+) Bug С-7 closed without ever opening a bugs.md entry (same
  pattern as the input-reset fix in Prompt 03.5 ADR).
- (−) ErrorView is ~180 lines. Under the 200 limit but close. If
  another sub-case appears in the future, split before growing.

**Files changed:**
- `jck-auto/src/app/tools/auction-sheet/ErrorView.tsx` (new)
- `jck-auto/src/app/tools/auction-sheet/AuctionSheetClient.tsx`
  (import + 429 handler fix + inline block replacement)
- `jck-auto/knowledge/tools.md`, `jck-auto/knowledge/INDEX.md`

## [2026-04-18] AuctionSheetClient split complete — modular view components

**Status:** Accepted

**Confidence:** High

**Context:**
Prompt 02 began splitting the 655-line `AuctionSheetClient.tsx` into
modular components. Through prompts 02–08 (+ interleaved bug fixes
02.5, 03.5 and API changes 05, 06), the orchestrator has been reduced
and its inline types/helpers migrated to shared modules. This ADR
closes the series, promoting the WIP entry to Accepted.

**Decision:**
Final module boundaries:
- `auctionSheetTypes.ts` — all TypeScript types (`AuctionResult`,
  `ApiError`, `JobStatusResponse`, etc.) and helper types
  (`VinConfidence`, `CarDimensions`, `FormattedVin`).
- `auctionSheetHelpers.ts` — pure formatting functions (`formatSize`,
  `gradeColor`, `severityColor`, `confidenceBadge`, `formatVin`,
  `formatDimensions`, `formatRecycleFee`).
- `UploadZone.tsx` — drag/drop + file input + preview.
- `ProcessingViews.tsx` — three transitional states
  (submitting/queued/processing) with stage rotation.
- `ErrorView.tsx` — error rendering with four sub-cases (queue_full,
  rate_limit cooldown/lifetime/daily, default) including live cooldown
  timer.
- `ResultView.tsx` — nine sections of decoded auction sheet data
  including Identification and Sales Points. Contains an inner
  `ResultFooter` sub-component (not exported) to keep the main render
  tree readable.
- `AuctionSheetClient.tsx` — orchestrator with state, handlers,
  effects, polling lifecycle, and a thin render tree delegating to view
  modules.

**Observed outcomes:**
- Line counts: orchestrator 591 → 368 (target <300 for this series was
  not reached; the remaining volume is the polling machine +
  handleAnalyze + handleDownloadPdf + three `useEffect`s, which cannot
  be compressed without a polling custom hook — deferred). Each view
  module stays under the 200-line guideline except `ResultView.tsx`,
  which at ~268 lines hosts 9 visual sections + inner `ResultFooter`
  split per the prompt's fallback clause.
- Bug С-7 (rate_limit UX desync) fully closed in Prompt 07.
- 11 new API fields (VIN, model code, registration plate, inspection
  date, recycle fee, seats, color code, dimensions, sales points, body
  type) from Prompt 01 schema extension now surface in the UI via
  Prompt 08.
- "Не распознано" replaced by collapsible "Дополнительный текст с
  листа" — cleaner default view with scope transparency via counter.

**Deferred:**
- С-6 cross-tab session leak (tracked in `bugs.md`, awaits dedicated
  fix prompt).
- Polling custom hook (would trim orchestrator toward <200 lines but
  adds abstraction not justified by current needs).
- Bot handler migration to shared pipeline (tracked in `bugs.md` as
  Б-2/Б-3).

**Files changed (this commit):**
- `jck-auto/src/app/tools/auction-sheet/ResultView.tsx` (new)
- `jck-auto/src/app/tools/auction-sheet/AuctionSheetClient.tsx`
  (massive cleanup: inline types → import, inline helpers removed,
  unused imports removed, inline result JSX replaced with `<ResultView>`)
- `jck-auto/knowledge/tools.md`, `jck-auto/knowledge/INDEX.md`,
  `jck-auto/knowledge/decisions.md`

## [2026-04-19] Sync /tools/auction-sheet UI texts with real system behaviour

**Status:** Accepted

**Confidence:** High

**Context:**
The `/tools/auction-sheet` landing page carried three kinds of user-facing
copy that contradicted the actual system behaviour:
1. Four places (`metadata.description`, `openGraph.description`,
   `webAppJsonLd.description`, hero subtitle) promised "за 15 секунд".
   The real pipeline (Pass 0 classifier + 3 parallel OCR passes +
   DeepSeek Step 2 parse) takes 20–60 seconds on printed sheets and
   up to ~120 seconds on handwritten ones. Users interpreting "15s"
   as a real SLA perceived the tool as broken while waiting.
2. FAQ item #3 said "3 расшифровки в день бесплатно". The rate
   limiter (`src/lib/rateLimiter.ts`, `MAX_ANONYMOUS_REQUESTS = 3`,
   `ipMap` never cleared) applies a **lifetime** quota for
   anonymous users — the 3-request limit never resets. Authenticated
   users (via `@jckauto_help_bot` Telegram Login) receive 10/day with
   a 2-minute cooldown between requests.
3. FAQ item #5 referenced a "Не распознано" block. Prompt 08 of the
   AuctionSheetClient refactor series renamed that block to the
   collapsible "Дополнительный текст с листа" (native
   `<details>/<summary>` in `ResultView.tsx`).

Knowledge base (`knowledge/tools.md` Rate Limiting section) was
already correct; only the user-facing page copy was stale.

**Decision:**
Synchronize all three classes of copy with the source of truth in
code:
- Hero/metadata/JSON-LD descriptions now say "обычно за 20–60 секунд"
  instead of "за 15 секунд".
- FAQ item #3 now explicitly states the two-mode rate limit: 3
  lifetime for anonymous users, 10/day + 2-minute cooldown for
  Telegram-authenticated users.
- FAQ item #5 now references the current "Дополнительный текст с
  листа" collapsible block name.
- File header `@lastModified` bumped to 2026-04-19.
- `metadata.description` kept under the 155-character SEO truncation
  threshold (new length: 143 chars).

**Alternatives considered:**
- Add a "typical latency" field to the JSON-LD and compute the hero
  subtitle from it: rejected — one-shot static page, abstraction not
  justified.
- Leave FAQ #3 alone and add a footnote: rejected — the text is
  factually wrong, not just incomplete; a footnote would not remove
  the misleading primary claim.

**Consequences:**
- (+) User-facing timing expectations align with actual pipeline
  behaviour; fewer "stuck" perceptions during the 20–60s wait.
- (+) Anonymous users no longer read "3 в день" and expect a fresh
  quota tomorrow — the lifetime semantics are stated up-front.
- (+) FAQ no longer references a UI element that doesn't exist.
- (−) None — pure text update, no runtime behaviour change.

**Files changed (this commit):**
- `jck-auto/src/app/tools/auction-sheet/page.tsx` (6 text edits + 1
  header date bump)
- `jck-auto/knowledge/decisions.md` (this ADR + header bump)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-19] Per-tool FAQ heading across /tools/* pages

**Status:** Accepted

**Confidence:** High — series 02–05 complete, all 4 consumers
updated, `tsc --noEmit` clean of missing-prop errors, `npm run
build` green on the series branch.

**Context:**
`CalculatorFAQ` hardcoded h2 "Частые вопросы о расчёте" across 4
tool pages (calculator, customs, encar, auction-sheet). The heading
was semantically correct only for calculator. On the other 3 pages
it hurt SEO (h2 should carry the page's core keyword) and user
orientation (F-pattern scanning expects the topic noun first).

**Decision:**
Promoted `heading` to a required prop of `CalculatorFAQ`. Each
consumer page passes a per-tool heading with the page's core
keyword first:
- calculator → "Расчёт. Частые вопросы"
- customs → "Растаможка. Частые вопросы"
- encar → "Encar. Частые вопросы"
- auction-sheet → "Аукционные листы. Частые вопросы"

**Why required, not optional with default:**
`next.config.ts` has `typescript: { ignoreBuildErrors: true }`, so
a missing optional prop would silently render as `undefined` at
runtime. Required prop + single-branch serialization of the 4
prompts (`claude/faq-heading-per-tool`) was the only safe path —
any intermediate merge to main would have shipped a blank h2 to
production on the unfixed pages.

**Alternatives considered:**
- Optional prop with a generic default ("Частые вопросы") —
  rejected: silently keeps the regression on customs/encar/
  auction-sheet under the build-errors-ignored loophole.
- Prompt sequence with auto-merge after each prompt (default
  project flow) — rejected: same reason; would have shipped blank
  headings between prompts.

**Consequences:**
- (+) Each tool page has an SEO-aligned h2 with its core keyword
  first; improves topic relevance and F-pattern scanning.
- (+) Future `/tools/*` pages cannot forget the heading —
  TypeScript enforces the required prop, and the `@rule` note in
  the component docblock serves as a second tripwire for code
  review and AI edits.
- (−) One extra prop on each consumer call site (~40 characters).
  Trivial cost.

**Series execution:**
- Prompt 02 — `CalculatorFAQ.tsx` required prop + `calculator/
  page.tsx` consumer (2026-04-19, commit 9433c90)
- Prompt 03 — `customs/page.tsx` (2026-04-19, commit 49e7566)
- Prompt 04 — `encar/page.tsx` (2026-04-19, commit 09cbbd0)
- Prompt 05 — `auction-sheet/page.tsx` + ADR promotion (this
  commit)

**Files:**
- `jck-auto/src/app/tools/calculator/CalculatorFAQ.tsx`
- `jck-auto/src/app/tools/calculator/page.tsx`
- `jck-auto/src/app/tools/customs/page.tsx`
- `jck-auto/src/app/tools/encar/page.tsx`
- `jck-auto/src/app/tools/auction-sheet/page.tsx`

**Supersedes WIP:** "Per-tool FAQ heading (series 02–05)"
(recorded 2026-04-19, now cut from `§ Active iterations`).

## [2026-04-19] Prompt-series strategy under auto-merge + ignoreBuildErrors

**Status:** Accepted

**Confidence:** High — both underlying mechanisms directly observed
in session 2026-04-19 (auto-merge behaviour confirmed by reading
`.github/workflows/auto-merge.yml`; silent blank render confirmed
by deployed pages `/tools/customs`, `/tools/encar`,
`/tools/auction-sheet` showing `<h2></h2>` between Prompt 02 and
Prompt 05 commits).

**Context:**
The project has two independent mechanisms that compose into a
trap for multi-prompt series that change a shared component's API:

1. `.github/workflows/auto-merge.yml` triggers on every push to
   `claude/**` and immediately merges to main — no staging, no
   label gate, no required PR. Every push is a deploy.
2. `next.config.ts` sets `typescript: { ignoreBuildErrors: true }`,
   so missing required props pass `npm run build` and render as
   `undefined` at runtime (blank DOM for JSX expressions).

Series 02–05 on 2026-04-19 made `CalculatorFAQ.heading` a required
prop across 4 consumer pages. The plan was "single branch for the
whole series, one merge at the end". That plan was defeated by
mechanism #1: each prompt's push to `claude/faq-heading-per-tool`
auto-merged to main independently. Between Prompt 02 (component
change + 1 consumer fixed) and Prompt 05 (last consumer fixed),
three pages rendered a blank `<h2>` in production for ~40 minutes.
SEO damage was negligible (Google did not recrawl within that
window), but the mechanism is real and the cost could have been
much worse (e.g. a required auth prop, a required data-fetch prop).

**Decision:**
For any prompt series that changes a shared component's API or
otherwise creates intermediate broken states, one of the following
three strategies MUST be chosen BEFORE writing Prompt 02 of the
series, documented in the series ADR or WIP entry, and enforced in
every prompt's REGRESSION SHIELD block:

- **Strategy A — Graceful contract evolution (default).** Design
  the intermediate states to be behaviourally equivalent to the
  current production behaviour. For required-prop changes: make
  the prop optional first with a default that matches today's
  behaviour, update all consumers to pass explicit values, THEN
  tighten to required in the final prompt. Each intermediate
  push auto-merges safely because nothing is actually broken.
  This is the preferred default when the contract change is
  self-contained.

- **Strategy B — Non-`claude/**` branch prefix.** Use a branch
  prefix that `auto-merge.yml` does not match (e.g. `feature/**`,
  `series/**`). Merge to main manually after the full series
  lands. This requires explicit instruction to Claude Code in
  every prompt of the series to use the non-default prefix.
  Requires no code change today (auto-merge.yml already filters
  by `claude/**` only).

- **Strategy C — Hold locally until final prompt.** All prompts
  in the series commit locally but DO NOT push. Only the final
  prompt pushes all commits at once. Requires Vasily to manage
  his local state carefully and defeats the normal push-per-
  prompt workflow. Use only when Strategies A and B are
  infeasible.

The DEFAULT choice is Strategy A. Strategies B and C require an
explicit justification in the series ADR. Strategy B is
operationally cheapest if A is infeasible.

**Why not fix the root cause now:**
Changing `auto-merge.yml` to gate on labels or PR-ready state
would break the normal single-prompt workflow (the vast majority
of Claude Code work) and require Vasily to add PR ceremony to
every prompt. Changing `next.config.ts` to
`ignoreBuildErrors: false` would expose 6 pre-existing bot
baseline TypeScript errors and break deploy until those are
fixed — a separate prompt series. Both fixes are on the backlog
but neither is blocking; the strategy-based mitigation is
sufficient for foreseeable series.

**Alternatives considered:**
- Add a CI check that runs `npx tsc --noEmit` and fails the deploy
  on errors — rejected for now, because the 6 baseline bot errors
  would require a prerequisite cleanup series before this check
  could be enabled. Logged as roadmap item.
- Require every shared-component API change to go through a
  codemod that updates all consumers in one atomic commit —
  rejected as premature optimisation; Strategy A covers this
  case with less ceremony.

**Consequences:**
- (+) Future prompt-series are planned for auto-merge
  compatibility from the start — no repeat of the blank-h2
  window.
- (+) Strategy A is genuinely the right default — it produces
  cleaner git history (each commit is deployable) and better
  code reviewability.
- (−) Slightly more planning overhead before the series starts
  (choose Strategy A/B/C, document it). Justified by the cost
  of the observed failure.
- (−) Strategy B and C require discipline about branch names /
  local state that is new to the workflow.

**Files:**
- No code files changed — this is a methodology record.
- `knowledge/rules.md` gained two atomic rules
  (auto-merge behaviour + `ignoreBuildErrors` trap) pointing to
  this ADR for the strategy context.

**Discovered via:**
Series 02–05 on 2026-04-19 (CalculatorFAQ per-tool heading),
branch `claude/faq-heading-per-tool`, commits 9433c90, 49e7566,
09cbbd0, 64e4c54.

## [2026-04-19] Cross-tab session ownership in auction-sheet client

**Status:** Accepted

**Confidence:** High — all three components directly tested during fix
(sessionStorage per-tab behaviour, localStorage cross-tab visibility,
UUID generation fallback for older mobile Safari).

**Context:**
ADR `[2026-04-18] Async-only contract for POST /api/tools/auction-sheet`
introduced session restore: the client persists the active jobId to
`localStorage['jckauto.auction_sheet.active_job']` and resumes polling
on remount. This was designed for single-tab resilience (screen-off,
tab-switch, browser minimize, F5 reload) — sessionStorage would have
been insufficient because it dies on some mobile "tab eviction" paths.

Side-effect: localStorage is shared across all tabs of the same origin.
Bug C-6 reported that opening `/tools/auction-sheet` in a second tab
caused that tab to auto-pick-up the first tab's job and render the
private result (VIN, lot number, damage codes) without the user's
awareness.

**Decision:**
Introduce per-tab ownership via `sessionStorage['jckauto.auction_sheet.tab_id']`
(a random UUID, generated on first mount of each tab). The localStorage
record changes shape from a plain string `"<jobId>"` to a JSON object
`{jobId, ownerTabId}`. On mount, session restore runs only if
`localStorage.ownerTabId === sessionStorage.tabId`. Otherwise the tab
behaves as a fresh tab and shows a clean upload screen.

**Orphan handling — silent cleanup, no resume banner:**
An "orphan" is a localStorage record with no matching sessionStorage
tabId in any open tab (the owning tab was closed before the job
completed). The original fix plan in `bugs.md` suggested showing a
"Resume previous analysis?" banner. This was rejected during review
for three reasons:
- **UX noise:** a banner that appears unexpectedly for a case the
  user often does not remember creates confusion rather than relief.
  Reloading a single photo takes ~5 seconds.
- **Privacy:** auction sheet results contain private data (VIN, lot
  number, body damages). Surfacing a "you have an unfinished
  analysis" prompt in a browser potentially shared with others
  (borrowed phone, shared computer) is a direct privacy minus.
- **State complexity:** the client component already has 7 states;
  adding an `orphan_resume` state + render branch + "resume" /
  "dismiss" handlers expands surface area for regressions in
  exchange for a narrow edge case.

The silent-cleanup path does not actually `removeItem` on the sibling
tab — only the owning tab clears its own record (via done/failed/reset).
This is important because the owning tab may still be actively polling.
A second tab returning `null` and showing a clean upload does not
disturb the owner.

Only malformed records (JSON parse failure, missing required fields,
or legacy plain-string format from pre-fix deploys) are actively
removed — garbage cannot belong to anyone.

**Why not BroadcastChannel (variant C) now:**
BroadcastChannel coordination between tabs is more robust (tabs could
explicitly negotiate ownership transfer, handle closed-owner case more
gracefully). Rejected for now as premature complexity. The
sessionStorage + localStorage pattern used here is the standard
solution in production tab-aware libraries (e.g. oidc-client-ts).
If variant B proves insufficient (concrete user reports, not
hypothetical concerns), BroadcastChannel is the next escalation.

**UUID fallback:**
`crypto.randomUUID()` requires HTTPS + modern browser (Chrome 92+,
Firefox 95+, Safari 15.4+). Coverage for the JCK AUTO audience is
~99%, but a fallback using `Date.now().toString(36)` +
`Math.random().toString(36)` is included to prevent runtime crash on
outdated mobile Safari. Tab id uniqueness requirements are modest
(collision only matters within the same browser within 15 minutes —
vanishingly unlikely with 8 random base-36 characters).

**Consequences:**
- (+) Closes C-6. A user's analysis is not visible in sibling tabs.
- (+) Session restore in the same tab (including F5 reload, screen-off)
  continues to work — sessionStorage outlives page reloads within the
  same tab lifecycle.
- (+) Backward compatibility: old plain-string records from
  pre-deploy browsers are treated as orphan-garbage and silently
  cleaned, no migration required.
- (−) An orphaned job (owner tab closed before completion) cannot
  be resumed. User reloads photo — ~5 second cost. Deemed acceptable
  per UX + privacy rationale above.
- (−) Server endpoint `/api/tools/auction-sheet/job/[jobId]` still
  serves any jobId to any caller with the UUID — a separate
  hardening concern if jobIds ever leak (they currently are not
  exposed outside the client's own DOM / XHR). Tracked implicitly
  by the scope note in the closed C-6 entry.

**Files:**
- `src/app/tools/auction-sheet/AuctionSheetClient.tsx`
- `knowledge/bugs.md` (C-6 entry removed)
- `knowledge/INDEX.md` (dates updated)

**Discovered via:** Bug C-6 in `knowledge/bugs.md`, fixed 2026-04-19.

## [2026-04-19] Harden /api/lead contract: fail-loud env, sanitized logs, fallback phone

**Status:** Accepted

**Confidence:** High — all three changes are narrow and the failure
modes they protect against are well-understood (VDS provider blocks
api.telegram.org; Telegram error bodies may echo tokens; users without
a fallback channel on 502 become lost leads).

**Context:**
Bug C-4 in `knowledge/bugs.md` claimed that `/api/lead` bypassed the
Cloudflare Worker by hitting `api.telegram.org` directly. Inspection
on 2026-04-19 showed the claim was stale: the code already reads
`TELEGRAM_API_BASE_URL` from env (with a fallback to api.telegram.org)
and the env is set correctly on the production VDS. The fix had been
applied earlier — likely during the 2026-04-10 Worker migration for
the bot — without a corresponding bugs.md cleanup.

In the process of closing C-4, three latent weaknesses were found in
the same file:
1. The `|| "https://api.telegram.org"` fallback masks missing env
   as silent degradation: the next time someone loses this env (VDS
   migration, `.env.local.save` restore that predates the env being
   added, Worker change that loses the reference) all leads would
   silently fail against a provider-blocked URL.
2. `console.error(..., err)` in the `!res.ok` branch logs the raw
   Telegram response body, which may echo back request URLs of the
   form `/bot<TOKEN>/sendMessage`. The prior `TG_API_BASE.replace(/\/\/.*@/, "//***@")`
   regex was a vestigial basic-auth sanitizer and did not apply.
3. The 502 user-facing message ("Не удалось отправить заявку") offered
   no fallback channel, unlike the 429 path which included CONTACTS.phone.

**Decision:**
Close C-4 as stale AND harden the endpoint in the same prompt. Three
coupled changes in `route.ts`:
1. Remove the `|| "https://api.telegram.org"` fallback. Extend the
   existing `BOT_TOKEN`/`GROUP_CHAT_ID` missing-env check to also
   require `TELEGRAM_API_BASE_URL`. Missing env → 503 with
   grep-friendly log (`[lead] Missing required env: <names>`) and
   user response containing `CONTACTS.phone`.
2. Add a local `sanitizeTelegramLog(s)` helper that masks the full
   Telegram token pattern `<digits>:<token>` to `***`. Apply it to
   response bodies BEFORE truncation (so tokens past the 200-char
   slice cannot survive), then log status + sanitized body only.
3. Add `CONTACTS.phone` to the 502 user-facing message.

Token regex rationale: `\d{6,}:[A-Za-z0-9_-]{20,}` — Telegram bot IDs
are 8–10 digits, tokens are 35+ chars with underscores and hyphens.
The 6-digit and 20-char lower bounds avoid over-matching random
`NUM:WORD` patterns in unrelated error messages.

**Why fail-loud over defensive default:**
`TELEGRAM_API_BASE_URL` is a critical endpoint whose default
(api.telegram.org) is known to be blocked on this specific VDS.
A defensive default here is semantic dishonesty: it pretends to
provide resilience while guaranteeing silent failure. Fail-loud
surfaces config errors in minutes (operator grep shows clear
message); defensive default surfaces them in days or weeks (someone
eventually notices "leads are down"). The same file already
fail-loud's on BOT_TOKEN and GROUP_CHAT_ID — extending the pattern
is consistency, not escalation.

**Alternatives considered:**
- Keep the fallback, add a health check endpoint — rejected: adds a
  separate surface to maintain, doesn't prevent the silent-failure
  window. Health checks help detect problems but don't prevent the
  wrong behavior at request time.
- Move sanitization to a shared `lib/sanitize.ts` — rejected as
  premature. There is currently exactly one caller; a shared module
  is justified when a second caller appears (bot error logs are a
  candidate, tracked implicitly here).
- Keep tokens in logs because VDS logs are local-only — rejected.
  Any future centralized logger (Sentry, Logtail, Datadog) would
  retroactively leak the token history. Prevention today is cheap;
  retrospective redaction is not.

**Consequences:**
- (+) C-4 closed, bugs.md cleaner.
- (+) Missing `TELEGRAM_API_BASE_URL` becomes immediately visible in
  logs at the first request, not after someone notices lead drop.
- (+) Telegram tokens cannot leak via the `/api/lead` error path,
  even if response bodies grow to include them in the future.
- (+) Users who hit a 502 know to call the phone — a saved lead
  instead of a lost one.
- (−) Any future operator who forgets to set `TELEGRAM_API_BASE_URL`
  on a new environment (dev laptop, staging) will see 503 instead
  of a silent bypass. This is deliberately the point, but worth
  documenting so operators are not surprised.
- (−) Operational risk to note separately: `.env.local.save` exists
  in the project root alongside `.env.local`. If anyone restores
  from this backup and the backup predates the `TELEGRAM_API_BASE_URL`
  addition, post-fix behavior will be 503 on all leads until the
  env is re-added. Pre-fix behavior would have been silent failure —
  fail-loud is strictly better here. Not addressed in this prompt;
  cleaning up stray `.env.local.save` is a separate operational task.

**Files:**
- `src/app/api/lead/route.ts`
- `knowledge/bugs.md` (C-4 entry removed)
- `knowledge/INDEX.md` (dates updated)

**Discovered via:** Bug C-4 triage on 2026-04-19 — inspection of code
showed the bug was already fixed, but logs/UX still had room to
harden. Closed as cleanup-plus-hardening.

## [2026-04-19] Add on-primary CTA variant to LeadFormTrigger + fix hierarchy on /tools/* pages

**Context:**
Bug C-3 was filed as "wrong CTA on all services pages — «Позвонить»
button instead of standard `<LeadFormTrigger>`, not centered, action
unclear". Triage on 2026-04-19 showed the actual shape of the bug is
different: both CTAs (the lead form trigger AND the phone link) are
present and correctly centered. The regression is visual/hierarchy:

`<LeadFormTrigger triggerVariant="outline">` renders
`border-primary text-primary` on a transparent background. The
consumer component `CalculatorCTA` (and `tools/page.tsx` CTA card)
wraps it in a `<section className="bg-primary ...">` / `<div class="bg-primary ...">`
block. Result: primary-coloured button text on a primary-coloured
background ⇒ the form trigger is visually invisible. Users only
see the secondary `<a href="tel:">Позвонить</a>` link (white text
on primary bg, readable), so they perceive "Позвонить" as the
single CTA — matching the original bug report — even though the
lead form trigger is technically rendered.

Affected pages (4): `/tools/calculator`, `/tools/customs`,
`/tools/encar`, `/tools/auction-sheet` — each imports
`CalculatorCTA` from `src/app/tools/calculator/CalculatorCTA.tsx`
(despite the file path, this component is shared across all four
/tools/* pages — the name is a historical accident). Plus the
`/tools` index page which has its own inline copy of the same
anti-pattern.

**Root cause:**
`LeadFormTrigger` only shipped two variants — `"primary"` (fill)
and `"outline"` (border on transparent). Neither works on a
coloured background: `"primary"` is bg-on-bg, `"outline"` is
text-on-bg. There was no variant designed for the
"button-on-coloured-section" case, and the call site mistakenly
picked `"outline"` because that is the only non-fill option and
visually appeared correct in the local component preview (which
renders on white).

**Decision:**
Add a third variant `"on-primary"` to `LeadFormTrigger`: white
fill + primary text + `hover:bg-white/90`. Standard Material
Design "on-X" naming convention — `on-primary` means "intended to
render on top of a primary-coloured surface". Use it at every
`<LeadFormTrigger>` call site that sits inside `bg-primary` (or
any coloured section).

Implementation details:
1. Extend the `triggerVariant` union from `"primary" | "outline"`
   to `"primary" | "outline" | "on-primary"`.
2. Replace the ternary `btnCls` definition with an explicit
   `switch` statement. Each case returns a full Tailwind class
   string. The `default` branch assigns `triggerVariant` to a
   `const _exhaustive: never` — if a future variant is added to
   the union without a corresponding case, `tsc --noEmit` fails
   with "Type 'X' is not assignable to type 'never'". This
   catches the omission at build time even though Next.js config
   has `typescript: { ignoreBuildErrors: true }` — because our
   CI recipe runs `tsc --noEmit` explicitly before `npm run build`.
3. At each /tools CTA call site, pass `triggerVariant="on-primary"`.
4. Align visual weight: the adjacent `<a>Позвонить</a>` link had
   `px-8 py-3`, the `LeadFormTrigger` button internally uses
   `px-6 py-3`. Change the `<a>` to `px-6 py-3` for visual parity.

**Applied to:**
- `src/app/tools/calculator/CalculatorCTA.tsx` — shared across all
  4 /tools/* pages.
- `src/app/tools/page.tsx` — /tools index CTA card (same anti-pattern).

**Rules added:**
- `knowledge/rules.md` → new `## UI Component Rules` section with
  the variant-to-background matching rule and the extension
  procedure for new variants (switch + exhaustiveness check).

**Alternatives considered:**
1. Wrap the existing `"outline"` variant with border-white +
   text-white when parent is `bg-primary`. Rejected: requires the
   child component to know about parent background, violating
   component boundaries. Either we add a new variant or we pass
   a `bgColor` prop — adding a variant is the narrower change.
2. Drop `LeadFormTrigger` altogether on /tools/* and inline a
   `<button>` at each call site with correct colours. Rejected:
   loses modal-open behaviour, subject-prop plumbing, keyboard-esc
   handler. The component's job is good; only its variant
   palette was incomplete.
3. Remove the phone `<a>Позвонить</a>` link and keep only the
   form trigger, matching the original bug filer's intent of "no
   phone CTA". Rejected: `tel:` links have measurable conversion
   on mobile — removing them hurts leads. The hierarchy fix is
   enough; both CTAs can coexist once the form trigger is visible.

**Consequences:**
- (+) C-3 closed. Form trigger is visible on all 5 affected pages
  (4 tool pages + /tools index).
- (+) Future coloured-section CTAs can reuse `"on-primary"` —
  one more composable primitive in the kit.
- (+) The `_exhaustive: never` pattern prevents the next "added
  variant but forgot to wire one call site" class of bug at
  compile time, even under `ignoreBuildErrors: true`.
- (−) Consumers using `"outline"` on a dark/coloured section
  elsewhere in the app (none currently, but possible in future
  noscut/news pages) will still silently mis-render. The rule
  in rules.md is the only guard — no runtime check. Mitigation:
  the new rules.md entry explicitly flags this; reviewers should
  catch it.

**Files:**
- `src/components/LeadFormTrigger.tsx`
- `src/app/tools/calculator/CalculatorCTA.tsx`
- `src/app/tools/page.tsx`
- `knowledge/rules.md` (new UI Component Rules section)
- `knowledge/bugs.md` (C-3 entry removed)
- `knowledge/INDEX.md` (dates + bugs.md summary updated)

**Discovered via:** Bug C-3 triage on 2026-04-19 — confirmed on
each of /tools/calculator, /tools/customs, /tools/encar,
/tools/auction-sheet, and /tools in DevTools: outline variant
rendered `color: oklch(...)` on matching bg, DOM correct but
visually absent.

## [2026-04-20] Enable Cloudflare Smart Placement on tg-proxy Worker (close Б-1)

**Status:** Accepted

**Confidence:** High — root cause isolated by a deterministic reproduction
(direct `curl` to Worker `getMe`, 19.8s), fix verified by the same
reproduction (0.22s after Smart Placement), user-visible latency
confirmed eliminated.

**Context:**
The 2026-04-10 ADR `Telegram webhook via Cloudflare Worker` fixed the
INBOUND side of Б-1: Telegram webhook POSTs now arrive at the bot
quickly via Cloudflare edge instead of being blocked by the VDS
provider's Telegram IP range filter. However, verification on
2026-04-20 revealed a separate symptom — the bot replied 17-20 seconds
after every `/start`, despite updates arriving instantly (0 pending,
no webhook errors, no retry loops).

Diagnosis isolated the delay to the OUTBOUND path: every bot call to
Telegram (`sendMessage`, `sendChatAction`, `answerCallbackQuery`) went
through the Worker's fallback route (`url.host = "api.telegram.org"`),
and the Worker's `fetch` to Telegram was taking ~20 seconds. Direct
`curl` from VDS to the Worker for `/getMe` reproduced the delay cleanly
(19.785s). Direct `curl` from VDS to `api.telegram.org` timed out at
2min 14s — confirming the VDS provider STILL blocks the direct path,
so the Worker is mandatory for both inbound AND outbound.

The Worker's source code was reviewed (copy obtained from Cloudflare
Dashboard). No retry loops, no expensive operations, no error handling
with sleep/backoff. The entire 19.8 seconds was spent inside one
`fetch(new Request(...))` call in the outgoing fallback branch. The
delay was upstream network latency: the Cloudflare edge where the
Worker defaulted to running had a degraded network path to the
Telegram DC.

**Decision:**
Enable **Cloudflare Smart Placement** on the tg-proxy Worker.
Smart Placement analyzes Worker subrequest latency and automatically
relocates the Worker to a region where upstream calls are fast. For a
transparent-proxy Worker like tg-proxy — whose entire job is to fetch
an external API — Smart Placement is the standard recommended setting.

Applied 2026-04-20 via Cloudflare Dashboard:
Workers & Pages → tg-proxy → Settings → Runtime → Placement →
changed from "Default" to "Smart".

No code change. No redeploy. Effect took ~minutes to propagate after
Cloudflare's latency analyzer gathered enough data.

**Verification:**
- Before: `time curl -s -X POST "https://tg-proxy.../bot<TOKEN>/getMe"`
  → 19.785s (real), valid JSON response.
- After: same `curl` → **0.227s** (real), valid JSON response.
  Improvement: ~88x faster.
- User-facing: `/start` to @jckauto_help_bot now replies in <1s
  (was 17-20s).

**Why this was not caught earlier:**
Smart Placement is an off-by-default setting. The Worker was created
on 2026-04-10 under time pressure (fixing inbound webhook), and the
default "Default" placement mode was accepted without review. The
outbound delay was dismissed over several sessions as "bot not yet
verified post-fix", when in fact the fix was incomplete for the
outbound direction. Added to `knowledge/rules.md` as a hard rule to
prevent recurrence if the Worker is ever recreated or the setting is
toggled off.

**Alternatives considered:**
- Move Worker to a paid Cloudflare plan with Argo Smart Routing —
  rejected, Smart Placement is free and solved the problem completely.
- Bypass Worker for outbound, use direct `api.telegram.org` — rejected,
  VDS provider blocks the direct path (confirmed 2min 14s timeout on
  direct curl).
- Rewrite Worker as a minimal transparent proxy — not needed, the
  current Worker code is already minimal and correct. Will be moved
  to the repository in a follow-up prompt for proper versioning, but
  no functional rewrite is needed.

**Consequences:**
- (+) Б-1 fully closed: both inbound AND outbound paths now fast.
  Removes the 17-20s delay that was degrading bot UX.
- (+) Downstream side-effect: ETELEGRAM `query is too old` errors
  (seen in earlier logs when callbacks took 30+ seconds to answer)
  should disappear. `answerCallbackQuery` now completes inside
  Telegram's 30-second query window.
- (+) Establishes a clear rule (in rules.md) that proxy-style Workers
  must use Smart Placement, preventing the same issue on any future
  Worker.
- (−) Cloudflare is now slightly more opinionated about Worker
  location. This is not observable to users but worth noting in
  case Cloudflare changes Smart Placement behavior.
- (−) The Worker code still lives only in Cloudflare Dashboard, not
  in the repository. If the Worker is accidentally deleted or the
  Cloudflare account changes, the code must be restored from this
  session's chat history. A follow-up prompt will move the Worker
  source to `worker/tg-proxy.ts` in the repo with a `wrangler.toml`
  for deployment via CLI, putting it on the same versioning track
  as the rest of the codebase.

**Files:**
- No code files changed — this is a Cloudflare Dashboard configuration
  change recorded as architectural decision.
- `knowledge/bugs.md` (Б-1 entry removed).
- `knowledge/rules.md` (Smart Placement requirement recorded).
- `knowledge/INDEX.md` (dates updated).

**Discovered via:** Bot reply delay verification on 2026-04-20 per
bugs.md Б-1 action item ("live test — send /start to @jckauto_help_bot,
confirm <1s response").

## [2026-04-21] Wire Telegram bot to shared auction-sheet service

**Status:** Accepted
**Confidence:** High

**Context:** Prompt 2.1 (2026-04-21) extracted the auction-sheet AI
pipeline into `src/lib/auctionSheetService.ts` with a single public
entry point `runAuctionSheetPipeline(buffer, { channel, ip?, telegramId? })`
and switched the website to call it via the shared `auctionSheetQueue`
(concurrency=1). The Telegram bot handler
`src/bot/handlers/auctionSheet.ts` still ran an older, drift-prone
path: a local `SYSTEM_PROMPT` literally marked "Copied exactly from
route.ts" plus a single direct `analyzeImage(..., { model: 'qwen3.5-plus' })`
call, with no Sharp compression and no shared queue. Symptoms: the bot
decode timed out in production on 2026-04-21 under load (tracked as
the "bot auction-sheet regression" In Progress bullet), and the bot
could overload DashScope independently of the website's queue-based
back-pressure.

**Decision:** Rewrite `src/bot/handlers/auctionSheet.ts` as a thin
Telegram adapter that enqueues into the same `auctionSheetQueue` the
website uses, and polls for the result:

1. Keep the pre-pipeline gate unchanged: `checkBotLimit(telegramId, 'ai')`
   is called before any download or API call. Site `rateLimiter` is NOT
   consulted — the bot uses its own `botRateLimiter` (ai cooldown 2 min).
2. After `bot.getFile()` + 5 MB size check + env validation + status
   message, download the photo via the Worker URL
   (`TELEGRAM_API_BASE_URL` — api.telegram.org is blocked from VDS).
3. Compress with Sharp using parameters byte-identical to the website
   (`resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })`,
   `jpeg({ quality: 85 })`, `sharpen({ sigma: 0.5 })`). The pipeline
   expects a specific input-quality envelope; any divergence here
   requires changing the website too.
4. Enqueue with
   `auctionSheetQueue.enqueue(() => runAuctionSheetPipeline(buf, { channel: 'bot', telegramId }))`.
   Because the service gates rate-limit bookkeeping on `channel === 'web'`,
   the bot path touches neither `recordUsage` nor the site `remaining`
   counter.
5. On `QueueFullError` at enqueue time: user-visible "service overloaded"
   message pointing to the site, and RETURN without calling
   `recordBotUsage` (queue refusal is not a successful service call).
6. Poll the queue every 1s with a 180s hard timeout. 1s is a
   free Map lookup in the same process; 180s leaves headroom for
   queue position + processing (typical pipeline 30–90s). On timeout:
   user-visible "analysis is taking longer than usual" message, and
   RETURN without `recordBotUsage`. The job continues running inside
   the queue after our timeout — cancellation support is a future
   improvement.
7. On `status === 'failed'`: parse the `ai_error:` / `parse_error:`
   prefix produced by the pipeline, strip the prefix, and send the
   Russian remainder to the user. For any other error format, fall
   back to a generic message. RETURN without `recordBotUsage`.
8. On `status === 'done'`: format via the local `formatAuctionResult`,
   split via the local `splitMessage`, send to chat, THEN call
   `recordBotUsage(telegramId, 'ai')` and
   `incrementCommand('auction')`. If the send itself fails, user did
   not get the result — do NOT record usage.

`formatAuctionResult`, `splitMessage`, and `severityLabel` stay in
the bot file: they are bot-surface concerns (Telegram chunking, Russian
copy, emoji). They do not belong in `src/lib/auctionSheetService.ts`.

**Consequences:**
- Bot and website share a single OCR + parse prompt set, a single
  DashScope/DeepSeek client path, and a single queue. DashScope
  prompt tweaks or rate-limit shifts now require one edit, not two.
- Concurrency=1 is now enforced across both surfaces. A burst of bot
  decodes cannot independently saturate DashScope while the site is
  also busy.
- Bot perceived latency increases slightly (Sharp compression + queue
  wait) but typical steady-state stays well under 180s.
- The previous "bot auction-sheet regression" In Progress bullet is
  removed from roadmap.md — the bot now shares the production pipeline
  proven stable on the website.
- Polling the queue for 180s uses a negligible amount of work (Map
  lookup every 1s). If we later add server-push for completion, the
  poll loop becomes redundant and can be removed — keep the contract
  `auctionSheetQueue.getStatus(jobId)` stable.
- Writing to disk is forbidden by existing `@rule` comments. Buffers
  stay in memory end-to-end.

## [2026-04-21] Architecture: shared auction-sheet service

**Status:** Accepted
**Confidence:** High
**Context:** The Japanese-auction-sheet AI pipeline existed in two
places: the website route `src/app/api/tools/auction-sheet/route.ts`
used the modern multi-pass pipeline (Pass 0 classifier + 3 parallel
OCR via `analyzeImageWithFallback` + DeepSeek Step 2), while
`src/bot/handlers/auctionSheet.ts` used a single heavy
`analyzeImage(..., { model: 'qwen3.5-plus' })` call with a duplicated,
drift-prone SYSTEM_PROMPT. That bot implementation timed out in
production on 2026-04-21 — a regression waiting to happen the moment
DashScope slows down. The SYSTEM_PROMPT comment in bot/handlers
literally said "Copied exactly from route.ts", which is the anti-pattern
our "Principle of Common Mechanics" rule forbids.

**Decision:** Extract the pipeline into `src/lib/auctionSheetService.ts`
with a single public entry point:
  `runAuctionSheetPipeline(buffer, { channel: 'web' | 'bot', ip?, telegramId? })`.
The website route becomes a thin HTTP adapter (rate-limit pre-gate,
Sharp compression, enqueue, 202 Accepted). Rate-limit bookkeeping is
gated by `channel`: on `'web'` we call `recordUsage` + `checkRateLimit`
from `src/lib/rateLimiter`; on `'bot'` we do neither (bot has its own
`botRateLimiter`). Concurrency=1 across both channels is enforced by
routing every caller through the same `auctionSheetQueue` — the bot
will enqueue the same way in Prompt 2.2.

The extraction was executed as three commits
(`[1/3]`, `[2/3]`, `[3/3]`) because a single-commit attempt hit a stream
idle timeout on file generation. Each intermediate commit is
self-consistent and compiles; only the final commit changes runtime
behaviour routing.

**Consequences:**
- Single source of truth for all OCR and parse prompts — no more
  accidental drift between channels.
- Website behaviour is byte-identical after the refactor (tracked by
  the behavioural shield in Prompt 2.1c acceptance criteria).
- Bot auction-sheet fix is one call away (Prompt 2.2).
- Next time DashScope behaviour changes, one file to edit.
- Encoding `channel` as an explicit discriminator (rather than
  inferring from presence of `ip`) makes future channels trivial.

## [2026-04-21] Remove internal auction codes from bot report

**Status:** Accepted

**Context:**
The Telegram bot auction-sheet formatter (`src/bot/handlers/auctionSheet.ts`) rendered damage entries in the form `• {location} — {code}, {description}` where `{code}` was the internal Japanese auction notation (W1, A1, G, S, U2, etc.). These codes are meaningful to auction professionals but appear as noise to end users in the bot output. The website's ResultView surfaces the same data via a severity badge (Russian label), so there was a cross-surface inconsistency: site users see a human-readable severity, bot users see an opaque code.

**Decision:**
- In the bot formatter, replace `{code}` with a Russian severity label derived from the `severity` field already present in the parsed JSON schema (`minor` / `moderate` / `major`).
- New rendering: `• {location} — {description} ({label})` where `label ∈ { незначительный, средний, серьёзный }`; when severity is missing/unknown, render without any suffix.
- Introduce a small `severityLabel()` helper in the same file — bot-local, not exported.
- Keep the SYSTEM_PROMPT auction-code list byte-identical: the model needs them to recognise codes on the sheet and classify severity correctly. Only the *rendered output* changes.
- Do not touch `src/app/tools/auction-sheet/ResultView.tsx` or any website-side formatter — the bot formatter was already bot-specific, so this is a single-surface change.

**Consequences:**
+ Bot users get human-readable defect severity instead of internal auction codes — reduces confusion for non-professional end users.
+ Cross-surface vocabulary alignment: bot now uses the same three labels (`незначительный` / `средний` / `серьёзный`) as the website's severity badge.
+ SYSTEM_PROMPT is preserved, so classification quality is unchanged.
− If a future prompt surfaces the codes elsewhere (e.g. a PDF export), this ADR must be revisited for consistency.
− Closes the roadmap bullet `Bot: remove internal auction codes` under **Planned — Bot**.

## [2026-04-21] Rename Encar bot inline button for clarity

**Status:** Accepted

**Confidence:** High

**Context:** "Открыть на сайте" in the Encar-result inline keyboard
was ambiguous — users interpreted it as a link to the encar.com
source listing instead of the JCK AUTO site report.

**Decision:** Rename to "Подробный отчёт на сайте" in
`src/bot/handlers/encar.ts`. Emoji retained.

**Consequences:** Minor UX clarification. No contract/API change.
No regression surface outside `bot/handlers/encar.ts`.

## [2026-04-20] Б-2 and Б-3 closed as side-effect of Smart Placement fix

**Status:** Accepted

**Confidence:** High — live verification in Telegram on 2026-04-20
confirmed both handlers deliver complete responses end-to-end.

**Context:**
Б-2 ("auction sheet handler does not respond on photo") and Б-3
("Encar handler does not respond on link") were registered during the
period when the bot exhibited 17-20 second outbound latency. In that
state, users sending a photo or encar-link to @jckauto_help_bot saw
no timely response, assumed the handler was broken, and the bugs
were logged as "code exists, but no response in production".

The handlers were not actually broken. The pipelines ran correctly,
produced results, and called `bot.sendMessage` / `bot.sendPhoto` —
but each of those calls spent ~20 seconds in the Worker outbound
fetch to `api.telegram.org`. With auction-sheet requiring multiple
sendMessage calls (acknowledge + processing status + result +
link) and encar requiring even more, the perceived latency stacked
to "no response arriving before the user gives up".

The 2026-04-20 Smart Placement fix (ADR
`[2026-04-20] Enable Cloudflare Smart Placement on tg-proxy Worker`)
cut outbound call latency from 19.8s to 0.22s — an ~88x speedup.
This had the non-obvious side effect of making Б-2 and Б-3 usable
without any handler-code change.

**Verification on 2026-04-20:**
- Б-2 test: photo of an auction sheet sent to @jckauto_help_bot.
  Bot received, ran OCR passes + DeepSeek parse, returned complete
  analysis (vehicle identification, 8 defects with auction codes,
  equipment list, expert comments, overall grade, confidence
  marker, and link to /tools/auction-sheet for full report).
  Total time from send to complete response: within expected
  pipeline timeframe (~1-2 minutes).
- Б-3 test: `fem.encar.com/cars/detail/<id>` (Genesis GV70 2.5T
  2023) sent to @jckauto_help_bot. Bot fetched from Encar API,
  produced Russian translation, calculated turnkey cost (≈5.4M RUB),
  added seller context, displayed inline buttons "Открыть на сайте"
  and "Оставить заявку". Total time: ~20 seconds.

Both responses complete and functional.

**Decision:**
Close Б-2 and Б-3. No handler-code change needed. Root cause of the
"no response" symptom was the outbound latency that is now eliminated.

**Why not rebuild the bugs around new follow-up observations:**
Live testing exposed several follow-up observations that are NOT
part of the Б-2/Б-3 closure:
- Auction-sheet output contains internal auction codes (W1, A1, G, S)
  that are noise to end users.
- Encar CTA buttons and auction-sheet CTA structure differ (inline
  buttons vs link-with-text); lead-form capture inconsistent.
- No PDF download in bot for either feature (unlike the website).
- No visible information in bot /start menu or BotFather description
  about these features (separately tracked as Б-4).
- Queue/rate-limit semantics in bot unclear — may not match the
  website's async queue contract.
- `/noscut` without argument expects next message to be prefixed
  with `/noscut ` again, not intuitive.
These are separate items and will be added to `roadmap.md` in a
follow-up documentation prompt. They are NOT regressions introduced
by Smart Placement — they pre-existed, just became visible once the
outbound path was fast enough for users to actually see the output.

**Pattern worth noting for future diagnosis:**
When a performance fix lands (latency, concurrency, capacity),
revisit bugs previously registered as "feature not responding" —
they may have been masked delay, not broken code. This pattern
saved ~4 hours of handler diagnosis on Б-2/Б-3. Fix was a
single Dashboard toggle, not a handler rewrite.

**Alternatives considered:**
- Keep Б-2 and Б-3 in Verify status indefinitely — rejected.
  Verification was done, both pass. Keeping "maybe-closed" entries
  in the tracker pollutes it.
- Close silently without ADR — rejected. The "side-effect closure"
  pattern is a valuable diagnostic precedent. Recording it helps
  future sessions notice when a performance fix may have masked
  multiple functional bugs.

**Consequences:**
- (+) Two bugs off the tracker. Bot feature parity with website
  confirmed for auction-sheet and encar core flow.
- (+) Establishes a recognised "side-effect closure" pattern in
  this project's ADR log. Future performance fixes should prompt
  a re-sweep of stalled bug entries.
- (−) Seven follow-up observations from live testing are NOT
  addressed here — they live in roadmap.md after the follow-up
  prompt. Each is a separate small task.

**Files:**
- No code changed.
- `knowledge/bugs.md` (Б-2 and Б-3 removed).
- `knowledge/INDEX.md` (dates updated).

**Discovered via:** Live verification of Б-2 and Б-3 in Telegram on
2026-04-20, per the action items updated by Prompt `8e5ed69`
(cleanup-b1-references).
