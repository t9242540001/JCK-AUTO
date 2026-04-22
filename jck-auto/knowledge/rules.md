<!--
  @file:        knowledge/rules.md
  @project:     JCK AUTO
  @description: All critical rules with locations and consequences of violation
  @updated:     2026-04-22
  @version:     1.16
  @lines:       144
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
| All PM2 process startup MUST go through committed `ecosystem.config.js` via `pm2 startOrReload ecosystem.config.js --only <name>`. Raw `pm2 start <bash> --name X -- -c "…"` is FORBIDDEN | `ecosystem.config.js`, `deploy.yml`, ADR [2026-04-22] Move PM2 process management to committed ecosystem.config.js | Hand-typed `pm2 start` flags create a third copy of process definitions (alongside `~/.pm2/dump.pm2` and `infrastructure.md`) — the three drift, causing the 2026-04-22 PM2 cwd incident (duplicate jckauto-bot processes, ids 295/296/297) and Б-11 (mcp-gateway losing FILESYSTEM_ROOTS env on raw restart). The ecosystem file holds `cwd`, `script`/`args`, `env`, and `max_restarts` declaratively; every reload re-applies them. To change a process's startup, edit `ecosystem.config.js` AND deploy in the same commit |
| `pm2 restart jckauto-bot` and `pm2 restart mcp-gateway` are FORBIDDEN — use `pm2 startOrReload ecosystem.config.js --only <name>` instead | All deploy/restart scripts, ADR [2026-04-22] Move PM2 process management to committed ecosystem.config.js | `pm2 restart` does NOT re-read env from any source — it only re-spawns `pm_exec_path` with the env snapshot saved at start time. Bot loses `.env.local` reload (existing rule); mcp-gateway loses `FILESYSTEM_ROOTS` (Б-11). `pm2 startOrReload <ecosystem-file>` re-spawns from the committed config, applying current env on every call |
| `pm2 restart` does NOT reload .env.local | Bot deploy | Bot runs with stale env vars, may crash or misbehave |
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
| Cloudflare Worker `tg-proxy` MUST have Placement mode set to **Smart**, not Default | Cloudflare Dashboard → Workers & Pages → tg-proxy → Settings → Runtime → Placement | Default placement puts the Worker on a Cloudflare edge whose upstream path to `api.telegram.org` may be degraded, causing every bot outbound call to wait ~20 seconds. Observed 2026-04-20: direct `curl` to Worker `/getMe` took 19.785s on Default, 0.227s on Smart. Full diagnosis in ADR `[2026-04-20] Enable Cloudflare Smart Placement on tg-proxy Worker`. |

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
