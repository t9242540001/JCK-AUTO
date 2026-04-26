<!--
  @file:        knowledge/rules.md
  @project:     JCK AUTO
  @description: All critical rules with locations and consequences of violation
  @updated:     2026-04-25
  @version:     1.28
  @lines:       157
-->

# Critical Rules

## Calculator Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| 5-year boundary is INCLUSIVE (≤5 = 3to5) | calculator.ts `yearToCarAge()` | ~218,000 ₽ overcharge for cars exactly 5 years old |
| Recycling fee: BOTH conditions (≤160hp AND ≤3L AND personalUse) | calculator.ts `getRecyclingFee()` | Jump from 5,200 ₽ to ~1,900,000+ ₽ |
| findBracket upper boundary is INCLUSIVE | calculator.ts `findBracket()` | Wrong ETS bracket → wrong duty amount |
| Do NOT change tariff numbers without checking normative docs | tariffs.ts | Incorrect customs calculations for all users |
| Rates from fetchCBRRates() ALREADY include markup | currencyRates.ts | Double markup if multiplied again |

## Infrastructure Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| All PM2 process startup MUST go through committed `ecosystem.config.js` via `pm2 startOrReload ecosystem.config.js --only <name>`. Raw `pm2 start <bash> --name X -- -c "…"` is FORBIDDEN outside the Emergency Manual Deploy fallback | `ecosystem.config.js`, `deploy.yml`, ADR [2026-04-22] Move PM2 process management to committed ecosystem.config.js | Hand-typed `pm2 start` flags create a third copy of process definitions (alongside `~/.pm2/dump.pm2` and `infrastructure.md`) — the three drift, causing the 2026-04-22 PM2 cwd incident (duplicate jckauto-bot processes, ids 295/296/297) and Б-11 (mcp-gateway losing FILESYSTEM_ROOTS env after `pm2 delete all`). The ecosystem file holds `cwd`, `script`/`args`, `env`, and `max_restarts` declaratively; every reload re-applies them |
| Any change to a PM2 process (script, args, cwd, env, max_restarts) MUST be a single commit that touches `ecosystem.config.js` AND any related docs (`infrastructure.md`, `rules.md`). Never edit on the server only | `ecosystem.config.js`, `infrastructure.md`, ADR [2026-04-22] Move PM2 process management to committed ecosystem.config.js | Server-only edits drift from the committed source; the next `pm2 startOrReload ecosystem.config.js` silently reverts them or — worse — applies a stale committed value over a hand-tuned one. Both directions of drift are bugs. The single-commit discipline is the whole point of the file |
| `pm2 restart jckauto-bot` and `pm2 restart mcp-gateway` are FORBIDDEN — use `pm2 startOrReload ecosystem.config.js --only <name>` instead | All deploy/restart scripts, ADR [2026-04-22] Move PM2 process management to committed ecosystem.config.js | `pm2 restart` does NOT re-read env from any source — it only re-spawns `pm_exec_path` with the env snapshot saved at start time. Bot loses `.env.local` reload (existing rule); mcp-gateway loses `FILESYSTEM_ROOTS` (Б-11). `pm2 startOrReload <ecosystem-file>` re-spawns from the committed config, applying current env on every call |
| Any change in `ecosystem.config.js` to a field of an already-online process (script, interpreter, args, cwd, env, max_restarts, autorestart) requires `pm2 delete <name>` BEFORE the next `pm2 startOrReload ecosystem.config.js --only <name>`. This rule REINFORCES but does NOT replace the rule above: ecosystem.config.js is still the only allowed source; `pm2 delete` is the operational step that makes the file's changes actually apply. First start of a process (when PM2 has no entry yet) does NOT require delete | `ecosystem.config.js`, `infrastructure.md` → PM2 Processes → "Applying ecosystem.config.js changes" subsection, ADR [2026-04-22] pm2 startOrReload is graceful reload — pm2 delete required to apply any ecosystem.config.js change | `pm2 startOrReload` performs graceful reload for online processes and silently preserves their in-memory definitions — script, interpreter, args, cwd, env snapshot — from the time of first start. Changes in the file have no effect until the next process creation. Incident Б-13: jckauto-bot ran stale code from a 13-hour-old manual startup for the full 2026-04-22 session because three `startOrReload` calls all took the silent-preservation path. Bot latency reached 20s/callback; users saw `ETELEGRAM: query is too old`. Only `pm2 delete` + `pm2 start` applies the current ecosystem.config.js definition |
| `pm2 restart` does NOT reload .env.local | Bot deploy | Bot runs with stale env vars, may crash or misbehave |
| When the Emergency Manual Deploy fallback IS used, `pm2 start` MUST be the `bash -c` form with explicit `cd` to project directory; relative-path commands are forbidden | `infrastructure.md` Emergency Manual Deploy block, ADR [2026-04-22] PM2 cwd inheritance incident | PM2 may resolve relative paths against the operator's shell pwd before the daemon's cwd takes effect. Direct `pm2 start "node_modules/.bin/tsx ..."` from `/root` produces a crash-loop process in `/root` while the canonical entry in dump may simultaneously survive — two `jckauto-bot` processes online (incident 2026-04-22, ids 295/296/297). Always `cd /var/www/jckauto/app/jck-auto && pm2 start bash --name X --max-restarts 5 -- -c "cd <same dir> && exec <command>"`. Outside the Emergency block, this whole form is forbidden anyway by the ecosystem.config.js rule above |
| Anthropic API: calls ONLY from GitHub Actions runner | scripts/process-ai-pending.ts | 403 error from Russian VDS IP |
| DashScope runs from VDS (Singapore region) | dashscope.ts | No issue, just documenting the allowed path |
| serverExternalPackages: ['pdfkit'] in next.config.ts | next.config.ts | PDFKit ENOENT on Helvetica.afm if removed |
| New /catalog/* subcategory segments must be added to EXCLUDED_SEGMENTS | src/middleware.ts | Segment gets redirected to /catalog/cars/* (404) |
| After post-commit crash: first check GitHub Actions deploy log, NOT pm2 logs | deploy.yml / GitHub Actions | pm2 logs show symptom only; Actions log shows root cause (tsc/turbopack error) |
| `deploy.yml` builds into inactive slot (.next-a / .next-b) and atomically swaps symlink — do NOT revert to direct `.next/` build | deploy.yml | Direct build into active `.next/` causes ~100s of 500/502 errors while Next.js manifest files are partially written |
| `distDir` in `next.config.ts` MUST keep fallback `'.next'` — value is `process.env.NEXT_DIST_DIR \|\| '.next'` | next.config.ts | If fallback removed, `next start` without NEXT_DIST_DIR env var reads wrong directory → 500 on all routes |
| `deploy.yml` uses `npm ci` AND captures exit code via `if npm ci; then ... else NPM_EXIT=$?; fi` because npm 10.8.2 has a probabilistic reify exit code bug | deploy.yml | npm 10.8.2 in non-TTY context returns exit 1 after successful install when many platform-specific optional deps fail to reify (sharp, swc, oxide, resolver-binding — ~50 platform variants). The bug affects BOTH `npm install` and `npm ci` (originally believed `npm ci` was immune — disproven by deploys #74-#80, where 3 of 4 `npm ci` runs failed). The capture-via-if pattern lets us verify `node_modules/{next,react,sharp,@next/swc-linux-x64-gnu}` exist and continue if install actually succeeded despite false-positive exit code |
| Manual fallback for stuck deploys: `rm -rf node_modules && npm install --no-audit --no-fund` | VDS shell | Fresh install bypasses the npm 10.8.2 reify bug because it uses a different code path than incremental install. Used as emergency unblock when Actions is down |
| `deploy.yml` MUST NOT use `script_stop: true` on `appleboy/ssh-action`. Use `set -e` as first script line instead | deploy.yml | `appleboy/ssh-action` `script_stop: true` intercepts non-zero exit codes in places where POSIX bash errexit does NOT (inside `cmd \|\| fallback`, inside `if [ A ] && [ B ]; then`, inside `var=$(cmd1 \|\| cmd2)`). This makes any non-trivial bash script extremely fragile. Standard `set -e` follows POSIX correctly: `\|\|` chains, if-conditions, and command substitutions are protected. Empirically established over 5 failed deploys (#74-#80) before structural fix in #81 |
| `deploy.yml` echo markers `[wrapper] step N:` and `[build] step N:` are an observability contract — do NOT remove them | deploy.yml | These markers are the only way to localize failures inside `appleboy/ssh-action` where stderr is unreliable and `set -x` would explode log volume. Removing them sends the next failure back to the diagnostic blindness that cost 4 iterations (#74-#79). Add new markers when adding new steps; never remove existing ones |
| When writing bash for `appleboy/ssh-action` (even with `set -e`), prefer `if cmd; then` over `cmd \|\| fallback` for exit code capture | deploy.yml | The `if cmd; then ... else NPM_EXIT=$?; fi` form is more robust under any errexit-handling layer (appleboy or bash) because it is a single syntactic unit per POSIX. The `\|\|` form works under bash `set -e` but failed under `appleboy script_stop: true` — defensive coding for a script that runs in both contexts |
| `npm run build` on VDS MUST always use `NEXT_DIST_DIR` env var — only deploy.yml builds, and it uses two-slot mechanism | VDS shell, all workflows, all cron | Without NEXT_DIST_DIR, Next.js writes to `.next/` directly, destroying the symlink → site crash. sync-catalog.yml must NOT build (catalog is force-dynamic). Cron scripts must NOT build. Only deploy.yml builds via `NEXT_DIST_DIR="$NEXT_SLOT" npm run build` |
| deploy.yml has self-healing: if `.next` is a directory (not symlink), it auto-restores the two-slot setup before building | deploy.yml | Protects against any process that accidentally runs `npm run build` without NEXT_DIST_DIR. Logs `[build] WARNING` when triggered |
| Cloudflare Worker `tg-proxy` configuration MUST live in `worker/wrangler.toml` with `[placement] mode = "smart"` + `region = "gcp:europe-west1"` — NEVER edit the Worker in Cloudflare Dashboard | `worker/wrangler.toml`, `worker/tg-proxy.js`, `.github/workflows/deploy-worker.yml`, ADR `[2026-04-23] Cloudflare Worker tg-proxy moved to git + Placement Hints` | Dashboard edits are overwritten by the next `wrangler deploy` (auto-triggered on push to `worker/**`). Without `mode = "smart"`, Wrangler 3.90.0 fails with `"placement.mode" is a required field` and no deploy happens. Without `region = "gcp:europe-west1"` (or another explicit region hint), Smart Placement drifts to `local-DME` (Moscow origin edge) on single-source traffic, causing 19.6s outbound latency to `api.telegram.org`. Incident 2026-04-23: plain Dashboard-toggled Smart Placement (per old ADR [2026-04-20]) silently drifted back to `local-DME` 14 hours after a git pull; only the explicit Placement Hint region eliminated the drift vector. Verified production 2026-04-23: `cf-placement: local-ARN`, 0.193s latency. |

## Bot Rate Limiting Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| anonymous ip-key records MUST NEVER be deleted or reset — permanent lifetime counter | rateLimiter.ts ipMap | Deletion = user gets 3 free tries again = auth gate bypassed |
| checkBotLimit() MUST be called BEFORE any external API call or file read in bot handlers | botRateLimiter.ts | Spammer triggers disk I/O or AI calls before rate check |
| recordBotUsage() MUST be called AFTER successful sendMessage only — never in catch branches | botRateLimiter.ts | Failed requests consume AI cooldown quota |
| Bot ALWAYS calls Telegram API through TELEGRAM_API_BASE_URL (Worker), never api.telegram.org | All bot handlers, fileIdCache.ts | Provider blocks api.telegram.org — download/send fails |
| getTelegramIdFromCookie() MUST NEVER throw — all errors caught, returns undefined | api/tools/*/route.ts | Authenticated users fall through to anonymous quota on any JWT error |
| Bot photo handler stores file in memory only — never writes to disk | auctionSheet.ts | Temp files accumulate, VDS disk fills up |
| file_size check in auctionSheet.ts uses bot.getFile() result, NOT msg.photo[N].file_size | auctionSheet.ts | msg.photo[N].file_size is unreliable — oversized files pass check |
| botStats increment calls are void — never await them | All bot handlers | TypeScript error if awaited (functions return void, not Promise) |
| botStats increment calls go in success paths only — never in catch/error branches | All bot handlers | Failed commands counted as successful in /stats |
| External AI calls inside bot handlers MUST be wrapped in a per-call timeout (30s default) — unwrapped `await` or `Promise.allSettled` without timeout can hang the bot event loop, blocking message dispatch for ALL users | `src/bot/handlers/encar.ts` (withTimeout helper + Promise.allSettled arms), ADR `[2026-04-25] С-8 closed — 30s per-arm timeout on encar AI enrichment` | С-8 incident 2026-04-22: encar handler hung indefinitely because `Promise.allSettled([estimateEnginePower, translateEncarFields])` had no per-arm timeout. Only `pm2 delete + pm2 start` recovered. Handlers that route AI through the auction-sheet async queue already have their own timeout; this rule covers direct AI calls from handler code |
| Phone validity in bot lead flow MUST be checked via `normalizePhone`/`hasValidPhone` helpers in `src/bot/handlers/request.ts` — bare truthy checks on `user.phone` and ad-hoc digit-counts in entry-point handlers are the regression pattern that produced Б-6 | `src/bot/handlers/request.ts` (helpers + four entry points: `handleRequestCommand`, `bot.on("contact")`, `bot.on("message")`, post-`savePhone` `getUser` lookup), ADR `[2026-04-25] Б-6 closed — phone validation single source of truth` | Б-6 incident (March 2026, @danitsov case): legacy garbage in `users.json` (`" "`, `"+7"`, `""`) and unverified Telegram contact payloads reached operator group as `Телефон: не указан` or with malformed values. Lead-flow phone validity is now a single source of truth — adding any new code path that compares `user.phone` directly is a Б-6 regression |
| Submit-without-phone fallback in `request.ts` MUST require `msg.from.username` — without it, refuse the lead and explain how to set @username. NEVER send a without-phone lead with `Связь: не указан` because the operator has no way to contact the user | `src/bot/handlers/request.ts` (the `bot.onText(/📝 Без телефона/)` handler), ADR `[2026-04-25] Б-6/2 — submit-without-phone fallback (lead flow, half 2 of 2)` | The whole point of the without-phone path is that contact happens via @username. A lead with no phone AND no username is undeliverable — the operator would receive it but have no channel. The refusal message points the user at Telegram username settings and re-offers the phone path |
| Every lead attempt in `finishRequest` MUST be persisted via `appendLeadLog()` BEFORE `bot.sendMessage` to the operator group — the audit log is the single source of truth for "this lead existed", independent of Telegram delivery success | `src/bot/handlers/request.ts` (`appendLeadLog` helper writing JSON-line to `${STORAGE_PATH}/leads/leads.log`), ADR `[2026-04-25] Б-15 closed — lead audit log` | Б-15: Telegram delivery failures (rate-limit, network drop, deleted group) used to lose leads silently — user saw `✅ Заявка принята`, operator received nothing, no recovery path. Pre-send append-only log records every lead irrespective of delivery outcome. Helper is fail-open (FS errors swallowed to stderr) — never crash the bot for monitoring code |

## Code Standards

| Rule | Location | Consequence |
|------|----------|-------------|
| Every new file starts with @file header | All src/ files | Loss of context for future readers |
| Files >100 lines: use region comments | All src/ files | Hard to navigate large files |
| All UI text in Russian, code in English | Everywhere | Inconsistent UX / confusing codebase |
| Client components must NOT import fetchCBRRates | CalculatorCore, CustomsClient | CORS error — sravni.ru blocks browser requests |
| Client components fetch rates from /api/exchange-rates | CalculatorCore, CustomsClient | — |
| Bot calls fetchCBRRates() directly (server-side OK) | bot/handlers/calculator.ts | — |
| Acceptance-Criteria grep checks MUST exclude JSDoc/comment matches OR use precise patterns | All Claude Code prompts | A JSDoc line like `* @rule ensureUsersLoaded must be awaited` will match a naive `grep -n 'ensureUsersLoaded'` AC check, inflating the expected count and causing false "criterion met" reports. Use anchored patterns (`import.*\bX\b`, `\.X\(`, `export.*X`) or pipe through `grep -v '^\s*\*'` to exclude comment lines. Established 2026-04-21 during Prompt 2.4.SESSION-CLOSE follow-up. |

## UI Wording Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| Rate label: "Ориентировочный курс" (not "Курс ЦБ РФ") | All calculators + bot | Misleads users — rates include bank markup |
| Disclaimer must appear under every rate display | All calculators + bot | Users assume rate is exact, complain at deal time |
| BETA_MODE in BetaBadge.tsx controls all beta labels | components/BetaBadge.tsx | Set false → all badges disappear site-wide |
| Privacy page /privacy must contain Telegram Login Widget data section | privacy/page.tsx | BotFather domain verification fails without it; legal gap under 152-ФЗ |

## API Economy Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| Don't re-download files already on VDS | catalogSync.ts | Wasted bandwidth and API calls |
| Don't re-process data already in catalog.json | process-ai-pending.ts | Wasted Claude Vision credits |
| Cache results: rates (6h TTL), translation (24h TTL) | currencyRates.ts, encarClient.ts | Unnecessary API calls and latency |
| Compare hashes before downloading from Drive | googleDrive.ts | Re-downloads unchanged files |
| Text generation in content pipeline (article topics + article body) MUST use DeepSeek via `callDeepSeek` — `callQwenText` from `@/lib/dashscope` is BANNED at these call sites | `src/services/articles/topicGenerator.ts`, `src/services/articles/generator.ts`, ADR `[2026-04-24] Migrate article text generation to DeepSeek` | DashScope text-generation systematically times out from VDS on large requests. Reintroducing `callQwenText` here re-creates bug Б-12 (two-week blog outage). DashScope is still correct for image generation (`qwen-image-2.0-pro`) and image/OCR — the ban is scoped to text in the content pipeline |
| `src/lib/cronAlert.ts` MUST be fail-open — any error (network, timeout, HTTP non-2xx, missing env) is caught, logged to stderr, and swallowed. The helper MUST NOT throw | `src/lib/cronAlert.ts`, ADR `[2026-04-24] Cron alert helper — fail-open Telegram notification via Worker` | Monitoring code that crashes the thing it monitors is worse than no monitoring. A Telegram/Worker outage combined with a fail-loud alert helper would cascade into failed crons on top of whatever problem prompted the alert in the first place. Fail-open keeps failure surfaces independent |
| Cron scripts in `scripts/*.ts` MUST call `sendCronAlert` before `process.exit(1)` at every fatal exit site — silent crash without a Telegram signal is FORBIDDEN | `scripts/generate-article.ts`, `scripts/generate-news.ts`, ADR `[2026-04-24] Mutual heartbeat alerting for content-pipeline crons` | The Б-12 precedent: a silent crash produces no signal for weeks. Wiring the alert at every exit site (outer `main().catch` plus internal fatal catches) ensures the alert actually sends before the process dies. The `await` is mandatory — `process.exit` does not flush pending promises |
| Cron scripts SHOULD check staleness of the SIBLING cron's output artifact at startup — "check the other one, not yourself". A self-check inside a silent cron cannot fire | `scripts/generate-article.ts` (checks `storage/news/*.json`, 36h threshold), `scripts/generate-news.ts` (checks `content/blog/*.mdx`, 96h threshold), ADR `[2026-04-24] Mutual heartbeat alerting for content-pipeline crons` | Self-staleness check is blind to "cron never runs" class of failures (daemon down, crontab deleted, OOM before first log line). Sibling check moves the observation point outside the failing process. Staleness alert is `warning` severity — the live cron continues normally |
| Content routes rendering filesystem-backed data that updates between deploys (news, blog) MUST use ISR with `export const revalidate = 3600` — NOT SSG (invisible until deploy) and NOT force-dynamic (excess disk reads) | `src/app/news/page.tsx`, `src/app/news/[slug]/page.tsx`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, ADR `[2026-04-24] Blog ISR migration` | Pure SSG creates "invisible until deploy" failure mode (the exact class Б-12 exposed for the article pipeline). force-dynamic (as in `/catalog`) is for volatile per-request data like inventory, not for blog/news cadence. revalidate=3600 unifies the pattern across both content routes |

## Git & Prompt Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| Always specify branch in CONTEXT block of every Claude Code prompt | Every prompt | Claude Code creates a new branch instead of working in the target branch → merge conflict, extra PR, lost time |
| First command in every Claude Code session: `git checkout <branch> && git pull origin <branch>` | Every prompt CONTEXT block | Same as above |
| Any prompt modifying .ts/.tsx must include `npm run build` as acceptance criterion | Every prompt | Build errors (tsc/turbopack) are invisible until deploy → production crash |
| Prompts removing wrapper blocks must explicitly verify BOTH the opening AND closing brace are deleted | Every prompt | Stray closing brace at module scope → Turbopack parse error → site down |
| Git root (`app/`) ≠ project dir (`app/jck-auto/`) — legacy structure. Root `CLAUDE.md` redirects Claude Code to `cd jck-auto`. Until flattening is done, this redirect is the safeguard | `app/CLAUDE.md` + every prompt | Without root CLAUDE.md, Claude Code creates files in `app/` instead of `app/jck-auto/`. Flattening (moving jck-auto/ contents to git root) is the real fix — blocked by deploy.yml, cron, PM2, MCP, nginx path updates |
| Claude Code MUST report out-of-scope bug findings during prompt execution, NOT silently extend the scope — even when the additional fix is technically correct. Report in the AC report as "Found related issue in <file>, NOT fixed in this prompt — suggest follow-up prompt". The human reviewer decides whether to approve the extension. | Every prompt execution | Silent scope extension erodes reviewer control over changes. Over time the reviewer loses the ability to catch unintended side effects, because "Claude Code fixed it right" becomes the implicit expectation. Precedent set 2026-04-19 (`b4dc01d`) — that commit was correct in content but wrong in process. |

## Prompt Series & Deploy Safety

| Rule | Location | Consequence |
|------|----------|-------------|
| Auto-merge triggers on every push to `claude/**` — there is no batching, no staging, no label filter | `.github/workflows/auto-merge.yml` | Strategies like "single branch for a multi-prompt series with intermediate broken state" do NOT protect production. Each prompt's push lands in main immediately. On 2026-04-19, series 02–05 shipped blank h2 headings to production on 3 pages for ~40 minutes between Prompt 02 and Prompt 05. Plan prompt series with this in mind — see decisions.md `[2026-04-19] Prompt-series strategy under auto-merge + ignoreBuildErrors` |
| `typescript: { ignoreBuildErrors: true }` + required prop + missing consumer = silent blank render at runtime | `next.config.ts` | TypeScript errors do NOT block `npm run build`, so a missing required prop at a consumer call site passes CI but causes the component to receive `undefined` at runtime, rendering JSX expressions as empty strings / blank DOM nodes. Standard build-green check does not catch this regression class. Mitigation options are documented in decisions.md (same ADR as above) |

## Process Discipline

| Rule | Location | Consequence |
|------|----------|-------------|
| Mid-series bug fixes MUST use `@fix YYYY-MM-DD` code marker above the fixed line in the format: `// @fix YYYY-MM-DD: was <old>, correct <new>. <Why/context>. Discovered during <prompt>. ADR pending in <series finalization prompt>.` Marker lives in code permanently | Any file with mid-series bug fix; first precedent: `src/bot/lib/inlineKeyboards.ts` above `noscutResultButtons()` URL line (2026-04-23); ADR `[2026-04-23] Series 2.4 complete` | Without `@fix` marker, the future reader of the code sees an unexplained value and may "clean it up" to what seems canonical, re-introducing the bug. Marker also enables `grep -rn "@fix" src/` for archaeology. bugs.md is NOT used for same-commit fixes — discipline lives in the code + commit + ADR |
| Files under active series transformation MUST carry `@series N.M (prompt N.M.K) — <description>` marker in their JSDoc header, immediately after `@lastModified`. Forward-only: prior-migrated files are NOT back-filled. Marker is REMOVED in the series finalization prompt | Handler files in `src/bot/handlers/**` during Series 2.4; first use: `src/bot/handlers/noscut.ts` (2.4.6, removed in 2.4.7); ADR `[2026-04-23] Series 2.4 complete` | Marker provides inline context for "why is this file being touched outside a standalone bug fix". If not removed in finalization, lifetime contract is broken and future readers see stale "work in progress" annotations on closed work. Forward-only: back-filling misrepresents closed work as in-progress |
| Prompt-based commits MUST follow Conventional Commits format: subject ≤72 chars + blank line + body. Compound commits (primary action + secondary changes) MUST detail all changes in body, not just subject. Trailing "Series N.M progress: X/Y" line recommended for series work | Every commit produced by a Claude Code prompt; first structured example: commit `cba938b` (2.4.6); ADR `[2026-04-23] Series 2.4 complete` | Short subjects are scan-friendly in `git log --oneline`. Body captures archaeological context unavailable elsewhere — compound commits with only subject text lose half their content to future archaeology (e.g. `git bisect` on a subject saying "refactor" will not reveal an embedded bug fix). Body is the only permanent record not subject to knowledge file churn |

## UI Component Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| `<LeadFormTrigger triggerVariant>` MUST match the surrounding background: `"primary"` or `"outline"` on light/neutral bg; `"on-primary"` (white fill + primary text) on `bg-primary` (or any coloured) section. Never use `"outline"` on `bg-primary` — text-primary on bg-primary is invisible. When adding a new variant, extend the `switch` in `LeadFormTrigger.tsx` AND the `triggerVariant` union type; the `_exhaustive: never` check will break the build if a case is missed | `src/components/LeadFormTrigger.tsx`, all consumers in `/tools/*`, `/catalog/*`, `/news/*` | Invisible CTA button — users see only the secondary "Позвонить" link, lead flow collapses silently. C-3 shipped in production for weeks before being noticed |

## Architecture Rules

- **Auction-sheet pipeline lives in exactly one place.** The SYSTEM_PROMPT,
  the three OCR prompts, the classifier prompt, the parse prompt, and the
  pipeline function itself live ONLY in `src/lib/auctionSheetService.ts`.
  Duplication in `src/bot/**`, `src/app/api/**`, or any other file is
  FORBIDDEN. Any caller that needs the pipeline imports
  `runAuctionSheetPipeline` from the service and enqueues through the
  shared `auctionSheetQueue` (concurrency=1, FIFO).
- **Bot result inline-keyboards live in exactly one place.** The
  keyboards shown below AI-analysis or calculation result messages in
  `src/bot/handlers/**` MUST be built through the helpers exported
  from `src/bot/lib/inlineKeyboards.ts`
  (`siteAndRequestButtons`, `siteRequestAndAgainButtons`,
  `noscutResultButtons`). Direct literal `inline_keyboard: [...]`
  objects for result messages are FORBIDDEN — they cause the text
  drift that the 2026-04-21 audit revealed. Navigation and wizard-step
  keyboards (catalog paging, customs wizard) are NOT covered — only
  terminal result messages.

## Noscut Business Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| Market price line shown ONLY when marketPriceRu > priceFrom | [slug]/page.tsx, NoscutCard.tsx | Otherwise page shows "we are more expensive than market" |
| No Telegram links in page body — only header, footer, floating button | All noscut components | Breaks lead funnel — user leaves site instead of filling form |
| Wholesale CTA audience: B2B broadly (dealers, resellers, fleet) — NOT "СТО" only | [slug]/page.tsx | Undersells wholesale channel |
| deliveryConfig.ts: Vladivostok excluded (company location) | deliveryConfig.ts | Illogical to list home city as delivery destination |
| Image prompts: NEVER request text, numbers, labels or callouts | generate-noscut.ts | Diffusion models produce unreadable garbage text in images |
| Price research: ask for SUM of 6 individual parts, NOT "noscut kit" price | update-noscut-prices.ts | "Noscut" keyword finds used parts at 100–180k — lower than our price |
