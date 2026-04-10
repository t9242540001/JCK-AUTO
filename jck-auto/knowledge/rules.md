<!--
  @file:        knowledge/rules.md
  @project:     JCK AUTO
  @description: All critical rules with locations and consequences of violation
  @updated:     2026-04-10
  @version:     1.7
  @lines:       90
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

## Code Standards

| Rule | Location | Consequence |
|------|----------|-------------|
| Every new file starts with @file header | All src/ files | Loss of context for future readers |
| Files >100 lines: use region comments | All src/ files | Hard to navigate large files |
| All UI text in Russian, code in English | Everywhere | Inconsistent UX / confusing codebase |
| Client components must NOT import fetchCBRRates | CalculatorCore, CustomsClient | CORS error — sravni.ru blocks browser requests |
| Client components fetch rates from /api/exchange-rates | CalculatorCore, CustomsClient | — |
| Bot calls fetchCBRRates() directly (server-side OK) | bot/handlers/calculator.ts | — |

## UI Wording Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| Rate label: "Ориентировочный курс" (not "Курс ЦБ РФ") | All calculators + bot | Misleads users — rates include bank markup |
| Disclaimer must appear under every rate display | All calculators + bot | Users assume rate is exact, complain at deal time |
| BETA_MODE in BetaBadge.tsx controls all beta labels | components/BetaBadge.tsx | Set false → all badges disappear site-wide |

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

## Noscut Business Rules

| Rule | Location | Consequence |
|------|----------|-------------|
| Market price line shown ONLY when marketPriceRu > priceFrom | [slug]/page.tsx, NoscutCard.tsx | Otherwise page shows "we are more expensive than market" |
| No Telegram links in page body — only header, footer, floating button | All noscut components | Breaks lead funnel — user leaves site instead of filling form |
| Wholesale CTA audience: B2B broadly (dealers, resellers, fleet) — NOT "СТО" only | [slug]/page.tsx | Undersells wholesale channel |
| deliveryConfig.ts: Vladivostok excluded (company location) | deliveryConfig.ts | Illogical to list home city as delivery destination |
| Image prompts: NEVER request text, numbers, labels or callouts | generate-noscut.ts | Diffusion models produce unreadable garbage text in images |
| Price research: ask for SUM of 6 individual parts, NOT "noscut kit" price | update-noscut-prices.ts | "Noscut" keyword finds used parts at 100–180k — lower than our price |
