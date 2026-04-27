<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources + strategic initiatives
  @updated:     2026-04-27
  @version:     1.23
  @lines:       323
-->

# Roadmap

> For detailed open bugs see bugs.md

## Recent Activity

> Журнал последних сессий. Новые записи на верх. После 10 записей — старые
> переносятся в roadmap-archive-N.md.

### 2026-04-27 — Серия Phase 5b закрыта (4 промпта): users.ts honest sync API

- **Сделано:** четыре последовательных промпта закрыли серию Phase 5b. (1) `fdcd08c` — `start.ts`: убраны три `await` перед `saveUser`. (2) `bab3fce` — `request.ts`: удалены два вызова `await ensureUsersLoaded()`, сняты два `await` перед `savePhone`, удалён импорт `ensureUsersLoaded`, переписан шапочный `@rule` (lazy-load → sync-init контракт). (3) `4425d41` — `admin.ts`: сняты три `await` перед `getUsersStats`/`getAllUsers`, добавлена минимальная JSDoc-шапка (отсутствовала). (4) этот коммит — `users.ts`: `saveUser`/`savePhone`/`getAllUsers`/`getUsersStats` стали честно sync (ушёл `async`, ушли lazy-load fallbacks `if (!loaded) loadUsers()`), `ensureUsersLoaded` удалён целиком, шапка переписана. Knowledge: ADR `[2026-04-27]` записан в `decisions.md`, INDEX.md обновлён.
- **Прервались на:** серия Phase 5b закрыта полностью | **Следующий шаг:** возврат к нормальной очереди задач (Phase 2 мониторинг тарифов, Phase 5 финализация SEO/mobile/sitemap, регенерация bot token, открытые баги Б-5/Б-6/Б-7/Б-8, С-8 encar handler timeout).
- **Контекст:** Phase 5a (commit `f90d7e5`, 2026-04-26) перевела внутренности `users.ts` на sync-init с сохранением async-сигнатур для backward compatibility. После 24+ часов чистого production soak (uptime > 24h, restart_time = null, ноль `[users]` ошибок в stderr, `[bot] users loaded: 50` подтверждён в startup logs) запущена Phase 5b. Серия из 4 промптов под one-task-one-prompt дисциплиной — каждый промпт оставлял repo в build-зелёном состоянии.
- **Структурные уроки серии:** (1) AC-grep'ы должны использовать anchored patterns + фильтр на JSDoc — naive grep на имени функции ловит её упоминание в комментариях; (2) line numbers в промптах быстро устаревают после правок — использовать якорные подстроки вместо номеров строк; (3) проверка mерджа в main делается чтением файла на VDS через MCP, не запросом команды у пользователя; (4) deprecated-флаг для функции, у которой ноль внешних потребителей — техдолг, не backward compat (обоснованно удалена `ensureUsersLoaded` целиком).
- **Ссылки:** четыре коммита серии — `fdcd08c`, `bab3fce`, `4425d41`, этот коммит. ADR `[2026-04-27] users.ts Phase 5b — honest sync API completed` в `decisions.md`.

### 2026-04-26 — Большая рабочая сессия: 11 коммитов, 8 закрытых задач

- **Сделано (по коммитам, в порядке хронологии):**
  - `a3f3fcf` — синхронизация roadmap (3 ложно-открытых пункта в Done) — отдельная Recent Activity запись ниже.
  - `6d8d3d5` — удалён workflow `audit-vds.yml` из main (cleanup leaked-secret хвоста, force-push на feature-ветке `claude/audit-mcp-gateway-lightrag` отдельно).
  - `502d818` — **Б-4 закрыт**: добавлены inline-кнопки `🔍 Расшифровать аукционный лист` и `🇰🇷 Анализ авто с Encar` в стартовое меню бота с инструкциями.
  - `0a5eee4` — **/noscut state machine**: per-chat `awaitingQuery` Map с TTL 5 минут, следующее plain-text сообщение после пустого `/noscut` обрабатывается как поисковый запрос.
  - `e8df54a` — **Промпт 2.3 (auction-sheet progress indicator)**: `editMessageText` на 30s/60s/90s thresholds, пользователь видит движение вместо тишины.
  - `b454912` — **`await handleRequestCommand` в catalog.ts:375** (вместо запланированного `void`): callback уже async, sibling calls awaited — `await` это правильный фикс floating-promise.
  - `f90d7e5` — **users.ts Phase 5a (sync-init internal)**: load на старте через `loadUsers()` в index.ts (паттерн `fileIdCache.loadCache`), public API сохранён async для backward compatibility, Phase 5b после 24h soak.
  - `0a2fbd9` — **AuctionSheetClient polling hook extraction**: новый `useAuctionSheetJob` hook с discriminated-union `JobState` (6 phases), orchestrator -133 строки.
  - `196ac3d` — **С-2 закрыт**: site-wide cursor-pointer на 5 `<div onClick>` + `@rule` в knowledge/rules.md.
  - `7d0d0e4` — Strategic initiative #4 "A11y миграция clickable non-button → native button" зарегистрирована в roadmap.
  - `e24bbb1` — С-2 формально закрыт в bugs.md, Recent Activity запись добавлена.
- **Прервались на:** конец дня. На следующую сессию ждём 24h soak users.ts Phase 5a → запускаем Phase 5b. Зарегистрированы два новых бага по боту (Б-новый-A, Б-новый-B).
- **Контекст:** утренний аудит вскрыл systematic drift roadmap vs кодом (3 ложно-открытых пункта). Сегодня же мы закрыли 8 задач, но по той же небрежности упустили обновление roadmap/bugs/decisions для каждой. Этот промпт — массовая синхронизация хвоста дня + регистрация двух новых бугов.
- **Структурные уроки дня (зафиксированы в моей памяти):** (1) knowledge/ как источник истины — не доверять userMemories старше нескольких дней; (2) LightRAG не используется, читать через fs_read_file; (3) один промпт = одно сообщение пользователю; (4) читай реальный файл перед каждым промптом; (5) "отложить серией позже" = сразу регистрировать в roadmap.
- **Ссылки:** все 11 коммитов в main; этот промпт — sync-knowledge-2026-04-26-evening.

### 2026-04-26 — С-2 закрыт + регистрация strategic init #4 (a11y миграция)

- **Сделано:** site-wide cursor-pointer фикс закрыт коммитом `196ac3d`. Аудит подтвердил 0 оставшихся `<div onClick>` без cursor-pointer. Добавлено правило `@rule cursor-pointer on clickable non-button elements` в `knowledge/rules.md` (UI/UX section). С-2 в `bugs.md` помечен Closed 2026-04-26.
- **Параллельно:** Strategic initiative #4 "Accessibility migration — clickable non-button elements to native <button>" зарегистрирована в `roadmap.md` коммитом `7d0d0e4`. Cursor-pointer закрыл видимый симптом; полная a11y-миграция (keyboard nav, screen reader semantics, focus styles) — отдельная T3-серия на будущее.
- **Контекст:** Пара промптов 08a (registrtaion) + 08 (audit/fix). Промпт 08 в момент исполнения обнаружил, что фикс уже на месте (no-op outcome) — это дало прозрачную сверку, что задача действительно выполнена.
- **Прервались на:** один день закрыли четыре баг-класса (С-2, Б-13/Б-9 chain через 5a, /noscut state, Б-4 кнопки), плюс несколько техдолгов. Дальше — следующая позиция в очереди (Phase 2 мониторинг тарифов, либо С-2 audit register #4, либо что укажет стратегический партнёр).
- **Ссылки:** `196ac3d` (cursor-pointer fix), `7d0d0e4` (strategic init #4), этот промпт (close-c2-bugs-md).

### 2026-04-26 — Roadmap sync: dropped 3 ложно-открытых пункта

- **Сделано:** аудит реального состояния кода против Planned — Site выявил 3 пункта, давно закрытых в коде, но висевших как открытые. Перенесены в Done с реальными датами:
  (1) `/tools/auction-sheet` honest texts — закрыто 2026-04-19;
  (2) "Оставить заявку — перезвоним" на странице авто — закрыто 2026-02-16 через `CarSidebarActions` + `LeadFormModal`;
  (3) картинки в первые 12 статей блога — закрыто 2026-04-19 (commit `bd23cf60`).
- **Прервались на:** roadmap синхронизирован, дальше — работа по реальной очереди (Б-4 кнопки бота — следующий промпт).
- **Контекст:** аудит 27 пунктов очереди вскрыл систематический drift между roadmap и кодом. Часть пунктов сделана, но не вычеркнута. Это профилактический cleanup.
- **Ссылки:** этот промпт (sync-roadmap-2026-04-26).

### 2026-04-26 — Переход на систему стандартов v2.0

- **Сделано:** серия 2026-04-26-knowledge-v2 закрыта (4/4 промптов): системная инструкция и контекстный файл проекта в claude.ai заменены на v2.0; добавлена секция Recent Activity и архивирован исторический хвост Done в `roadmap-archive-1.md`; создан `virtual-team.md`; миграция зафиксирована ADR `[2026-04-26]` в `decisions.md`; блок `## Execution Discipline` (5 Карпати-правил) добавлен в `app/jck-auto/CLAUDE.md` — теперь поведенческий стандарт действует на каждом промпте для Claude Code.
- **Прервались на:** серия v2.0 закрыта, новая система действует на всех уровнях (Claude / Claude Code / knowledge) | **Следующий шаг:** возврат к нормальной работе по новой системе; следующая запись Recent Activity создаётся при следующей рабочей сессии.
- **Контекст:** серия из 4 промптов (1 — этот, 2 — virtual-team/rules, 3 — ADR в decisions.md + финал INDEX.md, 4 — Execution Discipline в CLAUDE.md).
- **Ссылки:** план серии — в чате стратегического партнёра; ADR будет добавлен в Промпте 3.

## Done

- [x] **2026-04-27 — Серия Phase 5b закрыта: users.ts honest sync API.** Четыре последовательных промпта (`fdcd08c` start.ts → `bab3fce` request.ts → `4425d41` admin.ts → этот коммит users.ts + knowledge). Public API `saveUser`/`savePhone`/`getAllUsers`/`getUsersStats` теперь честно sync, без `async`-обёрток и без lazy-load fallbacks. `ensureUsersLoaded` удалена целиком. `await` снят со всех 8 production call sites (3 в start.ts, 2 в request.ts, 3 в admin.ts), две строки `await ensureUsersLoaded()` в request.ts удалены вместе с импортом. JSDoc-шапка users.ts переписана: единственный `@rule` фиксирует sync-init как контракт, не подсказку — lazy-load fallbacks физически отсутствуют, попытка вернуть их сломает компиляцию. Класс Б-9 (lazy-load race) структурно закрыт: ранее было «не используется», теперь «не существует». Серия запущена после 24+ часов чистого production soak Phase 5a. См. ADR `[2026-04-27] users.ts Phase 5b — honest sync API completed`.
- [x] **2026-04-26 — `0a2fbd9` AuctionSheetClient polling hook extraction.** Новый hook `src/app/tools/auction-sheet/useAuctionSheetJob.ts` (~335 строк) владеет polling lifecycle: AbortController, recursive setTimeout, exponential backoff (2/4/8/16/32, cap 60s), localStorage/sessionStorage ownership protocol, processing-stage rotation, session restore. Возвращает discriminated union `JobState` с 6 фазами (idle/queued/processing/done/failed/lost). Orchestrator (`AuctionSheetClient.tsx`) сократился с 436 до 303 строк, реагирует на phase changes одним useEffect со switch'ем — exhaustiveness check от TypeScript. Wire protocol byte-identical (POST /api/tools/auction-sheet, GET /api/tools/auction-sheet/job/{id} каждые 2s). Pure refactor, no behavioral change. См. ADR `[2026-04-26] useAuctionSheetJob discriminated-union pattern`.
- [x] **2026-04-26 — `f90d7e5` users.ts Phase 5a (sync-init internal).** `src/bot/store/users.ts` теперь загружает `users.json` через `fs.readFileSync` на старте бота (вызов `loadUsers()` в `src/bot/index.ts` рядом с `loadCache()`). Public API сохранён async для backward compatibility — saveUser, savePhone, getAllUsers, getUsersStats, ensureUsersLoaded остаются async. `getUser` остаётся sync БЕЗ defensive guard — это canary для init-order regressions. Phase 5b (honest sync API + удаление `await` в 11 call sites) запланирована после 24+ часов production soak. Корень класса Б-9 структурно закрыт: race condition между sync getUser и async loadUsers больше не возникает. См. ADR `[2026-04-26] users.ts sync-init two-phase refactor`.
- [x] **2026-04-26 — `b454912` `await handleRequestCommand` в catalog.ts:375.** Было: floating promise `handleRequestCommand(bot, chatId, groupChatId)` внутри `bot.on("callback_query", async (query) => {...})`. Стало: `await handleRequestCommand(...)`. Roadmap пункт упоминал `void prefix` как фикс — диагностика реального файла показала, что callback async, sibling calls (sendCarCard, editCarCard) awaited, и handleRequestCommand имеет нетривиальные side-effects (savePhone, lead-log, group message), которые нужно завершить до возврата из callback. `await` — корректный фикс класса бага, `void` лишь подавил бы lint warning без устранения race condition.
- [x] **2026-04-26 — `e8df54a` auction-sheet progress indicator (Промпт 2.3).** Сообщение «🔍 Анализирую аукционный лист... обычно занимает 20–60 секунд» теперь самообновляется через `editMessageText` на трёх thresholds: 30s «Распознаю текст и таблицы...», 60s «Извлекаю смысл и перевожу...», 90s «⏳ Анализ занимает дольше обычного. Подождите ещё немного...». Тексты motivational, не привязаны к реальным стадиям пайплайна (бот polls очередь, не имеет introspection). `lastFiredThresholdIndex` cursor предотвращает повторные edits. Edit failures non-fatal (caught and logged). Final result/error сообщения остаются SEPARATE messages чтобы сохранить inline keyboard.
- [x] **2026-04-26 — `0a5eee4` /noscut state machine.** Per-chat in-memory Map `awaitingQuery` с TTL 5 минут (паттерн из `calculator.ts`). После пустого `/noscut` бот ставит state, следующее plain-text сообщение в окне обрабатывается как поисковый запрос. Filter guards: `!msg.text`, `startsWith('/')`, `msg.photo`, `includes('encar.com')` — защита от хайджека сообщений идущих в auctionSheet/encar handlers. Lazy cleanup expired states. Дублирование rate-limit + search + format кода со slash-command branch — намеренно (DRY-extract запланирован follow-up'ом).
- [x] **2026-04-26 — `502d818` Б-4 закрыт: кнопки auction-sheet и encar в start menu бота.** Добавлены два inline-кнопки в стартовую клавиатуру `src/bot/handlers/start.ts`: `🔍 Расшифровать аукционный лист` (callback `auction_info`) и `🇰🇷 Анализ авто с Encar` (callback `encar_info`). Обе кнопки шлют instruction-сообщение, объясняющее как использовать фичу (отправить фото / отправить ссылку). Не вызывают команды напрямую, потому что underlying handlers триггерятся через `bot.on('message')` с photo/url-pattern, не через slash-команды. Финальная структура клавиатуры: [Calc][Catalog] / [Auction][Encar] / [Связаться] / [📤 Поделиться].
- [x] **2026-04-26 — `196ac3d` site-wide cursor-pointer fix (С-2).** Audit + fix: 5 `<div onClick>` элементов в `LeadFormTrigger.tsx`, `LeadFormModal.tsx`, `catalog/CarCard.tsx`, `noscut/NoscutCard.tsx`, `tools/encar/EncarClient.tsx` получили `cursor-pointer` Tailwind класс. Прочие `<div onClick>` — stopPropagation-only modal-body wrappers (не user-clickable). Native `<button>`, `<a href>`, `<Link>` оставлены — браузер сам ставит pointer. Audit подтвердил 0 оставшихся gaps. Добавлен `@rule cursor-pointer on clickable non-button elements` в `knowledge/rules.md` (UI/UX section). Длинная a11y-миграция — Strategic initiative #4.
- [x] **2026-04-26 — `6d8d3d5` cleanup audit-vds.yml workflow.** One-shot workflow для read-only обхода `/opt/ai-knowledge-system/` удалён из main. Параллельно force-push reset feature-ветки `claude/audit-mcp-gateway-lightrag` на merge-base убрал commit `bf3a458` с незаредактированным `LIGHTRAG_API_KEY` из reachable git refs. GitHub commit cache держит коммит ~90 дней (нормальная GC), затем недоступен. Ключ деактивирован; cleanup — гигиена, не security incident.
- [x] **2026-04-19 — `/tools/auction-sheet` honest texts.** Заменены три обещания, расходящиеся с реальностью: «15 секунд» → «20–60 секунд» в hero/metadata/openGraph/JSON-LD; FAQ #3 «3 в день» → «3 за всё время для анонимов, 10/день через Telegram»; FAQ #5 ссылка на переименованный блок «Дополнительный текст с листа». Файл: src/app/tools/auction-sheet/page.tsx.
- [x] **2026-04-19 — Картинки в первые 12 статей блога.** Все 12 старейших статей в `content/blog/*.mdx` имеют `image:` frontmatter, файлы лежат в `public/images/blog/`. Закрыто коммитом `bd23cf60` (Auto-merge claude/faq-heading-per-tool into main).
- [x] **2026-02-16 — Кнопка «Оставить заявку» на странице авто.** Main CTA «Оставить заявку — перезвоним» в `CarSidebarActions` открывает `LeadFormModal` → `/api/lead` → группа менеджеров. Плюс `LeadFormTrigger` для «Узнать цену» (когда цена по запросу) и для оптовых покупателей. Plus `CarCtaActions` в финальной CTA-секции страницы. Файлы: src/components/catalog/CarSidebarActions.tsx, src/components/catalog/CarCtaActions.tsx, src/app/catalog/cars/[id]/page.tsx.
- [x] **2026-04-26 — Migration to standards system v2.0 (series 2026-04-26-knowledge-v2, 4/4 prompts)** — five-layer system rolled out: (1) claude.ai system instruction + (2) STANDARDS_v2.0 contextual file replaced; (3) skills already current (`prompt-writing-standard` v3.4 with T1/T2/T3 triage, `knowledge-structure` v1.6 with Recent Activity + cross-linking); (4) `## Execution Discipline` block (5 Karpathy-style rules) added to `app/jck-auto/CLAUDE.md`; (5) memory updated via `memory_user_edits`. Knowledge changes: `roadmap.md` gained `## Recent Activity` section (commit `38f76ac`), historical Done one-liners archived to `roadmap-archive-1.md` (commit `38f76ac`), `virtual-team.md` created with permanent participants + roster of 10 (commit `d5dcd9a`), ADR `[2026-04-26] Переход на систему стандартов v2.0` recorded in `decisions.md` (commit `bf9d967`), Execution Discipline block in CLAUDE.md (this commit). See `decisions.md` ADR for context, alternatives considered, and consequences.
- [x] **2026-04-23 — Series 2.4 complete: bot result-message keyboards unified via `inlineKeyboards.ts` helpers.** Seven prompts (2.4.1–2.4.7) migrated four terminal-result handlers (auction-sheet, encar, calculator, customs, noscut) from literal `inline_keyboard: [...]` to three shared helpers (`siteAndRequestButtons`, `siteRequestAndAgainButtons`, `noscutResultButtons`). Button text, ordering, callback_data now centralized in `src/bot/lib/inlineKeyboards.ts`. Side-effect: URL bug in `noscutResultButtons()` fixed in 2.4.6 (`catalog/noscut` instead of nonexistent `tools/noscut`, `@fix 2026-04-23` marker in code). New process discipline codified in rules.md: `@fix` code marker, `@series` header marker, Conventional Commits format, mid-series bug variant B. Commits: `9639ba3` (2.4.1), `b18e117` (2.4.2), 2.4.3 closed, 2.4.4 closed, `6ab3f6e` (2.4.5), `cba938b` (2.4.6), this commit (2.4.7). See ADR `[2026-04-23] Series 2.4 complete` for full context. Out of series scope: `/noscut` state bug (empty-argument input does not transition to "awaiting query" state) still open — remains in Planned — Bot.
- [x] 2026-04-23: Cloudflare Worker `tg-proxy` migrated from Dashboard-only to git. Three new files: `worker/tg-proxy.js` (4-mode routing code copied verbatim), `worker/wrangler.toml` (placement pinned via `mode = "smart"` + `region = "gcp:europe-west1"`), `.github/workflows/deploy-worker.yml` (auto-deploy on push to `worker/**` via `cloudflare/wrangler-action@v3`). GitHub Secrets added: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Closes Etap 1 of Cloudflare infrastructure migration. Production-verified: `cf-placement: local-ARN` (Stockholm), 0.193s latency (better than 0.227s baseline). Supersedes ADR [2026-04-20] Smart Placement via Dashboard. See ADR [2026-04-23] for full trace of the drift incident that triggered this migration. Commits: `bdc5a611` (Infra-1), `b162b2b` (Infra-1-Fix-1).
- [x] **2026-04-22 — Customs handler refactored to use `siteRequestAndAgainButtons` helper (Prompt 2.4.5).**
  `src/bot/handlers/customs.ts` no longer builds a literal
  `inline_keyboard: [...]` for its result message. Now uses
  `siteRequestAndAgainButtons('https://jckauto.ru/tools/customs',
  'cust_again')` from `src/bot/lib/inlineKeyboards.ts`. Site-button
  label unified from 'Подробнее на сайте' to '🌐 Подробный отчёт
  на сайте', matching what auction-sheet, encar, and calculator
  already show. Two navigation keyboards (country-select in
  `startCustoms`, age-select in the message handler) stay
  literal — they are navigation / wizard-step, not result
  messages, which is out of the helper's documented scope.
  Series 2.4 progress: 2.4.1 done, 2.4.2 done, 2.4.3 done,
  2.4.4 done, 2.4.5 done — noscut (2.4.6) and series finalization
  (2.4.7) still pending.
- [x] **2026-04-22 (evening) — Б-13 closed: stale jckauto-bot process replaced after 13 hours.**
  A manually-started bot process from 13 hours earlier survived
  commit `59555b8` (ecosystem.config.js introduction) and every
  subsequent `pm2 startOrReload ecosystem.config.js --only
  jckauto-bot` throughout the session — three reload calls total,
  zero applied. Cause: `pm2 startOrReload` is graceful reload for
  already-online processes; it re-uses their existing in-memory
  `pm_exec_path` / `script_args` / env snapshot and does not re-read
  the file. Users experienced 20-second latency per `/calc` step
  and `ETELEGRAM: query is too old` errors. `pm2 delete jckauto-bot
  && pm2 startOrReload ecosystem.config.js --only jckauto-bot`
  replaced the stale process; latency returned to normal. See
  `bugs.md` Б-13 and ADR `[2026-04-22] pm2 startOrReload is
  graceful reload — pm2 delete required to apply any
  ecosystem.config.js change`.
- [x] **2026-04-22 — Calculator handler refactored to use `siteRequestAndAgainButtons` helper (Prompt 2.4.4).**
  `src/bot/handlers/calculator.ts` no longer builds a literal
  `inline_keyboard: [...]` for its result message. Now uses
  `siteRequestAndAgainButtons(siteUrl, againCallback)` from
  `src/bot/lib/inlineKeyboards.ts`. Site-button label unified from
  "На сайт" → "🌐 Подробный отчёт на сайте", matching what encar
  and auction-sheet already show. Two navigation keyboards
  (country-select in `startCalc`, age-select in the message
  handler) stay literal — they are navigation, not result
  messages, which is out of the helper's documented scope. Series
  2.4 progress: 2.4.1 ✓ 2.4.2 ✓ 2.4.3 ✓ 2.4.4 ✓ — customs (2.4.5)
  and noscut (2.4.6) still pending.
- [x] **2026-04-22 — mcp-gateway entry in ecosystem.config.js corrected (Prompt 2.4.3.6.1).**
  The initial 2.4.3.6 entry carried a speculative
  `args: ['-c', 'exec npx -y
  @modelcontextprotocol/server-filesystem "$FILESYSTEM_ROOTS"']`
  block — wrong server, wrong package, would have broken
  mcp-gateway on first clean start. Fixed to the real
  `script: '/opt/ai-knowledge-system/server/start.sh'` with
  `interpreter: 'bash'` and no args (the shell script is
  self-sufficient). FILESYSTEM_ROOTS env preserved. Post-merge
  operator action required `pm2 delete mcp-gateway && pm2 start
  ecosystem.config.js --only mcp-gateway` to actually apply the
  corrected entry — `pm2 startOrReload` alone preserved the old
  speculative args. This was the first real observation of the
  graceful-reload behaviour that later produced Б-13.
- [x] **2026-04-22 — PM2 ecosystem.config.js introduced (replaces manual pm2 commands).**
  Committed `ecosystem.config.js` at the project root is now the single
  source of truth for all three PM2 processes (jckauto, jckauto-bot,
  mcp-gateway). Raw `pm2 start <bash> --name X -- -c "…"` is FORBIDDEN
  going forward; `bash -c` wrapper retained only as Emergency Manual
  Deploy fallback. See ADR `[2026-04-22] Move PM2 process management
  to committed ecosystem.config.js`.
- [x] **2026-04-22 — Б-11 closed (MCP gateway FILESYSTEM_ROOTS lost and recovered).**
  `pm2 delete all` on VDS wiped `mcp-gateway` along with the bots; its
  `FILESYSTEM_ROOTS` env (passed inline at first start, never persisted)
  was lost, and Claude's MCP file-serving broke. Fixed by declaring
  `env: { FILESYSTEM_ROOTS: '/var/www/jckauto/app/jck-auto' }` on the
  mcp-gateway entry in `ecosystem.config.js` — every reload re-applies
  it.
- [x] **2026-04-22 — deploy.yml simplified: single pm2 reload call.**
  The previous separate `pm2 restart jckauto` + `pm2 delete jckauto-bot`
  + `pm2 start bash --name jckauto-bot -- -c "…"` triple collapsed into
  a single `pm2 startOrReload ecosystem.config.js --only
  jckauto,jckauto-bot`. `[build] step N` marker count reduced from 8 to
  7.
- [x] **2026-04-22 — С-8 registered: encar handler hangs indefinitely on DeepSeek timeout**
  Live verification of Prompt 2.4.3 surfaced an indefinite hang in
  `src/bot/handlers/encar.ts` when DeepSeek translation/power calls run
  in an unbounded `Promise.allSettled`. Documented in `bugs.md` as С-8
  with root cause + planned fix (wrap each arm in `Promise.race(call,
  timeout(30000))`). Refactor itself (Prompt 2.4.3) is innocent — the
  hang occurs before the helper is invoked.
- [x] **2026-04-22 — Encar handler refactored to use `siteAndRequestButtons` helper**
  `src/bot/handlers/encar.ts` no longer builds a literal
  `inline_keyboard: [...]` for its result message. Now uses
  `siteAndRequestButtons(siteUrl)` from `src/bot/lib/inlineKeyboards.ts`,
  matching the architecture rule introduced in Prompt 2.4.1. Pure
  refactor — text and button order already matched the helper output.
  Series 2.4 progress: 2.4.1 ✓ 2.4.2 ✓ 2.4.3 ✓ — calculator/customs/
  noscut still pending (2.4.4–2.4.6).
- [x] **2026-04-21 — Bot user store lazy-load race fixed (Б-9 closed)**
  `src/bot/store/users.ts` is an async-load store: the in-memory `users` Map
  is populated only inside the async `loadUsers()` function. The sync
  `getUser(chatId)` accessor did not trigger the load, so immediately after
  every `pm2 delete + pm2 start` cycle, existing users tapping inline
  "Оставить заявку" buttons received the spurious "Нажмите /start" fallback
  until some other code path awaited loadUsers. Fix: exposed
  `ensureUsersLoaded()` from `users.ts`; `handleRequestCommand` became async
  and awaits `ensureUsersLoaded()` before calling `getUser`. Callback_query
  listener invokes the handler with `void` (intentional non-await). Bug
  surfaced via live verification of Prompt 2.4.2 — the new keyboard added
  there made the race reproducible on every bot restart. See ADR
  `[2026-04-21] Bot user store lazy-load race — minimal lazy-await fix`.
- [x] **2026-04-21 — Auction-sheet bot handler wired to inline-keyboards helper**
  `src/bot/handlers/auctionSheet.ts` now appends the result CTA buttons via
  `siteAndRequestButtons(siteUrl)` from `src/bot/lib/inlineKeyboards.ts`
  instead of building a literal `inline_keyboard: [...]` block. Buttons are
  attached to the LAST chunk of the report (multi-message split case
  preserved). Behaviourally identical for users; eliminates the divergence
  risk caught in the 2026-04-21 audit. Pairs with the architecture rule
  added in Prompt 2.4.1.
- [x] **2026-04-21 — Bot inline-keyboards helper introduced (single source of truth)**
  Created `src/bot/lib/inlineKeyboards.ts` with three helpers:
  `siteAndRequestButtons`, `siteRequestAndAgainButtons`,
  `noscutResultButtons`. Result-message keyboards across all bot handlers
  must now be built through these helpers — direct literal
  `inline_keyboard: [...]` for terminal result messages is forbidden
  (rules.md → Architecture Rules). Navigation/wizard keyboards (catalog
  paging, customs wizard) are out of scope by design. Series 2.4.3–2.4.7
  will migrate the remaining handlers (encar, calculator, customs, noscut)
  one at a time.
- [x] **2026-04-21 — Wire Telegram bot auction-sheet handler to shared service via queue**
  `src/bot/handlers/auctionSheet.ts` rewritten to delete the duplicated
  SYSTEM_PROMPT and the direct single-model `analyzeImage` call.
  The handler now compresses with Sharp (same params as the website),
  enqueues into `auctionSheetQueue` with
  `runAuctionSheetPipeline(buf, { channel: 'bot', telegramId })`, and
  polls the job status every 1s with a 180s hard timeout. Bot and
  website now share concurrency=1 and one source of truth for OCR +
  parse prompts. `formatAuctionResult`, `splitMessage`, and
  `severityLabel` stay bot-local (bot-surface concerns). Closes the
  regression bullet from In Progress (bot auction-sheet analysis via
  photo).
- [x] **2026-04-21 — Extract auction-sheet pipeline into shared service (`src/lib/auctionSheetService.ts`)**
  Bot was still calling a duplicated, single-model version of the
  decoder; website had the production pipeline inline in its route.
  Rolled the pipeline into `src/lib/auctionSheetService.ts` exporting
  `runAuctionSheetPipeline(buffer, {channel, ip?, telegramId?})`.
  Website route refactored to call the service through its existing
  queue. Pure refactor — website behaviour byte-identical. Unblocks
  Prompt 2.2 (wire the bot to the service).
## In Progress

- [~] Phase 2: Tariff monitoring (check-tariffs.ts + cron)
- [~] Phase 5: Finalization (SEO audit, mobile check, sitemap)
- [~] Merge all branches into main
- [~] Regenerate bot token in BotFather (Step 0 — manual, pending)

## Planned — Site

- [ ] Mobile responsiveness — full page-by-page audit
- [ ] Register in Yandex.Webmaster and Google Search Console
- [ ] Site: unify CTA style across conversion surfaces. Target pattern is **inline buttons** with site link + LeadFormTrigger ("Оставить заявку"), as used on `/tools/encar` result view. Audit candidates: all `/services`-labelled pages (/tools/*), car detail pages, noscut detail pages, any other result view that currently shows a plain text link or a lone phone button. Consistency gain: users always see the same "get-in-touch" affordance regardless of which tool they use.

## Planned — Bot

- [ ] Auto-post new cars to channel t.me/jckauto_import_koreya
- [ ] AI consultant (Claude API + knowledge base)
- [ ] Bot: add PDF download for auction-sheet and encar results, matching the website's PDF export. Goal: feature parity between bot and site. Investigate whether existing PDF generator (from `/api/tools/*/pdf` routes) can be reused server-side and streamed to Telegram.
- [ ] Bot: clarify queue and rate-limit semantics for auction-sheet and encar in the bot — currently unclear whether the bot enforces the same async queue / 2-minute cooldown contract as the website, or whether it bypasses them. If bypassed, system overload is possible under concurrent bot+site traffic. Audit and, if needed, route bot calls through the same queue + rate-limiter layer used by `/api/tools/*`.

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
- [ ] **admin.ts hygiene.** Файл `src/bot/handlers/admin.ts` превышает 100 строк (117 после добавления JSDoc), что по `code-markup-standard` требует region-комментов. Также между top-level декларациями (`import` блок и `async function sendStats`, closing brace `sendStats` и `export function registerAdminHandler`) отсутствуют пустые строки. Найдено out-of-scope в промпте 03 серии Phase 5b. Один промпт: добавить 4 region-маркера (stats text formatter, /stats command + reply-keyboard, admin_export callback, /broadcast) и две пустые строки между декларациями. Чисто косметика, без поведенческих изменений.

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
