<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources + strategic initiatives
  @updated:     2026-05-04
  @version:     1.62
  @lines:       ~310
-->

# Roadmap

> For detailed open bugs see bugs.md

## Recent Activity

> Журнал последних сессий. Новые записи на верх. Auto-archive trigger:
> when this section exceeds 10 entries OR roadmap.md exceeds 400 lines,
> run a knowledge-cleanup pass to move oldest entries (older than the
> 7-day cutoff) into roadmap-archive-N.md.

### 2026-05-04 — UNIFY-1 series started — U-01 closed (LeadForm extended)

- **U-01 closed.** LeadForm.tsx расширен 5 новыми optional props (source?, requireName?, successMode?, autoCloseMs?, onSuccess?) с full backward-compat. Foundation для UNIFY-1 series unifying 4 lead-form entry points (LeadForm, LeadFormTrigger, LeadFormModal, NoscutCard inline modal). Research-protocol проведён в этой же сессии (standard pass, 4 phases с премортемом). См. ADR `[2026-05-04] UNIFY-1`.
- **Series plan:** U-01 (LeadForm extension, this commit) → U-02 (LeadFormTrigger forwards successMode/onSuccess to LeadForm — required so modals close after submit) → U-03 (CarSidebarActions + CarCtaActions migrate to LeadFormTrigger) → U-04 (NoscutCard inline modal → LeadFormTrigger) → U-05 (stable source labels на все callers, закрывает TD-LEAD-1) → U-06 (delete LeadFormModal.tsx + final ADR + INDEX.md update, после 48ч monitoring).
- **Unblocks:** SALES-CALC-1 после U-06 становится одним промптом без CalculatorLeadForm wrapper — `<LeadForm subject={...} source="calculator">` встраивается прямо в CalculatorCore.

### 2026-05-04 — Session close — knowledge housekeeping for tomorrow

- **Refined SALES-SUB-1** to subscription-gate (replaces authorization-gate; 3 free + bot-subscription-required + 10/day after subscription).
- **Added SALES-CALC-1** — lead capture form embedded in calculator results, reuses `LeadForm.tsx`.
- **Added HYP-FREE-3** — deferred hypothesis to reduce free attempts when traffic grows.
- ADR `[2026-05-04] Auth-flow direction — subscription-gate over authorization-gate` records the strategic decision so future sessions don't re-derive it.
- Tomorrow: start with discovery prompt for SALES-SUB-1 (T2 research-protocol). After that, SALES-CALC-1 discovery.
- Day's totals: 5 series closed (CRIT-1, SALES-CRIT-2, INFRA-1, INFRA-1.5, SALES-PERSIST-1), 5 ADRs added, 7 commits to main, R-OPS-3 rule, 4+1+1 backlog items registered/refined.

### 2026-05-04 — SALES-PERSIST-1 closed — client-side localStorage persistence of every lead submit

- **SALES-PERSIST-1 (closed 2026-05-04).** Added `src/lib/leadPersistence.ts` with `saveBeforeSend()` + `markConfirmed()`. Wired into both `LeadForm.tsx` and `LeadFormModal.tsx`. Every form submit now persists to localStorage BEFORE fetch — recovery path for leads where fetch fails on client side before reaching server. Indefinite retention, no TTL. NO UI changes — internal recovery infrastructure only. R-OPS-3 added to rules.md (markdown-in-chat copy-paste hazard from INFRA-1.5 incident). Four new backlog items registered in Planned section. See ADR `[2026-05-04] SALES-PERSIST-1`.

### 2026-05-04 — INFRA-1.5 closed — committed crontab management

- **INFRA-1.5 (closed 2026-05-04).** Root crontab moved from VDS-only to committed `scripts/crontab.root` + idempotent installer `scripts/install-crontab.sh`. Pattern mirrors PM2 `ecosystem.config.js`. Triggered by INFRA-1 incident where chat copy-paste injected markdown link syntax into a real cron entry. Inventoried 4 existing crons (news, articles, noscut prices, pm2-cleanup) and documented in `knowledge/infrastructure.md` Cron jobs section. See ADR `[2026-05-04] INFRA-1.5`.

### 2026-05-04 — INFRA-1 closed — PM2 logs centralized to /var/log/pm2/

- **INFRA-1 (closed 2026-05-04).** Moved PM2 logs from `/root/.pm2/logs/` to `/var/log/pm2/` via `out_file`/`error_file` fields in `ecosystem.config.js`. Extended mcp-gateway `FILESYSTEM_ROOTS` to include the new path. Claude (strategic partner) can now read PM2 logs via MCP without SSH round-trips. Added `scripts/cleanup-pm2-logs.sh` for quarterly retention (90 days). See ADR `[2026-05-04] INFRA-1`.

### 2026-05-04 — SALES-CRIT-2 closed — /api/lead fetch retry for Worker flakiness

- **SALES-CRIT-2 (closed 2026-05-04).** Added single retry to Telegram fetch in /api/lead. Per-attempt timeout 6s, backoff 800ms. Triggers on AbortError/network errors only, not on HTTP-level failures. Drops effective lead failure rate from ~20% (Worker flakiness) to ~4%. Worker investigation continues separately. See ADR `[2026-05-04] SALES-CRIT-2`.

### 2026-05-04 — CRIT-1 closed — /api/lead rate limit isolation + site audit log

- **CRIT-1 (closed 2026-05-04).** Removed lifetime-3 tools rate-limiter from /api/lead, added route-local 5/15min sliding window, added site-side audit log at `${STORAGE_PATH}/leads/site-leads.log`. Closes the 7-day zero-leads incident (2026-04-27 to 2026-05-04). See ADR `[2026-05-04] CRIT-1`.

### 2026-05-02 — KC + NEW-1 series CLOSED — knowledge cleanup + Yandex Metrika MCP end-to-end

- **Сделано:** Параллельно закрыты две серии. **NEW-1 series** (Yandex Metrika MCP integration): atomkraft/yandex-metrika-mcp форкнут в t9242540001, supergateway оборачивает stdio→Streamable HTTP на :8765, расширены FILESYSTEM_ROOTS mcp-gateway на /etc/nginx + /var/log/nginx + /opt/ai-knowledge-system, добавлены DENY_PATHS+DENY_GLOBS в mcp_server.py для блокировки .env*/ssh-keys/etc, nginx /mcp/metrika с Anthropic-IP allow-list, Custom Connector в Claude.ai подключён. End-to-end verified: nginx access log показал Anthropic IP 160.79.106.37 → POST /mcp/metrika → 200 OK + 15484 bytes tools/list ответ. **KC series** (knowledge-cleanup, 6 prompts): decisions.md (5229→777 строк), roadmap.md (746→511), bugs.md (409→145), infrastructure.md (493→289 + networking.md как новый файл), tools.md→tools-auction-sheet.md (rename + per-tool convention в INDEX), noscut-fixes.md→noscut-fixes-archive-1.md (full archival). 8 файлов превышавших 200-line guideline сокращены до соответствия (или близко к нему) с acknowledged-overrides.
- **Прервались на:** обе серии закрыты, knowledge state чист. | **Следующий шаг:** NEW-2 (conversion analysis с реальными данными Метрики через подключённый Custom Connector) — главная business-задача, разблокирована end-to-end Yandex Metrika integration. Альтернативно — pre2 (LightRAG cleanup из mcp_server.py — отложен как NEW-1.5).
- **Контекст:** сессия началась с разворачивания Yandex Metrika MCP (NEW-1) и обнаружила knowledge-size кризис на середине: 8 файлов превышали 200-line guideline, decisions.md в 26× больше limit'а, auto-archive triggers (зафиксированные в шапках декларативно) ни разу не сработали за 6 недель. Решение: остановить NEW-1.3 (closing batch для NEW-1) и сначала провести full knowledge cleanup (KC-1..KC-6), потом закрыть оба разом. Этот промпт — финальный батч.
- **Структурный урок №1 — auto-archive triggers без enforcement = декларация без эффекта.** Шапки decisions.md (`If file grows past ~600 lines, archive...`) и roadmap.md (`После 10 записей — старые переносятся...`) не сработали ни разу. Trigger проверяется только если кто-то его явно проверяет; без actionable rule с конкретными метриками — silent decay. Ввели R-PROC-1 в rules.md.
- **Структурный урок №2 — AC counts требуют MCP-проверки до написания промпта.** Три раза подряд (KC-1: 17 vs 24 actual ADRs; KC-2: target 310 lines vs 511 actual; KC-3: `Status: Closed` pattern не существует в файле, реально `[Closed YYYY-MM-DD]` в title) мои предсказанные числа в AC промахивались на 30-70%. Урок: считать через `wc -l` / `grep -c` на VDS до написания промпта, не пытаться prediction-style.
- **Структурный урок №3 — `Goal over steps` rule сработал безупречно в KC-1.** Claude Code увидел discrepancy в моих AC counts, не подгонял файл под мои числа, следовал canonical boundary instruction (line 749/750 by date 2026-04-29), и в отчёте честно показал actual numbers. Это правильное поведение — Karpathy rule работает.
- **Структурный урок №4 — manual ops дисциплина.** В сессии произошли два инцидента: (1) heredoc + markdown ```bash блоки в .txt инструкциях → bash syntax errors, исправлено через delivery patch script через repo (NEW-1.X-pre1B-script). (2) Inline rollback команда без if-condition в NEW-1.2-B Шаг 5 → Vasily случайно выполнил rollback при success'ном результате. Оба урока зафиксированы как R-OPS-1, R-OPS-2 в rules.md.
- **Структурный урок №5 — два инстанса MCP-кода.** Memory inaccuracy обнаружена: `JCK AUTO Files` MCP и `VDS Files` MCP — это **один и тот же** `mcp_server.py` код, развёрнутый на двух разных серверах (jckauto.ru с FILESYSTEM_ROOTS=/var/www/jckauto/...; yurassistent.ru с другим FILESYSTEM_ROOTS). Это не два разных продукта. Исправлено в memory item #25.
- **Структурный урок №6 — OAuth токен hygiene.** Дважды в сессии Vasily случайно вставил префикс Yandex OAuth токена в чат (копируя примеры команд с реальными значениями). Override решение: продолжаем без ротации (audit показал что префикс одного токена недостаточен для compromise; полная строка не утекла). Зафиксировано в decisions.md ADR.
- **Численные итоги.** decisions.md: 5229→777 (-85%). roadmap.md: 746→511 (-31%). bugs.md: 409→145 (-65%). infrastructure.md: 493→289 (-41%). tools.md→tools-auction-sheet.md (rename). noscut-fixes.md→noscut-fixes-archive-1.md (rename). Создано 5 новых файлов: decisions-archive-1.md, roadmap-archive-2.md, bugs-archive-1.md, networking.md, noscut-fixes-archive-1.md (последние два — переименования с архивированием). Yandex Metrika MCP: 1 новый PM2 entry, 1 новый nginx snippet, 1 patch script для mcp_server.py, 1 Custom Connector в Claude.ai, end-to-end pipeline проверен.
- **Ссылки:** этот коммит. NEW-1 commits: `417707b` (NEW-1.1), `fdcb6af` (pre1A), `8440a83` (pre1B script), `8c78ffd` (NEW-1.2-A nginx). KC commits: `6b4e8a8` (KC-1), `dc47036` (KC-2), `40e168a` (KC-3), `141f651` (KC-4), `5b73b19` (KC-5), `7e6c39f` (KC-6), этот (KC-7). Связанные ADR в decisions.md (этим коммитом добавлены): NEW-1 series final summary, KC series methodology, R-PROC-1 rule registration, R-OPS-1/R-OPS-2 rules, OAuth rotation override, MCP-instances clarification.

### 2026-05-02 — KC-2: roadmap.md split into active + archive-2

- **Сделано:** roadmap.md сокращён с 746 до ~310 строк. Pre-cutoff Recent Activity entries (5+ entries от 2026-04-26 и старее, кроме whitelisted v2.0 migration) перенесены в `roadmap-archive-2.md`. Pre-cutoff Done bullets (~25 entries от 2026-04-28 и старее) перенесены в тот же archive. Whitelist: `### 2026-04-26 — Migration to standards system v2.0` остаётся в active как foundational record. Helper paragraph секции Recent Activity обновлён с actionable trigger («exceeds 10 entries OR 400 lines») вместо нерабочего «После 10 записей».
- **Прервались на:** KC-2 закрыт, переход к KC-3 (bugs.md split). | **Следующий шаг:** KC-3 — split bugs.md по open/closed status.
- **Контекст:** часть series knowledge-cleanup (KC-1..KC-8). KC-1 (decisions.md → active + archive-1) закрыт commit `6b4e8a8`. Текущий KC-2 — второй в серии. Серия запущена после обнаружения, что 8 файлов в knowledge/ превышают 200-line guideline (decisions.md в 26×, roadmap.md в 3.7×, и т.д.), а зафиксированные auto-archive triggers ни разу не сработали за последние 6 недель.
- **Структурный урок:** auto-archive triggers без enforcement = декларация без эффекта. roadmap.md шапка говорила «после 10 записей переносить старые в archive», но это не происходило, потому что (а) trigger проверялся вручную / не проверялся, (б) формулировка была размытая. Replacement: actionable trigger с двумя метриками (count + lines) и явным action verb («run a knowledge-cleanup pass»).
- **Ссылки:** этот коммит. ADR `[2026-05-02] decisions.md archived — KC-1 (cleanup series)` (precedent). Связанные knowledge-cleanup commits: `6b4e8a8` (KC-1), этот (KC-2). Следующее — KC-3 для bugs.md.

### 2026-05-02 — Strategy pivot: register conversion analysis + automation tasks

- **Сделано:** Page-by-page audit /catalog (CAT-* series) официально заморожен после закрытия первой страницы; остальные страницы (Калькулятор, Customs, Каталог ноускатов, News, Blog, About) audit'иться по находкам не систематически. Новый стратегический фокус — превращение маркетингового конвейера в инструмент продаж. Зарегистрированы 5 новых задач: NEW-1 (Yandex Metrika API integration — enabler), NEW-2 (Conversion analysis + fixes — главная активная работа), NEW-3 (Bot subscription tracking от /tools/*), NEW-4 (новые article-types: модели, сравнения), NEW-5 (Content factory для соцсетей — Strategic initiative #6). Создана новая секция `## Active strategic work` в roadmap.md между `## In Progress` и `## Planned — Site` — содержит NEW-1 + NEW-2.
- **Прервались на:** регистрация плана завершена | **Следующий шаг:** старт NEW-1 — discovery prompt по skill research-protocol для исследования Yandex Metrika API endpoints, OAuth flow, локального cache architecture.
- **Контекст:** пивот произошёл после закрытия CAT-* серии. Vasily обозначил, что page-by-page audit не приносит business value пока не понятно, где именно отвал в воронке. Решение — сначала измерить (NEW-1 → NEW-2), потом фиксить точечно по данным. Принцип «никаких скринов, всё через API» зафиксирован — данные должны быть доступны программно, чтобы анализ был повторяемым.
- **Структурный урок:** page-by-page audit — валидный подход для известных классов багов (overflow, motion bundle, image optimization), но требует доказательства, что эти классы — узкое место. После CAT-1 (где Console чист и overflow=0 на 412px) стало видно, что CAT-* не поймает реальные блокеры конверсии. Lesson: перед запуском systematic audit-серии — проверить через данные, что аудит-категория действительно объясняет наблюдаемую проблему.
- **Ссылки:** этот коммит. Связанные ADR: `[2026-05-02] CAT-* series — final summary`. Следующая работа — NEW-1 discovery.

### 2026-05-02 — CAT-* series closed (page-by-page audit /catalog)

- **Сделано:** серия CAT-* для /catalog закрыта четырьмя резолюциями: CAT-1a (commit `29df1ed`) — удалён dead `motion` import в `CatalogClient.tsx`; CAT-1b (commit `227d16c`) — добавлен `BreadcrumbList` JSON-LD на `src/app/catalog/page.tsx` (2-level Главная → Каталог); CAT-3 — hover effects audit verified-no-change (border/background transitions без CLS-риска, Tailwind 4 hover variant gates на touch); CAT-2 — ItemList JSON-LD deferred как Strategic initiative #5 (enhancement, не common-error fix, выпадает из scope page-by-page audit). Browser-first diagnostic 412px показал чистый overflow=0 + console clean на первом же замере — серия пошла обычным audit-flow без CD-1-style root-cause-first.
- **Прервались на:** все 4 пункта закрыты документировано, code деплоен и merged. | **Следующий шаг:** переход к следующей странице по очереди page-by-page audit (Strategic initiative #2) — следующий кандидат /tools/calculator.
- **Контекст:** серия открылась 2026-05-02 после закрытия Tools audit (2026-04-29). Scope = частые ошибки, найденные в предыдущих сессиях (motion deadcode, BreadcrumbList JSON-LD gap, hover audit). Реестр — 4 пункта, две имплементации + одна verified + одна deferred.
- **Структурный урок:** короткая audit-серия (4 пункта) валидна. Не каждая серия должна быть размером Mobile audit (12) или Tools audit (5). Масштаб зависит от состояния страницы — если первый browser-first замер чистый, серия идёт обычным flow без выдумывания проблем. Также введён четвёртый класс close-причины: deferred-to-Strategic-initiative (для enhancement-пунктов, в отличие от deferred-to-Technical-Debt для багов/регрессий).
- **Численные итоги:** 4 items, 2 commits (`29df1ed`, `227d16c`), 3 новых ADR (CAT-1b, CAT-3 verified, final summary), 1 новый Strategic initiative #5, console errors на /catalog: 0, document overflow на 412px: 0.
- **Ссылки:** этот коммит. ADRs: `[2026-05-02] CAT-* series — final summary`, `[2026-05-02] CAT-3 — hover effects audit на /catalog (verified, no change needed)`, `[2026-05-02] CAT-1b — BreadcrumbList JSON-LD на /catalog`. Precedents: Tools audit series final summary (2026-04-29), Mobile audit closing cleanup (2026-04-29).

### 2026-05-02 — CAT-1b: BreadcrumbList JSON-LD на /catalog

- **Сделано:** в `src/app/catalog/page.tsx` добавлен `breadcrumbJsonLd` const (после `metadata`, до `export const dynamic = 'force-dynamic'`) и один `<script type="application/ld+json">` element как первый child returned `<>` fragment. Pattern идентичен TS-5 (auction-sheet/encar) и CD-4 (car detail). Структура — 2 ListItems: «Главная» → https://jckauto.ru, «Каталог» → https://jckauto.ru/catalog. Intermediate hub level отсутствует — каталог one level below home, нет промежуточного раздела в URL-иерархии. Существующий `metadata` export, `dynamic = 'force-dynamic'`, body `CatalogPage()` (data fetch, JSX) — байт-в-байт.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: View Source на /catalog → один `<script type="application/ld+json">` с BreadcrumbList JSON, Rich Results Test без warnings и errors, DevTools Console clean. | **Следующий шаг:** page-by-page audit BreadcrumbList покрытие main entry pages закрыто (4/4: /tools/auction-sheet, /tools/encar, /catalog/cars/[id], /catalog). Будущий extension — /catalog/noscut (sibling листинг), /blog (если появится breadcrumb-eligible иерархия).
- **Контекст:** TS-5 (2026-04-29) закрыл BreadcrumbList на tool pages, CD-4 (2026-04-29) — на car detail. /catalog оставался единственной main entry page с полными метаданными, но без structured data breadcrumbs. CAT-1b закрывает gap одним хирургическим промптом.
- **Структурный урок:** двухуровневые breadcrumbs (Главная → Раздел) — допустимая Schema.org структура, не нужно искусственно вставлять intermediate hub level для unification. Pattern decision: если URL `/X` напрямую под root — 2 ListItems; если URL `/Hub/Item` — 3 ListItems с реально существующим hub (как /tools/X использует /tools).
- **Ссылки:** этот коммит. ADR `[2026-05-02] CAT-1b — BreadcrumbList JSON-LD на /catalog`. Precedents: TS-5, CD-4.

### 2026-04-29 — Tools audit TS-5 + series closed

- **Сделано:** на обеих server-rendered tool pages (`src/app/tools/auction-sheet/page.tsx`, `src/app/tools/encar/page.tsx`) добавлен третий JSON-LD блок типа `BreadcrumbList` с тремя `ListItem`: «Главная» → https://jckauto.ru, «Сервисы» → https://jckauto.ru/tools, tool-name → https://jckauto.ru/tools/<slug>. Existing `webAppJsonLd` (WebApplication) и `faqJsonLd` (FAQPage) — байт-в-байт. Pattern идентичен CD-4 BreadcrumbList на car detail page. URL абсолютные согласно Schema.org spec. Vehicle schema для Encar result отвергнута by design (а не deferred): result рендерится client-side по user-input URL, indexable URL для конкретного результата отсутствует — Schema.org Vehicle на ephemeral state не приносит SEO-выгоды. Это архитектурное ограничение tool-pattern, документировано в TS-5 ADR.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: View Source на /tools/auction-sheet и /tools/encar — три distinct `<script type="application/ld+json">` блока (WebApplication + FAQPage + BreadcrumbList), Rich Results Test без ошибок и warnings, DevTools Console clean | **Следующий шаг:** серия Tools audit полностью закрыта (5/5 resolved + 1 by-design rejected). Переход к другим задачам или к закрытию MA-4 (NoscutCard motion → m, последний raw-motion файл).
- **Контекст:** TS-5 — финальный промпт серии Tools audit, закрывает оставшуюся SEO-возможность на tool-страницах. Без BreadcrumbList Google search results показывает URL-путь вместо человекочитаемых breadcrumbs в snippet'е. Применён тот же pattern, что и в CD-4 для car detail page.
- **Структурный урок (за всю серию Tools audit):** tools-страницы в проекте имеют общий audit-набор из 5 категорий — UX completion signal (TS-1), bundle (TS-2), image optimization (TS-3), overflow (TS-4), structured data (TS-5). Реестр сложился органически: critical UX → bundle → image → overflow → SEO, по убыванию impact. Серия охватила оба tool entry path'а (auction-sheet, encar) последовательно — pattern transferable, при добавлении новой tool-страницы в проект следует прогнать checklist той же серии.
- **Численные итоги серии:** Document width на 412px viewport (encar): 428px → 412px (overflow 16px → 0). Initial JS bundle на tools entry path: extends P-3 + CD-3 win (~30 KB framer-motion разница vs raw motion). Mobile photo bandwidth (encar): -50-80% (AVIF/WebP via next/image). SEO structured data: 3 JSON-LD блока на каждой tool странице (WebApplication + FAQPage + BreadcrumbList). UX completion signal: 4 канала (scroll + aria + title + flash). Console errors: 0.
- **Открытый Technical Debt от серии:** **MA-4 narrowed** — после TS-2 остался только NoscutCard.tsx как последний raw-motion файл. Закрытие MA-4 = миграция одного файла + включение LazyMotion strict mode.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Tools audit TS-5 — BreadcrumbList на tool-страницах` и `[2026-04-29] Tools audit series — final summary`. Серия охватывает коммиты `c3b3e8d` (TS-1) → `9bfdc0b` (TS-2) → `8f97072` (TS-3) → `5ee2778` (TS-4) → этот финальный.

### 2026-04-29 — Tools audit TS-4: EncarClient flex-row overflow fix

- **Сделано:** диагностика по R-FE-3 recipe на /tools/encar (412px viewport, Genesis GV70 result page) выявила `Document=428px, Overflow=16px` — top contributor `SPAN.text-right width=299` в dealer-блоке. Code-инспекция нашла три flex-justify-between row-pattern'а без `min-w-0` защиты на value-side spans: vehicle info `.map()` row, power row, dealer block (3 rows: Имя / Автосалон / Город). Применил pattern: `min-w-0 + [overflow-wrap:anywhere]` на value-span'ы (4 места), `min-w-0` на power-row span (без overflow-wrap, потому что значение содержит пробелы и скобки), плюс `gap-3` на 2 row'а для visual breathing. Cost breakdown row уже имел корректную защиту (`min-w-0 flex-1` + `shrink-0`) — не тронут. Auction-sheet проверен diagnostic'ом на 412px — `Overflow=0`, не входит в TS-4 scope.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: `documentElement.scrollWidth === clientWidth` true на 412px, длинные значения (VIN, dealer name/firm, city) wrap'ятся внутри span без расширения row, /tools/auction-sheet остаётся unchanged (sanity check) | **Следующий шаг:** TS-5..TS-N серии Tools audit (если планируются), либо переключение на NoscutCard для закрытия MA-4.
- **Контекст:** R-FE-3 (введён в CD-1) описывает grid-item min-width auto trap; flex-item имеет тот же CSS mechanism (default `min-width: auto = min-content`) с другим parent'ом. R-FE-3 уже упоминает "any grid item containing flex" — flex-item сам по себе закрывается тем же правилом. Новое правило не нужно.
- **Relation to CD-2:** CD-2 УБРАЛ `[overflow-wrap:anywhere]` из 3 description-блоков (длинные русские прозы — mid-syllable breaks выглядели уродливо). TS-4 ДОБАВЛЯЕТ это же utility на короткие mixed-content value spans (VIN, dealer names, city) — paragraph-ugly mid-syllable concerns не применяются к value-span scale. Два решения не противоречат — разные content categories. Документировано в TS-4 ADR.
- **Структурный урок:** при добавлении новых flex-row patterns в проект автоматически проверять что value-side spans, которые могут содержать unpredictable-length content (user data, external API responses) — имеют `min-w-0` защиту. Pattern легко повторим: `gap-N` на row, `min-w-0` на value-span, `[overflow-wrap:anywhere]` если контент может содержать single tokens длиннее ~20 chars (URLs, VINs, IDs, имена без пробелов).
- **Ссылки:** этот коммит. ADR `[2026-04-29] Tools audit TS-4 — EncarClient flex-row overflow fix`. Связанные: R-FE-3 (CD-1), CD-2 (Russian-prose decision).

### 2026-04-29 — Tools audit TS-3: EncarClient image optimization

- **Сделано:** в `next.config.ts` добавлен блок `images.remotePatterns` с allow-listed `https://ci.encar.com/**` (single host для Encar photo CDN). В `src/app/tools/encar/EncarClient.tsx` импортирован `Image` из `next/image`, два raw `<img>` элемента (hero + lightbox) заменены на `<Image fill>` с правильными `sizes` hints. Hero: `sizes="(max-width: 768px) 100vw, 768px"`; lightbox: `sizes="100vw" quality={85}`. Lightbox `<img>` обёрнут в `<div className="relative h-[90vh] w-[90vw]" onClick={stopPropagation}>` (необходим positioned parent для `fill` layout). `loading="lazy"` снят — `<Image>` lazy-loads по дефолту.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: DevTools Network → `/_next/image?url=https%3A%2F%2Fci.encar.com%2F...` с Content-Type `image/avif`/`image/webp`, lightbox open/close через X / Escape / клик вне фото — все работают, Console clean | **Следующий шаг:** TS-4..TS-N серии Tools audit, либо переключение на NoscutCard для закрытия MA-4.
- **Контекст:** TS-1 закрыл UX-блокер (completion signal), TS-2 закрыл bundle issue (motion → m). TS-3 закрывает ещё одну категорию: photo bandwidth. На mobile 4G каждый Encar JPEG (200-800 KB original) теперь конвертируется в AVIF/WebP с responsive size — типичная экономия 50-80% bytes per photo. Server-side fetch через Next.js Image Optimizer (а не client) snimает CORS-зависимость с ci.encar.com.
- **Структурный урок:** для любого external photo source должен быть `remotePatterns` whitelist в `next.config.ts`. Без него `<Image>` бросит «Invalid src prop ... hostname is not configured» на build/runtime. Pattern: один remotePatterns entry на host, paths через `pathname: '/**'` если нужен полный доступ. minimumCacheTTL уже 86400 (от P-1+P-2) — кэшируется на VDS.
- **Failure mode note:** если ci.encar.com 429-ит наш VDS, Next.js Image Optimizer fail'ит загрузку silently — alt text остаётся видимым, hero photo показывает empty fallback. Не критично для UX (analyse data + вся остальная информация работает), но на момент инцидента можно потерять photo. Не fix-able в TS-3 без circuit-breaker / fallback proxy — за scope.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Tools audit TS-3 — EncarClient image optimization`.

### 2026-04-29 — Tools audit TS-2: EncarClient + ResultView motion → m

- **Сделано:** `src/app/tools/encar/EncarClient.tsx` и `src/app/tools/auction-sheet/ResultView.tsx` мигрированы с raw `import { motion } from "framer-motion"` на `import * as m from "framer-motion/m"` (LazyMotion-compatible). JSX-теги `<motion.div>` / `</motion.div>` переименованы в `<m.div>` / `</m.div>` в каждом файле (по одной паре). Motion-props (`initial`, `animate`, `className`) — байт-в-байт. Pattern идентичен CD-3 (CarCard + CarTrustBlock миграция).
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: оба tool'а рендерятся идентично pre-TS-2, fade-in result-блока работает, TS-1 4-pronged signal продолжает работать, bundle на tools entry path меньше | **Следующий шаг:** TS-3..TS-N серии Tools audit (если планируются), либо переключение на NoscutCard как последний raw-motion файл (закроет MA-4 целиком и позволит включить LazyMotion `strict` mode).
- **Контекст:** TS-1 (commit `c3b3e8d`) добавил completion signal pattern, но не трогал bundle-проблему. EncarClient + ResultView продолжали тащить полный framer-motion (~34 KB) при cold-cache landing на `/tools/encar` или `/tools/auction-sheet`. TS-2 это исправляет, расширяя выигрыш P-3 (главная) и CD-3 (car detail) на tools entry path.
- **Структурный урок:** P-3 → CD-3 → TS-2 — частичная систематическая миграция всех client-компонентов с motion на LazyMotion-compatible `m`. Каждая итерация — surgical: один pattern, одна замена. Цена pattern'а (1 строка import + 2-4 JSX-токена tag rename) минимальна, выигрыш bundle большой. Pattern документирован неявно через эти 3 серии — стоит явно зафиксировать после TS-2 или закрытия MA-4.
- **MA-4 progress:** EncarClient и ResultView (auction) удалены из списка raw-motion holdouts. `NoscutCard.tsx` остаётся последним — рендерится на главной + `/catalog/noscut/*`, не на tools entry path.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Tools audit TS-2 — EncarClient + ResultView motion → m`. Связанные коммиты: `b1bd44c` (P-3), `5d7806a` (CD-3).

### 2026-04-29 — Tools audit TS-1: async completion signal

- **Сделано:** в обоих client'ах `/tools/auction-sheet/AuctionSheetClient.tsx` и `/tools/encar/EncarClient.tsx` добавлен 4-pronged completion signal при переходе state в "result": (1) smooth `scrollIntoView` к result-блоку через `requestAnimationFrame` (mobile-critical, honors `prefers-reduced-motion` автоматически); (2) ARIA live region (`role="status"`, persistent в DOM, empty на mount, инжектируется текст «Анализ завершён. ...» — для screen reader пользователей); (3) `document.title` mutation на «Готово · ... | JCK AUTO» (для users на inactive tabs); (4) CSS visual flash на result-контейнере через `.completion-flash` utility class (~600ms gold-tone ring). В `globals.css` новые `@keyframes ring-flash`, `.completion-flash` utility, `@media (prefers-reduced-motion: reduce)` guard. Cleanup восстанавливает title при unmount.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge (mobile DevTools 414px, прокрутить вниз во время processing'а, увидеть смартскролл + flash + tab title; macOS reduce-motion → flash off, scroll instant; VoiceOver announce «Анализ завершён»). | **Следующий шаг:** TS-2..TS-N серии Tools audit (если дальнейшие промпты).
- **Контекст:** Vasily сообщил, что на mobile после прокрутки во время loading-фазы юзер не видит когда анализ закончен — нет визуального cue, scroll, notification, tab title change. Юзеры могут считать что инструмент завис. TS-1 — первый промпт серии «Tools audit», открывает её закрытием UX-блокера.
- **Структурный урок:** async UI pattern с inline-result рендером ВСЕГДА требует minimum 3 из 4 каналов signal'а. Pattern зафиксирован как R-FE-4 в `rules.md` для повторного использования на других tools (calculator, customs, future). Особенно важно: **persistence** ARIA live region в DOM. Условный рендер `{state === "result" && <div role="status">...}` НЕ триггерит надёжное screen-reader announcement. Region должен mounted всегда, текст инжектится при событии.
- **Открытие новой серии:** Tools audit. TS-1 закрыл visible UX-blocker; следующие промпты серии могут включать audit `/tools/calculator`, `/tools/customs`, perf optimizations, A11y improvements specific to tool pages.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Tools audit TS-1 — async completion signal`. Новое правило `R-FE-4` в `rules.md`.

### 2026-04-29 — Car detail audit CD-4 + series closed

- **Сделано:** три improvements закрыли серию Car detail audit. **D2:** в `productJsonLd` `@type` изменён `"Product" → "Vehicle"` + 5 новых полей: `mileageFromOdometer` (QuantitativeValue с unitCode KMT), `vehicleEngine` (EngineSpecification с fuelType + engineDisplacement в литрах), `vehicleTransmission` ("AT"→"Automatic"|"MT"→"Manual"), `bodyType`, `color`. Существующие поля (name, description, image, brand, model, vehicleModelDate, offers с CD-2 priceCurrency fix) — байт-в-байт. **D1:** новый второй JSON-LD блок `breadcrumbJsonLd` с `@type: "BreadcrumbList"` (3 ListItem: Главная / Каталог / current car) с абсолютными URL'ами. **D3:** thumb-кнопки CarGallery получили `aria-label="Показать фото N из M"` и `aria-current="true"` для активной. Минорные improvements (B4 sizes, C1 description ternary, C3 hardcoded color, C4 useEscape hook, D4 h1 mt-3, drivetrain enum, enginePower unit) collected в Technical Debt CD-DEBT-1.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: View Source → 2 JSON-LD блока (Vehicle + BreadcrumbList), DevTools Elements → thumb buttons aria-label + aria-current, Rich Results Test без ошибок | **Следующий шаг:** серия Car detail audit полностью закрыта. Переход к другим задачам.
- **Контекст:** CD-4 — финальный промпт серии, закрывает оставшиеся SEO + a11y improvements после CD-1 (overflow), CD-2 (correctness/perf), CD-3 (motion/m + CLS). Vehicle schema — automotive-specific subtype Product'а, BreadcrumbList дополняет крошки в SERP, thumb-aria даёт screen-reader контекст.
- **Структурный урок (за всю серию Car detail audit):** browser-first diagnostic как первый шаг новой audit-серии — окупается. CD-1 нашёл root cause overflow за 30 секунд через DevTools snippet, без него — debugging by component reading. R-FE-3 в `rules.md` сохраняет recipe навсегда. Также серия показала value «root-cause first, аудит после»: CD-1 (overflow) был самым видимым багом; CD-2/CD-3/CD-4 нашли остальные проблемы только ПОСЛЕ исправления overflow'а. Если бы их искали под overflow'ом — часть была бы маскирована.
- **Численные итоги серии:** Document width 840px → 375px на 375px viewport (overflow 465px → 0). Server response timing -275ms на car detail. Initial JS bundle на car detail entry path → P-3 win extended. SEO: 2 JSON-LD блока вместо 1, Product → Vehicle с 5 новыми полями. Mobile thumb bandwidth: ~80% сокращение. Console errors на car detail: 0.
- **Открытый Technical Debt от серии:** **CD-DEBT-1** (7 минорных improvements). Зарегистрирован.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Car detail audit CD-4 — SEO + a11y` и `[2026-04-29] Car detail audit series — final summary`. Серия охватывает коммиты `ce4d130` (CD-1) → `4401529` (CD-2) → `5d7806a` (CD-3) → этот финальный.

### 2026-04-29 — Car detail audit CD-3: CarCard + CarTrustBlock motion → m + CLS fix

- **Сделано:** `src/components/catalog/CarCard.tsx` и `src/components/catalog/CarTrustBlock.tsx` мигрированы с raw `import { motion } from "framer-motion"` на `import * as m from "framer-motion/m"` (LazyMotion-compatible). JSX-теги `<motion.div>` и `</motion.div>` переименованы в `<m.div>` / `</m.div>`. В CarCard в hover-стиле inner-div'а заменён `hover:scale-[1.02] hover:shadow-md` на `hover:-translate-y-1 hover:shadow-md` — устраняет CLS на «Other cars» grid (scale изменяет размер карточки, сдвигает соседей; translate-y лифтит карточку без изменения размера). Все motion-props (initial / whileInView / viewport / transition) — байт-в-байт. group-hover:scale-105 на inner Image сохранён (intentional dual-hover effect: card lifts + photo zooms).
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: hover на «Other cars» лифтит карточки на ~4px без horizontal/vertical shift соседей, fade-in анимации работают, bundle на car detail entry path не тянет полный framer-motion | **Следующий шаг:** CD-4 (Vehicle schema upgrade + BreadcrumbList structured data + thumb aria-labels) либо переход к другим audit'ам.
- **Контекст:** P-3 (Mobile audit, commit `b1bd44c`) перевёл 10 секций главной с raw motion на m, сократив framer-motion bundle ~34 KB → ~4.6 KB. CarCard и CarTrustBlock в P-3 явно отложены — оба не на hot path главной. CD-3 закрывает их в car-detail-audit серии: оба компонента рендерятся на `/catalog/cars/[id]` (CarCard в «Other cars» секции внизу страницы, CarTrustBlock mid-page). Прямой landing на car detail из поиска без P-3-fix тащил полный framer-motion для new-visitor entry path. CD-3 этот gap закрывает.
- **Структурный урок:** при системной миграции на LazyMotion deferred-компоненты должны быть зарегистрированы как Technical Debt (которое потом закрывается follow-up серией) — иначе они тихо ломают bundle на entry-paths, отличных от того, для которого делалась миграция. Урок: P-3 не должен был только-deferring-без-TD-entry; CD-3 закрывает один из таких deferred. Остальные (NoscutCard, EncarClient + любые ещё) зарегистрированы как MA-4.
- **Bonus structural lesson — CLS pattern:** `hover:scale` на grid-card'ах = CLS, потому что transform: scale всё же расширяет visual bounding box и может pushить соседей в некоторых grid-сценариях. `hover:-translate-y-1` (или translate-x) — безопасный pattern для card-hover «лифт». Делает то же UX (карточка «всплывает»), без layout shift.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Car detail audit CD-3 — CarCard + CarTrustBlock motion → m + CLS fix`. Связанный коммит: `b1bd44c` (P-3, исходная миграция секций главной).

### 2026-04-29 — Car detail audit CD-2: correctness + perf cleanup

- **Сделано:** пять корректировок в `src/app/catalog/cars/[id]/page.tsx` и `src/components/catalog/CarGallery.tsx`. **A1:** `getAllCars()` обёрнут в `React.cache()` — функция вызывается дважды за запрос (`generateMetadata` + page component) при `force-dynamic`, без cache() это ~550ms лишнего disk I/O. **A2:** Schema.org `priceCurrency` теперь использует `car.currency` (CNY/KRW/JPY) когда `priceRub` отсутствует — раньше всегда писалось CNY, что ломало Google Shopping для машин из Кореи и Японии. **A3:** Schema.org `description` теперь — нормализованный excerpt из `car.description` (до 300 символов с word-boundary truncation), а не синтетическая 4-токенная техническая строка. Локальный helper `truncateForSchema` внутри `CarDetailPage` — не выносится в shared lib (один call site). **B5:** thumbnails в CarGallery загружаются `loading={i === 0 ? "eager" : "lazy"}` — экономит до ~360 KB на mobile при 12 thumbs × ~30 KB AVIF. **C2:** `[overflow-wrap:anywhere]` удалён с трёх description-related блоков (description div, description p, condition note), сохранён на `<h1>` (folderName может содержать длинные join-строки без пробелов). Русский prose теперь wrap'ится на word-boundaries, а не mid-syllable.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge: page source → JSON-LD priceCurrency и description correct, Network → thumbs lazy load, визуально страница не изменилась | **Следующий шаг:** CD-3 (CarCard motion → m migration, CLS fix from hover:scale, CarTrustBlock motion → m migration), CD-4 (BreadcrumbList structured data, Schema.org Product → Vehicle, thumb aria-labels).
- **Контекст:** CD-1 закрыл horizontal overflow, после визуальной верификации технический audit страницы выявил 5 non-visual issues (SEO data accuracy + perf). CD-2 закрывает все пять одним промптом — каждое изменение хирургическое, визуальный рендер байт-в-байт identical.
- **Структурный урок:** Schema.org SEO data correctness (priceCurrency, description) — silent regressions на проде, которые не проявляются визуально, но напрямую влияют на Google Shopping/SERP snippets. Их проще ловить когда есть систематический audit (как этот), чем reactively по жалобам аналитики. Урок: после серий мобильной адаптации делать обязательный SEO/perf-audit pass на ключевых страницах.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Car detail audit CD-2 — correctness + perf cleanup`.

### 2026-04-29 — Car detail audit CD-1: horizontal overflow fix

- **Сделано:** в `src/app/catalog/cars/[id]/page.tsx` к двум grid-items добавлен класс `min-w-0` — на gallery column (`lg:col-span-3`) и на info sidebar (`lg:col-span-2`). Каждая правка — добавление одного токена в className + RULE-комментарий выше с объяснением grid-item-min-width-auto trap. CarGallery.tsx и остальные компоненты не тронуты — баг был в parent grid items, не в галерее.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge при viewport widths 360 / 414 / 430. После фикса должны всплыть остальные visual bugs страницы, ранее замаскированные общим overflow'ом — будут зарегистрированы в реестр car detail audit | **Следующий шаг:** визуальный smoke-тест страницы детали машины на проде, составление реестра CD-2..N, прогон по приоритету.
- **Контекст и диагностика:** Vasily сообщил про обрезку фото и текста на iPhone SE preview. DevTools console показал `Viewport: 375px, Document: 840px, Overflow: 465px` — страница больше viewport'а вдвое. Через `getBoundingClientRect()` traversal'ом по всем элементам найдена цепочка overflow contributors: HEADER.fixed → DIV.mx-auto → DIV.lg:col-span-3 → IMG + thumbs row. Все 840px шириной. Корневая причина: CSS Grid item имеет `min-width: auto` (= min-content) по дефолту. Когда ребёнок — flex/scroll контейнер с `overflow-x-auto` + `flex-shrink-0` thumbs, grid item растёт под intrinsic min-content child'а, а не позволяет ему clip'аться. Fix: `min-w-0` на grid items.
- **Структурный урок:** grid-item-min-width-auto trap — частый баг, требующий специфического знания CSS Grid spec. Без diagnostic-recipe (DevTools snippet с `scrollWidth vs clientWidth + getBoundingClientRect traversal`) поиск занял бы значительно дольше — пришлось бы вручную инспектировать каждый nested контейнер. Recipe сохранён в R-FE-3 в `rules.md` для повторного использования. Правило: любой grid item, содержащий `flex + overflow-x-auto`, или `flex + flex-shrink-0` детей, или длинный текст с `[overflow-wrap:anywhere]`, или nested scroll containers — ОБЯЗАН иметь `min-w-0`.
- **Открытие новой серии:** car detail audit. Vasily обозначил страницу `/catalog/cars/[id]` как «больше всего визуальных багов». CD-1 — первый закрытый пункт. Реестр CD-2..N будет составлен после визуальной верификации фикса CD-1 (бывают баги, замаскированные общим overflow'ом).
- **Ссылки:** этот коммит. ADR `[2026-04-29] Car detail audit CD-1 — horizontal overflow fix`. Новое правило `R-FE-3` в `rules.md`.

### 2026-04-29 (final) — Mobile audit P-8 researched and deferred + series closed

- **Сделано:** документационный финальный промпт серии "Главная — мобильная адаптация". P-8 (bundle reduction через dynamic imports для below-fold секций) исследован и отложен из-за documented Next.js 16 limitation: когда Server Component (наш `src/app/page.tsx`) делает `dynamic(() => import('Client'))`, code-splitting не происходит — Client Component попадает в initial bundle родителя. Подтверждено vercel/next.js issues #61066, #58238, #66414 + App Router docs. Workaround через Client Component wrapper `BelowFoldSections.tsx` оценён как cost > benefit при текущих метриках (после P-3 framer-motion bundle уже сокращён 7.4×). Зарегистрировано как Technical Debt MA-3 с явным reopen-trigger: Lighthouse mobile < 80, INP > 200ms, или +5 секций на главной.
- **Прервались на:** серия Mobile audit полностью закрыта (12/12 resolved). После этого коммита — переключение на другие задачи проекта | **Следующий шаг:** другие открытые задачи (Telegram bot, контентные страницы, новые продуктовые цели), либо опциональный smoke-test всех закрытых пунктов на проде.
- **Контекст:** P-8 был последним открытым пунктом реестра. Серия включала 11 промптов кода (P-1+P-2 + 2 fix'а + nginx-патч + P-3 + P-4 + P-5+P-9 + P-6 + P-12 + P-12 fix) и 2 closing-документационных промпта (closing cleanup для P-7/P-10/P-11, и этот финальный для P-8 + series summary).
- **Структурный урок:** не каждый пункт audit-реестра требует code change. P-8 — пример third-class закрытия: «исследовано, отложено, открыто как TD с явным trigger». Это полное закрытие, не silent-drop. Вместе с P-7 (verified visually), P-10 (conscious deferral в TD), P-11 (verified code) серия демонстрирует все четыре класса резолюций: implemented, verified-visually, verified-code, researched-and-deferred. Шаблон применять при следующих audit-сериях.
- **Methodology lessons (за всю серию):** (1) Browser-first verification → R-FE-1 в rules.md; (2) Allowlist completeness → R-FE-2 в rules.md; (3) Bug hunt protocol triggers (skill `bug-hunting`) применяются строго — если пропустить, цена 4× итераций; (4) Inseparability exceptions to one-prompt-one-file rule оправданы при architectural inseparability (P-5+P-9 пример).
- **Численные итоги:** LCP image 6.94 MB → 56 KB AVIF (124×). Framer-motion bundle ~34 KB → ~4.6 KB (7.4×). HowItWorks DOM 90 → 45 (50%). HowItWorks motion instances 10 → 5 (50%). Console errors на главной 12 → 0.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Mobile audit P-8 — researched, deferred` и `[2026-04-29] Mobile audit series — final summary`.

### 2026-04-29 (closing) — Mobile audit closing cleanup: P-7, P-10, P-11

- **Сделано:** документационный closing-промпт серии "Главная — мобильная адаптация". Три пункта реестра проверены/оценены и закрыты без code changes: P-7 (Hero на 360px) — verified visually Vasily'ем после деплоев P-1+P-2 и P-5+P-9, заголовок переносится корректно, кнопки на всю ширину карточки, stats-сетка читается. P-10 (hover-only effects на Countries) — стили декоративные, карточки не интерактивные (не Link, не onClick); Tailwind 4 уже по умолчанию применяет `hover:` только на устройствах с hover. Зарегистрировано как Technical Debt MA-1 для полноты картины. P-11 (Yandex Metrika strategy) — уже использует `strategy='afterInteractive'` (оптимально для analytics scripts). Отдельный продуктовый вопрос webvisor=true (overhead на mobile CPU) зарегистрирован как Technical Debt MA-2.
- **Прервались на:** серия Mobile audit имеет 11 из 12 пунктов закрытыми; остался P-8 (bundle reduction через dynamic imports для below-fold секций) | **Следующий шаг:** P-8 отдельным промптом, либо переключение на другие задачи проекта (Telegram bot и т.д.).
- **Контекст:** closing-cleanup нужен чтобы будущая Claude-сессия при чтении roadmap не возвращалась к P-7/P-10/P-11 заново. Каждый пункт явно закрыт с указанной причиной (verified visually / verified code / conscious deferral в TD).
- **Структурный урок:** не каждый пункт audit-реестра требует code change. Часть закрывается visual verification, часть — code review без правок, часть — осознанная отсрочка с регистрацией в TD. Главное правило: **причина закрытия должна быть явной**, иначе через 2 сессии пункт всплывёт заново и кто-то начнёт его делать с нуля.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Mobile audit closing cleanup — P-7, P-10, P-11`.

### 2026-04-29 — P-12 fix: Testimonials card width

- **Сделано:** в `src/components/sections/Testimonials.tsx` className mobile-карточек заменён с `min-w-[280px] shrink-0 ...` на `w-[85vw] max-w-[320px] shrink-0 ...`. Добавлен RULE-комментарий выше className с объяснением, почему min-w в одиночку не работает в horizontal-scroll контексте с shrink-0 + переменной длины текста. Остальное в файле (IntersectionObserver, dots, JSX-контент карточек, desktop-grid) — байт-в-байт нетронуто.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge при viewport 360 / 412 / 430px (карточка должна влезать в viewport с peek'ом, текст переноситься на несколько строк) | **Следующий шаг:** P-7/P-8 серии Mobile audit либо closing summary серии.
- **Контекст бага:** после деплоя P-12 на проде осталась видимая обрезка mobile-карточек на 360-430px («по имп...»). Root cause: `min-w-[280px]` задаёт минимальную ширину но не максимальную; `shrink-0` запрещает flex'у уменьшать карточку; `<p>` с длинным testimonial-текстом (220+ символов) пытается уместиться на наименьшем числе строк — карточка растёт до intrinsic single-line width, выходит за viewport. P-12 (scroll-snap + dots) не пересекался с этим багом — он добавил signal'ы, но не зафиксировал ширину карточки.
- **Структурный урок:** в horizontal-scroll контексте с `shrink-0` и пользовательским контентом переменной длины — `min-w-` в одиночку недостаточно. Всегда парить с явной `w-` или `max-w-`. Альтернативно: убрать `shrink-0` — тогда flex schould-shrink, но peek-эффект ломается. Баг был latent в P-12 коде; вскрылся на конкретных длинных testimonials в data. Урок зафиксирован в Post-deploy fix секции ADR P-12.
- **Ссылки:** этот коммит. Связанный коммит: 644cb78 (P-12 первый деплой). ADR `[2026-04-29] Mobile audit P-12` расширен секцией Post-deploy fix.

### 2026-04-29 — Mobile audit P-12: Testimonials mobile scroll signal

- **Сделано:** в `src/components/sections/Testimonials.tsx` мобильный horizontal-scroll контейнер получил `snap-x snap-mandatory`, каждая карточка — `snap-start`. Добавлен ref на контейнер и массив refs на 5 карточек. Под карточками рендерится ряд из 5 dots с `md:hidden` (decorative, `aria-hidden="true"`): активный dot — `w-6 bg-primary`, неактивный — `w-2 bg-border`, transition-all 300ms. IntersectionObserver с `root: containerRef.current` и `threshold: [0, 0.5, 1]` определяет most-visible карточку через max `intersectionRatio` и обновляет `activeIndex`. Desktop grid (3 карточки на md+) — байт-в-байт нетронут.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge при viewport 360px и 430px (свайп через все 5 карточек, проверка плавного движения active-dot слева направо) | **Следующий шаг:** P-7 / P-8 серии, либо closing-промпт серии Mobile audit (9 из 12 пунктов закрыто).
- **Контекст:** P-12 добавлен в реестр сегодня после визуальной верификации P-5+P-9. Vasily увидел на iPhone 14 Pro Max preview, что секция «Что говорят клиенты» на mobile выглядит как одна обрезанная карточка — нет визуального сигнала «свайпни». Bleed-to-edge layout (`-mx-4 px-4` peek) — намеренный UX, который без cue теряется. Решение: добавить scroll-snap (тактильный сигнал на свайпе) + pagination dots (визуальный сигнал на статике).
- **Структурный урок:** peek-effect carousel'и требуют МИНИМУМ двух явных сигналов, чтобы пользователь понял interactivity: (1) scroll-snap для tactile feedback при свайпе, (2) pagination dots для статичного visual cue. Только один сигнал — половина коммуникации. Этот шаблон применим к любой будущей horizontal-scroll секции (catalog, news, partners). IntersectionObserver с `root: containerRef.current` — ключевой паттерн: без явного root observer не сработает на horizontal scroll внутри контейнера, потому что page viewport не меняется. Зафиксировано RULE-комментарием в коде.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Mobile audit P-12 — Testimonials mobile scroll signal`.

### 2026-04-29 — Mobile audit P-6: FloatingMessengers auto-hide on forms

- **Сделано:** в `src/components/FloatingMessengers.tsx` добавлены два новых useEffect: (1) IntersectionObserver, который запускается через `requestAnimationFrame` после mount'а, наблюдает все элементы с атрибутом `[data-fm-hide]` и хранит Set текущих intersecting элементов. `setHidden(set.size > 0)` — OR-логика. (2) Side effect `if (hidden && open) setOpen(false)` — collapse'ит menu вместе с FAB. Root div получает conditional className `transition-opacity duration-300 ${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`. RULE-комментарий выше observer'а фиксирует data-fm-hide контракт. В `src/components/LeadForm.tsx` к root `<form>` добавлен атрибут `data-fm-hide="true"` — единственная правка в этом файле.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge через DevTools при viewport widths 360px / 414px / ≥1024px (scroll до ContactCTA, проверка fade-out FAB, проверка collapse menu при scroll вниз с открытым menu) | **Следующий шаг:** P-7 серии (если по реестру) либо следующий приоритетный пункт.
- **Контекст:** P-6 — touch conflict между FAB (`fixed bottom-6 right-6`) и LeadForm submit-кнопкой при viewport width 360-414px. На 360px LeadForm wrapped в `max-w-sm` ≈ 328px, gap до правого края viewport ≈ 16px. FAB занимает right 16px + 48px влево = 64px от правого края, что перекрывает правые ~32px submit-кнопки. Юзер целится в submit, попадает по FAB. После фикса FAB исчезает на 300ms transition при появлении формы в viewport, возвращается при скролле вверх. После merge закрыто 7 из 11 пунктов реестра mobile audit.
- **Структурный урок:** declarative opt-in через `data-attribute` extensible'нее, чем hardcoded ref-based logic. Любой будущий компонент (sticky CTA, focus zone, full-screen modal, video player в hero) может opt-in одной строкой `data-fm-hide="true"` на root JSX. Без новых импортов FloatingMessengers, без изменений observer-логики. Обратная сторона: static observer на mount'е не ловит динамически добавленные элементы (например, lazy-loaded modal). При первой такой потребности — заменить на MutationObserver wrapper или re-query при route change.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Mobile audit P-6 — FloatingMessengers auto-hide on forms`.

### 2026-04-29 — Mobile audit P-5+P-9: viewport meta and safe-area inset

- **Сделано:** в `src/app/layout.tsx` добавлен `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1E3A5F' }` рядом с существующим `export const metadata`. В `src/components/layout/Header.tsx` к root `<header>` добавлены три класса `pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]` с RULE-комментарием выше. В `src/components/sections/Hero.tsx` верхний padding контента изменён с `pt-28 sm:pt-32` на `pt-[calc(7rem+env(safe-area-inset-top))] sm:pt-[calc(8rem+env(safe-area-inset-top))]` — на устройствах без выреза `env() = 0` и поведение не меняется, на iPhone с notch / Dynamic Island Hero опускается ниже теперь-более-высокого header'а.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge через DevTools Device Toolbar в presets «iPhone 14 Pro» (portrait + landscape) и «Galaxy S20» (regression check) | **Следующий шаг:** P-6 (FloatingMessengers конфликт с CTA, продуктовое обсуждение) либо следующий пункт реестра.
- **Контекст:** P-5 (Header safe-area) и P-9 (viewport meta) технически неразделимы — `viewport-fit=cover` активирует `env()`-значения; без `env()` safe-area классы — no-op. Раздельный деплой создаёт промежуточные состояния, видимо регрессирующие у пользователей mobile. Поэтому объединены в один промпт. После merge закрыто 6 из 11 пунктов реестра mobile audit.
- **Структурный урок:** viewport-fit и env() приходят в комплекте. Любой будущий промпт про safe-area / mobile keyboard avoidance / virtual-keyboard inset должен начинаться с проверки, что `viewport: Viewport` экспортирован с `viewportFit: 'cover'`. Иначе CSS-классы добавляются впустую.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Mobile audit P-5+P-9 — viewport meta and safe-area inset`.

### 2026-04-29 — Mobile audit P-4: HowItWorks unified responsive

- **Сделано:** в `src/components/sections/HowItWorks.tsx` два дублирующих блока (desktop `hidden md:grid md:grid-cols-5` с иконками и mobile `md:hidden space-y-8` с цифрами) заменены на один unified блок `mt-12 grid gap-8 md:grid-cols-5 md:gap-4`. Каждый шаг рендерится одним `<m.div>` с адаптивным flex-ом (`flex gap-4 md:flex-col md:items-center md:gap-0 md:text-center`). Иконка-кружок h-12 w-12 несёт сразу два сигнала: lucide-икону (тип шага) И маленький badge h-5 w-5 в правом-нижнем углу с номером 1-5 (порядок шага). Раньше mobile-блок терял иконку, desktop-блок терял номер — теперь информационная семантика унифицирована на обоих breakpoint'ах. Decorative connector-линии остались двух-вариантными (вертикальная `md:hidden` + горизонтальная `hidden md:block`) — это accepted exception для одного visual элемента, оставшегося dual-render по природе.
- **Прервались на:** ожидание визуальной верификации на VDS после auto-merge на двух viewport'ах (360px и ≥1024px) | **Следующий шаг:** P-5 серии Mobile audit либо продуктовое обсуждение P-6 (FloatingMessengers конфликт с CTA).
- **Контекст:** P-4 закрывает один из 11 пунктов реестра mobile audit. Ожидаемый эффект: 90 DOM-узлов → 45 (50% сокращение), 10 motion-инстансов → 5 (50% сокращение). Меньше parse + reconcile work на render.
- **Структурный урок:** dual-render `hidden md:` + `md:hidden` antipattern — следствие "сделать как макет на desktop, потом скопировать и переделать для mobile". Правильный подход — один responsive layout с tailwind breakpoints. Цена antipattern'а: дублирование контента, дрейф между surface'ами (mobile терял иконку), 2× JS-нагрузка на motion-инстансы. Этот паттерн ещё может встречаться в других секциях — проверить при следующих P-промптах.
- **Trade-off:** mobile fade-up animation `x:-20 → x:0` (slide-from-left) заменена на `y:20 → y:0` (fade-up). Принято как accepted trade-off за code unification — обе анимации функционально эквивалентны (signal "элемент появляется"), визуальное различие минимально.
- **Ссылки:** этот коммит. ADR `[2026-04-29] Mobile audit P-4 — HowItWorks unified responsive layout`.

### 2026-04-29 (vecher) — P-1+P-2 bug hunt closed: image optimizer fully operational

- **Сделано:** последняя проверка через DevTools Console на main page после Empty Cache and Hard Reload — 0 ошибок 400 на /_next/image. Image optimizer полностью работает в production: hero-bg.jpg → image/avif 56 KB (с источника 148 KB JPEG; до P-1+P-2 был PNG 6.94 MB). Картинки каталога из /storage/ тоже оптимизируются.
- **Что было:** баг hunt по 400 на /_next/image занял 4 итерации фиксов: P-1+P-2 первый промпт (включил optimizer) → fix-1 (добавил qualities + localPatterns: /images/**) → ручной nginx-патч на VDS (WebSocket upgrade map) → fix-2 (расширил localPatterns на /storage/**). Каждая итерация закрывала один слой проблемы.
- **Что мешало:** диагностика через curl без браузерных headers скрыла реальное поведение. После первого 400 — нужно было сразу открыть DevTools Console на проде, увидеть **все 12 ошибок** и их URL, а не пытаться воспроизвести через curl. Урок зафиксирован в rules.md.
- **Закрытие skill `bug-hunting`:** 7 из 8 пунктов Section 6.7 закрыты. Пункт 6 (RULE anchor в nginx) — оператор выполнит ручной командой на VDS (см. конец этого промпта).
- **Ссылки:** коммиты 9658e00, fcc7c7c, b7d14d9. nginx-патч — вне git, на VDS в /etc/nginx/nginx.conf и /etc/nginx/sites-available/jckauto.

### 2026-04-29 (poslepoldnia) — P-1+P-2 fix #2: localPatterns extended for /storage/**

- **Сделано:** в `next.config.ts` массив `images.localPatterns` расширен вторым паттерном `{ pathname: '/storage/**', search: '' }`. Первый паттерн `/images/**` для статических ассетов сохранён. После фикса оптимизатор валидирует и обрабатывает картинки из обеих директорий: `/public/images/` (статика проекта) и `/public/storage/` (симлинк на `/var/www/jckauto/storage` с фото каталога автомобилей).
- **Прервались на:** ожидание curl-проверки на VDS после auto-merge. Финальный браузерный smoke-тест: главная без ошибок 400 в DevTools Console при hard reload.
- **Контекст ошибки:** P-1+P-2 fix добавил `localPatterns` с одним паттерном `/images/**`, потому что я не учёл, что на главной CatalogPreview рендерит CarCard'ы с фото из `/storage/catalog/`. После первого fix в DevTools Console осталась 1 ошибка из 12 — именно на storage-картинку.
- **Структурный урок:** при добавлении allowlist-полей (localPatterns, remotePatterns, CSP source-list, CORS origins) — обязательно делать инвентаризацию ВСЕХ источников, а не только того, который только что починен. Метод: grep по `<Image src=` в src/, найти все уникальные пути prefix'ы. Это бы выявило `/storage/` сразу.
- **Bug hunt — это была триггерная серия для skill `bug-hunting`:** P-1+P-2 первый промпт → 400 → fix-1 (qualities, localPatterns: /images/**) → 400 → bug hunt protocol → найден nginx WebSocket-upgrade misconfiguration → fix nginx + узнаём про /storage → fix-2 этот. Урок: при первой неудаче fix'а после деплоя — обязательно проверять реальный браузер, не только curl. Curl без браузерных headers скрыл реальные ошибки от пользователей в DevTools Console.
- **Ссылки:** этот коммит. Связанные коммиты: 9658e00 (P-1+P-2), fcc7c7c (P-1+P-2 fix-1), nginx-патч на VDS (вне git).

### 2026-04-29 — Mobile audit P-3: LazyMotion + m migration on home page

- **Сделано:** создан `src/components/MotionProvider.tsx` (client-wrapper с `<LazyMotion features={domAnimation}>`), интегрирован в `src/app/layout.tsx` вокруг `<main>`. Все 10 client-секций главной (Hero, Countries, HowItWorks, Calculator, Values, Warranty, Testimonials, FAQ, ContactCTA, SocialFollow) мигрированы с `motion.div` на `m.div`. Импорт во всех файлах: `import * as m from "framer-motion/m"` вместо `import { motion } from "framer-motion"`. Анимации сохранены внешне идентично — props initial/animate/whileInView/viewport/transition не тронуты, JSX-структура не изменена.
- **Прервались на:** ожидание визуальной верификации главной на VDS после деплоя | **Следующий шаг:** P-4 (HowItWorks dual-render desktop+mobile) или продуктовое обсуждение P-6 (FloatingMessengers конфликт с CTA).
- **Контекст:** P-3 закрывает один из 11 пунктов реестра проблем mobile-аудита. Ожидаемый эффект: framer-motion initial bundle сокращается с ~34 KB до ~4.6 KB. На реальной мобильной CPU это снижает parse+exec time на entry, что прямо влияет на INP (порог "good" ≤ 200ms).
- **Не задеты:** CarCard.tsx, NoscutCard.tsx, tools-страницы — они используют motion, но не относятся к главной. Будут мигрированы при работе по соответствующим типам страниц. После миграции всех motion-вызовов проекта — финальный промпт включит `strict` на LazyMotion для защиты от регрессий.
- **Структурный урок:** один глобальный `<LazyMotion>` через client-wrapper в layout — чище, чем локальные обёртки в каждой секции. Cost — один новый файл (15 строк), benefit — единое поведение и точка контроля для будущего `strict`.
- **Ссылки:** этот коммит. Документация Motion: https://motion.dev/docs/react-lazy-motion.

### 2026-04-29 (vechelnyaya) — P-1+P-2 fix: qualities + localPatterns required in Next.js 16

- **Сделано:** в `next.config.ts` блок `images` дополнен двумя полями: `qualities: [75, 85]` (allowlist значений quality, ОБЯЗАТЕЛЬНОЕ поле начиная с Next.js 16) и `localPatterns: [{ pathname: '/images/**', search: '' }]` (allowlist путей для локальных <Image>). Без `qualities` оптимизатор отвечал 400 Bad Request на любой запрос /_next/image с q= в URL. После фикса curl должен вернуть 200 + content-type: image/avif или image/webp.
- **Прервались на:** ожидание curl-проверки на VDS после auto-merge | **Следующий шаг:** P-3 (Framer Motion → LazyMotion) при условии успеха curl. При новом 400 — диагностика nginx/Next.js stderr.
- **Контекст ошибки:** P-1+P-2 включил optimizer (formats/deviceSizes/imageSizes/minimumCacheTTL), но не включил qualities — поле, ставшее обязательным в Next.js 16 (security: предотвращение DoS через произвольные q=). Next.js 16 docs: "If the quality prop does not match a value in this array, the closest allowed value will be used. If the REST API is visited directly with a quality that does not match a value in this array, the server will return a 400 Bad Request response."
- **Структурный урок:** новые обязательные поля Next.js при upgrade major версии — потенциальный латентный баг. У нас Next.js 16 уже стоял, P-1+P-2 не вводил Next.js 16 — но активация optimizer вскрыла существующее несоответствие конфига 16-й версии. При следующих включениях продвинутых features Next.js — проверять changelog требуемых полей в конфиге.
- **Ссылки:** этот коммит. Документация Next.js: https://nextjs.org/docs/app/api-reference/components/image#qualities

### 2026-04-29 — Mobile audit P-1+P-2: enable Next.js image optimizer + compress hero-bg

- **Сделано:** в `next.config.ts` снят `unoptimized: true` и добавлен блок `images: { formats, deviceSizes, imageSizes, minimumCacheTTL }` с AVIF в приоритете и брейкпоинтами 360/414. `sharp` перенесён из devDependencies в dependencies для production runtime. Файл `public/images/hero-bg.png` (6.62 MB) пережат через одноразовый `scripts/compress-hero-bg.ts` в `public/images/hero-bg.jpg` (148 KB, ≤ 500 KB). Ссылка в `src/components/sections/Hero.tsx` обновлена. После деплоя production-проверка через `curl -H "Accept: image/avif,image/webp" /_next/image?url=...` должна вернуть `content-type: image/avif` или `image/webp`.
- **Прервались на:** ожидание результата curl-проверки на VDS после auto-merge | **Следующий шаг:** P-3 (Framer Motion → LazyMotion + m component) если AC прошли; либо разбор регрессии если nginx режет /_next/image.
- **Контекст:** P-1+P-2 — первый промпт фазы 2 серии "Главная — мобильная адаптация". Из реестра 11 пунктов, эти два дают наибольший эффект на LCP мобильного. Серия будет идти P-1 → P-11 по порядку приоритета.
- **Структурные уроки:** (1) sharp в devDependencies при production runtime под PM2 — латентный баг, который не проявлялся только потому что `unoptimized: true` отключал оптимизатор целиком. После включения оптимизатора без sharp в dependencies был бы 500 на /_next/image; (2) pre-compression source перед оптимизатором (PNG 6.62 MB → JPEG 148 KB, 97.8% reduction) — стандартная практика; оптимизатор не делает чудес из неоптимизированного source.
- **Ссылки:** этот коммит.

### 2026-04-26 — Переход на систему стандартов v2.0

- **Сделано:** серия 2026-04-26-knowledge-v2 закрыта (4/4 промптов): системная инструкция и контекстный файл проекта в claude.ai заменены на v2.0; добавлена секция Recent Activity и архивирован исторический хвост Done в `roadmap-archive-1.md`; создан `virtual-team.md`; миграция зафиксирована ADR `[2026-04-26]` в `decisions.md`; блок `## Execution Discipline` (5 Карпати-правил) добавлен в `app/jck-auto/CLAUDE.md` — теперь поведенческий стандарт действует на каждом промпте для Claude Code.
- **Прервались на:** серия v2.0 закрыта, новая система действует на всех уровнях (Claude / Claude Code / knowledge) | **Следующий шаг:** возврат к нормальной работе по новой системе; следующая запись Recent Activity создаётся при следующей рабочей сессии.
- **Контекст:** серия из 4 промптов (1 — этот, 2 — virtual-team/rules, 3 — ADR в decisions.md + финал INDEX.md, 4 — Execution Discipline в CLAUDE.md).
- **Ссылки:** план серии — в чате стратегического партнёра; ADR будет добавлен в Промпте 3.

## Done

- [x] **2026-05-02 — KC series CLOSED (6/6 — knowledge cleanup).** decisions.md, roadmap.md, bugs.md split (active + archive); infrastructure.md split into infrastructure + networking; tools.md → tools-auction-sheet.md rename + per-tool convention; noscut-fixes.md → noscut-fixes-archive-1.md (completed ТЗ archived). 8 files over 200-line guideline brought into compliance or near-compliance with acknowledged overrides. New rule R-PROC-1 in rules.md enforces actionable auto-archive triggers (replaces declarative ones that never fired). См. ADR `[2026-05-02] KC series — knowledge cleanup methodology and outcomes`.
- [x] **2026-05-02 — NEW-1 series CLOSED (6/6 — Yandex Metrika MCP end-to-end).** NEW-1.1 PM2 entry yandex-metrika-mcp + supergateway, NEW-1.X-pre1A FILESYSTEM_ROOTS extended, NEW-1.X-pre1B DENY_PATHS in mcp_server.py, NEW-1.2 nginx /mcp/metrika snippet + deploy, NEW-1.4 Custom Connector в Claude.ai. End-to-end verified via nginx access log: Anthropic Custom Connector POST /mcp/metrika → 200 OK + 15484 bytes tools/list. Future-Claude теперь имеет read-доступ к Yandex Metrika data jckauto.ru через `yandex-metrika:*` tools. См. ADR `[2026-05-02] NEW-1 series — final summary` и связанные ADR.
- [x] **2026-05-02 — CAT-* series CLOSED (4/4: 2 implemented, 1 verified-no-change, 1 deferred to Strategic initiative).** CAT-1a (motion deadcode, commit `29df1ed`), CAT-1b (BreadcrumbList JSON-LD, commit `227d16c`), CAT-3 (hover audit verified-no-change), CAT-2 (ItemList JSON-LD deferred as Strategic initiative #5). См. ADR `[2026-05-02] CAT-* series — final summary`.
- [x] **2026-05-02 — CAT-3 closed (verified, no code change).** Hover effects на category cards и country tabs /catalog проверены: border-color transitions без CLS-риска, Tailwind 4 hover variant gates на touch-устройствах. Browser-first diagnostic 412px: overflow=0, Console clean. См. ADR `[2026-05-02] CAT-3 — hover effects audit на /catalog (verified, no change needed)`.
- [x] **2026-05-02 — CAT-1b closed.** BreadcrumbList JSON-LD added on /catalog (2-level: Главная → Каталог). Same pattern as TS-5 and CD-4, applied with surgical scope to `src/app/catalog/page.tsx` (one const + one `<script>` element). Existing metadata, dynamic export, и body — байт-в-байт. Page-by-page BreadcrumbList покрытие main entry pages: 4/4. См. ADR `[2026-05-02] CAT-1b — BreadcrumbList JSON-LD на /catalog`.
- [x] **2026-04-29 — Tools audit TS-5 closed.** BreadcrumbList JSON-LD added on both /tools/auction-sheet and /tools/encar server pages. Three levels: Главная → Сервисы → tool-name. Vehicle schema for Encar result rejected by design (no indexable URL per result; client-rendered transient state). См. ADR `[2026-04-29] Tools audit TS-5 — BreadcrumbList на tool-страницах`.
- [x] **2026-04-29 — Tools audit series CLOSED (5/5 resolved + 1 by-design deferred).** TS-1 (4-pronged completion signal), TS-2 (motion → m), TS-3 (image optimization), TS-4 (overflow fix), TS-5 (BreadcrumbList). NoscutCard remains under MA-4 as last raw-motion file project-wide. См. ADR `[2026-04-29] Tools audit series — final summary`.
- [x] **2026-04-29 — Mobile audit P-3 закрыт.** Создан MotionProvider (LazyMotion + domAnimation), все 10 секций главной мигрированы с `motion` на `m`. Bundle framer-motion: ~34 KB → ~4.6 KB initial. Анимации работают как до миграции. CarCard/NoscutCard/tools/About/Blog/News — НЕ задеты, мигрируются позже. См. ADR `[2026-04-29] Mobile audit P-3 — LazyMotion + m migration on home page`.
- [x] **2026-04-29 — Tools audit TS-4 closed.** EncarClient.tsx flex-justify-between rows защищены от horizontal overflow: vehicle info grid, power row, dealer block (3 rows). Добавлены `min-w-0 + [overflow-wrap:anywhere]` на value spans (VIN, dealer name/firm/city), `gap-3` на 2 rows для visual breathing. Cost breakdown unchanged (уже корректен). Auction-sheet unchanged (zero overflow). R-FE-3 grid-item trap rule применяется equally к flex-items — нового правила не требуется. См. ADR `[2026-04-29] Tools audit TS-4 — EncarClient flex-row overflow fix`.
- [x] **2026-04-29 — Tools audit TS-3 closed.** EncarClient hero photo и lightbox теперь используют Next.js Image Optimizer с AVIF/WebP конверсией. `ci.encar.com` whitelisted в `next.config.ts` `images.remotePatterns`. Mobile 4G users получают ~50-80% smaller photo bytes per request; UX (lightbox open/close, escape, aria) — байт-в-байт. См. ADR `[2026-04-29] Tools audit TS-3 — EncarClient image optimization`.
- [x] **2026-04-29 — Tools audit TS-2 closed.** EncarClient.tsx и ResultView.tsx (auction-sheet) мигрированы с raw `motion` на `m` (LazyMotion-compatible) — extends P-3 + CD-3 bundle wins to tools entry paths. NoscutCard.tsx остаётся последним raw-motion файлом (tracked under MA-4). Pattern идентичен CD-3 (один import + один JSX tag pair rename per файл). См. ADR `[2026-04-29] Tools audit TS-2 — EncarClient + ResultView motion → m`.
- [x] **2026-04-29 — Tools audit TS-1 closed.** Both `/tools/auction-sheet` и `/tools/encar` теперь сигналят completion analysis через 4 канала: smooth scroll-into-view, ARIA live region (role=status, persistent в DOM), `document.title` mutation, CSS ring-flash animation. Honors `prefers-reduced-motion`. Pattern документирован как R-FE-4 в `rules.md`. Открыта серия Tools audit (Vasily mobile UX feedback — юзеры не понимали, когда анализ завершён). См. ADR `[2026-04-29] Tools audit TS-1 — async completion signal`.
- [x] **2026-04-29 — Car detail audit series CLOSED (4/4 resolved).** CD-1 (horizontal overflow + R-FE-3 grid trap rule), CD-2 (correctness: cache, currency, description, lazy thumbs, text wrapping), CD-3 (LazyMotion m migration + CLS fix), CD-4 (Vehicle schema + BreadcrumbList + thumb a11y). Open Technical Debt от серии: CD-DEBT-1. См. ADR `[2026-04-29] Car detail audit series — final summary`.
- [x] **2026-04-29 — Car detail audit CD-4 closed.** Schema.org Product upgraded до Vehicle с mileage, engine, transmission, bodyType, color (drivetrain и enginePower deferred к CD-DEBT-1 из-за enum/unit ambiguity). BreadcrumbList JSON-LD добавлен на /catalog/cars/[id]. Thumb-кнопки CarGallery получили aria-label и aria-current. См. ADR `[2026-04-29] Car detail audit CD-4 — SEO + a11y`.
- [x] **2026-04-29 — Car detail audit CD-3 closed.** CarCard.tsx и CarTrustBlock.tsx мигрированы с raw `motion` на `m` (LazyMotion-compatible) — закрывает gap для car detail entry path, оставленный P-3. CarCard hover:scale-[1.02] заменён на hover:-translate-y-1 — устраняет CLS на «Other cars» grid. Adjacent компоненты (NoscutCard, EncarClient и др.) ещё используют raw motion — зарегистрированы как Technical Debt MA-4. См. ADR `[2026-04-29] Car detail audit CD-3 — CarCard + CarTrustBlock motion → m + CLS fix`.
- [x] **2026-04-29 — Car detail audit CD-2 closed.** Пять корректировок в `src/app/catalog/cars/[id]/page.tsx` и `src/components/catalog/CarGallery.tsx`: (A1) `getAllCars` обёрнут в `React.cache()` для dedup per-request reads — экономит ~275ms. (A2) Schema.org `priceCurrency` отражает `car.currency` для Korea/Japan, не всегда CNY. (A3) Schema.org `description` — truncated excerpt из `car.description` (300 chars, word-boundary). (B5) Thumb-images lazy-load кроме первого. (C2) Удалён `[overflow-wrap:anywhere]` с трёх description-блоков (сохранён на h1). Визуально страница идентична. См. ADR `[2026-04-29] Car detail audit CD-2 — correctness + perf cleanup`.
- [x] **2026-04-29 — Car detail audit CD-1 closed.** Horizontal overflow on `/catalog/cars/[id]` mobile fixed via `min-w-0` на двух grid items в `page.tsx`. Корневая причина: grid item default min-width: auto + nested flex/overflow-x-auto child = parent expansion past viewport. Diagnostic command (`scrollWidth vs clientWidth + getBoundingClientRect traversal`) сохранён в ADR для будущих audit'ов. Открыта серия Car detail audit (Vasily обозначил страницу как «больше всего визуальных багов»). См. ADR `[2026-04-29] Car detail audit CD-1 — horizontal overflow fix` и новое правило `R-FE-3` в `rules.md`.
- [x] **2026-04-29 — Mobile audit series CLOSED (12/12 resolved).** Implemented: P-1+P-2 (image optimizer + hero-bg compression), P-3 (LazyMotion + m migration), P-4 (HowItWorks unified responsive), P-5+P-9 (viewport meta + safe-area inset), P-6 (FloatingMessengers auto-hide), P-12 (Testimonials scroll signal + width fix). Verified/deferred: P-7 (verified visually), P-10 (conscious deferral), P-11 (verified code), P-8 (researched, deferred). Open Technical Debt от серии: IaC-1, MA-1, MA-2, MA-3. См. ADR `[2026-04-29] Mobile audit series — final summary`.
- [x] **2026-04-29 — Mobile audit P-8 closed (researched, deferred).** Next.js 16 Server Components не делают code-splitting Client Component dynamic imports (documented limitation, vercel/next.js issues #61066, #58238, #66414). Workaround через Client Component wrapper deemed not worth complexity для ~10-20 KB gain после P-3 (framer-motion bundle уже сокращён 7.4×). Tracked как MA-3 с reopen trigger (Lighthouse < 80 / INP > 200ms / +5 секций). См. ADR `[2026-04-29] Mobile audit P-8 — researched, deferred`.
- [x] **2026-04-29 — Mobile audit P-7 closed (verified visually).** Hero на 360px: заголовок переносится корректно, кнопки на всю ширину карточки, stats-сетка читается. No code change needed. См. ADR `[2026-04-29] Mobile audit closing cleanup`.
- [x] **2026-04-29 — Mobile audit P-11 closed (verified code).** YandexMetrika уже использует `strategy='afterInteractive'` — оптимальная стратегия для analytics. No code change needed. Отдельный вопрос webvisor=true — Technical Debt MA-2 (продуктовое решение). См. ADR `[2026-04-29] Mobile audit closing cleanup`.
- [x] **2026-04-29 — P-12 fix закрыт.** Testimonials mobile-карточки получили deterministic ширину `w-[85vw] max-w-[320px]` вместо `min-w-[280px]` — длинный testimonial-текст теперь wrap'ится внутри границ карточки на всех mobile viewport'ах (360 / 412 / 430). Pagination dots и scroll-snap из исходного P-12 продолжают работать. См. ADR `[2026-04-29] Mobile audit P-12 — Testimonials mobile scroll signal` секция Post-deploy fix.
- [x] **2026-04-29 — Mobile audit P-12 закрыт.** Testimonials секция получила `snap-x snap-mandatory` + `snap-start` на mobile horizontal-scroll, плюс decorative pagination dots (5 точек) под карточками. Active dot обновляется через IntersectionObserver с `root: containerRef.current` (без явного root observer не сработает на horizontal scroll). Desktop grid не задет. См. ADR `[2026-04-29] Mobile audit P-12 — Testimonials mobile scroll signal`.
- [x] **2026-04-29 — Mobile audit P-6 закрыт.** FloatingMessengers FAB теперь auto-hide на любом элементе с атрибутом `[data-fm-hide="true"]` в viewport (через IntersectionObserver). LeadForm opt'ин — единственная правка в файле, атрибут на root `<form>`. На 360-414px touch conflict между FAB и submit-кнопкой формы устранён. При раскрытом menu и появлении формы — menu collapse'ится вместе с FAB. См. ADR `[2026-04-29] Mobile audit P-6 — FloatingMessengers auto-hide on forms`.
- [x] **2026-04-29 — Mobile audit P-5+P-9 закрыт.** В `layout.tsx` экспортирован `viewport: Viewport` с `viewportFit: 'cover'` и `themeColor: '#1E3A5F'`. В Header добавлены `env(safe-area-inset-top|left|right)` для notch / Dynamic Island в portrait + landscape. В Hero верхний padding адаптирован через `calc(7rem + env(safe-area-inset-top))`. На устройствах без выреза поведение не меняется (env=0). См. ADR `[2026-04-29] Mobile audit P-5+P-9 — viewport meta and safe-area inset`.
- [x] **2026-04-29 — Mobile audit P-4 закрыт.** HowItWorks unified responsive layout: один блок вместо двух дублирующих (`hidden md:grid` + `md:hidden`). 90 DOM-узлов → 45, 10 motion-инстансов → 5. Иконка + small number badge на каждом breakpoint'е — больше нет потери информационной семантики между mobile (только цифры) и desktop (только иконки). См. ADR `[2026-04-29] Mobile audit P-4 — HowItWorks unified responsive layout`.
- [x] **2026-04-29 — P-1+P-2 bug hunt полностью закрыт.** Image optimizer работает на проде: AVIF/WebP с responsive srcset для всех `<Image>` на сайте. hero-bg.jpg сжат с 6.94 MB до 56 KB AVIF (124× меньше). DevTools Console чистая. См. ADR `[2026-04-29] Mobile audit P-1+P-2` со всеми тремя секциями fix'ов и Closure.
- [x] **2026-04-29 (poslepoldnia) — P-1+P-2 fix #2 закрыт.** Расширен `localPatterns` в next.config.ts на `/storage/**`. Браузерный smoke-тест на проде — главная без ошибок 400 в DevTools Console. P-1+P-2 серии Mobile audit функционально полностью завершён. Bug hunt по 400 на /_next/image закрыт (см. ADR расширенный с секциями Post-deploy fix #1 и #2).
- [x] **2026-04-29 (vechelnyaya) — P-1+P-2 fix закрыт.** Добавлены `qualities: [75, 85]` и `localPatterns` в next.config.ts. Production curl `/_next/image?url=%2Fimages%2Fhero-bg.jpg&w=1920&q=85` вернул HTTP/2 200 + content-type: image/avif. P-1+P-2 серии Mobile audit функционально завершён.
- [x] **2026-04-29 — Mobile audit P-1+P-2 закрыт.** В next.config.ts включён image optimizer (AVIF/WebP, mobile-first deviceSizes 360/414). sharp в production dependencies. hero-bg переcжат с 6.62 MB до 148 KB JPEG. Ссылка в Hero обновлена. Production curl-проверка `/_next/image` подтвердила выдачу AVIF/WebP с правильным content-type. См. ADR `[2026-04-29] Mobile audit P-1+P-2`.
## In Progress

- [~] Phase 2: Tariff monitoring (check-tariffs.ts + cron)
- [~] Phase 5: Finalization (SEO audit, mobile check, sitemap)
- [~] Merge all branches into main
- [~] Regenerate bot token in BotFather (Step 0 — manual, pending)

## Active strategic work

> Multi-prompt strategic series currently being executed. Each entry stays here until closure, then moves to Done.

### NEW-1 — Yandex Metrika API integration

**Status:** Discovery.

**Цель:** Реализовать автоматический pull данных из Яндекс.Метрики через Counter API + Reporting API без скриншотов и ручного экспорта. Это enabler для NEW-2 (анализ конверсии): без программного доступа к данным анализ конверсии — одноразовая активность; с интеграцией он становится повторяемым процессом, питающим решения по продукту.

**Зависимости:** unblocks NEW-2 (Conversion analysis + fixes).

**What needs research:** (1) какие endpoints Reporting API покрывают нужные срезы — воронка catalog → car → lead, mobile/desktop split, поведение на /tools/*, источники трафика → конверсия; (2) модель авторизации — OAuth flow + counter ID, где хранить refresh-token, как обновлять access-token; (3) rate limits API и стратегия pagination для исторических данных; (4) формат локального хранилища — daily JSON snapshots в storage/metrika/ vs SQLite vs аггрегация на лету; (5) webvisor data — отдельный API endpoint, или приходит вместе с обычными отчётами.

**Следующий шаг:** discovery prompt по skill research-protocol — 4-фазное исследование Metrika API endpoints, OAuth flow, и архитектуры локального cache. После discovery — план серии implementation-промптов.

### NEW-2 — Conversion analysis and fixes

**Status:** Blocked on NEW-1.

**Цель:** Найти и устранить причины низкой конверсии в заявки на сайте jckauto.ru. На текущий момент трафик есть, заявок мало — гипотезы где отвал нужно проверить через данные Метрики, не через предположения.

**Зависимости:** blocked on NEW-1 (Yandex Metrika API integration). Без автоматического pull данных серия откладывается.

**What needs research:** (1) воронка catalog → car detail → click «Оставить заявку» → отправка формы — где главные точки отвала; (2) mobile vs desktop split — после серии Mobile audit (12/12 закрыто 2026-04-29) мобила должна показывать улучшение; если хуже desktop — найти конкретные баги; (3) /tools/auction-sheet и /tools/encar — приносят ли вообще заявки, или просто «полезный сервис без конверсии»; (4) каналы трафика → конверсия по каналу — есть ли источники с высоким объёмом и нулевыми заявками; (5) поведенческие паттерны через webvisor — где сессии заканчиваются без действия; (6) entry pages с высоким bounce.

**Параллельные баги:** при любом аудите находки фиксятся в той же сессии, не откладываются. Это явное правило этой серии — не накапливать TD во время conversion-работы.

**Следующий шаг:** ждём закрытия NEW-1. После — discovery prompt по skill research-protocol с реальными данными воронки на руках. Затем план серии fix-промптов.

## Planned — Site

- [ ] Mobile responsiveness — full page-by-page audit
- [ ] Register in Yandex.Webmaster and Google Search Console
- [ ] Site: unify CTA style across conversion surfaces. Target pattern is **inline buttons** with site link + LeadFormTrigger ("Оставить заявку"), as used on `/tools/encar` result view. Audit candidates: all `/services`-labelled pages (/tools/*), car detail pages, noscut detail pages, any other result view that currently shows a plain text link or a lone phone button. Consistency gain: users always see the same "get-in-touch" affordance regardless of which tool they use.
- [ ] **NEW-4: Новые article-types в news-pipeline.** Расширить existing генератор статей в `src/services/articles/generator.ts` двумя новыми article kinds: (a) «Описание популярной модели» — характеристики + плюсы/минусы + цена под ключ + наша рекомендация; формат подходит для commercial intent SEO («обзор Toyota RAV4», «что взять Hyundai Tucson или Kia Sportage»); (b) «Сравнение моделей» — side-by-side таблица 2-3 модели + вердикт; формат для conversion-driven content. Использует существующий pipeline (DeepSeek text + DashScope cover), новые prompt templates для двух типов. **Зависимости:** после NEW-2 (анализ конверсии может изменить приоритет — какие модели и сравнения максимально востребованы аудиторией).

## Planned — Bot

- [ ] Auto-post new cars to channel t.me/jckauto_import_koreya
- [ ] AI consultant (Claude API + knowledge base)
- [ ] Bot: add PDF download for auction-sheet and encar results, matching the website's PDF export. Goal: feature parity between bot and site. Investigate whether existing PDF generator (from `/api/tools/*/pdf` routes) can be reused server-side and streamed to Telegram.
- [ ] Bot: clarify queue and rate-limit semantics for auction-sheet and encar in the bot — currently unclear whether the bot enforces the same async queue / 2-minute cooldown contract as the website, or whether it bypasses them. If bypassed, system overload is possible under concurrent bot+site traffic. Audit and, if needed, route bot calls through the same queue + rate-limiter layer used by `/api/tools/*`.
- [ ] **NEW-3: Bot subscription tracking from /tools/* result views.** Гипотеза: пользователи /tools/auction-sheet и /tools/encar получают результат на сайте, видят CTA вернуться к боту (или должны его видеть), но связка «использовал инструмент → подписался на бота» не отслеживается или сломана. **What needs investigation:** (a) что записывается в `botStats.ts` сейчас — per-command stats есть, но per-user-source attribution — неизвестно; (b) `pendingSource: Map` в request.ts — связан ли с tracking подписки или только с lead source; (c) есть ли вообще CTA «продолжить через бота / получать обновления» на result-views /tools/auction-sheet и /tools/encar; (d) если CTA есть — какой URL ведёт в бота (есть ли deep-link с source-параметром). **Outcome ожидаемый:** либо подтверждение, что связка работает (тогда задача сводится к dashboard'у со статистикой), либо identification места разрыва (тогда T2-фикс).

## Planned — Infrastructure

- [ ] Set up monitoring/alerting for PM2 processes
- [ ] Allion-specific auction sheet stabilization (see bugs.md С-5 — DeepSeek JSON parse fail diagnostics)
- [ ] Middleware-manifest regression investigation — PM2 720+ restart loop (see bugs.md Б-7)
- [ ] Capture-deploy-log workflow registration verification (see bugs.md Б-8)
- [ ] OCR label-swap mitigation in auction-sheet Pass 1 — qwen-vl-ocr occasionally misassigns adjacent label/value pairs on auction sheets (example observed 2026-04-18: 最大積載量 label paired with 寒冷地仕様 value that belongs to a different field). Result: seats / bodyType / salesPoints often arrive empty on test sheets. Two candidate fixes: (a) post-process in Step 2 DeepSeek parser with reasoning prompt that catches mismatches, or (b) replace Pass 1 model with qwen3-vl-flash (already used in Pass 2 with good results). Requires diagnostic comparison before choosing.
- [ ] Cloudflare Worker: harmonize Telegram default-branch header forwarding with Anthropic branch pattern. Currently `worker/tg-proxy.js` default branch forwards `request.headers` wholesale (the Telegram API accepts this), while the `/anthropic/` branch uses a clean 4-header pattern (`Content-Type`, `x-api-key`, `anthropic-version`, `anthropic-beta` only — Anthropic API rejects extra CF-* / X-Forwarded-* headers). Defense-in-depth: apply the clean pattern to the Telegram branch as well — no functional change expected, but reduces future risk if Telegram API tightens header validation. Out of scope for Etap 1 (migration); pick up as a follow-up prompt on `worker/tg-proxy.js` when next touching it.
- [ ] Cloudflare Worker: add `console.log` at ingress (request received) and egress (response returned) of each of the four routing branches in `worker/tg-proxy.js`. Format: `[tg-proxy] {branch} in: {url.pathname}` and `[tg-proxy] {branch} out: {status} {elapsed_ms}ms`. Purpose: future latency debugging via Cloudflare Dashboard's Worker logs tab, without needing SSH into VDS. Currently the Worker has zero logging; any latency regression requires external `curl` reproduction to diagnose. Small-scope follow-up prompt.

## Planned — Technical debt

> Quality-of-life follow-ups discovered during the 2026-04-21 work session.
> None blocking, all worth doing before the next major refactor.

- [ ] **TS hygiene cleanup.** За 5 промптов 2026-04-26 накопилось 7 pre-existing TS errors (`npx tsc --noEmit`): `persistent: true` × 6 в `request.ts`/`start.ts` (поле reply-keyboard, не известное типам node-telegram-bot-api), `isolatedModules` × 1 в `botRateLimiter.ts:147` (требует `export type` для type re-exports). Build проходит благодаря `ignoreBuildErrors: true` в `next.config.ts`. Один промпт: расширить типы node-telegram-bot-api через module augmentation для `persistent: true` (или `// @ts-expect-error` с комментарием), исправить isolatedModules через `export type`. Не блокер, но раздражает в каждой сессии Claude Code.
- [ ] **DRY noscut.ts: extract slash + plain-text branches into shared function.** Сейчас две ветки (slash-command в `bot.onText(/\/noscut(.*)/)` и plain-text после пустого `/noscut` в новом `bot.on('message')`) дублируют rate-limit check + searchNoscut call + format + send. ~80 строк дубликата. Извлечь в `runNoscutSearch(bot, chatId, telegramId, query)` который вызывается из обоих мест. Низкий приоритет — рефактор после ещё одной модификации (правило тройки: после третьего повторения).
- [ ] **`pendingSource` Map без TTL.** `src/bot/handlers/request.ts` экспортирует `pendingSource: Map<number, string>` без механизма expiration. Запись очищается только при оформлении lead'а через явный `pendingSource.delete(chatId)`. Если пользователь видит кнопку «Оставить заявку» (после noscut/calc/customs/auction-sheet/encar) и не нажимает её — entry остаётся в Map'е до следующего захода через тот же tool (overwrite) или до restart процесса. Theoretical memory drift при долгой uptime, но keys=chatId ограничено userbase'ом (несколько тысяч). Архитектурная неопрятность, surfaced 5 раз в out-of-scope reports серии Б-новый-B (2026-04-27). Один T2 промпт: добавить TTL 5–10 минут аналогично паттерну `awaitingQuery: Map` в `noscut.ts` (lazy cleanup при обращении + `AWAITING_TTL_MS` константа). Без поведенческих изменений в нормальных сценариях.
- [ ] **Handler JSDoc audit — `@dependencies` field.** Convention inconsistent across `src/bot/handlers/*.ts`: некоторые файлы (`noscut.ts`, `auctionSheet.ts`, `encar.ts`, `request.ts`) имеют полноценный `@dependencies` блок в JSDoc-шапке, другие (`calculator.ts`, `customs.ts`, `start.ts`, `admin.ts`) — нет. Surfaced out-of-scope в промпте 3 серии Б-новый-B (calc/customs не получили обновление @dependencies на новый pendingSource импорт, потому что это поле отсутствовало целиком). Один T2 промпт: пройти все handler-файлы, добавить или дополнить `@dependencies` где отсутствует/неполный, зафиксировать конвенцию в `code-markup-standard` skill. Зацепка для skill-update: критерии "что включать в @dependencies" — runtime requirements (env vars, JSON files, sibling modules с side-effects) обязательно, чистые helpers — опционально.

### IaC-1 — nginx-конфиг вне git-репо

**Что:** конфигурация nginx (`/etc/nginx/nginx.conf` и `/etc/nginx/sites-available/jckauto`) живёт только на VDS. Git её не отслеживает. GitHub Actions deploy её не трогает.

**Почему это техдолг:**
- При краше VDS конфиг придётся восстанавливать по памяти и backup-файлам.
- История изменений конфига отсутствует — нельзя сделать `git log` или `git revert`.
- Каждая правка nginx — ручная операция оператора, не отслеживаемая в общем рабочем процессе проекта.
- 2026-04-29 baghunt по WebSocket-upgrade misconfiguration занял несколько итераций именно из-за того, что я не мог быстро увидеть полный конфиг — пришлось через MCP-чтение восстанавливать его по фрагментам.

**Возможные решения:**
1. Подпапка `infra/nginx/` в существующем репо JCK-AUTO. Симлинки на `/etc/nginx/sites-available/jckauto` и `nginx.conf`. Правки идут через PR, ручной apply на VDS (потому что reload nginx — административная операция).
2. Отдельный приватный репо `JCK-AUTO-infra` для всех системных конфигов (nginx, PM2 ecosystem, cron, systemd-units). Чище разделение, но больше overhead.

**Стоимость отсрочки:** низкая в обычное время (правки nginx редкие), высокая в момент инцидента (несколько часов на восстановление при отсутствии бэкапа).

**Когда открывать:** при следующей значимой правке nginx или при первом серьёзном инциденте. Сейчас — backup-файлы на VDS актуальны (`jckauto.backup-2026-04-29-bug-hunt`, `nginx.conf.backup-2026-04-29-bug-hunt`), что снимает immediate риск.

### MA-1 — Countries section hover-only effects (low priority)

**Что:** Карточки стран в `src/components/sections/Countries.tsx` используют hover-стили (`hover:border-china/korea/japan`, `hover:shadow-md`), которые на тач-устройствах не активируются.

**Почему техдолг, а не баг:** карточки декоративные (не Link, не onClick) — informational blocks, не интерактивные. Hover не ломает UX, просто бесполезен на мобиле. Стили парсятся, но не применяются.

**Возможное решение:** обернуть hover-стили в `@media (hover: hover)` через Tailwind variant `hover:` уже это делает в Tailwind 4 (по умолчанию hover применяется только на устройствах с hover). То есть фактически уже корректно. Минимальная экономия CSS bytes — не оправдывает изменение.

**Стоимость отсрочки:** нулевая. Регистрируем для полноты картины серии Mobile audit. Открывать только если возникнет связанная задача в Countries.tsx.

### MA-2 — Yandex Metrika webvisor performance trade-off

**Что:** в `src/components/layout/YandexMetrika.tsx` параметр `webvisor: true` включает запись пользовательских сессий — самую тяжёлую фичу Yandex Metrika по bundle size и runtime overhead на мобильных CPU.

**Почему техдолг, а не баг:** webvisor — рабочая фича, активно используется для UX-исследований. Это **продуктовое решение** (стоит ли webvisor мобильной производительности), не технический баг.

**Возможное решение:** обсудить с Vasiliy — сохраняем webvisor для аналитики или отключаем для мобильной производительности. Если отключать: одна правка `webvisor: true → false` в YandexMetrika.tsx.

**Стоимость отсрочки:** низкая. Webvisor влияет на metrics LCP/INP на ~5-15ms (estimate). Не критично, но измеримо. Открывать при следующей продуктовой ревью аналитики.

### MA-3 — Below-fold dynamic imports for home page

**Что:** `src/app/page.tsx` (Server Component) импортирует 10 client-секций главной (Hero + 9 below-fold). Все они попадают в initial JS bundle. Прямой `next/dynamic` на этих импортах не работает из-за ограничения Next.js 16 — Server Components не делают code-splitting Client Component dynamic imports.

**Почему техдолг, а не баг:** функционально всё работает. Bundle уже значительно сокращён в P-3 (framer-motion ~34 KB → ~4.6 KB). Дополнительная экономия от below-fold dynamic imports оценена в ~10-20 KB — измеримая, но не критичная для текущих CWV метрик главной.

**Возможное решение:** создать Client Component wrapper `BelowFoldSections.tsx` с `'use client'`, который делает `dynamic(() => import('@/components/sections/X'), { ssr: true })` для 9 below-fold секций, и импортить wrapper статически в page.tsx. Это даст реальное code-splitting. Cost: один новый файл-обёртка, потенциальная переоценка SSR-поведения секций (в обёртке `'use client'`, но дочерние секции остаются client с собственными SSR через Next.js).

**Стоимость отсрочки:** низкая. Текущий initial bundle главной приемлем для CWV. Открывать MA-3 при следующих условиях:
- Lighthouse mobile performance score падает ниже 80.
- Core Web Vitals INP > 200ms на real-user мониторинге.
- Появляется задача добавить ещё 5+ секций на главную (увеличит bundle).

**Связанная документация:** vercel/next.js issues #61066, #58238, #66414 (limitation подтверждён командой Next.js); App Router docs section "Lazy Loading" (workaround pattern).

### MA-4 — Remaining raw motion imports project-wide

**Что:** P-3 (Mobile audit, commit `b1bd44c`) перевёл 10 секций главной с `motion` на `m`. CD-3 (commit `5d7806a`) добавил CarCard + CarTrustBlock. TS-2 (этот коммит) добавил EncarClient + ResultView (auction). Остаётся raw `import { motion } from "framer-motion"` в:
- `src/components/noscut/NoscutCard.tsx` (рендерится на главной + `/catalog/noscut/*` — не на tools entry path)
- возможно других файлах — нужен полный audit `grep -rn 'from "framer-motion"' src/` при следующем заходе.

**Почему техдолг:** функционально работает (LazyMotion в MotionProvider обрабатывает любые motion-элементы потомков), но bundle размер на страницах с этими компонентами раздувается до полного framer-motion (~34 KB) при первом заходе. После завершения миграции можно включить `strict` mode в LazyMotion для защиты от регрессий — тогда любой случайный raw `motion` будет бросать runtime error.

**Возможное решение:** единым промптом-серией mige все оставшиеся компоненты — pattern идентичен CD-3 (replace import, rename JSX-теги). После — отдельный тщательный grep audit + включение `strict` на LazyMotion в MotionProvider.

**Стоимость отсрочки:** низкая. Bundle-impact на пользователях посещающих `/catalog/noscut` и `/tools/encar`. Открывать когда: будет связанная задача в этих файлах, или Lighthouse регрессия на bundle size, или запланированная "bundle hygiene" сессия.

### CD-DEBT-1 — Car detail page minor improvements (deferred)

**Что:** Технический аудит car detail page выявил ряд минорных улучшений, не реализованных в CD-1..CD-4 как не-блокеров и не-баги:
- **B4:** более точный `sizes` на главном фото галереи (текущий `(max-width: 768px) 100vw, 60vw` неточен — desktop фактически грузит до 768px image, можно оптимизировать до конкретного pixel value).
- **C1:** в page.tsx два JSX-блока с противоположными условиями (`description.length > 100` и `<= 100`) можно объединить через ternary в одну переменную.
- **C3:** `text-[#C9A84C]` (✓ галочки в "Что входит в стоимость") — hardcoded цвет, не из дизайн-системы. Заменить на `text-secondary` или вынести в design token.
- **C4:** Escape-key useEffect в CarCard можно упростить через custom hook `useKeyDown('Escape', handler, enabled)`.
- **D4:** `mt-3` на h1 info sidebar создаёт визуальную асимметрию относительно top edge галереи на desktop. Проверить намеренность.
- **driveWheelConfiguration** в Vehicle schema: `car.drivetrain` хранит "AWD"/"FWD"/etc.; Schema.org требует enum (`AllWheelDriveConfiguration`, `FrontWheelDriveConfiguration`). Нужен mapping table.
- **enginePower** в Vehicle schema: `car.power` хранит число, но unit (hp vs kW) неоднозначен в типе. Schema.org требует kW. Нужно подтвердить unit и конвертировать.

**Почему техдолг:** все пункты — стилистика, минорная оптимизация или non-critical SEO enrichment. Ни один не блокирует функционал и не ухудшает CWV.

**Возможное решение:** один T2 промпт-пакет на все 7 пунктов после получения данных по power-unit и составления drivetrain-enum mapping table.

**Стоимость отсрочки:** низкая. Открывать когда: будет связанная задача в car detail page, или появится систематическая работа по design tokens, или Lighthouse SEO score < 95.

- **TD-KC-1** — `.env.local` file permissions = 644 (стандарт Linux), should be 600 для secrets. Trigger: при следующем cleanup-pass на VDS — `chmod 600 /var/www/jckauto/app/jck-auto/.env.local`.
- **TD-KC-2** — `set -a; source .env.local` падает с `service_account,: command not found` на JSON значениях с запятыми (Google service account key). Workaround: для multi-line JSON значений — `export VAR="$(cat -)"` или per-key load. Не блокирует, но нужен явный workaround в documentation.
- **TD-KC-3** — `build/` директория закоммичена в fork atomkraft/yandex-metrika-mcp. Pre-compiled JS в repo — не идиоматично, нужен `.gitignore` + CI build step. При update fork с upstream — может конфликтовать.
- **TD-KC-4** — `transports: ['stdio']` в atomkraft wrangler.toml даёт TS2353 косметическую ошибку (runtime игнорирует). Если apply'им upstream patches — придётся либо игнорировать TypeScript errors, либо исправлять в fork. Сейчас `tsc --noEmit` на этой codebase не запускается в CI.
- **TD-KC-5** — `vds-files-mcp/server.py` (legacy название старого MCP сервера на yurassistent.ru) подлежит миграции в IaC-1 (когда созреет). Сейчас manually-deployed без version-control.
- **TD-KC-6** — Сейчас 2 «infra-» файла в `scripts/` (`infra-patch-mcp-deny.py`, `infra-mcp-yandex-metrika.conf`). При появлении 3-го — выделить в отдельную директорию (`infra/` или `scripts/infra/`). Это начало IaC-1 миграции.
- **TD-KC-7** — `/root/.pm2/logs` не в FILESYSTEM_ROOTS mcp-gateway, поэтому pm2-логи не читаются через JCK AUTO Files MCP. При диагностике приходится использовать SSH или просить Vasily копировать логи. Решение — добавить `/root/.pm2/logs` в FILESYSTEM_ROOTS (отдельный T1 промпт).
- **TD-KC-8** — `rules.md` split по доменам отложен (deferred from KC-4 master plan). File 257 lines, 28% over guideline, но 14 H2-секций с domain-system (R-FE-*, R-PROC-*, R-OPS-*) делают split нетривиальным — это re-architecture (T3), не date-based archive (T2). Trigger: при превышении 400 lines или domain-confusion ошибках.
- **TD-KC-9** — LightRAG cleanup в mcp_server.py (NEW-1.5 / pre2) отложен. Hybrid-код (filesystem + LightRAG tools) сейчас работает корректно — LightRAG calls просто возвращают ConnectError на :9621, MCP-клиент это переживает. Но deprecated код в server-файле — code smell. Trigger: при следующем major refactor mcp_server.py или если ConnectError начинает confuses Anthropic Custom Connectors.

## Backlog — added 2026-05-04 (Vasily hypotheses session)

### SALES-PRICE-1 — Background price calibration vs market

Background system that periodically checks our prices (cars + noscuts) against competitor prices. Iterative — small batches per day (e.g. 5 cars + 5 noscuts), not all at once. Alert in admin Telegram when our price diverges from market by more than X%. Threshold and methodology TBD via discovery prompt.

Discovery scope: identify competitor data sources (Encar API for cars? scraping for noscuts?), define "market price" formula (median? p25-p75 range?), pick alert thresholds, design rate-limiting of the comparison job.

Why high impact: today we have no signal that our prices have drifted out of market. A noscut listed at 30% above competitors gets zero leads silently. A car listed 10% below market is a margin loss we don't catch. This problem compounds as catalog grows.

Estimated: T2 discovery prompt + 3-5 implementation prompts.

### SALES-DESIGN-1 — Design audit for conversion friction

Page-by-page audit focused on conversion friction (not technical bugs). Targets: visual clutter, weak/watery copy ("how we work" filler), confusing icons, redundant blocks, hierarchy issues that cause bounce.

Differs from CAT-* technical audit (which looked for layout/overflow/JS bugs). This audit looks at "would I, as a serious buyer, take this site seriously?" through the eyes of representative target audience.

Discovery scope: list all main pages, prioritize by traffic + conversion impact (Yandex Metrika data), produce shortlist of friction points per page. Then individual fix prompts.

Estimated: T2 discovery + 5-10 fix prompts spread over weeks.

### SALES-IMAGES-1 — Image generation prompts iteration

Improve the visual quality of AI-generated cover images for news, articles, and noscut listings. Current pipeline: `coverGenerator.ts` (DeepSeek prompt → Flux watercolor → Sharp overlay). Goal: more realistic, more professional aesthetic.

Discovery scope: collect baseline (gallery of last 30 covers), define quality criteria (subjective scoring rubric), iterate on prompts, evaluate alternative image models (Flux Dev vs Pro vs other DashScope models), measure improvement.

Why moderate impact: poor cover images undercut content credibility. Users skim covers as proxy for content quality. A realistic, well-composed cover signals "real publication" vs "low-effort content farm."

Estimated: T2 discovery + iterative refinement, ongoing.

### SALES-SUB-1 — Bot subscription as gate after free-tier exhaustion (replace authorization-gate)

**Current state.** Three tools (`/tools/auction-sheet`, `/tools/encar`, `/tools/customs`) use a shared `TelegramAuthBlock` component as a rate-limit gate. Flow today: user gets 3 free attempts → on exhaustion, the block prompts authorization via Telegram Login Widget → on auth, user gets 10/day → user sees a "open in bot" deep link, but only **becomes a bot subscriber** if they then click `/start` inside the bot. From observed behaviour, very few users complete that final step. The bot subscription channel is mostly empty despite many tool authorizations.

**Decision (2026-05-04, Vasily).** Replace the authorization-gate with a **subscription-gate**. The 3-free-attempts mechanic stays exactly as today. After exhaustion, the user is asked to **subscribe to the bot** (not just authorize). The 10-requests-per-day quota for subscribed users stays the same. Only the gating mechanism changes: instead of "authorized → 10/day", it is "subscribed → 10/day".

**Why.** Tool users are high-intent (they tried the product). Bot subscription is the lowest-friction return channel for follow-up. Today we lose this channel because subscription is decoupled from the authorization step. Making subscription the gate captures this signal at source.

**Why not subscription-gate from attempt #1?** Vasily's principle: "We are still building authority and recognition. Three free attempts let users see value before we ask anything in return." When traffic grows, we may reduce the free-tier — see HYP-FREE-3.

**Discovery scope (next prompt — T2 research-protocol):**
- Read full current auth flow: `TelegramAuthBlock.tsx`, `/api/auth/telegram` route, hooks in auction-sheet/encar/customs that integrate auth state.
- Determine how the server detects subscription status (Telegram Bot API `getChatMember`? webhook on `/start`?).
- Plan migration: existing authorized-but-not-subscribed users — preserve their 10/day quota or require re-subscription? Recommend "preserve" to avoid breaking active users.
- Plan UI copy: clear, single-action prompt "Подпишитесь на бот, чтобы продолжить" with one button → bot deep link → automatic return + status check.
- Define the persistence: how does the site know "this telegram_id is subscribed" — server-side cookie/JWT, or fresh check on each request?
- Estimate: 1 discovery prompt + 2-3 implementation prompts.

**Original tracking.** First registered as NEW-3 (pre-INFRA cleanup), then as SALES-SUB-1 (autosubscription approach 2026-05-04 morning), now finalized as subscription-gate per closing discussion.

### SALES-CALC-1 — Lead capture form embedded in calculator results

**Current state.** `/tools/calculator` ("Калькулятор «под ключ»") is open without authentication, no rate limit, no lead capture. User enters parameters (year, engine, country, etc.), sees the cost breakdown, and leaves. We have no way to follow up — the high-intent moment ("user has just seen a real number for a real car") passes silently.

**Decision (2026-05-04, Vasily).** Add a lead-capture form **embedded directly under the calculator results** (not a modal, not a separate page). Form pre-fills `subject` field with the calculation summary so the manager seeing the lead in Telegram immediately knows which car the user was researching.

**Why.** This is our primary lead-capture surface ("форма захвата" per Vasily). The calculator stays open and ungated to maximize top-of-funnel reach. The form converts people who see a result they can act on. The pre-filled subject makes the lead instantly actionable for the manager (no need to re-ask the user what car they were looking at).

**Discovery scope (next prompt — T2 research-protocol):**
- Read `/tools/calculator` page, identify result-rendering component and the data shape of the calculation result.
- Decide form placement: directly under result cards? After a slight delay/scroll? Always visible vs. only after first calculation?
- Decide subject formatting: structured ("Расчёт: Toyota Camry 2020, 2.5L, Корея — 3 200 000 ₽") vs. free-text. Recommend structured.
- Decide whether to reuse `LeadForm.tsx` (already wired to /api/lead + leadPersistence) or create calculator-specific variant. Recommend reuse — saves implementation, gets all CRIT-1/SALES-CRIT-2/SALES-PERSIST-1 mechanics for free.
- Verify rate-limit behaviour: calculator is ungated, but lead submissions go through /api/lead's 5/15min limit per IP. This is correct (anti-spam), no change.
- Estimate: 1 discovery prompt + 1-2 implementation prompts.

### HYP-FREE-3 — Reduce free attempts when traffic grows (deferred hypothesis)

**Hypothesis.** When tool traffic grows past current scale (TBD threshold — likely when authentication/subscription costs become non-negligible, or when free-tier abuse becomes visible), we reduce the 3-free-attempts limit on `/tools/auction-sheet`, `/tools/encar`, `/tools/customs` to 1 or 2.

**Status: deferred.** Vasily's principle (2026-05-04): "We are still building authority and recognition. Three free attempts is the right balance now." Do NOT act on this until one of these signals appears:
- DashScope/DeepSeek API costs from anonymous tool usage exceed [TBD] per month.
- Anonymous lifetime ip-key records in `rateLimiter.ts` show abuse pattern (same IP returning monthly to consume 3-attempt window).
- Bot subscription rate after SALES-SUB-1 lands is below [TBD]% of unique tool users (suggests 3-free is too generous to drive subscription).

**Action when triggered.** A simple change in `src/lib/rateLimiter.ts` — change the constant `ANON_LIFETIME_LIMIT` (or equivalent) from 3 to the new value. Plus knowledge update + comms in bot/site about new policy.

**Estimate.** 1 small T1 prompt when triggered.

## Strategic initiatives

> Larger-scope initiatives that wait for the current bug list to clear. Each entry is an idea that **requires deep research and design before implementation** — not a ready-to-prompt task. Numbered for reference only, not priority-ordered.

### 1. Admin dashboard with analytics + mini CRM

Comprehensive admin dashboard covering the site's observable state:
- **Site traffic** — visitors, sessions, source breakdown (direct, search, social, referral, messenger).
- **Conversion actions** — leads submitted via `/api/lead`, auction-sheet decodes completed, encar analyses, calculator usages, PDF downloads, catalog card views.
- **Traffic sources** — UTM attribution, referrer breakdown, channel-level conversion funnel.
- **Bot statistics** — existing `botStats.ts` surfaced in a UI (currently `/stats` command only).
- **Service usage** — per-tool breakdown of `/tools/*` usage with rate-limiter state.
- **Subscription data** — channels, messaging platforms, newsletters (once introduced).
- **Mini CRM** — requests history, customer data, manager notes, pipeline state.

**Status:** Idea. Requires a dedicated discovery phase before the first prompt — data model, auth model, privacy compliance (152-ФЗ), storage strategy (current file-based `storage/` vs database migration), UI surface (separate admin route vs feature-flagged sections).

### 2. Page-by-page site audit

Full-site audit, one page at a time, against these criteria:
- **Mobile adaptation** — layout breakage, touch targets, readable font sizes.
- **Usability** — navigation clarity, information scent, primary-action visibility.
- **UI/content simplification** — remove overloaded sections, cut redundant copy, tighten visual hierarchy.
- **SEO** — metadata uniqueness, canonical URLs, structured data, internal linking, image alts.
- **Bugs** — visual regressions, broken interactions, console errors.
- **Conversion uplift** — CTA placement, form friction, trust signals near conversion points.
- **Company reputation** — testimonials, warranty claims, social proof consistency.

**Status:** Idea. Requires a page inventory first (`src/app/**/page.tsx` + dynamic routes from catalog/news/blog/noscut), then a per-page audit checklist, then prioritisation by traffic × conversion-impact. Likely a multi-prompt series, one page per prompt.

### 3. Growth analytics on services and sections

Analytics research to identify **which services and sections can further increase traffic or conversion**. Examples of the kind of questions this should answer:
- Which `/tools/*` page has the highest entry rate vs conversion rate — where is the funnel leaking?
- Are there underused sections (noscut, news, blog) that deserve more navigation prominence?
- Are there search intents that the site does not currently address but could (e.g., "растаможка BYD", "Hyundai из Кореи цена" — specific queries where a dedicated landing page would capture traffic)?
- Where does the catalog lose users — listing vs detail vs lead form?

**Status:** Idea. Requires (a) analytics integration first — the current site has no systematic analytics (Yandex.Metrika, GA, or equivalent). Depends on initiative #1 for data surface. Can also run partially on server-side access logs + bot stats.

### 4. Accessibility migration — clickable non-button elements to native <button>

Current site has multiple `<div onClick>`, `<span onClick>`, `<li onClick>`-style clickable elements. Adding `cursor-pointer` (closed via С-2 fix on 2026-04-26) addresses the visual hover feedback, but the underlying accessibility gaps remain:

- **Keyboard navigation** — div-with-onClick is not in the natural Tab order. Power users and accessibility-tooling users cannot reach these affordances via keyboard alone.
- **Screen reader semantics** — div-with-onClick announces as generic "clickable region", not "button". Loses role information.
- **Focus styles** — without `tabIndex` and explicit focus-visible rules, the user can't see which element currently has focus when navigating by keyboard.
- **Activation** — div-with-onClick reacts to mouse click, but not to Enter or Space key, which are the standard button-activation keys.

**Status:** Idea. Requires discovery before the first prompt:
- **Audit scope** — count of div-with-onClick across `src/**/*.tsx`. Categorize by component type (modal close, list item, toggle, custom dropdown, etc.).
- **Design decision** — universal `<Clickable>` wrapper that emits a properly-attributed button vs per-case migration to native `<button>` with unstyled CSS. Trade-off: wrapper is one PR but adds a layer; per-case is many PRs but stays close to the platform.
- **Migration order** — start with high-traffic conversion paths (LeadFormTrigger, CarSidebarActions, header/menu items) because that's where keyboard / screen-reader users are most likely to hit walls.
- **Acceptance criteria** — automated check (eslint-plugin-jsx-a11y `click-events-have-key-events` rule + `interactive-supports-focus` rule) reports zero violations after migration. Plus manual smoke-test of Tab → Enter activation across each migrated surface.

**Closes:** the long tail of UX issues in С-2 family — cursor-pointer fix is the visible symptom; this initiative addresses the root accessibility gap.

### 5. ItemList JSON-LD on /catalog for Rich snippet

**What.** Schema.org `ItemList` structured data на server-rendered first page of /catalog cars, чтобы Google генерировал carousel-snippet «Автомобили в наличии — Toyota RAV4, Hyundai Tucson, …» в SERP для commercial intent queries вроде «купить авто из Кореи», «авто из Японии в наличии», «Hyundai из Кореи цена». Существующий BreadcrumbList JSON-LD (CAT-1b) даёт breadcrumb-snippet; ItemList — отдельный enrichment, дополняющий, не замещающий.

**Status:** Idea. Researched в чате при закрытии CAT-* серии 2026-05-02, deferred от scope page-by-page audit потому что enhancement (новый Rich snippet type), не common-error fix или regression. Серия CAT-* предназначалась для частых ошибок в существующих паттернах, ItemList выходит за этот scope.

**What needs research before first prompt:**
- Точное число cars в server-render первой страницы при `dynamic = 'force-dynamic'`. ItemList должен содержать только cars, реально присутствующие в initial HTML — иначе Google пометит mismatch'ем. Если caталог пагинируется client-side, нужен явный server-side slice (например, первые N) для structured data.
- Какие поля `Car` входят в каждый `ListItem` — кандидаты: `name` (mark + model + year), `image` (первое фото из gallery), `url` (`/catalog/cars/{id}`), `offers.price` (priceRub если есть, иначе native + currency), `brand`, `model`, `vehicleModelDate`. Совместимость с CD-4 Vehicle schema на детальной странице важна — фактический ItemList на /catalog должен ссылаться на canonical URL карточки, где живёт детальный Vehicle JSON-LD.
- Как взаимодействует ItemList с client-side filtering. После применения фильтров пользователем DOM меняется, но JSON-LD блок в `<head>`/initial HTML остаётся прежним. Google индексирует initial render — этого достаточно. Но нужно проверить, что filtering НЕ удаляет JSON-LD из DOM каким-то re-render'ом.
- Ожидаемый rich-snippet preview через Rich Results Test (https://search.google.com/test/rich-results) до production deploy. Должен показать «Carousel» eligible status с zero warnings и zero errors.

**Cost of deferral.** Низкая. Текущий BreadcrumbList уже даёт breadcrumb-snippet в SERP для /catalog. ItemList — дополнительный Rich snippet type, не блокирующий existing SEO win. Каталог сейчас индексируется как обычная listing-страница, traffic не теряется без ItemList — теряется только потенциал carousel-presentation в SERP.

**When to open.** При следующей итерации SEO-улучшений каталога. Альтернативно: когда Search Console покажет, что breadcrumb-snippet от CAT-1b активен и стабилен (signal что Google принимает наш JSON-LD на listing-страницах) — тогда есть высокая уверенность, что ItemList тоже будет принят. Третий триггер: при добавлении новых типов listing-страниц (например, /catalog/noscut получит свой ItemList; /tools — если когда-нибудь станет реальным каталогом инструментов).

### 6. Content factory — ТГ-группа / Instagram / YouTube

Автоматизированный content pipeline по принципу news-pipeline (RSS → DeepSeek → covers → JSON), но для социальных каналов компании. Цель — превратить маркетинговый сток (новости + блог + каталог) в постоянный поток постов в трёх каналах: ТГ-группа, Instagram, YouTube. Каждый канал имеет свой формат, ритм, и тип визуала.

**Status:** Idea. Discovery deferred until NEW-2 (Conversion analysis) closes — анализ конверсии может изменить приоритет каналов (например, выяснится, что Instagram даёт 0 трафика и фокусироваться на нём бессмысленно).

**What needs research before first prompt:** (a) аудит существующих социалок — что активно, что заглохло, какие audience metrics; (b) выбор приоритетного канала для MVP — один канал, не три сразу; (c) формат контента per channel — для ТГ-группы достаточно текст + лёгкая картинка, для Instagram нужен carousel или Reel, для YouTube — видео (что критично — генерация видео или просто превью?); (d) расписание и лимиты публикаций per channel; (e) метрики успеха — engagement, переходы на сайт, attributions от соцсетей к заявкам.

**Cost of deferral:** медленная — соцсети работают долгосрочно, упущенная неделя не критична. Но без них компания зависит только от поиска и прямых переходов — диверсификация трафика отсутствует.

**When to open:** после закрытия NEW-2 (conversion analysis даёт данные о текущих каналах трафика и conversion-impact) или по явному решению Vasily запустить параллельно.
