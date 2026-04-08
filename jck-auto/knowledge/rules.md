<!--
  @file:        knowledge/rules.md
  @project:     JCK AUTO
  @description: All critical rules with locations and consequences of violation
  @updated:     2026-04-08
  @version:     1.0
  @lines:       64
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
