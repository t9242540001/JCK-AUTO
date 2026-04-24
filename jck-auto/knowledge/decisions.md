<!--
  @file:        knowledge/decisions.md
  @project:     JCK AUTO
  @description: Architectural Decision Records (ADR log) — append-only
  @updated:     2026-04-25
  @version:     1.45
  @lines:       ~3634
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

## [2026-04-25] С-8 closed — 30s per-arm timeout on encar AI enrichment

**Status:** Accepted

**Confidence:** High — pattern (`withTimeout` wrapper + no-op catch on originals) is the standard Node.js idiom for bounding foreign promises without cancellation. No library dependency, no cascade into downstream AI clients, single-file change.

**Context:**

The encar bot handler (`src/bot/handlers/encar.ts`) enriches vehicle data via two parallel DeepSeek calls (`estimateEnginePower`, `translateEncarFields`) wrapped in `Promise.allSettled`. Neither arm had a timeout. On 2026-04-22, one of the calls hung indefinitely — most likely because a concurrent auction-sheet job was saturating the shared DeepSeek connection — and the handler blocked forever.

The block is worse than "this user waits": the bot is a single Node.js process, so an awaited promise that never settles pins the event-loop progress of `registerEncarHandler` and delays message dispatch for all other bot users until `pm2 delete + pm2 start` recovers the process. Bug tracked as С-8 in `knowledge/bugs.md`.

The other bot handlers are not affected by the same pattern: auction-sheet goes through the async queue (ADR [2026-04-18]) with its own DeepSeek 180s timeout; calculator/customs/noscut do not make AI calls from the handler path.

**Decision:**

Introduce a local `withTimeout<T>(promise, ms, label)` helper inside `src/bot/handlers/encar.ts` — a standard Promise-race-with-timer pattern. Wrap each arm of `Promise.allSettled` in `withTimeout(arm, 30_000, label)`. Attach `.catch(() => {})` to the ORIGINAL `estimateEnginePower` / `translateEncarFields` promises (the references captured before the race) so that a late rejection arriving after the race already timed out does not escape as `UnhandledPromiseRejectionWarning`.

Why 30 seconds:
- DeepSeek typical latency for these calls is 3–8 seconds.
- 30s = ~4x normal, generous headroom for slow-but-recovering states.
- Handler worst-case: rate-limit (<1s) + fetchVehicle+fetchInspection (<5s) + 30s AI bound + cost calc (<3s) + sendMessage (<2s) ≈ 40s. Safely under nginx 200s and the Telegram-callback comfort window.

Why LOCAL helper, not a shared util:
- This is the only place in the codebase (confirmed by the file inventory for this prompt) where a bot handler awaits a direct AI call without going through the auction-sheet async queue. No third caller is on the near horizon.
- The helper is 12 lines of body + JSDoc. Extracting to `src/lib/` adds an import dependency and a file to reason about per handler — not a win at N=1.
- If a second caller emerges, the helper can be promoted to `src/lib/promiseTimeout.ts` with a separate ADR at that time.

Why NOT switch to `AbortController` for true cancellation:
- True cancellation requires threading the signal through `estimateEnginePower`, `translateEncarFields`, and the underlying DeepSeek client (`src/lib/deepseek.ts`). That is 3–4 files of change and pulls in the contract negotiation with the DeepSeek client's own retry/timeout behaviour (already 180s in some call paths).
- Local race-with-timer gives us what we actually need here: the handler unblocks in ≤30s, the bot stays responsive, and the orphan promise dies naturally when its TCP socket eventually closes or its retry budget finishes. We accept the minor cost of a dangling fetch for correctness of the main event loop.

**Alternatives considered:**

- **Increase only one arm's timeout (e.g. wrap just `translateEncarFields` and leave `estimateEnginePower` unwrapped).** Rejected — the 2026-04-22 logs showed the hang occurred in the power-estimate path first. Either arm can cause the block. Both must be bounded.
- **Replace `Promise.allSettled` with `Promise.race([allSettled, timeout])` (single outer race).** Rejected — this loses the partial-success path. If power succeeds fast and translation is slow, outer race times out before power result is captured, discarding a valid result that should be shown.
- **Use `AbortController`.** Rejected for this prompt; see decision rationale above. Can be revisited if a wider pattern needs true cancellation.
- **Global timeout on every bot handler (middleware).** Rejected — `node-telegram-bot-api` does not provide a hook at that layer, and bot handlers are diverse (photo upload, rate-limit wait, long-running auction-sheet poll) with different natural latencies. Per-call bounds at the AI-call site are the right granularity.
- **Skip the orphan `.catch(() => {})` and rely on Node's default unhandled-rejection behaviour.** Rejected — Node 20 promotes unhandled rejections to hard crashes under `--unhandled-rejections=strict` (not the current flag, but it's a future risk); even under the default warning mode, `UnhandledPromiseRejectionWarning` pollutes logs and obscures real errors during incident triage.

**Consequences:**

- (+) Closes С-8. Bot no longer hangs on slow AI responses; user gets a response within ~40s worst case, and the handler always reaches `bot.sendMessage`.
- (+) Event-loop block class closed for encar path specifically; other bot handlers unaffected (unchanged).
- (+) Handler degrades gracefully: a timed-out power arm means no HP shown in the card; a timed-out translation arm means `⚠️ Перевод недоступен — данные на корейском` banner (pre-existing behaviour). Either case is a user-visible but complete response, not silence.
- (−) A slow-but-eventually-succeeding AI call wastes its work: if translation returns at 31s after we timed out at 30s, the response is discarded. Rare; acceptable cost.
- (−) Orphan DeepSeek calls continue running after the race; they use minor CPU/connection resources until they naturally complete or their TCP socket closes. Not significant at current traffic volumes; re-evaluate if load grows.
- (−) `withTimeout` is duplicated if a second caller ever emerges. Explicitly accepted for now; promotion path documented.

**Verification (post-deploy, operator):**
Send the bot a valid encar.com link (e.g. a current listing URL). Expected: a result card appears within ~40s worst-case, not indefinite silence. If a future hang happens (DeepSeek actually slow), the user gets either a card with "⚠️ Перевод недоступен" or a card without power figure, but always gets a card.

**Files changed:**
- `jck-auto/src/bot/handlers/encar.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (one new row in Bot Rate Limiting Rules)
- `jck-auto/knowledge/bugs.md` (С-8 marked closed; new /news drift entry)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-24] Blog ISR migration (/blog + /blog/[slug]) — unify with /news

**Status:** Accepted

**Confidence:** High — identical pattern is already production-deployed on `/news` since 2026-04-01 with no observed issues. The migration is a two-line change (one `export const revalidate = 3600` per file).

**Context:**

The article cron (migrated to DeepSeek in series 01–02, observability added in 03–04) now reliably creates `.mdx` files in `content/blog/`. But `/blog` is pure SSG: `page.tsx` has no revalidate, `[slug]/page.tsx` uses `generateStaticParams` with no revalidate either. A cron-generated MDX is invisible on the site until someone triggers a full deploy — either by pushing a trivial commit to main or by a scheduled deploy that doesn't exist.

The same shape of problem was already solved elsewhere in the project: `/news` uses `export const revalidate = 3600`, refreshing every hour. Publication cadence for news (daily) and articles (every 3 days) is different, but both benefit from the same trade-off: per-request cost near-zero (serve from cache), background refresh covers the update delay, SEO is unaffected (ISR returns server-rendered HTML indistinguishable from SSG for crawlers).

**Decision:**

Add `export const revalidate = 3600` to `src/app/blog/page.tsx` and `src/app/blog/[slug]/page.tsx`. Keep `generateStaticParams` in the slug file — it pre-renders existing articles at build time, ISR handles newly-added ones on-demand. No other changes to rendering logic.

Value 3600 = 1 hour, identical to `/news`. A new cron-generated article becomes visible to visitors and crawlers within one hour of file creation, with no deploy required. Worst-case 1/72 = ~1.4% of the 72h publication cycle is spent waiting for cache invalidation.

**Alternatives considered:**

- **`export const dynamic = 'force-dynamic'` (as in `/catalog`).** Rejected. Would do 37+ disk reads per request — acceptable for a catalog page that shows volatile inventory and needs real-time freshness, but wasteful for a blog list that changes every 72 hours.
- **Shorter revalidate (60s, 300s).** Rejected. Higher background refresh frequency without meaningful benefit. A newly-created article still appears "quickly" even at 3600.
- **Longer revalidate (86400s = 24h).** Rejected. Would leave a fresh cron-generated article invisible for up to a full day, defeating the point of the migration.
- **Keep SSG, trigger deploy after each cron run.** Rejected. The article cron deliberately does NOT run `npm run build` or commit anything (@rule in `generate-article.ts`, enforced after the 2026-04-09 deploy outage). Wiring the cron to commit-and-push would reintroduce that risk class. ISR sidesteps the entire coupling.
- **Move rendering to Server Action with on-demand revalidation (`revalidatePath`).** Rejected. Adds coupling between the cron script and Next.js internals, requires the cron to call an internal HTTP endpoint, introduces a new failure mode. ISR is the simpler equivalent.

**Consequences:**

- (+) Cron-generated articles become visible on `/blog` and `/blog/[slug]` within 1 hour of file creation, no deploy needed.
- (+) Consistency with `/news` — the same pattern, same revalidate value, same JSDoc format in the header comment.
- (+) Zero impact on SEO. ISR serves full server-rendered HTML.
- (+) Near-zero cost per request: Next.js serves cached page for 99%+ of requests, disk is hit once per hour per route.
- (−) First visitor after the revalidation window expires sees the stale page; the refresh happens in the background and the NEXT visitor sees the fresh page. This is the standard ISR trade-off, same as `/news`, not a regression for this route.
- (−) Slight increase in build complexity: Next.js build output now includes ISR marker on blog routes. No operational impact.

**Follow-up:**

- Separate prompt (B) verifies that new blog MDX files are picked up by `sitemap.xml`. Without sitemap propagation, search engines may not discover fresh articles even though the page serves them.

**Files changed:**
- `jck-auto/src/app/blog/page.tsx`
- `jck-auto/src/app/blog/[slug]/page.tsx`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (one new rule row)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-24] Mutual heartbeat alerting for content-pipeline crons (series 04/04 — close)

**Status:** Accepted

**Confidence:** High — pattern is minimal (two function calls per script at startup + wrapped catch blocks), fail-open semantics are inherited from the already-verified `cronAlert.ts` helper (prompt 03 smoke-test passed), thresholds are set with conservative buffers on top of the cron cadence.

**Context:**

Prompts 01–03 of the series closed Б-12 (two-week silent blog outage caused by DashScope text-generation timeouts from VDS) and landed a fail-open Telegram alert helper. The remaining gap: no cron script called the helper. A repeat of the Б-12 pattern — any cron failing or stopping entirely — would still go unnoticed until someone manually checks the blog or the news feed.

A `try/catch` inside each script catches exceptions raised while the script runs, but says nothing about the case where the script never runs at all (cron daemon down, disk full, crontab overwritten, OOM kill, env file unreadable). That failure class — "no heartbeat" — is blind to any self-check inside the silent cron.

The fix is mutual heartbeat: each script, on startup, checks whether the OTHER cron has produced its expected artifact recently. If the other cron has stopped producing, the live cron sends a staleness alert. Combined with alert-before-exit in the live cron's own catch blocks, this closes both failure classes: "my own run crashed" and "my sibling never ran".

**Decision:**

Wire `sendCronAlert` into both content-pipeline crons with the following contract:

1. **At startup, check the sibling.** Article cron checks `storage/news/*.json` (36h threshold). News cron checks `content/blog/*.mdx` (96h threshold). Staleness → `severity: 'warning'`. The current script continues normally — sibling staleness does NOT block the live script's own run.
2. **Before exit, alert.** Every `process.exit(1)` site — outer `main().catch` in both scripts, plus three internal fatal catches in the news cron — gets an `await sendCronAlert(...)` immediately before it. Severity: `'error'`. This ensures the alert actually sends before the process dies (the helper's 10s timeout bounds the delay).
3. **No retry, no deduplication, no state.** Every cron run that detects staleness sends an alert. If the sibling is broken for 5 days, the live cron alerts on each of its runs. Silence = fixed; repeated alerts = still broken. State would buy nothing except a new bug surface.
4. **Measured by mtime.** Filename-based date checks are unreliable (files can be named for a date different from their creation time). `fs.statSync(path).mtime` is the single source of truth.
5. **Staleness measurement fails safe.** Unreadable directory, missing file, stat error — `newestMtime` returns null, which is treated identically to "older than threshold" → alert fires. Rationale: an unreadable storage dir is itself a broken-cron signal.

Thresholds:

- **News check from article cron: 36h.** News cadence is daily (24h). 36h = 1.5 cycles. Tighter (24h) produces false positives on any cron jitter or clock drift. Looser (48h+) delays detection unnecessarily given the daily cadence.
- **Article check from news cron: 96h.** Article cadence is 72h. 96h = 1.33 cycles — only 24h of buffer. Article cron fires 8x less frequently than news, so the detection window is naturally longer; reducing to 72h would fire on every normal day the cron happens to slip past midnight.

**Alternatives considered:**

- **Self-check (current cron checks its own last output).** Rejected — fundamentally cannot detect "cron never runs". If the script is not executing, no code inside it can run the check. This is not an edge case; two of the seven main failure modes for Б-12-class silent outages (crontab deletion, cron daemon down) present exactly as "script never starts".
- **External uptime monitor (Healthchecks.io, BetterStack, UptimeRobot, etc.).** Right long-term answer. Explicitly deferred for this series because: (1) requires a new external account / billing relationship, (2) requires secrets management and HTTPS ping integration, (3) operationally heavier than a 20-line inline check. Logged as roadmap item — combined with mutual heartbeat, it would form a two-layer alerting stack (mutual heartbeat catches most cases cheaply; external monitor catches the "VDS fully dead" case which mutual heartbeat cannot see).
- **Extract `newestMtime` into a shared lib module.** Rejected — 15-line helper duplicated across two files is cheaper than adding one more import dependency per cron. Neither of the other active cron scripts (`update-noscut-prices.ts`, future `check-tariffs.ts`) uses filesystem staleness checks; the abstraction is speculative. Inline duplication is revisitable later if a third caller emerges.
- **Change internal `process.exit(1)` sites in news cron to `throw` and catch in the outer `main().catch`.** Rejected as scope creep — reshapes error handling beyond the observability concern. The three internal catches each have distinct step context (collection / processing / publishing) that is more precisely reported as three distinct alerts ("News cron failed — Collection step") than as one generic "unhandled error" at the outer catch. Step-level granularity aids diagnosis.
- **Alert on zero-items collection.** Rejected — a different class of signal (all 21 RSS feeds simultaneously returning nothing). Conflating it with AI-call failure dilutes alert taxonomy. Future prompt territory if the pattern recurs.
- **Deduplicate alerts via on-disk state file.** Rejected per above. Repeating the alert is the feature, not the bug.

**Consequences:**

- (+) A single script crash or a cron daemon stopping entirely becomes visible in Telegram within 36–96 hours of the failure. Compared to the 2-week Б-12 silence, this is a 10–30× improvement.
- (+) The series closes cleanly. Б-12 is fixed (DeepSeek migration), the helper exists (prompt 03), both crons use it (this prompt). No loose ends.
- (+) Cross-cron observability is symmetric: both shifts watch each other. If one stops, the other raises the alarm; if both stop simultaneously (rare VDS-level outage), the external-monitor roadmap item catches it.
- (+) Pattern is reusable: `update-noscut-prices.ts` and future `check-tariffs.ts` can adopt the same shape (wrap catch + check sibling artifact) with near-zero overhead.
- (−) No durable delivery — if Telegram/Worker are down during the exact moment the alert fires, the alert is lost. Mitigated partly by multiple-per-run alerts (re-fires on subsequent runs) and by the external-monitor roadmap item.
- (−) Thresholds (36h / 96h) are hand-tuned, not measured from historical distribution of cron-run latencies. If the underlying cadence changes (e.g. articles move to daily), the thresholds must be revisited. Acceptable cost for the simplicity.
- (−) Both scripts now have a synchronous `readdirSync`/`statSync` call at startup. Worst case a few milliseconds on a healthy filesystem; no measurable impact on the 300s+ article-cron run.

**Series close:**

Series `migrate-article-text-to-deepseek` is fully landed:
- Prompt 01 (`c3e8513`) — `topicGenerator.ts` → DeepSeek.
- Prompt 02 (`28706fa`) — `generator.ts` → DeepSeek; Б-12 closed.
- Prompt 03 (`fb62204`) — `cronAlert.ts` created (fail-open helper).
- Prompt 04 (this commit) — both crons wired; mutual heartbeat active.

**Files changed:**
- `jck-auto/scripts/generate-article.ts`
- `jck-auto/scripts/generate-news.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (two new rule rows)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-24] Cron alert helper — fail-open Telegram notification via Worker

**Status:** Accepted

**Confidence:** High — implementation is a thin `fetch` wrapper; failure modes are fully enumerated and all are fail-open; transport already proven by bot code that uses the same Cloudflare Worker path.

**Context:**

Two weeks of silent blog outage (Б-12, closed in prompt 02) exposed a broader problem than the DashScope timeout itself: no one was notified when the article cron started failing. Logs are on VDS, not monitored. The only operator feedback loop is "someone eventually notices the blog has no new posts" — a 2-week feedback loop for a pipeline that should produce a post every 3 days.

The content pipeline actually has two cron shifts — news (daily, 07:00 MSK) and articles (every 3 days, 09:00 MSK) — and three more are planned or active (noscut prices weekly; tariff monitoring in roadmap; future health checks). All of them need the same kind of signal: "this cron broke, and here is what broke".

A top-level `try/catch` inside each script is necessary but not sufficient. It catches exceptions raised after the script is executing, but says nothing about the case where the script never runs at all (cron daemon down, disk full, crontab overwritten, OOM kill, env file unreadable). That class of failure — "no heartbeat" — is caught by mutual stale-checking across crons, which prompt 04 implements. Both patterns need a shared low-level alerting helper. This ADR is about creating that helper cleanly, once.

**Decision:**

Create `src/lib/cronAlert.ts` with one exported function:
`sendCronAlert({ title, body, severity?: 'info'|'warning'|'error' }): Promise<void>`.

Core behavioural contract:
1. **Fail-open.** Any failure of the alert itself — network, timeout, missing env, non-2xx Telegram response — is caught, logged to stderr, and swallowed. The helper never throws. Callers can call it bare, without their own try/catch. Rationale: the helper exists to report OTHER failures; if it starts crashing cron scripts on its own bad day, it becomes the problem it was meant to solve.
2. **Worker-only transport.** Telegram API calls go through `TELEGRAM_API_BASE_URL` (Cloudflare Worker `tg-proxy`). Direct `api.telegram.org` is banned project-wide per existing rule. This choice is not re-litigated here.
3. **Late env read.** Env vars are read at call time, not at module import, so the helper is robust to dotenv-loading order changes in downstream scripts.
4. **Explicit severity mapping.** `info`/`warning`/`error` map to `🟢`/`🟡`/`🔴`. Default is `error` because the overwhelming use case is "something broke".
5. **Recipient resolution.** `process.env.ALERTS_TELEGRAM_ID` (new optional var), falling back to the first numeric id parsed from existing `ADMIN_TELEGRAM_IDS`. If both are missing, alert is skipped with a warning log — not a crash.

No retry logic. One POST, 10-second timeout, done. If Telegram is down, a retry inside the same cron run will not help; we rely on future cron runs + external uptime monitoring (roadmap) for durable delivery.

**Alternatives considered:**

- **Fail-loud (throw on alert failure).** Rejected — the classic pitfall of monitoring code. Monitoring should never be able to crash the thing it is monitoring. If the helper throws, a DeepSeek outage plus a simultaneously flaky Worker could cascade into a failed cron that would otherwise have partially completed and left diagnostics. Fail-open keeps failure surfaces independent.
- **`node-telegram-bot-api` dependency.** Rejected — 200+ KB library for `sendMessage`. `fetch` with 10 lines of JSON handling is sufficient. Avoids tying cron helper to the bot's library version upgrades.
- **Retry (2 attempts with backoff).** Rejected — see "No retry logic" above. A one-shot attempt is the right complexity for a best-effort notifier. Durable delivery is out of scope; Healthchecks.io or similar belongs in a future roadmap item.
- **Put the helper directly inside each cron script.** Rejected — three crons today, two more planned; six copies of the same fetch logic is exactly the drift that the "Principle of Common Mechanics" rule in rules.md exists to prevent.
- **`parse_mode: 'Markdown'` instead of `'HTML'`.** Rejected — Telegram's Markdown parser is strict about unbalanced `_` and `*` characters, which appear often in error stack traces, file paths, and DeepSeek API error messages. `HTML` requires escaping only three characters (`&`, `<`, `>`) and handles everything else literally, making it robust against arbitrary `body` content from failing crons.
- **Global `AbortSignal.timeout(10_000)` (newer Node API) instead of manual `AbortController`.** Rejected — Node 20 supports both, but manual `AbortController` is the pattern already used in `src/lib/deepseek.ts` and `src/lib/dashscope.ts`. Consistency > micro-improvement.

**Consequences:**

- (+) Single place to change Telegram alert format, transport, or recipient resolution. Future crons get observability for free with one import.
- (+) Fail-open contract means prompt 04 can call `sendCronAlert(...)` without wrapping it in its own try/catch, keeping wiring sites small.
- (+) Contract (`sendCronAlert({ title, body, severity })`) is documented at call signature level; future changes require explicit ADR revision, not drift.
- (−) No durable delivery — a one-shot alert during a brief Telegram/Worker outage is lost. Accepted for this iteration. Roadmap item: external uptime monitor (Healthchecks.io / BetterStack) as a redundant channel.
- (−) New optional env var `ALERTS_TELEGRAM_ID` — when not set, alerts go to the first admin id from `ADMIN_TELEGRAM_IDS`. Operator should set it explicitly on VDS when a separate alerts channel is desired (e.g. a dedicated alerts-only Telegram chat).
- (−) Alert failures log to stderr but do not escalate. If alerts stop working entirely, the only signal is absence of expected messages. Accepted — external uptime monitor above is the intended mitigation.

**Files changed:**
- `jck-auto/src/lib/cronAlert.ts` (new file)
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (one new rule row)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-24] Migrate article text generation to DeepSeek — step 2/2 (generator) — closes Б-12

**Status:** Accepted

**Confidence:** High — direct extension of step 1/2 pattern. `callDeepSeek`
is signature-compatible with `callQwenText`; DeepSeek's `max_tokens` ceiling
is 8192, which matches the existing `maxTokens: 8192` request shape exactly.
news-processor pipeline has issued thousands of 8192-token DeepSeek calls
over the prior months with no timeouts (verified via
`/var/log/jckauto-news.log`).

**Context:**

Prompt 01 (commit `c3e8513`) migrated `topicGenerator.ts` — the first AI
call in the article cron — from `callQwenText` to `callDeepSeek`. That
unblocked the cron past its failure point but left the heavier second
AI call (article-body generation in `generator.ts`, 8192 output tokens)
still on DashScope. Post-deploy verification after prompt 01 confirmed the
intended intermediate state: `[TopicGen]` succeeded on DeepSeek, then
`[Article] Шаг 1/3: Генерация текста...` failed with the same DashScope
timeout at the `generator.ts` call site.

This ADR completes the migration. The class fix and decision rationale
are fully recorded in the sibling ADR
`[2026-04-24] Migrate article text generation to DeepSeek (class fix
for DashScope text timeouts from VDS) — step 1/2 (topicGenerator)`; this
ADR documents only the delta for step 2.

**Decision:**

Replace the single `callQwenText` call inside `generator.ts`
(`generateArticle()`, line 154) with `callDeepSeek`. Same options object
(`temperature: 0.6`, `maxTokens: 8192`, `systemPrompt:
ARTICLE_SYSTEM_PROMPT`). No prompt text change, no retry logic change.
Add the same regression anchor pattern (inline `@rule` block above the
import, file-header `@rule` line) established in step 1/2.

Close Б-12 in `knowledge/bugs.md` — both AI call sites are now on
DeepSeek; the article cron should produce articles end-to-end on the
next scheduled run.

**Alternatives considered:**

Same list as step 1/2. Chose the two-prompt split (step 1 topicGenerator,
step 2 generator) over a single mega-prompt to preserve verifiability
and bisectability.

**Consequences:**

- (+) Б-12 closed. Article cron end-to-end runs on DeepSeek; the 2-week
  blog outage ends.
- (+) Operating cost of article generation drops ~10× — DeepSeek at
  ~$0.001–0.003 per article vs DashScope text at ~$0.010–0.019. Across
  the ~10 articles/month cadence, this is ~$0.10–0.20 saved monthly;
  the real benefit is reliability, not cost.
- (+) `knowledge/rules.md` → API Economy Rules now fully covers both
  call sites (`topicGenerator.ts` + `generator.ts`) with a single ban.
- (−) If DeepSeek itself fails (quota, key rotation, outage), the cron
  still fails silently — no Telegram alert on cron error. This is a
  separate concern tracked as follow-up work (not in scope for this
  ADR or prompt).

**Files changed:**
- `jck-auto/src/services/articles/generator.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/bugs.md` (Б-12 closed)
- `jck-auto/knowledge/INDEX.md` (version bump + dates)

## [2026-04-24] Migrate article text generation to DeepSeek (class fix for DashScope text timeouts from VDS) — step 1/2 (topicGenerator)

**Status:** Accepted

**Confidence:** High — DeepSeek reliability from VDS has already been established by the news-processor pipeline (months of stable daily 07:00 MSK runs visible in `/var/log/jckauto-news.log`) and by ADRs `[2026-04-15] DeepSeek primary for Step 2 text parse` and `[2026-04-18] DeepSeek timeout 60s→180s`. `callDeepSeek` is signature-compatible with `callQwenText` — the change is a drop-in replacement.

**Context:**

Article generation cron has been failing since ~2026-04-11 with `DashScope API failed after 2 retries: The operation was aborted due to timeout`. The blog has received no new articles for roughly two weeks. Diagnosis from `/var/log/jckauto-articles.log` plus direct curl tests showed: DashScope key and network are fine for small requests (5-token ping returns HTTP 200), but large text-generation requests (6000+ output tokens from `qwen3.5-plus`) systematically time out from the VDS.

This is not a new class of problem. Two prior ADRs already recognised DashScope text-generation as unreliable from VDS for the auction-sheet pipeline and migrated the affected code to DeepSeek. The same class fix has not yet been applied to the article-generation pipeline; applying it is the purpose of this ADR.

**Decision:**

Migrate the two AI calls in the article-generation pipeline from `callQwenText` (DashScope) to `callDeepSeek`, in two prompts:
- Prompt 01 (THIS): migrate `src/services/articles/topicGenerator.ts` — the first AI call in the pipeline, which is where every recent cron run died.
- Prompt 02: migrate `src/services/articles/generator.ts` — the heavy long-form article writer.

Scope of this step (prompt 01):
- Replace the single `callQwenText` call inside `generateTopic()` with `callDeepSeek`. Same options object (`temperature: 0.7`, `maxTokens: 1024`, `systemPrompt`). No prompt text change.
- Add an inline `@rule` anchor above the new import line explaining why DashScope is banned at this call site.
- Add a file-header `@rule` entry recording the decision at file scope.
- Add one new row in `knowledge/rules.md` under `## API Economy Rules` reflecting the new class-level rule for the content pipeline.

Prompt 02 will apply the same pattern to `generator.ts` and close bug Б-12 in `knowledge/bugs.md`.

DashScope remains the provider for image generation (`qwen-image-2.0-pro` in `coverGenerator.ts`) and for image/OCR tasks (auction-sheet Pass 1). Those code paths are out of scope.

**Alternatives considered:**

- Keep DashScope for text, increase timeout to 300s and retries to 4. Rejected: symptomatic fix only; already applied to the auction-sheet pipeline twice (ADRs 2026-04-15 and 2026-04-18) as a partial measure before the full migration. DashScope text from VDS is fundamentally unreliable on large requests — this patch class has a known half-life of 2–3 weeks.
- Move the cron to GitHub Actions and call DashScope from the runner. Rejected for now: larger scope (secrets management, workflow setup, coordination with existing deploy pipeline), does not close the class for other future content-pipeline features, and defers the fix unnecessarily. May be revisited as a separate infrastructure initiative once the class fix is applied.
- Migrate both files (`topicGenerator.ts` + `generator.ts`) in a single prompt. Rejected: violates the one-file-per-prompt rule. Two files with different risk profiles (1024-token vs 8192-token output, different system prompts) warrant separate verification windows; a single prompt would leave no easy rollback point for half the migration.

**Consequences:**

- (+) Article cron's first AI call (topic generation) runs through DeepSeek, removing the timeout failure mode observed since 2026-04-11 at that step.
- (+) DeepSeek is ~10× cheaper than `qwen3.5-plus` on text (confirmed by `/var/log/jckauto-news.log` — DeepSeek calls at ~$0.001–0.003 vs DashScope text at ~$0.010–0.019 in `/var/log/jckauto-articles.log`). Operating cost of topic generation drops proportionally.
- (+) Cross-pipeline consistency: news-processor and article-topic now both call DeepSeek for text, matching the pattern already established by the auction-sheet migration.
- (−) Article cron will still fail one step later (at `generator.ts`, still on Qwen) until prompt 02 lands. This is a known intermediate state, accepted because splitting the migration preserves verifiability.
- (−) Telegram alerts for cron failure are NOT in this prompt — if DeepSeek itself fails on production (quota, key rotation), the silent-failure problem persists until prompts 03 and 04. Fully accepted; alerts are a separate concern tracked in the same series.

**Files changed:**
- `jck-auto/src/services/articles/topicGenerator.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md`
- `jck-auto/knowledge/INDEX.md`

## [2026-04-23] Series 2.4 complete — bot result-message keyboards unified via inlineKeyboards.ts helpers + new process discipline (@fix marker, @series marker, Conventional Commits, mid-series bug variant B)

**Status:** Accepted

**Confidence:** High — all seven prompts closed, all five migrated
handlers verified in production (2.4.2–2.4.5 during their
respective sessions, 2.4.6 verified 2026-04-23 by operator via
Telegram), URL bug fix in `noscutResultButtons()` helper verified
by site response (opens `jckauto.ru/catalog/noscut`, not 404).

**Context:**

Bot surface had four independent handler files each building its
own inline keyboard literal below result messages: auction-sheet,
encar, calculator, customs. Button text, ordering, and
callback_data values drifted across handlers over time. An audit
on 2026-04-21 surfaced three concrete divergences:
- auction-sheet used "Открыть на сайте" while encar used "На сайт"
- customs result was missing the "Рассчитать ещё" CTA that
  calculator had
- noscut used "Смотреть каталог" instead of a branded site button

The divergence risk was reinforcement of drift over time — every
new handler edit risked adding another inconsistent variant.

**Decision:**

Introduce a single source of truth at `src/bot/lib/inlineKeyboards.ts`
with three helper functions (`siteAndRequestButtons`,
`siteRequestAndAgainButtons`, `noscutResultButtons`). Architecture
rule: bot result-message inline keyboards MUST be built by these
helpers; direct literal `inline_keyboard: [...]` for result
messages in `src/bot/handlers/**` is FORBIDDEN. Navigation and
wizard-step keyboards (catalog paging, customs/calculator wizard)
are OUT OF SCOPE — helpers cover only terminal result messages.

Empty-result branches that use single-button keyboards retain
their inline literals by explicit helper design (documented in
helper JSDoc).

Migrated handlers, in order:
- 2.4.1 (commit `9639ba3`) — `inlineKeyboards.ts` created;
  architecture rule added to `rules.md`.
- 2.4.2 (commit `b18e117`) — `auctionSheet.ts` →
  `siteAndRequestButtons(siteUrl)`.
- 2.4.3 (closed 2026-04-22) — `encar.ts` →
  `siteAndRequestButtons(siteUrl)`.
- 2.4.4 (closed 2026-04-22) — `calculator.ts` →
  `siteRequestAndAgainButtons(siteUrl, 'calc_again')`.
- 2.4.5 (closed 2026-04-22, commit `6ab3f6e`) — `customs.ts` →
  `siteRequestAndAgainButtons('https://jckauto.ru/tools/customs',
  'cust_again')`.
- 2.4.6 (closed 2026-04-23, commit `cba938b`) — `noscut.ts` →
  `noscutResultButtons()`. URL bug in helper fixed in same commit
  (variant B precedent applied).
- 2.4.7 (THIS PROMPT) — finalization.

**Side-effect bug fix (2.4.6):**

During 2.4.6 diagnostic reads for noscut.ts migration, found that
`noscutResultButtons()` helper was created 2026-04-21 with URL
`jckauto.ru/tools/noscut` — a page that does not exist on the
site (correct path is `/catalog/noscut`). The helper had never
been called from production code, so no user impact. Migrating
noscut.ts to the helper as-is would have introduced a 404
regression. Fix co-located with migration in commit cba938b.
`@fix 2026-04-23` marker added above the corrected URL line in
helper for future archaeology.

**New process disciplines established in 2.4.6 (formalized here):**

1. `@fix YYYY-MM-DD` code marker for mid-series bug fixes. Format:
   ```
   // @fix YYYY-MM-DD: was <old>, correct <new>. <Why/context>.
   //   Discovered during <prompt/work item>. ADR pending in
   //   <series finalization prompt id>.
   ```
   Lives in code permanently. Grep-searchable via
   `grep -rn "@fix" src/`. Formalized in `rules.md` in this prompt.

2. `@series N.M (prompt N.M.K)` handler header marker for files
   under active series transformation. Forward-only application —
   only files migrated after the convention is established
   receive the marker, prior-migrated files are NOT back-filled.
   Marker is removed in the series finalization prompt (its
   lifetime contract). First use: noscut.ts header in 2.4.6;
   removed in 2.4.7 (this prompt). Formalized in `rules.md` here.

3. Conventional Commits commit format: subject ≤72 chars + blank
   line + body. Compound commits (primary + secondary changes)
   MUST detail all changes in body. First structured commit:
   cba938b (2.4.6). Formalized in `rules.md` here.

4. Mid-series bug fix discipline (variant B formalized): bugs
   found mid-series AND fixed in the same commit as their
   discovery are documented via (a) commit body, (b) `@fix` code
   marker, (c) consolidating ADR. NOT registered in `bugs.md`.
   Registration in `bugs.md` is reserved for pre-registered bugs
   or bugs that cannot be closed in the discovery commit.
   Variant A (bugs pre-registered in `bugs.md`, closed in
   dedicated prompt) remains the default for bugs discovered
   BETWEEN work items. Formalized in `rules.md` here.

**Alternatives considered:**

- Single mega-prompt covering all four migrations instead of
  series of five small prompts: rejected. Each handler has its
  own edge cases (multi-message split in auctionSheet,
  `cust_again` / `calc_again` callback in customs/calculator,
  empty-result branch in noscut). Series allowed verification
  after each step.
- Retroactive back-fill of `@series` marker across already-
  migrated handlers (2.4.2–2.4.5): rejected. Marker's semantics
  are "work in progress on this file in this series". Back-fill
  to closed work is misleading. Forward-only is the cleaner
  contract.
- Skip `@series` marker entirely: rejected. Marker provides
  inline context for "why is this file being touched outside
  a standalone bug fix" — archaeological value exceeds its
  few-day lifetime.
- Put new rules directly into `infrastructure.md` or another
  topic file: rejected. `rules.md` is the canonical location for
  cross-cutting discipline rules per the knowledge-structure
  convention.

**Consequences:**

- (+) All bot result-message keyboards come from one file. Button
  text, ordering, callback_data centralized. Future additions
  (new handlers, new button variants) go through
  `inlineKeyboards.ts`.
- (+) One latent bug closed as side effect (noscut URL). The bug
  existed since 2026-04-21 but had not surfaced because
  `noscutResultButtons()` was never called until 2.4.6.
- (+) Process discipline codified: `@fix`, `@series`, Conventional
  Commits, mid-series bug variant B — all now `rules.md` entries
  with first-use precedents in the codebase.
- (+) `roadmap.md` Planned — Bot entries for 2.4.3, 2.4.6, 2.4.7
  closed. Planned — Bot shrinks.
- (−) `@series` marker is lifetime-scoped. Operators must remember
  to remove it in series finalization. Enforced by rule (see
  `rules.md`) but relies on discipline rather than automation.
- (−) `@fix` marker lives in code forever. If the fixed code is
  ever refactored, the marker should be preserved (it's
  archaeology), but during large refactors it's at risk of
  accidental removal. Accepted trade-off — archaeology
  permanence is the point.
- (−) The `/noscut` state bug (send `/noscut` without argument
  → next plain-text message not treated as query) was
  re-verified as still present on 2026-04-23 after the
  migration. Out of series scope — remains in `roadmap.md` →
  Planned — Bot as a separate work item.

**Files:**
- Code: `src/bot/lib/inlineKeyboards.ts` (created 2.4.1, URL fix
  2.4.6), `src/bot/handlers/auctionSheet.ts` (2.4.2),
  `src/bot/handlers/encar.ts` (2.4.3),
  `src/bot/handlers/calculator.ts` (2.4.4),
  `src/bot/handlers/customs.ts` (2.4.5),
  `src/bot/handlers/noscut.ts` (2.4.6, @series removed in 2.4.7).
- Knowledge: `knowledge/decisions.md` (this ADR),
  `knowledge/rules.md` (architecture rule from 2.4.1 + three new
  rules from this prompt), `knowledge/roadmap.md` (Series 2.4 →
  Done), `knowledge/INDEX.md` (version bump).

## [2026-04-23] Cloudflare Worker tg-proxy moved to git + Placement Hints (supersedes [2026-04-20])

**Status:** Accepted

**Confidence:** High — production-verified 2026-04-23:
`cf-placement: local-ARN` (Stockholm edge), `time curl .../getMe`
0.193s (better than 0.227s baseline from ADR [2026-04-20]), bot
responds end-to-end in single-digit seconds.

**Supersedes:** [2026-04-20] Enable Cloudflare Smart Placement on
tg-proxy Worker.

**Context:**
On 2026-04-23 morning (~14 hours after a 160-commit git pull and
PM2 process fix for Б-13), bot was still slow — 19.6s latency per
outbound Telegram API call via `tg-proxy.t9242540001.workers.dev`.
Direct `curl .../getMe` reproduced this deterministically. `curl`
on the response showed `cf-placement: local-DME` — the Moscow
Cloudflare edge — despite the Cloudflare Dashboard UI displaying
Smart Placement as enabled on the Worker.

Investigation revealed the drift mechanism. Cloudflare Smart
Placement analyzes Worker subrequest latency across multiple
traffic source locations to decide where to relocate a Worker for
optimal upstream performance. Our Worker has single-source
traffic — every request originates from one Moscow VDS. Smart
Placement's algorithm cannot collect multi-source statistics for
a single-source Worker, so it defaults to placement at the origin
region. This default can silently reassert itself when Cloudflare
re-evaluates placement, producing drift from `remote-EU` back to
`local-DME` — the exact symptom observed 2026-04-23 morning.

The ADR `[2026-04-20] Enable Cloudflare Smart Placement on
tg-proxy Worker` enabled Smart Placement via the Dashboard toggle,
and verified a fast `curl` result (0.227s) immediately after.
That ADR was correct for the knowledge available at that time;
it closed Б-1's immediate symptom and held stable for the
intervening days because Cloudflare's placement decision hadn't
yet been re-evaluated against the single-source reality. The
2026-04-23 morning drift exposed this ADR's incompleteness:
Smart Placement alone is not a sufficient placement strategy for
single-source Workers. A deterministic constraint is needed.

Further: the Worker source code lived only in Cloudflare Dashboard.
The old ADR's "Consequences" section noted this as follow-up work
to be done later. Dashboard-only configuration meant any change
(including re-enabling Smart Placement if drift happened) required
manual Dashboard intervention — operationally fragile, not
source-controlled.

**Decision:**

Three-part decision, delivered in Prompts Infra-1 (commit
bdc5a611) and Infra-1-Fix-1 (commit b162b2b):

1. **Migrate Worker source to git.** Create `worker/tg-proxy.js`
   with the Worker's four-mode routing code (webhook, photo,
   anthropic, telegram default) copied verbatim from Dashboard,
   with only `@file` header and one `@rule` anchor comment added
   above the Anthropic clean-branch pattern.

2. **Pin placement deterministically.** Create `worker/wrangler.toml`
   with:
   ```
   [placement]
   mode = "smart"
   region = "gcp:europe-west1"
   ```
   This uses Placement Hints (Cloudflare changelog 2026-01-22) as
   an EXTENSION of Smart Placement, not as replacement. `mode =
   "smart"` enables the Smart Placement mechanism (required field
   in Wrangler ≥3.90.0, without which wrangler deploy fails with
   `"placement.mode" is a required field`). `region =
   "gcp:europe-west1"` provides a deterministic regional
   constraint — Belgium GCP data center, close to Telegram's
   infrastructure in Netherlands — that bypasses the multi-source
   statistics requirement. This combination eliminates the drift
   vector.

3. **Automate deploy.** Create `.github/workflows/deploy-worker.yml`
   using `cloudflare/wrangler-action@v3`, triggered on push to
   `worker/**` and manual `workflow_dispatch`. Requires two
   GitHub Secrets: `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit
   on the account, created via "Edit Cloudflare Workers"
   template) and `CLOUDFLARE_ACCOUNT_ID` (non-secret identifier
   `604d9a5c5413693bbb859f1ffab5fc99`, stored in Secrets for
   consistency). Workflow runs wrangler deploy in ~20 seconds on
   every `worker/**` push; operator can also manually trigger.

**Conceptual correction of prompt Infra-1 initial reasoning:**

Prompt Infra-1 initially described Placement Hints as "a
deterministic mechanism, not the Smart Placement ML heuristic".
This was wrong. Placement Hints are an EXTENSION of Smart Placement:
- `mode = "smart"` enables the mechanism (required).
- `region = "..."` provides a deterministic hint within that
  mechanism (bypasses multi-source statistics requirement).
A wrangler.toml with `[placement]` block is rejected by Wrangler
3.90.0 if `mode` is missing. This correction was verified
empirically by the failed `wrangler deploy` on workflow run
24813043040 (2026-04-23 02:16 UTC) and fixed by Infra-1-Fix-1.

**Verification (2026-04-23):**
- `wrangler deploy` workflow green on commit b162b2b.
- 15-minute Cloudflare placement analysis window elapsed.
- `curl -sI https://tg-proxy.t9242540001.workers.dev/getMe |
   grep cf-placement` → `cf-placement: local-ARN` (Stockholm
   Arlanda airport, European edge; `local-` prefix means
   "Worker ran at the edge closest to the client", not that
   placement is at origin region — Stockholm is the European
   edge for our traffic pattern).
- `time curl .../getMe` → 0.193s real. Faster than the 0.227s
   baseline from ADR [2026-04-20] (plain Smart Placement). Faster
   than historical `remote-EU` measurements.
- Bot `/customs` wizard completes end-to-end in single-digit
   seconds (verified manually by operator).

**Alternatives considered:**

- **Keep Dashboard-only Smart Placement, diagnose drift cause
  deeper.** Rejected: Dashboard is manual, fragile,
  non-version-controlled. Even if Smart Placement drift were
  solvable via Dashboard tweaks alone, the configuration would
  remain outside git. Every future incident would require
  Dashboard inspection as first diagnostic, not `cat` on a file.

- **Plain `mode = "smart"` without `region` hint.** Rejected:
  already tried on 2026-04-20 (via Dashboard toggle) and drift
  occurred by 2026-04-23 morning. Without a deterministic hint,
  single-source traffic defaults to origin region.

- **Plain `region = "gcp:europe-west1"` without `mode`.**
  Rejected: Wrangler 3.90.0 fails with `"placement.mode" is a
  required field`. Both parts are mandatory.

- **Hetzner CX22 (Helsinki, €3.49/mo) as self-hosted nginx
  reverse proxy, independent of Cloudflare.** Considered as
  fallback path (Etap 2 of Cloudflare migration per earlier
  research-protocol document). Deferred: current Cloudflare path
  verified stable and fast; Hetzner retained as strategic
  backlog option. Activation criteria: if Cloudflare Workers
  become unreliable in Russia, if pricing changes, or if a
  second independent outbound path becomes a hard requirement.

- **Use a different EU region.** Options considered:
  `aws:eu-central-1` (Frankfurt AWS), `azure:westeurope`
  (Netherlands Azure). Chose `gcp:europe-west1` (Belgium GCP)
  because it appears explicitly in Cloudflare's own documentation
  examples — strongest signal of support. All three options
  would likely work similarly for our use case.

**Consequences:**

- (+) Worker configuration is source-controlled. The committed
  `worker/wrangler.toml` is single source of truth. Changes in
  Cloudflare Dashboard are overwritten by next `wrangler deploy`.

- (+) Deterministic placement — the `region` hint eliminates the
  drift vector that caused the 2026-04-23 morning incident. The
  Worker should not spontaneously drift back to `local-DME`
  (origin Moscow region) on future Cloudflare re-evaluation
  windows.

- (+) Auto-deploy via GitHub Actions: pushing changes to
  `worker/**` triggers wrangler deploy automatically within ~30s.
  No manual Dashboard steps needed. No `setWebhook` re-run needed
  (the Worker URL `tg-proxy.t9242540001.workers.dev` is
  unchanged).

- (+) Б-1 remains closed. Today's 2026-04-23 incident was
  placement drift within the class that the 2026-04-20 ADR
  addressed, not a new bug class and not a Б-1 recurrence. The
  Placement Hint eliminates the drift vector, so Б-1 is closed
  with stronger foundation than it had on 2026-04-20.

- (+) Supersedes the 2026-04-20 ADR cleanly: old ADR remains in
  history with `Status: Superseded by [2026-04-23]`; new ADR
  has `Supersedes: [2026-04-20]` in header. Bidirectional link
  for future discoverability.

- (−) GitHub Secrets now contain `CLOUDFLARE_API_TOKEN` with
  Workers Scripts Edit scope on the entire account. Scope could
  be narrowed to only the `tg-proxy` Worker resource — minor
  security hardening, not urgent. Noted in follow-ups.

- (−) Still dependent on Cloudflare as sole outbound path for
  bot + Anthropic API. If Cloudflare becomes blocked or
  unreliable from Russian ISPs, the bot goes down. Hetzner Etap
  2 remains the strategic mitigation for this risk.

- (−) Wrangler version drift risk: `cloudflare/wrangler-action@v3`
  installs `wrangler@3.90.0` automatically. If this action or
  wrangler version changes behavior, the placement config may need
  revisiting. Mitigated by pinning action to `@v3` (major version
  pin, stable API contract) and by keeping wrangler.toml minimal.

**Follow-up items (moved to roadmap.md Planned Infrastructure):**

- Telegram-branch header cleanup (worker/tg-proxy.js currently
  forwards `request.headers` wholesale on the default branch; the
  Anthropic branch uses a clean 4-header pattern; consider
  harmonizing for defense-in-depth).
- console.log ingress/egress at each routing branch (for future
  latency debugging without Dashboard access).

**Files:**
- `worker/tg-proxy.js` (new in Infra-1, commit bdc5a611).
- `worker/wrangler.toml` (new in Infra-1 with incorrect config,
  fixed in Infra-1-Fix-1 commit b162b2b).
- `.github/workflows/deploy-worker.yml` (new in Infra-1).
- `knowledge/decisions.md` (this entry + old ADR Status change).
- `knowledge/rules.md` (Smart Placement rule replaced with
  Worker-in-git rule).
- `knowledge/roadmap.md` (old "Move Cloudflare Worker" Planned
  Infrastructure item → Done + new small Follow-up items).
- `knowledge/infrastructure.md` (Cloudflare Worker section
  updated).
- `knowledge/INDEX.md` (version and dates bumped).

## [2026-04-22] pm2 startOrReload is graceful reload — pm2 delete required to apply any ecosystem.config.js change

**Status:** Accepted

**Confidence:** High

**Context:**
ADR `[2026-04-22] Move PM2 process management to committed
ecosystem.config.js` introduced declarative PM2 configuration as
single source of truth (commit `59555b8`). deploy.yml was simplified
to `pm2 startOrReload ecosystem.config.js --only jckauto,jckauto-bot`,
and the informal expectation was that `startOrReload` re-reads the
file on every invocation and brings online processes into sync with
the declared definition.

This expectation was INCORRECT. The actual PM2 behaviour is:

- For a process NAME that PM2 does NOT currently have: `pm2
  startOrReload <file> --only <name>` creates a new process from the
  file. All fields in the file are applied at spawn time. Works as
  expected.

- For a process NAME that PM2 already has online:
  `pm2 startOrReload` performs graceful reload. PM2 re-spawns the
  running process — but using its EXISTING in-memory definition:
  `pm_exec_path`, `script_args`, `exec_interpreter`, and env snapshot
  that PM2 captured when the process was first started. No field
  from the ecosystem file is re-read for an online process.

Incident Б-13 (2026-04-22 evening) made this production-visible. A
13-hour-old manually-started `jckauto-bot` process survived the
merge of commit `59555b8` and every subsequent `pm2 startOrReload
--only jckauto-bot` throughout the day. Its `script path` remained
`/usr/bin/bash -c "npx tsx …"` (the old manual form), while the
ecosystem.config.js file declared `script: 'node_modules/.bin/tsx'`
with `interpreter: 'none'` and no bash wrapper. `pm2 describe`
showed the stale values; users experienced 20-second callback
latency from 13 hours of accumulated process state.

Retroactive evidence from Prompt 2.4.3.6.1 post-merge confirmed the
same pattern for a different process: `pm2 startOrReload --only
mcp-gateway` after the args correction preserved the old (wrong)
`-c exec npx -y ...` args; only `pm2 delete mcp-gateway && pm2
start ecosystem.config.js --only mcp-gateway` applied the
corrected entry.

**Decision:**
Any change in `ecosystem.config.js` to a field of an ALREADY-ONLINE
process (script, interpreter, args, cwd, env, max_restarts,
autorestart, or any other pm2 option) does NOT take effect on
`pm2 startOrReload` alone. The correct sequence to apply such a
change is:

```bash
pm2 delete <name>
pm2 start ecosystem.config.js --only <name>   # or startOrReload
pm2 save
```

`pm2 delete <name>` removes PM2's in-memory entry entirely, so the
next `pm2 start ecosystem.config.js` creates a fresh process from
the file with all current field values applied at spawn.

This rule does NOT apply to the first start of a process (when PM2
has no entry yet) — that case works correctly with `pm2 startOrReload`
alone. The rule applies only when updating an existing process's
definition.

`deploy.yml` is NOT changed by this ADR. Normal deploys ship code
but do not change PM2 script/args/env fields — the vast majority of
deploys are fine with `pm2 startOrReload` alone. The `pm2 delete`
step is an operator-discipline rule for the rare case of
ecosystem.config.js field changes, not a CI rule applied to every
deploy.

**Alternatives considered:**
- Make deploy.yml unconditional `pm2 delete <name> && pm2 start` for
  bot and site: rejected. Causes 5–10 seconds of downtime on every
  deploy. 99% of deploys do not touch PM2 fields; discipline should
  scope to the rare case.
- Switch from `pm2 startOrReload` to `pm2 reload`: rejected.
  `pm2 reload` has the same graceful-reload semantics; it is a
  strict subset of `startOrReload`, not a different operation.
- Automate a diff check in deploy.yml that compares live process
  definitions against the ecosystem file and fails if they drift:
  rejected for now. Useful but non-trivial to implement (PM2 has no
  single API that returns the full process definition in the same
  shape as the file). Can be revisited as a Technical debt item if
  the operator-discipline approach proves insufficient.
- Rename processes with a version suffix on every ecosystem change
  to force fresh creation: rejected. Invasive, loses PM2's
  restart-count and log-tail continuity, does not match PM2's
  intended usage.

**Consequences:**
- (+) Future prompts that change script / interpreter / args / cwd /
  env / max_restarts in ecosystem.config.js have a clear operational
  requirement: the post-merge operator action documented in the
  prompt MUST include `pm2 delete <name>` before the startOrReload.
- (+) Diagnostic workflow gains a first-check rule: whenever a PM2
  process behaves unexpectedly after an ecosystem.config.js change,
  compare `pm2 describe <name> | grep -E "script path|script args"`
  against the file. If they disagree, the pm2 delete step was
  skipped. This check is now documented in infrastructure.md.
- (+) Б-11 closure evidence is correctly re-attributed: the mcp-gateway
  FILESYSTEM_ROOTS env was applied to the live process via an
  explicit `pm2 delete` (visible in the session transcript), not via
  startOrReload alone. This ADR corrects an informal belief about
  env reconciliation that briefly appeared during Б-13 diagnosis.
- (−) Operators must remember the asymmetry between first start
  (works) and update (needs delete). Documented in rules.md,
  infrastructure.md, and this ADR, but it remains a cognitive load.
- (−) The three retroactive 2026-04-22 startOrReload runs (for
  2.4.3.6 post-merge, 2.4.3.6.1 post-merge, 2.4.4 post-merge) silently
  preserved whichever stale definition the bot and mcp-gateway had.
  Only the one explicit `pm2 delete` for mcp-gateway in 2.4.3.6.1,
  and the one explicit `pm2 delete` for jckauto-bot at the end of
  the session, applied the correct definitions. Without those two
  explicit deletes, the bot would still be serving stale code and
  mcp-gateway would still have the wrong args. This explains the
  whole-day symptom.

**Files changed:**
- `jck-auto/knowledge/bugs.md` — Б-13 entry added and closed in the
  same commit.
- `jck-auto/knowledge/rules.md` — new Infrastructure Rule.
- `jck-auto/knowledge/infrastructure.md` — new subsection in PM2
  Processes; one-phrase correction in Deploy section removing a
  misleading `(re)spawns` wording.
- `jck-auto/knowledge/roadmap.md` — three new Done bullets
  (2.4.4 calculator refactor; Б-13 closed in same session; 2.4.3.6.1
  mcp-gateway entry correction); 2.4.4 removed from Planned — Bot.
- `jck-auto/knowledge/INDEX.md` — version bump to 1.61, dates, and
  description refreshes for the five changed files.

## [2026-04-22] Move PM2 process management to committed ecosystem.config.js

**Status:** Accepted

**Confidence:** High

**Context:**
Two prior 2026-04-22 ADRs (`PM2 cwd inheritance incident — duplicate
jckauto-bot processes` and its `Canonical bot startup change requires
workflow grep` addendum) tightened the ad-hoc `pm2 start bash -c` command
canon and added a procedural rule to grep `.github/workflows/` whenever
that canon changes. Both were interim steps: they made the imperative
form safer, but the imperative form itself remained in three
uncoordinated copies — `~/.pm2/dump.pm2` on VDS, `infrastructure.md`
prose, and `.github/workflows/deploy.yml`. Drift was inevitable; the
prior ADRs only narrowed the window, not the class.

The trigger for replacing the imperative form entirely was the
2026-04-22 `pm2 delete all` incident on VDS. While clearing duplicate
jckauto-bot processes from the cwd-inheritance incident, the operator
ran `pm2 delete all` and wiped the running `mcp-gateway` process along
with the bot. The `mcp-gateway` process had been started weeks earlier
with `FILESYSTEM_ROOTS` passed inline on the command line. That value
was not persisted anywhere — no `.env` file, no `dump.pm2` entry that
captured the env, no hardcode in `start.sh`. After `pm2 delete all`,
manually restarting `mcp-gateway` brought it up with empty
`FILESYSTEM_ROOTS`, and the JCK AUTO Files MCP connector returned
`Filesystem access disabled` to every read. The deploy-log workflow
broke; project file reads via MCP broke. Recovered manually by
re-passing the env inline. Registered as Б-11.

The two incidents share a single structural root cause: PM2 process
definitions are not in the repo. Three uncoordinated copies → drift is
inevitable. Procedural discipline (grep before commit, "always cd before
pm2 start", "pass FILESYSTEM_ROOTS inline") only mitigates symptoms.

**Decision:**
Introduce a committed `ecosystem.config.js` at the project root as the
SINGLE SOURCE OF TRUTH for all three PM2 processes (jckauto,
jckauto-bot, mcp-gateway). The file declares each app's `name`, `cwd`,
`script`/`args`/`interpreter`, `env`, and `max_restarts`. `deploy.yml`
calls `pm2 startOrReload ecosystem.config.js --only jckauto,jckauto-bot`
in place of the previous separate `pm2 restart jckauto` + `pm2 delete
jckauto-bot` + `pm2 start bash --name jckauto-bot -- -c "…"` triple.
Manual restarts on VDS use the same file via the same call (with
`--only` matching the affected process). Raw `pm2 start <bash> --name X
-- -c "…"` is FORBIDDEN going forward; codified in `rules.md`
Infrastructure Rules.

The `bash -c` wrapper canon from the prior 2026-04-22 ADRs is RETAINED
as the Emergency Manual Deploy fallback in `infrastructure.md`, for the
single case where `ecosystem.config.js` is temporarily broken or
unreadable. After the emergency passes, the canonical state must be
restored by `pm2 startOrReload ecosystem.config.js`. This caps the
imperative form's surface area to "ecosystem file is unreadable" — a
recovery path, not a daily-driver path.

Layout choice: CommonJS `.js` extension. Verified `package.json` has no
`"type": "module"` field, so Node treats `.js` as CommonJS by default.
`module.exports = { apps: [...] }` is the standard PM2 ecosystem shape.
If the project later adopts `"type": "module"`, this file MUST be
renamed to `ecosystem.config.cjs` in the same commit, otherwise
`pm2 startOrReload` fails with "require() of ES Module".

mcp-gateway is included in the file but NOT in the deploy `--only` list
— it lives outside the site/bot deploy cycle. Its source code lives in
`/opt/ai-knowledge-system/` (separate FastMCP server, not in this
repo); only the PM2 process definition lives here. The entry declares
`env: { FILESYSTEM_ROOTS: '/var/www/jckauto/app/jck-auto' }` so every
`pm2 startOrReload ecosystem.config.js --only mcp-gateway` re-applies
the env declaratively — closing Б-11 structurally. If the start script
on VDS ever changes from `/opt/ai-knowledge-system/server/start.sh`,
this file MUST be updated in the same commit as the VDS change. That
discipline is the whole point of the file.

**Five protective layers from the 2026-04-22 PM2 cwd ADR are preserved**,
now expressed declaratively in `ecosystem.config.js` `apps[1]`:
1. `cwd: '/var/www/jckauto/app/jck-auto'` — daemon cwd, enforced by PM2
   at every start/restart/resurrect.
2. `script: 'node_modules/.bin/tsx'` with `interpreter: 'none'` — PM2's
   PID equals the tsx PID directly. No bash wrapper, no double-cd
   needed because PM2's `cwd` field is enforced deterministically
   (this is the change vs the prior ADR — the bash wrapper was
   defense-in-depth against `cwd` being ignored, but `ecosystem.config.js`
   sets `cwd` once per spawn from a committed source).
3. `args: '-r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local'`
   — explicit `.env.local` path; bot reads env on every reload.
4. `max_restarts: 5` — crash-loop cap (incident 2026-04-22 produced 34+
   restarts before manual catch).
5. `pm2 startOrReload` reload semantics — re-spawns the entry with the
   current ecosystem config on every call, eliminating the "id reuse
   with wrong cwd" / "stale env" failure modes.

**Alternatives considered:**
- Keep the inline `pm2 start bash …` form in `deploy.yml`, just add a
  CI grep that compares against `infrastructure.md`: rejected. Patterns
  would calcify on today's specific shape; the grep would itself drift
  and become a false-positive nuisance. Drift is a structural problem,
  not a procedural one. (This is the alternative the
  `Canonical bot startup change requires workflow grep` addendum settled
  for; promoting to ecosystem.config.js supersedes it for PM2 startup.)
- Use `ecosystem.config.cjs` (explicit CommonJS extension) regardless
  of `package.json` "type": rejected for now. The repo is currently
  CommonJS by default; `.js` is more idiomatic. The "rename to .cjs if
  type: module is added" rule above covers the future case.
- Move all three processes (incl. mcp-gateway) into the deploy `--only`
  list: rejected. mcp-gateway's lifecycle is decoupled from the site/bot
  release cadence; coupling them would drag the MCP connection down on
  unrelated site deploys.
- Keep the bash -c wrapper for the bot inside ecosystem.config.js (the
  same form the prior ADR settled on, just declared in the file rather
  than in deploy.yml): rejected. PM2's `cwd` field is enforced
  deterministically when the process definition comes from an
  ecosystem file — the layered defense the prior ADR built was a
  workaround for the imperative-form's unreliable cwd inheritance, not
  a structural requirement. Direct `script: 'node_modules/.bin/tsx'`
  with `interpreter: 'none'` is simpler and equivalent in safety once
  `cwd` is declarative. The bash wrapper survives only as the
  Emergency Manual Deploy fallback.

**Consequences:**
- `ecosystem.config.js` is now the only allowed source for PM2 process
  definitions. Editing process startup means editing this file — never
  hand-typing flags into a `pm2 start` shell invocation outside the
  Emergency Manual Deploy block.
- `deploy.yml` step 7 (the bot start block) and step 8 (deploy complete
  echo) collapse into a single new step 7 (`pm2 startOrReload …` + new
  echo). The `[build] step N` marker count goes from 8 to 7.
  `infrastructure.md` Deploy section is updated to reflect step 7 as
  the final marker.
- Б-11 closed: declaring `FILESYSTEM_ROOTS` on the mcp-gateway entry
  means every reload through ecosystem.config.js re-applies the env.
  Raw `pm2 restart mcp-gateway` is now FORBIDDEN by `rules.md`.
- The 2026-04-22 PM2 cwd ADR addendum (workflow grep on canonical
  command changes) remains in force for other canonical-command
  changes (cron jobs, ad-hoc scripts), but its scope narrows for PM2
  startup: PM2 commands now live in one file, and the grep target for
  PM2 changes becomes that file rather than `.github/workflows/`.
- `~/.pm2/dump.pm2` on VDS becomes a runtime cache, not a primary
  record. After the first `pm2 startOrReload ecosystem.config.js` the
  dump can be safely deleted and re-generated.
- The Planned — Technical debt entry "Commit ecosystem.config.js to the
  repository" in `roadmap.md` is closed and moved to Done.

## [2026-04-22] Canonical bot startup change requires workflow grep — addendum to PM2 cwd ADR

**Status:** Accepted

**Confidence:** High

**Context:**
The earlier 2026-04-22 ADR `PM2 cwd inheritance incident — duplicate
jckauto-bot processes` updated `infrastructure.md` with the new canonical
bot startup command (`bash -c` form, double `cd`, `--max-restarts 5`,
`pm2 delete ... 2>/dev/null || true`). It did NOT include a step to grep
the actual deploy automation (`.github/workflows/*.yml`) for the OLD
form and update those occurrences in the same prompt. As a result, the
old form survived in `.github/workflows/deploy.yml` step 7 unchanged.
Today's deploy of Prompt 2.4.3 saved a process whose `pm_exec_path` was
the old relative-path form. The process happened to work because
`appleboy/ssh-action` had already `cd`'d into the project directory
before `pm2 start`, but any future `pm2 resurrect` from a non-project
cwd would have triggered the exact crash-loop the original ADR was
written to prevent.

**Decision:**
Whenever the canonical startup command of any PM2-managed process changes,
the same prompt MUST update both `infrastructure.md` AND every occurrence
of `pm2 start` for that process across `.github/workflows/*.yml`. Verify
via `grep -rn "pm2 start" .github/workflows/` after the edit — the result
must show ONLY the new form for the affected process. This rule applies
to all future canonical-command changes, not just bot startup.

The encar hang inadvertently caught this gap today: live verification of
2.4.3 surfaced it because the operator manually restarted the bot under
the new canonical form to fix the hang, then noticed the `deploy.yml`
mismatch on subsequent inspection. Without that side-channel, the gap
would have remained latent until the next VDS reboot.

**Alternatives considered:**
- Add a one-off CI check that greps workflows for old pm2 patterns:
  rejected. Patterns evolve; the check would calcify on today's specific
  shape. The discipline of "search workflows when changing canon" lives
  better as a written rule (here) than as a brittle CI assertion.
- Move all PM2 startup to a committed `ecosystem.config.js` so workflows
  reference one file: deferred — already in roadmap.md → Planned —
  Technical debt. When implemented, this addendum becomes redundant for
  PM2 startup but the general rule (grep automation when canon changes)
  still applies.

**Consequences:**
- The earlier 2026-04-22 PM2 cwd ADR is NOT modified (append-only). This
  addendum extends it.
- Future prompts that change any PM2 process startup MUST include in
  Acceptance Criteria a grep over `.github/workflows/` confirming no
  occurrences of the old form survive.
- This prompt itself satisfies the new rule for the bot-startup case:
  edits `deploy.yml` step 7 in the same prompt as the addendum.

## [2026-04-22] PM2 cwd inheritance incident — duplicate jckauto-bot processes

**Status:** Accepted

**Confidence:** High

**Context:**
On 2026-04-22, while reproducing the bot startup commands from the previous
session's handoff post, three jckauto-bot processes ended up running
simultaneously: id 295 (the canonical one, online, cwd
`/var/www/jckauto/app/jck-auto`), id 296 (online, ↺ 34, cwd `/root`,
crash-loop), id 297 (stopped, ↺ 1, cwd `/root`).

Sequence of events:
1. Operator ran `pm2 start bash --name jckauto-bot -- -c "npx tsx ..."` from
   shell with `pwd = /root`. Process 295 spawned with the correct cwd
   `/var/www/jckauto/app/jck-auto`. The correct cwd was inherited from a
   prior `~/.pm2/dump.pm2` entry under the same name, NOT from the
   operator's current shell or from the command itself.
2. Operator ran `pm2 start "node_modules/.bin/tsx ..." --name jckauto-bot`
   from the same shell (`pwd = /root`). PM2 resolved the relative path
   `node_modules/.bin/tsx` against the operator's `pwd`, found nothing, and
   the bash invocation failed at startup. PM2 respawned 34+ times — id 296
   in crash-loop.
3. Id 297 also appeared, also crash-looping in `/root`. Two candidate
   mechanisms (neither verified after the fact): PM2 watchdog respawn after
   `pm2 delete 296`, OR a third paste of the broken command from shell
   history. Logs at `~/.pm2/pm2.log` for the relevant moment had already
   rotated by diagnosis time.

Manual cleanup: `pm2 delete 296 && pm2 delete 297 && pm2 save`. Process 295
remained as the live bot.

**Decision:**
Canonical bot startup command updated to be cwd-independent and fail-loud
on misuse:

```bash
cd /var/www/jckauto/app/jck-auto
pm2 delete jckauto-bot 2>/dev/null || true
pm2 start bash --name jckauto-bot --max-restarts 5 -- \
  -c "cd /var/www/jckauto/app/jck-auto && exec node_modules/.bin/tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local"
pm2 save
```

Five protective measures, layered:
- `cd` BEFORE `pm2 start` — gives the daemon the right cwd to inherit.
- `cd` AGAIN inside `bash -c` — defense in depth: even if PM2 ignores the
  inherited cwd, bash itself moves to the project directory before exec.
- `exec` — replaces the bash process with the tsx process so PM2's PID
  equals the actual bot PID (correct restart metrics, correct graceful
  shutdown).
- `--max-restarts 5` — prevents future broken commands from spawning
  unbounded crash-loops like 296 did (34+ restarts before manual catch).
- `pm2 delete jckauto-bot 2>/dev/null || true` — strips any stale entry
  from the dump file before starting fresh, eliminating the "id reuse
  with wrong cwd" failure mode that caused this incident.

The choice of tsx binary (`node_modules/.bin/tsx` vs `npx tsx`) was
researched separately on 2026-04-22 (research-protocol skill, lightweight
pass) and the pre-existing rule from `telegram-bot.md` (2026-04-10) and
`infrastructure.md` (2026-04-18) was reaffirmed: `node_modules/.bin/tsx`
remains canonical because `npx tsx` may pick up a global tsx that fails
to resolve `dotenv/config`. The `npx tsx` form in the session handoff
post was a one-off repair, not a policy change.

**Alternatives considered:**
- Just `cd` before `pm2 start`, no `bash -c` wrapper, direct
  `pm2 start "node_modules/.bin/tsx ..."` form: rejected. PM2 may resolve
  the relative path at start-time against the operator's shell pwd before
  the daemon's cwd takes effect (this is what triggered the incident).
  The `bash -c` form puts the path resolution inside bash, after the
  internal `cd`.
- Move the startup to `ecosystem.config.js` committed to the repo:
  deferred to Planned — Technical debt. Not a quick fix; involves a
  policy decision on which processes to migrate together.
- Drop `--max-restarts`: rejected. The incident produced 34+ restarts
  before manual intervention. The cap turns a runaway loop into a clear
  `errored` state visible in `pm2 status`.

**Consequences:**
- Old canonical command in `infrastructure.md` (the form
  `pm2 start "node_modules/.bin/tsx ..." --name jckauto-bot` with no
  explicit `cd`) is SUPERSEDED by this ADR. Any reference to the old
  form anywhere in knowledge must be updated.
- Operators must always run `pm2 status` after starting the bot to verify
  exactly one online jckauto-bot process exists, no duplicates.
- A new `rules.md` entry forbids `pm2 start` with relative paths; all
  future bot/process starts go through `bash -c` + explicit `cd`.

## [2026-04-21] Session close 2026-04-21 — delivery summary

**Status:** Accepted

**Confidence:** High

**Context:**
Single-day work session on 2026-04-21 covered the auction-sheet bot
regression (DashScope timeout from legacy single-model call) and the start
of CTA unification across bot handlers. The session produced nine commits
landed on main via auto-merge of `claude/**` branches.

**Decision:**
Record the session as a single ADR for traceability. Individual ADRs
already exist for the substantive architecture changes (extract
auction-sheet service, wire bot to service, bot user store lazy-load fix,
inline-keyboards helper). This entry is the index pointing to them.

Commits, in chronological order:
- `b5503b4` — Prompt 01: Encar inline button text rename to "Подробный отчёт на сайте"
- `129df73` — Prompt 02: replace internal auction codes A1/W1/G/S with Russian severity labels in bot output
- `4645101` — Prompt 2.1a: skeleton of `src/lib/auctionSheetService.ts` + nine planned prompts
- `e911832` — Prompt 2.1b: service types `RunOpts`, `PipelineResult`, helpers, `classifySheet`
- `086d986` — Prompt 2.1c: `runAuctionSheetPipeline` + website route.ts via service
- `1716921` — Prompt 2.2: bot `registerAuctionSheetHandler` enqueues into `auctionSheetQueue` + polling
- `9639ba3` — Prompt 2.4.1: introduce `src/bot/lib/inlineKeyboards.ts` + Architecture Rule in `rules.md`
- `b18e117` — Prompt 2.4.2: bot auction-sheet handler uses inline-keyboards helper
- `716cc06` — Prompt 2.4.2.1: Б-9 closed — `ensureUsersLoaded()` + async `handleRequestCommand`

Closed bugs: Б-9 (user store lazy-load race on bot restart).
Closed regressions: bot auction-sheet DashScope timeout via legacy single-
model call (now uses shared multi-pass pipeline through queue).

**Consequences:**
- Bot and website now share one source of truth for the auction-sheet
  pipeline (`src/lib/auctionSheetService.ts`), enforced through one queue
  (concurrency=1).
- Bot result-message keyboards have a helper layer; remaining handlers
  (encar, calculator, customs, noscut) migrate in series 2.4.3–2.4.6.
- Prompt-process improvements in this session: AC grep checks must be
  written to exclude JSDoc comment matches (recorded as a separate rule
  in `rules.md`); session-suffixed branch names from Claude Code (e.g.
  `claude/xxx-ytmKy`) are accepted as normal.

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

**Status:** Superseded by [2026-04-23] Cloudflare Worker tg-proxy moved to git + Placement Hints

> **Superseded 2026-04-23:** Smart Placement alone turned out to be
> an incomplete solution for our single-source traffic pattern — it
> drifted back to `local-DME` on 2026-04-23 morning (14 hours after
> a git pull + PM2 fix). Root cause: Smart Placement's multi-source
> statistics requirement cannot be satisfied by single-source
> traffic from one VDS. Complete solution requires `[placement]
> mode = "smart"` + `region = "gcp:europe-west1"` Placement Hint
> in `worker/wrangler.toml`. See the new ADR for details. The
> original decision below remains in history unmodified; only this
> header was added.

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

## [2026-04-21] Bot user store lazy-load race — minimal lazy-await fix

**Status:** Accepted
**Confidence:** High
**Context:** `src/bot/store/users.ts` lazy-loads user records from
`/var/www/jckauto/storage/users.json` asynchronously. Its sync public
accessor `getUser()` returns data only after some other async code
path has already awaited the internal `loadUsers()`. On fresh bot
process, a user tapping an "Оставить заявку" inline button before
typing any command hits `handleRequestCommand` → `getUser` → empty
map → "Нажмите /start чтобы начать." fallback. Bug Б-9.
**Decision:** Minimal targeted fix. Expose
`ensureUsersLoaded()` from users.ts (idempotent wrapper over
`loadUsers`). Make `handleRequestCommand` async and await
`ensureUsersLoaded()` on its first line before any `getUser` call.
The callback_query listener continues to fire synchronously and
invokes the handler with `void` (fire-and-forget).
**Rejected alternative 1:** Rewrite users.ts to load synchronously at
module import (like `botStats.ts`). Better architecturally but much
larger scope — changes the signature of every async accessor and ripples
through all callers.
**Rejected alternative 2:** Wrap handler registration in an async IIFE
inside `src/bot/index.ts` with `await ensureUsersLoaded()` before
`registerRequestHandler`. Theoretically leaves a ~10ms race window
during which webhook events could arrive before the listener is
registered. `node-telegram-bot-api` does not buffer events pre-listener
(it extends EventEmitter). Rejected to avoid the risk; a lazy-await
inside the handler is gone as soon as the first callback arrives.
**Consequences:**
- Targeted fix; one handler changed, one public helper added.
- Every subsequent callback_query `request_start` adds a ~10ms cost
  for the first one and ~0ns for the rest of process lifetime.
- Pattern is reusable: any other handler reading the user store
  synchronously can await ensureUsersLoaded() the same way. None
  exist today.
- Long-term follow-up logged in bugs.md Б-9 "Long-term follow-up"
  section: synchronous-init refactor of users.ts.

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
