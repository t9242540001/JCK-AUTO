<!--
  @file:        knowledge/decisions.md
  @project:     JCK AUTO
  @description: Architectural Decision Records (ADR log) — active section, append-only
  @updated:     2026-05-02
  @version:     1.81
  @lines:       ~770
  @note:        Active section: 16 ADRs from 2026-04-29 onward.
                Older entries (81 ADRs from 2026-01..2026-04-28) → see
                decisions-archive-1.md.
                Auto-archive trigger: when this file exceeds 1000 lines, run a
                knowledge-cleanup pass to move oldest entries past a 30-day
                cutoff into the next archive file.
-->

# Architectural Decisions

## § Active iterations

> Section for multi-prompt refactors that are not yet complete. Each entry
> stays here until its final commit lands, at which point it gets promoted
> to a full Accepted ADR below and this entry is removed.

## [2026-05-02] NEW-1 series — final summary (Yandex Metrika MCP integration end-to-end)

**Status:** Accepted. **Confidence:** high.

**Контекст.** NEW-1 серия открыта 2026-05-02 как enabler для NEW-2 (conversion analysis с реальными данными Метрики). Цель — программный read-доступ к Yandex Metrika data jckauto.ru из Claude.ai через MCP Custom Connector, без скриншотов и ручного экспорта. 6 sub-промптов: NEW-1.1 (PM2 entry + supergateway install), NEW-1.X-pre1A (FILESYSTEM_ROOTS extension в ecosystem.config.js), NEW-1.X-pre1B (DENY_PATHS в mcp_server.py), NEW-1.2-A (nginx snippet в repo), NEW-1.2-B (manual deploy on VDS), NEW-1.4 (Custom Connector setup в Claude.ai).

**Архитектура (финальная):**
```
Claude.ai (Anthropic Cloud, IP range 160.79.104.0/21 + 2607:6bc0::/48)
  → HTTPS jckauto.ru/mcp/metrika
  → nginx (allow-list filter, /etc/nginx/snippets/mcp-yandex-metrika.conf)
  → proxy_pass http://localhost:8765/mcp
  → supergateway (Streamable HTTP transport)
  → stdio MCP atomkraft/yandex-metrika-mcp (fork в t9242540001)
  → Yandex Metrika API (OAuth с YANDEX_API_KEY из .env.local)
```

**End-to-end verification:** nginx access log на VDS показал три request типа от Anthropic IP 160.79.106.37 → 200 OK + 202 Accepted + 200 OK 15484 bytes ответ — это полный MCP handshake (initialize → notifications/initialized → tools/list).

**Открытые items зарегистрированы:**
- OAuth token rotation override — отдельный ADR ниже.
- Build directory в fork — TD-KC-3.
- TS2353 косметика — TD-KC-4.
- `.env.local` permissions / source-fragility — TD-KC-1, TD-KC-2.
- LightRAG cleanup в mcp_server.py — TD-KC-9.

**Альтернативы (отвергнуты):**
- Local Claude Desktop integration — отвергнут (Vasily не использует терминал ежедневно, Node не установлен).
- Yandex Webmaster MCP — отложен (пока не нужен).

**Последствия.** Future-Claude сессии в новых чатах могут вызывать `yandex-metrika:*` tools для запроса counter/visits/conversion data. Это разблокирует NEW-2 (главная business-задача проекта). Также open access к /etc/nginx/, /var/log/nginx/, /opt/ai-knowledge-system/ через расширенный FILESYSTEM_ROOTS — упрощает диагностику.

**Source.** NEW-1 series, 2026-05-02. 6 commits: `417707b`, `fdcb6af`, `8440a83`, `8c78ffd`, NEW-1.2-B (manual), NEW-1.4 (UI).

---

## [2026-05-02] KC series — knowledge cleanup methodology and outcomes

**Status:** Accepted. **Confidence:** high.

**Контекст.** В середине NEW-1 series Vasily обратил внимание, что 8 файлов knowledge/ превышают 200-line guideline (skill `knowledge-structure` Section 6): decisions.md (5229 lines, 26× over), roadmap.md (746, 3.7×), rules.md (257, 1.3×), bugs.md (409, 2×), noscut-fixes.md (469, 2.3×), infrastructure.md (493, 2.5×), tools.md (388, 2×), deploy.md (171, within). Auto-archive triggers зафиксированные в шапках (decisions: «when file >600 lines», roadmap: «после 10 записей переносить в archive») ни разу не сработали за 6 недель.

**Решение.** Запустить серию из 6 cleanup промптов (KC-1..KC-6) с разными strategies per-file. NEW-1.3 (closing batch для NEW-1) отложен до завершения KC, потом совмещён с KC-7 в этом промпте.

**Применённые strategies:**

| File | Strategy | Outcome |
|---|---|---|
| decisions.md | Split by date-cutoff (2026-04-29) | active 777 lines, archive-1 4503 lines |
| roadmap.md | Split by date-cutoff + whitelist (v2.0 migration entry) | active 511 lines, archive-2 280 lines |
| bugs.md | Split by status (closed → archive) | active 145 lines, archive-1 306 lines |
| infrastructure.md | Split by domain (server vs network) | infrastructure 289 lines + networking.md 227 lines |
| tools.md | Rename for per-tool convention | tools-auction-sheet.md 393 lines + INDEX convention section |
| noscut-fixes.md | Full archival (completed ТЗ) | noscut-fixes-archive-1.md (read-only) |
| rules.md | DEFERRED — TD-KC-8 | unchanged 257 lines |
| deploy.md | Within guideline | unchanged 171 lines |

**Структурные уроки:**

1. **Auto-archive triggers без enforcement = декларация без эффекта.** Декларативная formula `If file grows past X lines, archive` ни разу не сработала. Решение: новое правило R-PROC-1 в rules.md фиксирует actionable trigger phrasing с конкретными числами + явным action verb.

2. **AC counts требуют MCP-верификации до написания промпта.** Три раза подряд предсказанные numbers промахивались. Lesson: для AC counts использовать `wc -l` / `grep -c` через MCP до написания промпта, не prediction-style. Memory item #28 уже фиксировал похожий принцип; уточнили scope.

3. **`Goal over steps` Karpathy rule работает.** В KC-1 Claude Code увидел discrepancy между моими AC counts и canonical boundary instruction, не подгонял файл под numbers, следовал boundary, в отчёте показал actual numbers. Это эталонное поведение.

4. **Content Preservation в archive файлах non-negotiable.** Cross-references в decisions-archive-1.md / roadmap-archive-1.md / bugs-archive-1.md содержат refs которые на момент записи были корректными. Изменять их — нарушение Section 9 skill `knowledge-structure`. Pointer chains (active → archive через INDEX и через @note) решают navigation problem без edit'ов.

5. **`git mv` обязателен для preservation истории.** В KC-5 (tools.md → tools-auction-sheet.md) и KC-6 (noscut-fixes.md → noscut-fixes-archive-1.md) использован `git mv` который git auto-detects via similarity threshold. Без этого history breaks для tooling (`git log --follow`, blame).

**Альтернативы (отвергнуты):**
- Thematic split decisions.md (по subsystems) — нарушает chronological audit trail.
- Split rules.md по доменам — re-architecture (T3), отложен как TD-KC-8.
- Полная сохранение всего без archive — игнорирует skill 200-line guideline и реальный access pattern (90% reads — top of file).

**Последствия.** Knowledge state теперь в guideline или near-compliance. Future sessions читают шапку файла + relevant content без drowning в 5000-line files. Auto-archive triggers actionable (R-PROC-1). Created 5 archive files (decisions-archive-1, roadmap-archive-2, bugs-archive-1, networking.md как split, noscut-fixes-archive-1).

**Source.** KC series, 2026-05-02. 6 commits per KC, плюс этот closing batch.

---

## [2026-05-02] R-PROC-1 — Knowledge auto-archive triggers must be actionable

**Status:** Accepted. **Confidence:** high.

**Контекст.** До KC-7 шапки knowledge файлов содержали declarative auto-archive triggers: `decisions.md` шапка («If file grows past ~600 lines, archive entries older than one year»), `roadmap.md` Recent Activity helper («После 10 записей — старые переносятся в roadmap-archive-N.md»). Эти triggers ни разу не сработали за 6 недель. Файлы продолжали расти бесконтрольно (decisions.md → 5229 lines, 8.7× over trigger). Причины: (а) trigger не имеет actionable verb — кто и как должен его проверять; (б) проверка требует counting вручную в каждой сессии; (в) метрика размытая («one year» в стабильном проекте — слишком много).

**Решение — R-PROC-1 в rules.md.** Каждый knowledge файл с потенциалом неконтролируемого роста (decisions.md, roadmap.md, bugs.md) должен иметь auto-archive trigger в шапке с тремя обязательными элементами:

1. **Конкретная количественная метрика** — например, "exceeds 1000 lines" или "exceeds 10 entries", не "grows large".
2. **Явный action verb** — "run a knowledge-cleanup pass to move...", не "archive...".
3. **Целевая граница** — что переносится (oldest entries past N-day cutoff), куда (next archive file).

При следующей session start ритуале (Section 11.6 skill knowledge-structure) Claude обязан проверить @lines в шапках файлов: если превышает trigger, инициировать knowledge-cleanup перед основной работой.

**Альтернативы.** Не делать R-PROC-1, надеяться на periodic self-discipline — отвергнут (исторические данные показали что не работает). Делать automated tooling (CI script) — отложен, T3 scope.

**Последствия.** В шапках decisions.md, roadmap.md, bugs.md теперь есть actionable triggers («exceeds 1000 lines», «exceeds 10 entries OR 400 lines», «exceeds 250 lines»). Future-Claude обязан проверить эти триггеры на session start и trigger'нуть cleanup при превышении.

**Source.** KC series methodology, 2026-05-02. R-PROC-1 в rules.md (этот коммит).

---

## [2026-05-02] R-OPS-1 — Rollback commands в manual ops с if-condition

**Status:** Accepted. **Confidence:** high.

**Контекст.** В NEW-1.2-B Шаг 5 (manual ops для nginx deploy) я выдал команды:

```
sed -i '/anchor/a\new-line' file
grep -c "anchor" file
grep -c "new-line" file
# ... happy-path expectation: оба возвращают 1

# Если получил 2 для второй команды — выполни откат:
sed -i '0,/new-line/{/new-line/d;}' file
```

Vasily выполнил весь блок включая rollback команду, потому что: (а) inline rollback оформлен как обычная bash-команда (не визуально отделён); (б) если-условие в тексте перед командой ("Если получил 2") — слабый сигнал по сравнению с готовой команды; (в) copy-paste pattern на VDS — атомарный, обычно весь блок копируется разом.

Результат: rollback выполнен на success'ном результате, пришлось повторить шаг.

**Решение — R-OPS-1 в rules.md.** Rollback команды в manual ops инструкциях оформляются одним из трёх способов:

1. **If-block с проверкой условия** (предпочтительный):
   ```bash
   if [ "$(grep -c 'pattern' file)" -gt 1 ]; then
     sed -i ...rollback...
   fi
   ```
2. **Отдельный визуально выделенный callout-блок** — заголовок «ROLLBACK — выполнять только если...», следующий за happy-path блоком, обёрнутый в визуальный divider.
3. **Дополнительный manual confirmation step** — «Перед запуском rollback команды ниже подтверди условие в чат».

Никогда не выдавать rollback как plain bash-команду рядом с happy-path-командой без явной защиты.

**Альтернативы.** Полагаться на if-условия в тексте инструкции — отвергнут (proven fail-mode из NEW-1.2-B). Не выдавать rollback вообще — отвергнут (rollback нужен для recovery).

**Последствия.** Все будущие manual ops инструкции используют один из трёх паттернов R-OPS-1. R-OPS-1 закрывает class инцидентов «Vasily случайно выполнил rollback на success».

**Source.** NEW-1.2-B инцидент, 2026-05-02. R-OPS-1 в rules.md (этот коммит).

---

## [2026-05-02] R-OPS-2 — Manual ops .txt files без markdown bash блоков

**Status:** Accepted. **Confidence:** high.

**Контекст.** В первой версии NEW-1.X-pre1B (.txt manual ops инструкция для патча mcp_server.py) я выдал блок с тройными бэктиками вокруг heredoc. Vasily скопировал весь блок включая обрамляющие тройные бэктики ````bash` и `````. Bash увидел `` ` `` как command-substitution syntax, попытался выполнить кусок Python кода как shell-команды. Каскад ошибок syntax error, command not found. Heredoc остался незакрытым, terminal завис в `>` prompt waiting for `PATCH_EOF`.

Pattern recognition: markdown ```bash блоки в .txt файлах опасны для copy-paste, потому что:
1. Плейн-текст файлы не рендерят markdown — пользователь видит сырые бэктики.
2. Копируется всё как есть, включая визуальные обрамления.
3. Bash интерпретирует `` ` `` как command substitution syntax.

**Решение — R-OPS-2 в rules.md.** Manual ops инструкции, выдаваемые через `.txt` файлы, не используют тройные бэктики ```bash вокруг shell-команд. Команды выдаются одним из трёх способов:

1. **Plain text** — команда на отдельной строке без обрамления.
2. **Heredoc inside heredoc** — `cat > /tmp/script.sh << 'EOF' ... EOF` для multi-line scripts с явным end-marker.
3. **Repo-delivered scripts** — для сложных multi-line операций положить script в repo через Claude Code, Vasily через `git pull` + `python3 path/to/script.py` (применено в NEW-1.X-pre1B-script revision, патч-script лёг в `scripts/infra-patch-mcp-deny.py`).

**Альтернативы.** Использовать markdown в .txt файлах с предупреждением — отвергнут (proven fail-mode). Использовать только plain text — слишком ограничивает structure.

**Последствия.** Все будущие manual ops .txt файлы свободны от markdown bash блоков. Сложные операции delivery'ются через repo. R-OPS-2 закрывает class инцидентов «heredoc + бэктики».

**Source.** NEW-1.X-pre1B первая версия инцидент, 2026-05-02. R-OPS-2 в rules.md (этот коммит).

---

## [2026-05-02] OAuth token rotation override (Yandex Metrika MCP)

**Status:** Accepted. **Confidence:** medium-high.

**Контекст.** Дважды в течение NEW-1 series Vasily случайно вставил префикс Yandex OAuth токена в чат. Префикс был визиблен в копированных команд из manual ops инструкций (один раз — в `echo $YANDEX_API_KEY` для verification, другой — в шаге load-into-shell). Полная строка токена (54 символа) НЕ утекла, только префикс ~30 символов.

Стандартная security best practice — ротировать токен после любого случая утечки в untrusted channel. Однако в данном случае:

1. Префикс OAuth токена (без полной длины + checksum) недостаточен для compromise — Yandex API проверяет полную строку.
2. Чат claude.ai — encrypted in transit, retained Anthropic с access controls (не public Slack/email/etc).
3. Ротация требует: создания нового токена в Yandex OAuth UI, обновления `.env.local` на VDS, `pm2 delete + startOrReload yandex-metrika-mcp`. ~10 минут operational time.
4. Вся серия NEW-1 проходит через сегодняшнюю сессию; ротация в середине series создаёт extra coupling и risk.

**Решение.** Override: продолжаем использовать текущий токен без ротации в рамках этой сессии. После закрытия NEW-1 (этот коммит) и в follow-up сессии — Vasily может ротировать в spare time, не как urgent. Документация ротации зафиксирована в networking.md → Yandex Metrika MCP — install steps → Token rotation.

**Альтернативы.** Полная ротация немедленно — отвергнута (cost > benefit при partial leak). Игнорировать — отвергнута (всё-таки фиксируем как note в decisions.md для audit trail).

**Последствия.** Текущий токен остаётся active. При future leak любой part'и токена — обязательная ротация. Rule: при copy-paste токена в чат — ротировать в течение 24 часов.

**Source.** NEW-1.X-pre1B, NEW-1.4 manual ops инциденты, 2026-05-02.

---

## [2026-05-02] MCP-instances clarification — JCK AUTO Files и VDS Files это два инстанса одного кода

**Status:** Accepted. **Confidence:** high.

**Контекст.** В userMemories item #25 (до KC-7) была формулировка предполагающая, что `JCK AUTO Files` MCP и `VDS Files` MCP — два разных продукта. Vasily в этой сессии указал на неточность: это **один и тот же** `mcp_server.py` код, развёрнутый на двух разных серверах с разными настройками FILESYSTEM_ROOTS.

**Архитектура (актуальная):**

| MCP коннектор | Сервер | URL | FILESYSTEM_ROOTS |
|---|---|---|---|
| JCK AUTO Files | jckauto.ru (94.250.249.104) | https://jckauto.ru/mcp | /var/www/jckauto + /etc/nginx + /var/log/nginx + /opt/ai-knowledge-system (after pre1A) |
| VDS Files | yurassistent.ru (другой VDS Vasily) | https://yurassistent.ru/vds-mcp/mcp | другой root, неизвестно точное значение |

`mcp_server.py` файл живёт в `/opt/ai-knowledge-system/server/mcp_server.py` на jckauto.ru. На yurassistent.ru — другой инстанс того же кода (или близкий fork) в другой path. После pre1B (DENY_PATHS) изменения применились ТОЛЬКО на jckauto.ru версию; yurassistent.ru версия не затронута этой сессией.

**Решение.** Memory item #25 обновлён. infrastructure.md (новый KC-4 split → networking.md PM2 secition) → mcp-gateway entry уточняет local path. networking.md → Yandex Metrika MCP install — clarifies что install procedure только для jckauto.ru.

**Альтернативы.** Слить в один инстанс — не подходит (разные projects, разные FS roots). Скрыть detail — отвергнут (это foundational architecture knowledge).

**Последствия.** Future-Claude чтения memory + networking.md теперь имеют точную картину. При работе над VDS Files MCP (на yurassistent.ru проекте) — разделение чёткое.

**Source.** Vasily clarification mid-session, 2026-05-02. Memory item #25 updated.

## [2026-05-02] decisions.md archived — KC-1 (cleanup series)

**Status:** Accepted. **Confidence:** high.

**Контекст.** decisions.md вырос до 5229 строк (97 ADR), что в 26× превышало 200-line guideline и в 8.7× — собственный auto-archive trigger в шапке (>600 lines, set 2026-04-15). Trigger ни разу не сработал за 6 недель — append-only-by-date паттерн оказался pure-additive без enforcement. KC-1 закрывает этот gap.

**Решение.** Split по line-cutoff (не по date) для устранения race conditions с back-dated edits в хвосте файла:
- Lines 1-749 (16 ADRs от 2026-05-02 и 2026-04-29) остаются в `decisions.md`.
- Lines 750-5229 (81 ADR от 2026-04-28 и старее) скопированы в `decisions-archive-1.md`.

Cross-reference safety check: roadmap.md ссылается только на ADR от 2026-04-29 и 2026-05-02. Все они в active. Никаких сломанных ссылок.

Cutoff date 2026-04-29 захватывает дневной audit-блок (Tools/Car detail/Mobile audit final summaries — 13 ADR одним днём + 3 ADR от 2026-05-02). Cutting глубже разрезал бы audit-серии посредине; cutting мельче не дал бы значимого сокращения.

**Альтернативы.**
- Thematic split (по подсистемам) — отвергнут, нарушает chronological audit trail и заставляет решать «куда положить cross-cutting ADR».
- Cutoff 2026-04-25 (27 ADR в active, ~1571 строк) — отвергнут, недостаточно агрессивный.
- Cutoff 2026-05-01 (3 ADR в active, ~150 строк) — отвергнут, разрезает audit-блок 2026-04-29.

**Последствия.**
- Active decisions.md уменьшен с 5229 до ~770 строк.
- Future Claude session reads only active at session start ритуала; archive открывается только при historical lookup.
- Новый @note в шапке: trigger «when active >1000 lines, run knowledge-cleanup pass» — actionable rule с числом, не размытое «one year ago».
- Series KC-1..KC-8: после KC-1 идут roadmap.md split (KC-2), bugs.md split (KC-3), и т.д.

**Source.** Knowledge-cleanup series KC-1, 2026-05-02. Triage T3 через research-protocol.

## [2026-05-02] CAT-3 — hover effects audit на /catalog (verified, no change needed)

**Status:** Accepted. **Confidence:** high.

**Контекст.** В рамках CAT-* page-by-page audit для /catalog проверены hover-эффекты на category cards (`hover:border-primary/70`, `hover:border-primary` на двух Link-карточках в Category cards секции) и country tabs внутри `CatalogFilters` (`hover:bg-border` на табах выбора страны). Verification двухуровневая: (1) browser-first diagnostic на Samsung Galaxy S20 Ultra 412px viewport — `Viewport=412px, Document=412px, Overflow=0px`, DevTools Console clean; (2) code-инспекция Tailwind-классов в `src/app/catalog/page.tsx` и `src/components/catalog/CatalogFilters.tsx` — все hover-стили являются border-color + background-color transitions, ни один не использует transform / scale / translate.

**Решение.** Никаких code changes не требуется. Border-color и background-color transitions не сдвигают bounding box элемента, не push'ат соседей в grid/flex layout — CLS-риск отсутствует. На touch-устройствах Tailwind 4 по умолчанию gating'ит `hover:` variants через `(hover: hover)` media query — стили не применяются на устройствах без hover capability, sticky-hover ghost-стили на тапе не появляются. Эталон поведения — MA-1 (Countries hover-only effects на главной), где аналогичный класс hover-decoration был оставлен без code change по той же причине.

**Альтернативы.**
- **Явно обернуть hover-стили в `@media (hover: hover)` через CSS.** Отвергнуто: Tailwind 4 уже делает это за нас на уровне utility generator'а. Дублирующий wrapper — overengineering, нулевая пользовательская выгода, лишний CSS noise.
- **Заменить hover на `group-hover` с явным focus-visible mirror.** Отвергнуто: focus-visible уже работает через дефолтный browser outline на Link/button — отдельный custom focus-стиль вне scope CAT-3 и относится к Strategic initiative #4 (Accessibility migration).
- **Удалить hover-эффекты целиком.** Отвергнуто: hover-feedback на desktop — стандартный UX-сигнал «это интерактивный элемент». Удаление ухудшит desktop affordance без compensating mobile-выигрыша.

**Последствия.**
- CAT-3 закрыт без code change по тому же шаблону, что P-7 / P-10 / P-11 в Mobile audit closing cleanup. Будущие сессии при чтении roadmap'а видят явное закрытие, не возвращаются к hover-аудиту /catalog.
- Если в будущем появится новый hover-эффект с transform/scale на /catalog — этот ADR подсказывает причину, по которой текущие effects были признаны safe; новый transform-effect требует отдельной CLS-проверки.
- (Knowledge) Border/background hover на Link/Button-cards — safe-by-default pattern в Tailwind 4 проектах. Применимо ко всему сайту.

**Ссылки.** Этот коммит. Precedent ADRs: `[2026-04-29] Mobile audit closing cleanup — P-7, P-10, P-11` (P-10 — те же reasoning'и для Countries hover на главной), Technical Debt MA-1 (та же категория hover-decoration без code change).

## [2026-05-02] CAT-* series — final summary

**Контекст.** Серия CAT-* запущена 2026-05-02 после закрытия Tools audit series (2026-04-29). Scope = page-by-page audit /catalog для частых ошибок, найденных в предыдущих сессиях (motion deadcode, BreadcrumbList JSON-LD gap, hover audit). Реестр сложился из четырёх пунктов и решился органически: 2 implementation prompts + 1 verified-no-change + 1 deferred-as-strategic.

**Что реализовано (2 / 4 промптов с code change + 1 verified + 1 deferred).**

- **CAT-1a** (commit `29df1ed`): удалён dead `import { motion } from "framer-motion"` в `src/components/catalog/CatalogClient.tsx` — единственная line removed, no behavior change. Pure deadcode cleanup.

- **CAT-1b** (commit `227d16c`): добавлен `BreadcrumbList` JSON-LD на `src/app/catalog/page.tsx` (2-level: Главная → Каталог). Pattern идентичен TS-5 + CD-4. Закрыл BreadcrumbList coverage gap для main entry pages (4/4: /tools/auction-sheet, /tools/encar, /catalog/cars/[id], /catalog).

- **CAT-3** (verified, no change): hover effects на category cards и country tabs /catalog — border/background transitions без CLS-риска, Tailwind 4 hover variant gates на touch-устройствах. Browser-first diagnostic 412px: overflow=0, console clean. См. ADR `[2026-05-02] CAT-3 — hover effects audit на /catalog (verified, no change needed)`.

- **CAT-2** (deferred): ItemList JSON-LD на server-rendered first page /catalog для Rich snippet carousel. Researched в чате при закрытии серии, признано enhancement (не common-error fix, не regression) — выпадает из scope CAT-* page-by-page audit. Перенесено в Strategic initiative #5.

**Methodology lessons (3 урока).**

1. **Чистый первый browser-first замер — допустимый исход.** В CD-1 diagnostic recipe нашёл root cause overflow за 30 секунд; в CAT-* такой же recipe вернул `overflow=0` на первом замере. Lesson: **не выдумывать проблем при чистом первом замере.** Серия может пойти в обычный audit-flow (motion deadcode, JSON-LD gap, hover review) без CD-1-style root-cause-first phase. Это не делает серию менее полезной — она просто короче.

2. **Короткая серия (4 пункта) валидна.** Tools audit (5 пунктов) и Mobile audit (12 пунктов) задали ожидание «крупная серия». CAT-* — 4 пункта, из которых 2 реальных code commits и 2 без правок (verified + deferred). Lesson: **масштаб audit-серии зависит от состояния страницы**, не от ритуала. Если страница в хорошем состоянии, короткая серия с явными close-причинами лучше, чем растягивание ради «крупного» summary.

3. **Deferral как четвёртый класс резолюции.** До сих пор close-причины были: implemented / verified-visually / verified-code / researched-and-deferred-to-Technical-Debt. CAT-2 ввёл четвёртый класс — deferred-to-Strategic-initiative. Разница: Technical Debt — баг или регрессия, отложенная по приоритету. Strategic initiative — enhancement, требующий research/discovery до prompt'а. Lesson: **место deferred-пункта зависит от его природы**, не от удобства реестра. ItemList — enhancement, его место в Strategic initiatives #5, не в TD.

**Численные итоги серии.**
- 4 пункта реестра (CAT-1a, CAT-1b, CAT-2, CAT-3).
- 2 коммита кода (`29df1ed` CAT-1a, `227d16c` CAT-1b).
- 3 новых ADR в decisions.md (`CAT-1b BreadcrumbList`, `CAT-3 hover audit verified`, этот final summary).
- 1 новый Strategic initiative #5 (ItemList JSON-LD).
- DevTools console errors на /catalog: 0.
- Document overflow на 412px viewport (/catalog): 0.

**Ссылки.** Этот коммит. Precedent ADRs: `[2026-04-29] Tools audit series — final summary`, `[2026-04-29] Mobile audit series — final summary`, `[2026-04-29] Mobile audit closing cleanup — P-7, P-10, P-11`. Серия охватывает коммиты `29df1ed` (CAT-1a) → `227d16c` (CAT-1b) → этот финальный.

## [2026-05-02] CAT-1b — BreadcrumbList JSON-LD на /catalog

**Status:** Accepted. **Confidence:** high.

**Контекст.** /catalog — последняя из main entry-point страниц без BreadcrumbList structured data. Метаданные (title, description, OG, canonical) уже корректные, но Google SERP для /catalog показывает URL-путь вместо человекочитаемых breadcrumbs. Тот же паттерн уже применён в TS-5 (`[2026-04-29] Tools audit TS-5 — BreadcrumbList на tool-страницах`) для /tools/auction-sheet и /tools/encar (3 уровня каждый), и в CD-4 (`[2026-04-29] Car detail audit CD-4 — SEO + a11y`) для /catalog/cars/[id] (3 уровня).

**Решение.** Добавить один `<script type="application/ld+json">` блок на /catalog с BreadcrumbList из **двух** ListItems: «Главная» → https://jckauto.ru, «Каталог» → https://jckauto.ru/catalog. URL абсолютные согласно Schema.org spec. Существующий `metadata` export, `dynamic = 'force-dynamic'`, и body `CatalogPage()` не трогаются — единственная правка JSX — `<script>` element как первый child returned `<>` fragment.

**Альтернативы.**
- **Three-level breadcrumb (Главная → Каталог автомобилей → Авто).** Отвергнуто: каталог — единый раздел с одним listing'ом, intermediate hub не существует в URL-структуре. Добавление виртуального уровня сломает соответствие breadcrumbs ↔ URL и запутает Google.
- **Имя position 2 = «Каталог автомобилей» (full).** Отвергнуто: short form «Каталог» матчит navigation menu и produce'ит compact SERP breadcrumb. Длинная форма уже в `<title>` метаданных — дублирование не нужно.
- **Включить отдельные категории как ListItems (Авто / Ноускаты).** Отвергнуто: ноускаты — sibling раздел /catalog/noscut, не child /catalog. Breadcrumbs описывают URL hierarchy, не UI grouping.
- **JsonLd компонент (centralized).** Отвергнуто: тот же reasoning, что в TS-5 — page-specific schema живёт рядом со страницей; глобальный JsonLd.tsx используется для LocalBusiness + WebSite в layout.

**Последствия.**
- Google SERP-snippets для /catalog теперь содержат breadcrumbs «Главная > Каталог» вместо «jckauto.ru/catalog». Потенциальный CTR-rise.
- Page-by-page audit BreadcrumbList покрытие: 4/4 main entry pages (/tools/auction-sheet, /tools/encar, /catalog/cars/[id], /catalog).
- Pattern reusable: при добавлении новой listing-style страницы (например, /blog/category) — те же 2 ListItems с adjusted name + URL.

**Ссылки.** Этот коммит. Precedents: TS-5 ADR (3-level tools pages), CD-4 ADR (3-level car detail).

## [2026-04-29] Tools audit series — final summary

**Контекст.** Серия "Tools audit" запущена 2026-04-29 после
завершения Mobile audit и Car detail audit серий. Vasiliy
обозначил конкретную UX-проблему («после выдачи результата
пользователь не понимает что анализ завершён») плюс попросил
применить найденные ранее паттерны (overflow, motion, image
optimization, Schema.org) к tools-страницам. Реестр сложился
органически: critical UX → bundle → image → overflow → SEO,
по убыванию impact.

**Что реализовано (5/5 промптов).**

- **TS-1** (commit `c3b3e8d`): 4-pronged completion signal
  pattern (scrollIntoView + ARIA live region + document.title
  + CSS ring-flash) на /tools/auction-sheet и /tools/encar.
  Honors prefers-reduced-motion. Введено правило R-FE-4 в
  `rules.md`.

- **TS-2** (commit `9bfdc0b`): EncarClient + auction
  ResultView мигрированы на LazyMotion-совместимый m import.
  Extends P-3 + CD-3 bundle wins на tools entry path.
  NoscutCard.tsx остаётся последним raw-motion файлом
  проекта (открыт в MA-4).

- **TS-3** (commit `8f97072`): EncarClient hero photo +
  lightbox мигрированы с raw <img> на next/image. Добавлен
  images.remotePatterns для ci.encar.com в next.config.ts.
  Mobile bandwidth — 50-80% сокращение.

- **TS-4** (commit `5ee2778`): horizontal overflow fix на
  /tools/encar через min-w-0 + [overflow-wrap:anywhere] на
  flex-row value spans (vehicle info, power row, dealer
  block). Document=428px → Document=412px на 412px viewport.
  Auction-sheet — clean (zero overflow).

- **TS-5** (this commit): BreadcrumbList JSON-LD на обеих
  server pages. Vehicle schema для Encar result отвергнута
  by design (нет indexable URL per result).

**Methodology lessons (3 урока для будущих серий).**

1. **Output discipline test (TS-4 первая итерация).** Я выдал
   промпт inline в чате вместо `create_file` → `present_files`
   потока. Vasiliy справедливо заметил отступление от skill,
   переделал. Lesson: **проверять доступные tools в каждой
   session перед формулированием промпта.** Tool list может
   меняться между sessions; никогда не предполагать наличие
   инструмента.

2. **Web research для новых паттернов.** TS-1 потребовал
   web search по ARIA live region + persistence requirement.
   Без research я бы выдал нерабочий код (live region добавлен
   after mount = screen reader не объявит). Lesson: **новые
   UX/SEO/a11y паттерны требуют web research before
   implementing**, даже если они "стандартные".

3. **Universal CSS-trap rules.** R-FE-3 (CD-1 — grid-item
   min-width auto trap) формулировано абстрактно с самого
   начала, поэтому TS-4 (flex-item trap) применил то же
   правило без новых rules. Lesson: **формулировать CSS-
   правила через абстрактный CSS-mechanism**, а не конкретный
   selector type — будет переиспользовано.

**Открытые Technical Debt от серии.**
- **MA-4 narrowed** — после TS-2 остался только NoscutCard.tsx
  как последний raw-motion файл. Закрытие MA-4 = миграция
  одного файла + включение LazyMotion strict mode.

**Численные итоги.**
- DevTools console errors на /tools/encar и /tools/auction-
  sheet: 0 (после TS-1..TS-5).
- Document width на 412px viewport (encar): 428px → 412px
  (overflow 16px → 0).
- Initial JS bundle на tools entry path: extends P-3 + CD-3
  win (~30 KB framer-motion разница vs raw motion).
- Mobile photo bandwidth (encar): -50-80% (AVIF/WebP via
  next/image).
- SEO structured data: 3 JSON-LD блока на каждой tool странице
  (WebApplication + FAQPage + BreadcrumbList).
- UX: completion signal через 4 канала (scroll + aria + title
  + flash) — измеримое улучшение для пользователей не
  наблюдавших processing.

**Ссылки.** Серия охватывает коммиты от `c3b3e8d` (TS-1) до
этого финального коммита (TS-5). ADR-цепочка: Tools audit TS-1,
TS-2, TS-3, TS-4, TS-5, final summary — все в `decisions.md` в
порядке coverage.

## [2026-04-29] Tools audit TS-5 — BreadcrumbList на tool-страницах

**Контекст.** Tools audit series закрывается. Оставшаяся SEO-
возможность — добавление BreadcrumbList structured data на обе
server-rendered tool pages (auction-sheet, encar). Без него
Google search results показывает URL вместо человекочитаемых
breadcrumbs.

**Решение.** Добавить третий `<script type="application/ld+json">`
на обеих страницах с BreadcrumbList: Главная → Сервисы → tool-
name. URL абсолютные (https://jckauto.ru/...) согласно
Schema.org spec. Существующие WebApplication + FAQPage schemas
не трогаются.

**Альтернативы.**
- **Vehicle schema на Encar result.** Отвергнуто by design
  (а не deferred): result рендерится client-side по user-input
  URL, нет публичного indexable URL для конкретного результата.
  Schema.org Vehicle на ephemeral state не приносит SEO-выгоды.
  Это архитектурное ограничение tool-pattern, не техдолг.
- **Visible breadcrumbs на странице.** Отвергнуто: extension of
  scope; current pages не имеют визуальных breadcrumbs by
  design (минимализм tool UX). Если потребуется — отдельный
  промпт.
- **Использовать готовый JsonLd компонент.** Отвергнуто:
  JsonLd.tsx — глобальный (LocalBusiness + WebSite в layout);
  page-specific schema нужен в самих page.tsx файлах.

**Последствия.**
- Google search snippets для tool страниц теперь содержат
  breadcrumbs ("Главная > Сервисы > AI расшифровка..." вместо
  "jckauto.ru/tools/auction-sheet"). Потенциальный CTR-rise.
- Tools audit series закрыта.
- Vehicle schema rejection задокументирован — будущие сессии
  не вернутся к этому вопросу.

## [2026-04-29] Tools audit TS-4 — EncarClient flex-row overflow fix

**Контекст.** Diagnostic per R-FE-3 recipe (DevTools console snippet) на /tools/encar после успешного анализа Genesis GV70 при viewport 412px:

```
Viewport: 412px, Document: 428px, Overflow: 16px
```

Top contributor через `getBoundingClientRect()` traversal: `SPAN.text-right width=299` в dealer-блоке. Code-инспекция `EncarClient.tsx` нашла три flex-justify-between row-pattern'а без `min-w-0` защиты на value-side spans:

1. Vehicle info grid `.map()` row — `<div className="flex justify-between text-sm">` с `<span>{value}</span>` (длинный single-token VIN — 17 chars без пробелов — растягивает).
2. Power row — `<div className="flex justify-between text-sm">` с `<span className="flex items-center gap-1.5 ...">{power text + AI badge}</span>`.
3. Dealer block — три row'а (Имя / Автосалон / Город) — `<span className="text-right ...">{dealerName / dealerFirm / city}</span>`. Korean dealer names + Russian transliteration легко превышают 30 chars.

Cost breakdown row (`{cost.breakdown.map()}`) уже имел корректную защиту (`min-w-0 flex-1` + `shrink-0`) — pre-CD-2 wisdom. Auction-sheet diagnostic при том же viewport: `Document=412px, Overflow=0px` — clean, не входит в TS-4 scope.

**Решение.** Добавить `min-w-0` и `[overflow-wrap:anywhere]` на value-side spans в трёх locations + `gap-3` на 2 row для visual breathing:

- **Vehicle info row**: `gap-3` на row, на value-span `min-w-0 text-right [overflow-wrap:anywhere]` (плюс существующие `font-medium text-text`).
- **Power row**: `gap-3` на row, на value-span (с `flex items-center gap-1.5`) добавлен `min-w-0`. БЕЗ `[overflow-wrap:anywhere]` — power-text содержит пробелы и скобки, обычный flex-shrink с `min-w-0` достаточен.
- **Dealer block** (3 rows × identical pattern): row className unchanged (gap-4 уже был), на value-span добавлен `min-w-0 [overflow-wrap:anywhere]` (плюс существующие `text-right font-medium text-text`).

Left label spans — UNCHANGED во всех трёх locations (короткие Russian labels naturally не expand row).

**Альтернативы.**
- **`break-all` на value spans.** Отклонено: слишком агрессивно, ломает Russian dealer names mid-character (например, "Си-стар" → "Си-ста\nр"). `[overflow-wrap:anywhere]` ломает только когда нет word boundary — для VIN это symbol-level, для имён it tries word-boundary first.
- **`truncate` с ellipsis.** Отклонено: скрывает VIN и часть dealer name'а — пользователь теряет данные. Wrap better preserves информацию.
- **Новое правило R-FE-x для flex-items.** Отклонено: R-FE-3 уже описывает grid-item трап и упоминает "any grid item containing flex/scroll children". Flex-item — тот же CSS mechanism с другим parent'ом. Дублирующее правило — overengineering.
- **Refactor layout to grid с auto-columns.** Отклонено: too broad scope, требует переписи всех trail-rows. Flex с min-w-0 — стандартный fix, минимальный change footprint.

**Последствия.**
- (+) `Document = Viewport` на /tools/encar 412px (overflow 0). Long values (VIN, Korean dealer names, city + region) wrap внутри их span на word boundary где возможно или character boundary для single-token content.
- (+) Pattern reusable: для любого будущего flex-row в проекте, где value side может содержать unpredictable-length user/API content — добавить `min-w-0` + при необходимости `[overflow-wrap:anywhere]`.
- (+) Visual breathing: gap-3 между label и value на vehicle info + power rows. Dealer rows уже имели gap-4 (pre-existing).
- (−) `[overflow-wrap:anywhere]` на VIN может разорвать его mid-character (например, `KMHL14JA0KA123\n45678`). Для VIN word-boundary не существует, alternative — truncate или scroll. Wrap is least-worst для preserving data.
- (Knowledge) Flex-item min-width: auto trap покрыт R-FE-3 — никакого дополнительного правила. Если в будущем такой же баг проявится — R-FE-3 + diagnostic recipe найдут его за 30 секунд.

**Relation to CD-2.** CD-2 явно УБРАЛ `[overflow-wrap:anywhere]` из 3 description-блоков на car detail page (длинные русские прозы, где mid-syllable breaks выглядели уродливо). TS-4 явно ДОБАВЛЯЕТ это же utility на короткие mixed-content value spans (VIN, dealer names, city) на /tools/encar. Два решения не противоречат — они применяются к разным content categories:
- **CD-2 case**: Russian prose paragraph (50-200 chars), мостно содержит word-boundary breaks возможны → `break-words` достаточно, `[overflow-wrap:anywhere]` лишний и ugly.
- **TS-4 case**: Short value (5-50 chars), часто single token (VIN) или mixed Korean/Russian (dealer name) — word boundaries могут отсутствовать → нужен character-level fallback.

Консistent правило: используйте `break-words` для prose, добавляйте `[overflow-wrap:anywhere]` только когда контент может быть single-token длиной > viewport breakpoint. Не зафиксировано как formal rule в `rules.md` (узкий case, R-FE-3 покрывает корневой mechanism); future Claude через эти два ADR может вывести правило при необходимости.

## [2026-04-29] Tools audit TS-3 — EncarClient image optimization

**Контекст.** На странице `/tools/encar` после успешного анализа отображается одно external фото (`result.photoUrls[0]`) — hero + lightbox. Оба места использовали raw HTML `<img>` элементы, полностью обходя Next.js Image Optimizer. На mobile 4G пользователи скачивали оригинальные JPEG'и (типично 200-800 KB на фото) без AVIF/WebP конверсии, без responsive sizes, без оптимизации beyond `loading="lazy"`. В `src/lib/encarClient.ts` `ENCAR_PHOTO_BASE = 'https://ci.encar.com'` подтверждён как single host для всех Encar photo URLs; `next.config.ts` от P-1+P-2 уже имеет `formats: ['image/avif', 'image/webp']`, `qualities: [75, 85]`, `minimumCacheTTL: 86400`, но без `remotePatterns` для external источников.

**Решение.** Двухчастный fix:

1. **`next.config.ts`**: добавлен `images.remotePatterns: [{ protocol: 'https', hostname: 'ci.encar.com', pathname: '/**' }]` после существующего `localPatterns`. Comment-блок поясняет: server-side fetch Next.js Optimizer'ом (no client CORS), кэшируется per `minimumCacheTTL`. Single host policy (только ci.encar.com) — без wildcards, минимизирует attack surface.

2. **`src/app/tools/encar/EncarClient.tsx`**: `import Image from "next/image"`, два raw `<img>` элемента заменены на `<Image fill>`:
   - **Hero**: `<Image src={...} alt={...} fill className="object-contain" sizes="(max-width: 768px) 100vw, 768px" />` внутри существующего `<button>` с `relative` (positioned parent для `fill`). `<span>` overlay сохранён.
   - **Lightbox**: `<img>` заменён на `<div className="relative h-[90vh] w-[90vw]" onClick={stopPropagation}><Image fill className="object-contain" sizes="100vw" quality={85} /></div>` — wrapper div нужен для `relative` + положение, `onClick` stopPropagation перенесён на wrapper (на самом `<Image>` не работает onClick прямо).

`loading="lazy"` снят — `<Image>` lazy-loads по умолчанию для non-priority фото. `quality={85}` в lightbox матчит существующий `qualities: [75, 85]` allowlist.

**Альтернативы.**
- **Оставить raw `<img>` с `decoding="async" fetchpriority="low"`.** Отклонено: даёт декодирующий выигрыш в render path, но не уменьшает bytes — пользователь всё равно качает 200-800 KB JPEG.
- **Server-side proxy / cache layer вне Next.js Image (custom route с sharp).** Отклонено: дублирует функциональность Next.js Optimizer'а, добавляет maintenance burden, никаких уникальных features (мы уже на VDS, и Optimizer там же).
- **`<Image unoptimized={true} />`.** Отклонено: defeats the purpose. Бессмысленно использовать `next/image` без оптимизации.
- **Альтернативный photo CDN (Cloudinary, Vercel Blob).** Отклонено: добавляет third-party dep + cost. Encar предоставляет фото через свой CDN в high quality; Next.js Optimizer на VDS даёт нам конверсию + кэш бесплатно.

**Последствия.**
- (+) Mobile bandwidth dramatically reduced: AVIF на Chrome / WebP на старых браузерах = 50-80% меньше bytes per Encar photo.
- (+) VDS Image Optimizer cache populates с одним entry per Encar carid. При повторных анализах одной и той же машины (например, юзер сравнивает варианты) — instant cache hit.
- (+) `remotePatterns` pattern documented в `next.config.ts` comment'ом для будущих external photo sources (если когда-нибудь подключим second car-listing site).
- (−) **Failure mode**: если `ci.encar.com` начнёт 429-ить наш VDS (rate-limit), Next.js Image Optimizer fail'ит загрузку silently — `alt` text остаётся видимым (а11y не теряется), но hero photo показывает empty fallback. UX impact ограничен, но на момент инцидента можно потерять photo display. Не fix-able в TS-3 — потребует circuit-breaker + retry-with-backoff layer. За scope.
- (−) Image Optimizer добавляет server-side load на VDS (sharp processing). Для одного-photo-на-tool это negligible, но если в будущем добавим отображение всех photoUrls галереей — стоит мониторить CPU.
- Серия Tools audit: TS-1 ✓ (UX completion signal), TS-2 ✓ (bundle), TS-3 ✓ (photo bandwidth). Дальнейшие пункты по мере выявления.

## [2026-04-29] Tools audit TS-2 — EncarClient + ResultView motion → m

**Контекст.** TS-1 (commit `c3b3e8d`) добавил 4-pronged completion signal в оба tool client'а, но не трогал bundle-проблему: оба компонента (`EncarClient.tsx` напрямую, `ResultView.tsx` как root компонента) использовали raw `import { motion } from "framer-motion"`. При cold-cache landing на `/tools/encar` или `/tools/auction-sheet` (например, прямой переход с поиска или внешней ссылки) первый запрос тащил полный framer-motion bundle (~34 KB), отменяя выигрыш P-3 (главная) и CD-3 (car detail) для tools entry path.

**Решение.** Двухфайловая миграция, идентичная по паттерну CD-3:
- `src/app/tools/encar/EncarClient.tsx`: (1) `import { motion } from "framer-motion"` → `import * as m from "framer-motion/m"`. (2) `<motion.div>` / `</motion.div>` → `<m.div>` / `</m.div>` (одна пара, root результат-блока).
- `src/app/tools/auction-sheet/ResultView.tsx`: те же два изменения; mostion.div root компонента переименован.

Motion props (`initial={{ opacity: 0, y: 10 }}`, `animate={{ opacity: 1, y: 0 }}`, `className="space-y-6"`) — байт-в-байт. После миграции LazyMotion из MotionProvider (уже обёрнут вокруг `<main>` в layout.tsx) обрабатывает `m`-элементы с pre-loaded `domAnimation` features (~4.6 KB вместо ~34 KB).

TS-1 outer wrapper `<div ref={resultRef} key={flashKey} className="completion-flash">` остаётся байт-в-байт; теперь оборачивает `m.div` вместо `motion.div` без других изменений.

**Альтернативы.**
- **Полная project-wide миграция в одном промпте.** Отклонено: NoscutCard.tsx требует отдельного scope (рендерится на главной + `/catalog/noscut/*` — separate entry-paths, separate testing surface).
- **Убрать анимации совсем.** Отклонено: fade-in result-блока — важный perception cue «контент появился». Удаление = UX-регрессия.
- **LazyMotion `strict` mode сразу.** Отклонено: NoscutCard ещё использует raw motion → strict бросит runtime error на главной и `/catalog/noscut/*`. Включаем после полного закрытия MA-4.

**Последствия.**
- (+) P-3 + CD-3 bundle-выигрыш расширен на tools entry path. Прямой landing с поиска на `/tools/encar` или `/tools/auction-sheet` больше не тянет полный framer-motion.
- (+) TS-1 completion signal pattern продолжает работать — внешний wrapper не зависит от типа inner-tag (motion.div vs m.div).
- (−) NoscutCard.tsx остаётся последним raw-motion holdout. MA-4 не закрыт; `strict` mode в LazyMotion остаётся deferred.
- (Knowledge) После TS-2 остался один файл до полной чистки motion-imports проекта. Pattern «3-step systematic LazyMotion migration» (P-3 → CD-3 → TS-2 → закрывающая NoscutCard миграция) — может быть зафиксирован как методологический урок при закрытии MA-4.
- Серия Tools audit: TS-1 ✓, TS-2 ✓; дальнейшие пункты по мере выявления.

## [2026-04-29] Tools audit TS-1 — async completion signal

**Контекст.** Vasily на mobile (DevTools 414px, реальный iPhone) сообщил, что инструменты `/tools/auction-sheet` и `/tools/encar` после процессинга «выглядят как зависшие». Сценарий: юзер загружает фото / вставляет URL, нажимает «Расшифровать»/«Анализировать», во время loading'а прокручивает страницу вниз, ждёт. Когда state переходит в "result", DOM рендерит result-блок инлайн на той же странице — без любого signal'а о завершении. Юзер не видит scroll, не слышит notification, не видит change в tab title, не видит никакого визуального flash. Думает, что инструмент завис, нажимает обновить страницу или уходит.

Веб-стандарты 2026 для async UI completion: minimum 3 из 4 каналов signal'а — scroll, ARIA live region, document.title, visual cue. Каждый канал покрывает разный сценарий (mobile scroll, screen reader, inactive tab, sighted on-page).

**Решение.** Добавить 4-pronged completion signal в оба client'а через единый pattern:

1. **Smooth scrollIntoView** на result-блок через `requestAnimationFrame` после layout. Browser API уважает `prefers-reduced-motion` автоматически — instant scroll вместо smooth.
2. **ARIA live region** `<div ref={liveRegionRef} role="status" className="sr-only" />` — **persistent в DOM, empty на mount**. Текст инжектится при transition в "result". Условный render не работает — screen reader не announce'ит регион который только что появился.
3. **document.title mutation** на «Готово · {tool name} | JCK AUTO» с cleanup function для restore.
4. **CSS visual flash** — `.completion-flash` utility class с `@keyframes ring-flash` (~600ms gold-tone ring). `key={flashKey}` на wrapper-div'е инкрементируется при каждом переходе → re-mount → animation restart. `@media (prefers-reduced-motion: reduce) { .completion-flash { animation: none; } }`.

Pattern зафиксирован как R-FE-4 в `rules.md` для повторного использования на других async UIs.

**Альтернативы.**
- **Toast notifications.** Отклонено: redundant с visual flash + смещают фокус с самого result'а; добавляют новую UI primitive в проект.
- **Browser Notifications API.** Отклонено: требует user permission grant, overhead для permission UI, юзер уже на странице (не в background app).
- **Sound effects.** Отклонено: intrusive, требует user gesture для autoplay, не подходит для tool на mobile в общественном месте.
- **Refactor state machines в обоих client'ах для centralized state management.** Отклонено: вне scope TS-1; цель — UX fix, не структурный refactor.
- **Использовать `aria-live` на сам result-блок без separate region.** Отклонено: result-блок появляется условно (`{state === "result" && ...}`); screen reader не announce'ит content который mounts вместе с aria-live attribute. Persistent separate region — рабочий pattern.

**Последствия.**
- (+) Mobile UX dramatically improved — юзеры видят когда анализ закончен независимо от скролла.
- (+) Screen reader users слышат announcement при completion. Persistent live region ставит фундамент под другие announcements (например, ошибки) если понадобятся.
- (+) Inactive-tab users видят «Готово · ...» в tab strip, могут переключиться обратно когда удобно.
- (+) Pattern reusable: R-FE-4 покрывает любые будущие async UIs (calculator, customs, новые tools).
- (−) `requestAnimationFrame` + `scrollIntoView` плохо взаимодействует если юзер активно скроллит в момент завершения. Browser-default — interrupts user-initiated scroll smooth. На текущих сценариях acceptable; если станет проблемой, рассмотреть `prefers-reduced-motion`-style guard или ввести setting «hide auto-scroll».
- (−) `document.title` cleanup polnyaет при unmount component, не при transition в idle. Для full SPA-rebuild (юзер кликнул "Расшифровать ещё") title восстанавливается через cleanup function от useEffect (state ушёл из "result"). Verified path работает.
- (Knowledge) Pattern «persistent ARIA live region для async UI completion» зафиксирован в R-FE-4 — частая ошибка fresh-developers рендерить region условно. Этот ADR + правило защищают.
- Открыта серия Tools audit. TS-1 — первый закрытый пункт.

## [2026-04-29] Car detail audit series — final summary

**Контекст.** Серия "Car detail page — мобильная адаптация и технический аудит" запущена 2026-04-29 после серии Mobile audit главной. Vasily указал что на car detail странице "больше всего визуальных багов". Реестр сложился органически: визуальный баг (overflow) → root-cause fix (CD-1) → визуальная проверка → технический аудит → 14 находок в 4 категориях → группировка в 3 промпта по приоритету и риску.

**Что реализовано (4/4 промпта).**

- **CD-1** (commit `ce4d130`): horizontal overflow fix через `min-w-0` на двух grid items. Diagnostic: Document width 840px на 375px viewport (overflow 465px). Root cause: CSS Grid item default min-width=auto + flex/scroll child = parent expansion. Введено правило R-FE-3 в `rules.md`. Сохранён диагностический DevTools-recipe для будущих audit'ов любых страниц.

- **CD-2** (commit `4401529`): корректность данных + perf cleanup. (A1) `getAllCars()` обёрнут в React `cache()` для дедупликации в request lifecycle (-275ms). (A2) Schema.org `priceCurrency` теперь корректно отражает KRW/JPY для Korea/Japan машин. (A3) Schema.org `description` заменён на нормализованный excerpt `car.description` (300 символов, word-boundary). (B5) Thumbnail images lazy-load кроме первого. (C2) убран лишний `[overflow-wrap:anywhere]` из 3 description-блоков (h1 сохранён для folderName).

- **CD-3** (commit `5d7806a`): bundle + CLS. CarCard + CarTrustBlock мигрированы на LazyMotion-совместимый `m` import — extends P-3 win to car detail entry path. `hover:scale-[1.02]` заменён на `hover:-translate-y-1` в CarCard для устранения CLS в "Other cars" grid. Зарегистрирован MA-4 для оставшихся raw motion компонентов (NoscutCard, EncarClient).

- **CD-4** (this commit): SEO + a11y. Schema.org `Product` upgraded до `Vehicle` с mileage, engine, transmission, bodyType, color. Добавлен BreadcrumbList JSON-LD. Thumb-кнопки CarGallery получили aria-label + aria-current. Минорные улучшения (B4, C1, C3, C4, D4 + drivetrain/power Vehicle fields) collected в CD-DEBT-1.

**Methodology lessons (3 урока для будущих серий).**

1. **Browser-first diagnostic для new audit series.** CD-1 нашёл root cause за 30 секунд через DevTools console snippet (scrollWidth vs clientWidth + table of widest elements). Без recipe пришлось бы читать все компоненты страницы по очереди и гадать. R-FE-3 сохраняет recipe для будущих audit'ов. Lesson: **новая audit-серия начинается с диагностического скрипта, не с component-by-component reading.**

2. **Audit-find-первым-промптом, не комплексные пакеты.** CD-1 — узкий root-cause fix без связанных улучшений. После исправления overflow открылись остальные находки (которые могли быть скрыты под overflow). Lesson: **в новой audit-серии первый промпт — root-cause fix самой видимой проблемы, технический audit делается ПОСЛЕ.**

3. **AC literal grep vs regression-shield collision.** CD-2 AC7 ожидал точный счётчик `[overflow-wrap:anywhere]` = 1, но мой собственный CD-1 RULE-комментарий (regression shield запрещает редактировать) содержал эту фразу в тексте, давая 2 совпадения. Lesson: **AC через grep должны учитывать существующие RULE-комментарии и/или формулироваться через спирит ("3 specific blocks no longer have it, h1 keeps it"), не через точное число.**

**Открытые Technical Debt от серии.**
- **CD-DEBT-1** — Car detail page minor improvements (B4, C1, C3, C4, D4, drivetrain enum, enginePower unit).

**Численные итоги.**
- Document width на 375px viewport: 840px → 375px (overflow 465px → 0).
- Server response timing на car detail: -275ms на каждый запрос (force-dynamic + двойной getAllCars).
- Initial JS bundle на car detail entry path: extends P-3 win (~30 KB framer-motion разница vs raw motion).
- SEO structured data: 2 JSON-LD блока вместо 1 (+ BreadcrumbList; Product → Vehicle с 5 новыми полями).
- Mobile thumb bandwidth: ~80% сокращение initial load (1 thumb eager + 11 lazy вместо 12 eager).
- DevTools Console errors на car detail: 0.

**Ссылки.** Серия охватывает коммиты от `ce4d130` (CD-1) до этого финального коммита (CD-4). ADR-цепочка: Car detail audit CD-1, CD-2, CD-3, CD-4, final summary — все в `decisions.md` в порядке coverage.

## [2026-04-29] Car detail audit CD-4 — SEO + a11y

**Контекст.** Технический аудит car detail page выявил отсутствующий BreadcrumbList structured data, неполный Product schema (нет mileage, engine, transmission, body type), отсутствующие aria-label на thumb-кнопках CarGallery. Эти три недостатка относятся к category-broad SEO/a11y improvements — закрывают серию car-detail audit.

**Решение.** Schema.org `Product` → `Vehicle` (Vehicle IS-A Product, обратной совместимости не теряется). Добавлены `mileageFromOdometer` (QuantitativeValue с unitCode KMT), `vehicleEngine` (EngineSpecification с fuelType + engineDisplacement в литрах), `vehicleTransmission` (mapped "AT"→"Automatic", "MT"→"Manual"), `bodyType`, `color`. Добавлен второй JSON-LD блок — BreadcrumbList с тремя позициями (Главная → Каталог → car-name) с абсолютными URL-ами. Thumb-кнопки получили aria-label на русском ("Показать фото N из M") + aria-current="true" для активной кнопки.

**Альтернативы.**
- Использовать готовый JsonLd компонент. Отклонено: он глобальный (LocalBusiness + WebSite в layout), page-specific schema нужен в page.tsx.
- Добавить `driveWheelConfiguration` и `enginePower` в Vehicle. Отклонено: requires enum mapping и unit confirmation, не делаем без верификации данных. Регистрируем в CD-DEBT-1.
- Сделать thumbs кликабельными через клавиатуру. Отклонено: `<button>` уже keyboard-accessible by default — нужны только aria-* атрибуты для контекста.
- Использовать Person Schema для author/sales-manager. Отклонено: вне scope car detail (LocalBusiness в layout уже это покрывает).

**Последствия.**
- Vehicle schema → потенциально лучшее ranking в automotive search verticals.
- BreadcrumbList → крошки в Google search results вместо URL → выше CTR.
- aria-label/aria-current → screen reader пользователи могут эффективно навигировать галерею.
- CD-DEBT-1 регистрирует deferred drivetrain/power fields + 5 минорных пунктов аудита.
- Car-detail audit series закрыта (4/4).

## [2026-04-29] Car detail audit CD-3 — CarCard + CarTrustBlock motion → m + CLS fix

**Контекст.** Mobile audit P-3 (commit `b1bd44c`) перевёл 10 секций главной с raw `motion` на LazyMotion-compatible `m`, сократив framer-motion bundle ~34 KB → ~4.6 KB. CarCard.tsx и CarTrustBlock.tsx в P-3 явно отложены — оба не на hot path главной. Сейчас, в Car detail audit серии, оба они работают на странице `/catalog/cars/[id]`: CarCard рендерится в «Other cars» секции (3 карточки на mobile), CarTrustBlock — mid-page как trust/guarantees блок. При прямом landing на car detail страницу из поисковика (без предварительного захода на главную) первый запрос тащил полный framer-motion (~34 KB) — полностью отменяя выигрыш P-3 для этого entry path.

Дополнительное наблюдение: в CarCard hover-стиль `hover:scale-[1.02] hover:shadow-md`. `scale-[1.02]` увеличивает карточку на 2% при hover'е, что может сдвигать соседние карточки в grid'е (CLS — Cumulative Layout Shift, метрика Core Web Vitals). На «Other cars» grid'е 3-4 карточек эффект visible при hover-навигации между ними. Замена на `-translate-y-1` (-4px вертикальный лифт) сохраняет размер карточки и устраняет CLS.

**Решение.** Два хирургических изменения:

- **CarCard.tsx**: (1) `import { motion } from "framer-motion"` → `import * as m from "framer-motion/m"`. (2) `<motion.div>` / `</motion.div>` → `<m.div>` / `</m.div>`. (3) В inner-div className заменён `hover:scale-[1.02] hover:shadow-md` на `hover:-translate-y-1 hover:shadow-md`. Условие `${!isModalOpen ? '...' : ''}` и остальные классы — байт-в-байт. `group-hover:scale-105` на inner Image сохранён (intentional dual-hover effect: card lifts + photo zooms).

- **CarTrustBlock.tsx**: (1) тот же import-replacement. (2) `<motion.div>` / `</motion.div>` → `<m.div>` / `</m.div>` внутри `.map()` over trustItems. Все motion-props (initial / whileInView / viewport / transition) — байт-в-байт.

Никаких других изменений в этих компонентах. После миграции framer-motion не тащится при заходе на car detail, потому что MotionProvider уже обёрнут вокруг `<main>` в layout.tsx, а LazyMotion + `m` импорт активирует только нужный feature-set (~4.6 KB).

**Альтернативы.**
- **Полный project-wide миграция в одном промпте.** Отклонено: scope слишком широкий (NoscutCard, EncarClient, возможно другие). Карty детали серии — CarCard и CarTrustBlock; остальное — отдельная серия / промпт. Зарегистрировано как MA-4.
- **LazyMotion `strict` mode сейчас.** Отклонено: пока NoscutCard и EncarClient ещё используют raw `motion`, включение `strict` бросит runtime error на `/catalog/noscut` и `/tools/encar`. Включать после полного закрытия MA-4.
- **Полностью убрать анимации с этих компонентов.** Отклонено: UX-регрессия (fade-in cards, trust block items дают важный perception cue «contenu loaded»).
- **Заменить hover:scale на CSS transition без framer-motion.** Отклонено overengineering: CSS hover + Tailwind utility (`hover:-translate-y-1`) — нативный браузерный hover, не зависит от framer-motion вообще; smooth перевод через `transition-all duration-200` уже на родителе.

**Последствия.**
- (+) P-3 bundle-выигрыш расширен на car detail entry path. Прямой заход с поиска на `/catalog/cars/[id]` больше не тянет полный framer-motion.
- (+) CLS на «Other cars» grid'е устранён. Pattern `hover:-translate-y-1` для card-hover становится рекомендуемым в проекте.
- (−) Adjacent компоненты (`NoscutCard`, `EncarClient`) по-прежнему используют raw motion — bundle на их страницах не оптимизирован. Зарегистрировано как Technical Debt MA-4 с явным reopen-trigger (Lighthouse регрессия / связанная задача / запланированная bundle-hygiene сессия).
- (Knowledge) Pattern «card hover via translate, не scale» зафиксирован в этом ADR. При создании новых card-компонентов — использовать `hover:-translate-y-N` как baseline, не `hover:scale-N`. Скейл оправдан только когда карточка вне grid'а или grid с явным buffer'ом.
- Серия Car detail audit: CD-1 ✓, CD-2 ✓, CD-3 ✓; CD-4 (Vehicle schema upgrade + BreadcrumbList + thumb aria-labels) planned.

## [2026-04-29] Car detail audit CD-2 — correctness + perf cleanup

**Контекст.** После закрытия CD-1 (horizontal overflow fix через `min-w-0` на двух grid-items) визуальный layout страницы `/catalog/cars/[id]` стал корректным на 360/414/430. Технический audit страницы выявил пять non-visual issues — SEO data inaccuracy, server timing inefficiency, mobile bandwidth waste, и Russian text wrap regression. Все пять не проявляются визуально, но напрямую влияют на SEO data quality, server performance и mobile UX. CD-2 закрывает их одним промптом.

**Решение.** Пять хирургических корректировок:

- **A1 — `getAllCars` в `React.cache()`.** Функция вызывается дважды за request (`generateMetadata()` + page component). При `export const dynamic = 'force-dynamic'` каждый request делает оба вызова, каждый — `readCatalogJson()` с disk I/O ~275ms. Без `cache()` это ~550ms лишнего I/O. Решение: `import { cache } from "react"` + `const getAllCars = cache(async () => ...)`. Call sites не меняются — React дедуплицирует внутри request lifecycle. RULE-комментарий выше декларации фиксирует контракт.

- **A2 — `priceCurrency` в Schema.org.** Было `priceCurrency: car.priceRub ? "RUB" : "CNY"` — для машин из Кореи (KRW) и Японии (JPY) JSON-LD сообщал CNY, что ломает Google Shopping и price aggregators. Стало `car.priceRub ? "RUB" : car.currency`. `car.currency` типизирован `"CNY" | "KRW" | "JPY"` в `src/types/car.ts` — точные ISO 4217 коды без fallback'а.

- **A3 — `description` в Schema.org.** Было синтетическое `${brand} ${model} ${year}, ${engineVolume}L ${transmission}` (4 токена). Стало: если `car.description` присутствует — нормализованный excerpt (collapse whitespace + word-boundary truncate до 300 символов через локальный helper `truncateForSchema`); fallback на старую техническую строку если description отсутствует. Лучший SEO snippet, rich result eligibility.

- **B5 — Lazy thumbnails в CarGallery.** На thumb `<Image>` добавлено `loading={i === 0 ? "eager" : "lazy"}`. Первая миниатюра — eager (initially-active, нужна без задержки). Thumbs 2-12 загружаются по мере скролла горизонтального thumb-row. Экономит до ~360 KB на mobile при 12 thumbs × ~30 KB AVIF. Главное фото `priority` — без `loading` (взаимоисключающие в next/image).

- **C2 — `[overflow-wrap:anywhere]` selectively removed.** Применялся в 4 местах рядом с `break-words`. `[overflow-wrap:anywhere]` режет текст на любой границе включая mid-word — на русском prose это уродливые mid-syllable переносы. `break-words` (= `overflow-wrap: break-word`) ломает только на word-boundaries и hyphens — корректно для естественного текста. Удалён с **трёх description-related блоков** (description div, description p, condition note), сохранён на `<h1>` (folderName может содержать undersлore/dash join-strings типа `Used_Mercedes-Benz_A180L_2023_280TSI_DSG_R-Line` без пробелов).

**Альтернативы.**
- **ISR через `revalidate` вместо `cache()` (A1).** Отклонено: зависит от mtime detection на catalog.json или внешнего invalidation, существенно сложнее. `cache()` решает локальный per-request dedup без global invalidation.
- **Vehicle schema upgrade вместо Product (A2/A3).** Отклонено: schema.org/Vehicle более специфичен и даёт более rich-результаты, но требует больше полей и validation. Перенесено в CD-4 как separate scope.
- **Полный motion → m migration в CarCard / CarTrustBlock.** Отклонено: вне scope CD-2, перенесено в CD-3 (вместе с CLS fix from hover:scale).
- **Динамический BreadcrumbList structured data.** Отклонено: scope CD-4 (вместе с aria-labels на thumbs).

**Последствия.**
- (+) Schema.org data accuracy improved → potential SEO uplift на Google Shopping / SERP snippets для машин Korea/Japan.
- (+) Server timing на каждом car detail request: -275ms (one fewer disk read).
- (+) Initial mobile bandwidth: -~330 KB (11 thumbs × ~30 KB AVIF, минус один который остался eager).
- (+) Russian text wrap correctness — prose в trusted текстовых блоках больше не режется mid-syllable.
- (−) `truncateForSchema` — локальный helper внутри `CarDetailPage`, не shared. Если потребуется в других server-component'ах — выделить в `src/lib/text.ts` отдельным промптом. Сейчас premature.
- (−) `loading="lazy"` для thumbs зависит от corretной разметки `<button>` parent'а — если в будущем кнопка будет hidden/display:none на mount, lazy-loading может задержать рендер. Не текущий случай.
- (Knowledge) Pattern «cache() для server-rendered Page'ов с двойным data-fetch» применять во всех будущих `force-dynamic` страницах с `generateMetadata`. Записан в этом ADR как CD-2 lesson.
- Серия Car detail audit: CD-1 ✓, CD-2 ✓, CD-3 + CD-4 planned.

## [2026-04-29] Car detail audit CD-1 — horizontal overflow fix

**Контекст.** Vasily сообщил про visual truncation на странице `/catalog/cars/[id]` при iPhone SE preview (375x667): обрезается главное фото галереи, описание уезжает за правый край viewport'а, breadcrumbs частично скрыт. Page определена как «больше всего визуальных багов» — открывается серия Car detail audit.

Diagnostic measurement в Chrome DevTools (viewport 375px):

```
Viewport: 375px, Document: 840px, Overflow: 465px
```

Документ — 840px на 375px viewport (более чем в 2 раза шире). Через `getBoundingClientRect()` traversal по всем элементам найдена цепочка overflow-contributors: HEADER.fixed, DIV.mx-auto (max-w-7xl wrapper), DIV.lg:col-span-3 (gallery column), IMG main, DIV.mt-3 (thumbs row). Все 840px шириной. Thumb-кнопки внутри thumbs row на right=424, 528, 632, 736 — N flex items по 96px + gap-2 без scroll containment.

**Решение.** Добавить `min-w-0` к двум grid-items в `src/app/catalog/cars/[id]/page.tsx`:
- `<div className="lg:col-span-3">` → `<div className="min-w-0 lg:col-span-3">`
- `<div className="lg:col-span-2">` → `<div className="min-w-0 lg:col-span-2">`

Над каждым добавлен RULE-комментарий, объясняющий grid-item-min-width-auto trap. CarGallery.tsx и остальные компоненты не тронуты — баг в parent grid items, не в галерее.

Корневая причина: CSS Grid item имеет `min-width: auto` (= `min-content`) по дефолту. Когда ребёнок — flex/scroll контейнер с `overflow-x-auto` + `flex-shrink-0` thumbnails, GRID ITEM растёт под intrinsic min-content child'а вместо того, чтобы child'у clip'аться или scroll'иться. Overflow propaгируется вверх через grid → body → page.

**Альтернативы.**
- Перенести overflow-handling в CarGallery (внутри thumbs row). Отклонено: CarGallery уже корректен (`flex gap-2 overflow-x-auto`); проблема не в нём, а в parent'е grid item, у которого `min-width: auto` сильнее `overflow-x-auto` ребёнка.
- Добавить `overflow-x: hidden` на body или html. Отклонено: маскирует симптом, не лечит причину; ломает горизонтальный scroll-snap паттерн который мы уже используем (Testimonials P-12) — внутри-контейнерный horizontal scroll должен работать.
- Реструктурировать layout (заменить CSS Grid на Flex или другую модель). Отклонено: overengineering для bag, который решается одним токеном `min-w-0`.
- Удалить `flex-shrink-0` с thumbnails в CarGallery. Отклонено: thumbnails должны сохранять фиксированную ширину 96px для consistency визуала; `flex-shrink-0` правильный.

**Последствия.**
- Страница `/catalog/cars/[id]` помещается в viewport на всех mobile-устройствах. После фикса должны всплыть остальные visual bugs страницы (если они были замаскированы общим overflow'ом) — будут зарегистрированы как CD-2..N.
- Новое правило `R-FE-3 — Grid item min-width auto trap` в `rules.md` фиксирует общий принцип: любой grid item с nested flex/scroll/long-text-with-anywhere-wrap должен иметь `min-w-0`.
- Diagnostic recipe (DevTools console snippet) сохранён в ADR и в R-FE-3 — пригоден для любого audit'а на overflow в будущем.
- Открыта серия Car detail audit. CD-1 — первый закрытый пункт; реестр CD-2..N составится после визуальной верификации фикса.

**Diagnostic recipe.** DevTools Console snippet, найдённый этим инцидентом и пригодный для повторного использования при любом подозрении на horizontal overflow:

```js
(() => {
  const docW = document.documentElement.scrollWidth;
  const viewW = document.documentElement.clientWidth;
  console.log(`Viewport: ${viewW}px, Document: ${docW}px, Overflow: ${docW - viewW}px`);
  if (docW > viewW) {
    const wide = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > viewW + 1) {
        wide.push({el: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''), right: Math.round(r.right), width: Math.round(r.width)});
      }
    });
    console.table(wide.slice(0, 20));
  }
})();
```

Запускать на самом узком target-viewport (360px). Top entries по `right` дают цепочку overflow contributors сверху-вниз по DOM.

## [2026-04-29] Mobile audit series — final summary

**Контекст.** Серия "Главная — мобильная адаптация" (фаза 2) была запущена 2026-04-29 утром после визуальной проверки главной на мобильных брейкпоинтах. Реестр из 12 пунктов составлен по результатам аудита кода + публичных стандартов CWV 2026 + анализа российской мобильной аудитории (30-42% трафика mobile). Этот ADR — финальное summary серии после закрытия последнего пункта (P-8).

**Что реализовано (12/12 resolved).**

Implemented (8 пунктов через 14+ промптов кода):
- **P-1+P-2:** Next.js Image Optimizer включён, `hero-bg.png` 6.94 MB → `hero-bg.jpg` 148 KB → AVIF 56 KB. 124× сокращение для LCP-элемента.
- **P-3:** LazyMotion + `m` migration на 10 секциях главной. Framer-motion bundle ~34 KB → ~4.6 KB initial.
- **P-4:** HowItWorks unified responsive. 90 DOM-узлов → 45, 10 motion instances → 5.
- **P-5+P-9:** `viewport-fit=cover` + `themeColor` + `safe-area-inset` на Header и Hero. iPhone notch handled.
- **P-6:** FloatingMessengers auto-hide через `data-fm-hide` IntersectionObserver. Touch-конфликт с LeadForm submit устранён.
- **P-12:** Testimonials scroll-snap + pagination dots + card width fix (`min-w-[280px]` → `w-[85vw] max-w-[320px]`).

Verified без изменений (3 пункта):
- **P-7:** Hero на 360px рендерится корректно visually.
- **P-10:** Countries hover-effects корректны через Tailwind defaults.
- **P-11:** YandexMetrika уже на оптимальной `strategy="afterInteractive"`.

Researched and deferred (1 пункт):
- **P-8:** bundle reduction через dynamic imports — не реализуем из-за Next.js 16 server-component limitation. Открыт как MA-3.

**Methodology lessons (4 урока для будущих серий).**

1. **Browser-first verification.** При любом frontend-баге primary источник истины — DevTools Console + Network в реальном браузере, не curl. Cost нарушения: 4 итерации диагностики P-1+P-2 (вместо 1) из-за curl-only диагностики, которая пропустила nginx WebSocket-upgrade misconfiguration. Зафиксировано как `R-FE-1` в `rules.md`.

2. **Allowlist completeness.** Поля типа `localPatterns` / CSP / `remotePatterns` требуют полной инвентаризации источников при первом задании, а не реакции на конкретный сломанный случай. Cost нарушения: 2 итерации fix'ов P-1+P-2 (`qualities` + одного pattern для `/images/`, потом расширение для `/storage/`). Зафиксировано как `R-FE-2` в `rules.md`.

3. **Bug hunt protocol triggers.** Skill `bug-hunting` Section 3.1 Trigger 1 (два неуспешных fix-промпта на одной ошибке) и Trigger 5 (повтор «закрытой» ошибки) применяются строго. Cost нарушения: первые 3 fix'а P-1+P-2 я лез в очередной curl без bug-hunt protocol; четвёртая итерация наконец применила skill и нашла корневую причину за 2 шага.

4. **Inseparability exceptions to one-prompt-one-file rule.** P-5+P-9 объединены в один промпт (3 кодовых файла) потому что `viewport-fit` активирует `env()` — это conditio-sine-qua-non для `safe-area-inset`. Skill `prompt-writing-standard` Section 6 допускает exception при architectural inseparability с обоснованием в CONTEXT. Pattern зафиксирован.

**Открытые Technical Debt от серии.**
- **IaC-1** — nginx-конфиг вне git-репо (открыт в P-1+P-2 closure).
- **MA-1** — Countries hover-only (low priority, conscious deferral).
- **MA-2** — Yandex Metrika webvisor performance trade-off (продуктовое решение, открыть на следующей продуктовой ревью).
- **MA-3** — Below-fold dynamic imports (Next.js 16 limitation workaround, открывать при Lighthouse regression).

**Численные итоги.**
- LCP image: 6.94 MB PNG → 56 KB AVIF (124× меньше).
- JS bundle framer-motion: ~34 KB → ~4.6 KB (7.4× меньше).
- DOM nodes в HowItWorks: 90 → 45 (50% меньше).
- Motion instances в HowItWorks: 10 → 5 (50% меньше).
- DevTools Console errors на главной: 12 → 0.

**Ссылки.** Серия охватывает коммиты от `9658e00` (P-1+P-2 первый) до этого финального коммита. ADR-цепочка: Mobile audit P-1+P-2, P-3, P-4, P-5+P-9, P-6, P-12, P-12 fix, closing cleanup, P-8 deferred — все в `decisions.md` в порядке coverage. nginx-патч на VDS — вне git, документирован в P-1+P-2 ADR Closure & lessons.

## [2026-04-29] Mobile audit P-8 — researched, deferred

**Контекст.** P-8 предлагал сократить initial JS bundle главной страницы через `next/dynamic` для 9 below-fold client-секций (Countries, HowItWorks, Calculator, Values, Warranty, Testimonials, FAQ, ContactCTA, SocialFollow). Цель — улучшить INP и TTI на мобильных пользователях за счёт отложенной загрузки interactivity для секций, видимых после скролла.

**Что выяснилось.** Next.js 16 имеет documented limitation: когда Server Component (наш `page.tsx`) делает `dynamic(() => import('...'))` для Client Component, code-splitting не происходит — импортируемый компонент попадает в initial bundle родителя. Это **подтверждённый limitation**, не наш баг (см. vercel/next.js issues #61066, #58238, #66414; App Router docs section "Lazy Loading").

**Решение.** НЕ реализовывать P-8 в его текущем виде. Закрыть как researched-and-deferred. Зарегистрировать workaround через Client Component wrapper в Technical Debt MA-3 с явным triggers для reopen (Lighthouse regression / INP > 200ms / +5 секций).

**Альтернативы.**
- Прямой `next/dynamic` в page.tsx. Отклонено: limitation Next.js 16, code-splitting не работает.
- Client Component wrapper `BelowFoldSections.tsx` с динамическими импортами внутри. Отклонено сейчас: новый файл-обёртка, потенциальные SSR-вопросы, gain ~10-20 KB. Cost > immediate benefit после P-3 (framer-motion bundle уже сокращён в 7.4×).
- Перевод page.tsx в Client Component целиком. Отклонено: потеря SSR data-fetching преимущества для NoscutPreview (server-side `fs.readFileSync` в `loadNoscutPreview`).
- Webpack `splitChunks` tuning. Отклонено: Next.js 16 уже использует дефолтные `splitChunks` оптимально для App Router; ручная настройка может конфликтовать с Next.js internals.

**Последствия.**
- Initial bundle главной остаётся в текущем размере. После P-3 это приемлемо.
- MA-3 в Technical Debt с явным reopen trigger (Lighthouse mobile < 80, INP > 200ms, или +5 секций на главной).
- Если в будущем добавятся новые тяжёлые секции на главную — нужно повторно оценить P-8/MA-3.
- Workaround с Client wrapper остаётся доступной опцией; investment в research сохранён в этом ADR.

## [2026-04-29] Mobile audit closing cleanup — P-7, P-10, P-11

**Контекст.** Серия "Главная — мобильная адаптация" (фаза 2) закрывает 11 из 12 пунктов реестра. Три пункта (P-7, P-10, P-11) не привели к изменениям в коде — каждый по своей причине. Этот ADR фиксирует causes для будущих сессий, чтобы не возвращаться к ним без необходимости.

- **P-7 (Hero на 360px).** Verified visually Vasily'ем после деплоев P-1+P-2 и P-5+P-9. Заголовок переносится корректно, кнопки на всю ширину карточки, stats-сетка (2x2) читается. Никаких code changes не требуется.
- **P-10 (Countries hover-only effects).** Карточки стран декоративные (не Link, не onClick) — informational blocks. Hover-стили на тач-устройствах не применяются благодаря тому, что Tailwind 4 по умолчанию обрабатывает `hover:` только на устройствах с hover. Минимальная теоретическая экономия CSS bytes не оправдывает изменение. Зарегистрировано как Technical Debt MA-1 для полноты картины.
- **P-11 (Yandex Metrika strategy).** Inspected `src/components/layout/YandexMetrika.tsx` — уже использует `<Script strategy="afterInteractive">`, оптимальная стратегия для analytics-скриптов. Отдельный продуктовый вопрос — `webvisor: true` (overhead на mobile CPU); это не технический баг, а trade-off UX-исследования vs. mobile performance. Зарегистрировано как Technical Debt MA-2.

**Решение.** Закрыть P-7 как verified visually. Закрыть P-11 как verified code. Перенести P-10 в Technical Debt как осознанную отсрочку (декоративный hover, нулевая стоимость). Webvisor-вопрос отделить как MA-2 в Technical Debt — продуктовое решение, не баг.

**Альтернативы.**
- Создавать отдельный ADR на каждый пункт. Отклонено: closing-summary в одном ADR компактнее, читателю-в-будущем легче понять полную картину серии за один заход.
- Открыть P-10 как полноценный bug fix. Отклонено: hover-стили не ломают UX, не блокируют интерактивность. Cost > benefit. Tailwind 4 уже гарантирует корректное поведение через media-query default.
- Сразу отключить webvisor. Отклонено: продуктовое решение, требует обсуждения с Vasiliy. Webvisor активно используется для UX-исследований.
- Молча закрыть пункты. Отклонено: через 2 сессии Claude увидит P-7/P-10/P-11 как незакрытые в реестре и начнёт их обрабатывать заново. Явное закрытие — primary защита от такого drift'а.

**Последствия.**
- Серия Mobile audit имеет один открытый пункт (P-8 — bundle reduction через dynamic imports для below-fold секций). После его закрытия серия завершена полностью.
- Будущие сессии при чтении roadmap видят явное закрытие P-7/P-10/P-11, не путают с забытыми пунктами.
- Webvisor-обсуждение зарегистрировано в Technical Debt MA-2, не теряется при следующей продуктовой ревью аналитики.
- (Knowledge) Шаблон closing-cleanup ADR установлен: при закрытии многошаговой серии, где не каждый пункт привёл к code change, единый ADR с разделением по причинам (verified / deferred / out-of-scope) — хорошая форма. Применять при следующих сериях такого размера.

## [2026-04-29] Mobile audit P-12 — Testimonials mobile scroll signal

**Контекст.** Testimonials.tsx на mobile рендерит горизонтальный scroll-контейнер с bleed-to-edge layout (`-mx-4 px-4`), 5 карточек по `min-w-[280px] shrink-0`. На viewport 360px первая карточка занимает ~280px шириной, видимая область — одна карточка целиком + ~16px peek правого края следующей. Это намеренный UX-приём (peek подсказывает «есть ещё»), но без дополнительного сигнала пользователь интерпретирует обрезание как layout-баг («текст обрезается»). Vasily обнаружил это на iPhone 14 Pro Max preview во время верификации P-5+P-9. P-12 добавлен в реестр сегодня.

**Решение.** Два минимальных усилителя сигнала «свайпни», без изменения bleed-to-edge layout'а:
1. CSS scroll-snap: `snap-x snap-mandatory` на контейнере, `snap-start` на каждой карточке. Тактильный сигнал при свайпе — карточки фиксируются на левой границе, чувствуется дискретность.
2. Pagination dots: 5 точек под карточками с `md:hidden`. Активная (соответствующая most-visible карточке) — `w-6 bg-primary`, неактивные — `w-2 bg-border`, transition-all 300ms. Декоративные (`aria-hidden="true"`), не кликабельные.

Active dot обновляется через IntersectionObserver. Ключевой технический момент: observer должен использовать `root: containerRef.current`, а не дефолтный root (page viewport). Горизонтальный scroll происходит ВНУТРИ контейнера; page viewport при свайпе не меняется, и observer с дефолтным root никогда не сработает. Threshold `[0, 0.5, 1]` даёт достаточно гранулярности, чтобы по `intersectionRatio` выбрать most-visible карточку.

**Альтернативы.**
- **Third-party carousel library (embla, swiper, keen-slider).** Отклонено: добавляет 10-30 KB к bundle, отдельная зависимость, замена нашего минимального CSS-решения на overengineered framework для случая, который решается двумя классами + observer'ом.
- **Vertical stack на mobile** (без scroll вообще, все 5 карточек в колонку). Отклонено: тратит вертикальный scroll real-estate, ломает peek-эффект и удлиняет mobile-страницу. Текущий горизонтальный scroll с peek — правильный UX для testimonials.
- **Sticky scroll indicator (custom progress bar внизу).** Отклонено: дублирует функцию pagination dots с большим визуальным шумом. Dots — стандартный вариант для 3-7 элементов.
- **Clickable dots (jump to card on tap).** Отклонено для текущего промпта: добавляет state-management (smooth scroll programmatically, scroll-position lock на кадр выбора). Вне scope P-12 — текущая задача в коммуникации affordance, не в полноценном carousel-control. Можно открыть отдельным промптом если появится feedback.
- **Только scroll-snap без dots.** Отклонено: тактильный signal работает только во время свайпа. На статике (когда пользователь увидел секцию и не двигался) sense of «есть больше» не появляется. Dots — визуальный cue для статики.
- **Только dots без scroll-snap.** Отклонено: dots показывают «есть 5 карточек», но без snap'а свайп ощущается «расхлябанным» (карточки могут останавливаться в произвольной позиции, peek не работает чисто).

**Последствия.**
- (+) Прецедент для будущих horizontal-scroll секций (catalog preview на главной, news strip, partners). Шаблон: scroll-snap + dots + IntersectionObserver с root=containerRef. Применить когда понадобится.
- (+) IntersectionObserver с явным `root: containerRef.current` зафиксирован RULE-комментарием в коде. Без этого setting observer на контейнерных scroll'ах — частая ловушка для будущих контрибьюторов (включая будущего Claude).
- (−) Pagination dots — `aria-hidden`, decorative. Screen reader'ы не получат cue про количество testimonials. Accessibility note: количество карточек уже доступно через нативную структуру DOM (5 children в scroll контейнере); decorative dots не отнимают доступности, но и не добавляют. Если в будущем понадобится кликабельная навигация — переход с `aria-hidden` на `role="tablist"` с `aria-selected` для каждого dot.
- (Knowledge) Pattern «peek-carousel needs both tactile AND visual signal» зафиксирован в ADR Consequences. Один из двух сигналов — половина коммуникации.

**Post-deploy fix.** После деплоя P-12 на проде осталась видимая обрезка mobile-карточек на 360-430px («по имп...»). Сигналы (scroll-snap + dots) работали корректно, но карточки физически выходили за viewport на длинных testimonial-текстах. Root cause: класс `min-w-[280px] shrink-0` задаёт МИНИМАЛЬНУЮ ширину без МАКСИМАЛЬНОЙ. Внутренний `<p>` с длинным текстом (220+ символов в нескольких entries из `src/data/testimonials.ts`) пытается уместиться на наименьшем числе строк — карточка растёт до intrinsic single-line ширины контента, `shrink-0` запрещает flex'у её ужать. Результат: первая карточка на 360px viewport может стать ~450px шириной, обрезается на правом краю.

Решение: заменить `min-w-[280px]` на `w-[85vw] max-w-[320px]`. `w-[85vw]` фиксирует ширину относительно viewport (306px на 360, 350px на 412, 366px на 430) — peek следующей карточки сохраняется. `max-w-[320px]` ограничивает на широких mobile-устройствах. `shrink-0` остаётся — без него flex shрink'ал бы карточки, peek-эффект ломается. RULE-комментарий выше className в коде объясняет необходимость пары width/max-width вместо одиночного min-width в этом контексте.

**Урок** (в дополнение к Consequences): `min-w-` в одиночку недостаточно для fixed-position карточек в horizontal-scroll контексте. Когда контент карточки — пользовательский текст переменной длины и `shrink-0` запрещает уменьшение, всегда парить с явной `w-` или `max-w-`. Этот pattern станет обязательным для будущих horizontal-scroll секций (catalog preview на главной, news strip, partners). Латентность бага в P-12: я знал про текстовый контент, но рассуждал «min-w задаёт минимум, текст уместится» — забыв что без max-w карточка может расти выше минимума под давлением intrinsic content width.

## [2026-04-29] Mobile audit P-6 — FloatingMessengers auto-hide on forms

**Контекст.** FloatingMessengers FAB позиционирован `fixed bottom-6 right-6 z-50` (`max-sm:bottom-4 max-sm:right-4`), main toggle h-14 w-14 (h-12 w-12 на mobile). LeadForm на главной (внутри ContactCTA) wrapped в `max-w-sm` контейнер с `space-y-3` стеком и full-width submit-кнопкой. На viewport 360px форма ≈ 328px шириной, gap до правого края viewport ≈ 16px. FAB занимает зону right 16-64px → перекрывает правые ~32px submit-кнопки. Замер на iPhone SE (375px) и Galaxy S20 (360px) подтвердил touch conflict: пользователь целится в «Оставить заявку», палец задевает FAB и открывает мессенджер-меню вместо submit'а.

**Решение.** IntersectionObserver в FloatingMessengers, declarative opt-in через атрибут `data-fm-hide="true"`. Любой элемент с этим атрибутом, попадающий в viewport, переключает FAB в hidden state (`opacity-0 pointer-events-none`, `transition-opacity duration-300`). LeadForm получает атрибут на root `<form>` — единственная правка в этом файле. Если открытое messenger-menu застаёт момент скрытия — отдельный useEffect collapse'ит его (`setOpen(false)`). Observer запускается через `requestAnimationFrame` после mount'а (гарантия что все секции страницы отрендерились), threshold 0 (любой пиксель формы в viewport триггерит hide).

**Альтернативы.**
- **Перенести FAB в другую позицию (bottom-center, left-bottom).** Отклонено: bottom-center конфликтует с iOS home indicator зоной, left-bottom — нестандартный паттерн (RU/EN пользователи привыкли к right-bottom для мессенджер-кнопок).
- **Понизить z-index FAB и поднять z-index формы.** Отклонено: не решает touch conflict — z-index влияет на painting order, но palец всё равно попадает в bounding rect FAB'а если он сверху по координатам.
- **Dismiss FAB после первого тапа на сессию (sessionStorage flag).** Отклонено: ломает основное use case'у — кнопка должна быть доступна снова после возврата с другой страницы или прокрутки. Существующий `fm_shake_shown` уже использует sessionStorage для anti-shake — добавлять второй такой flag overengineered.
- **Скрывать FAB через CSS media query на узких viewport (`max-sm:hidden`).** Отклонено: убирает FAB полностью на mobile, теряем основной messenger entry point на самом важном устройстве. Целевая логика — скрывать только когда есть конкурирующий focus zone (форма), не когда устройство узкое.
- **Hardcoded ref-based logic в FloatingMessengers** (импорт LeadForm ref'а). Отклонено: tight coupling между несвязанными компонентами; каждое новое opt-in потребует новой строки в FloatingMessengers; impossible для динамически рендерящихся компонентов через Portal.

**Последствия.**
- (+) Declarative opt-in через `data-fm-hide="true"` — extensible. Любой будущий компонент (sticky CTA bar, focus zone, full-screen modal, video player) может включиться одной строкой на root JSX без изменений в FloatingMessengers.
- (+) Touch conflict на 360-414px на главной устранён. Замер ожидаемый: поток заявок через ContactCTA не должен блокироваться mis-tap'ами.
- (−) Static observer (querySelectorAll один раз после requestAnimationFrame) — не ловит динамически добавленные элементы (lazy-loaded modal, dynamic form через client-side route). При первой такой потребности — заменить на MutationObserver wrapper или re-query при route change. Сейчас все потребители `data-fm-hide` рендерятся сразу с страницей.
- (−) `pointer-events-none` ОБЯЗАТЕЛЬНО парный с `opacity-0` в hidden state. Невидимая интерактивная кнопка — UX trap (пользователь не видит, но тапы работают). Зафиксировано RULE-комментарием в коде около className.
- (Knowledge) Этот ADR — first applied case паттерна «declarative opt-in via data-attribute для глобальных UI behaviors». Если в будущем появится нужда в подобной механике (например, hide header on scroll over elements with data-no-header), повторное использование паттерна предпочтительнее чем hardcoded refs.

## [2026-04-29] Mobile audit P-5+P-9 — viewport meta and safe-area inset

**Контекст.** Сайт работал без `export const viewport` в `src/app/layout.tsx` — Next.js эмитировал дефолтный `<meta name="viewport" content="width=device-width, initial-scale=1">` без `viewport-fit=cover`. На iPhone с notch / Dynamic Island это означает: (а) контент не доходит до краёв экрана (есть рамка-чёрная-полоска вокруг), (б) даже если бы doходил, CSS-значения `env(safe-area-inset-*)` всегда возвращали бы `0` — нет переключателя `viewport-fit=cover`. Параллельно: Header был `fixed top-0` без safe-area-inset, поэтому в гипотетическом сценарии активного `viewport-fit=cover` логотип/burger были бы заслонены notch'ом в portrait и боковым cutout'ом в landscape. Hero pt-28/sm:pt-32 был hand-tuned под высоту header'а **без notch'а** — после активации viewport-fit Hero физически залезал бы под header'а, увеличившийся на ~47-59px.

**Решение.** Объединить P-5 (Header safe-area) и P-9 (viewport meta) в один промпт.
- В `layout.tsx` добавить `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1E3A5F' }`.
- В Header.tsx root `<header>` получает `pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]` — top для portrait notch, left/right для landscape side notch и Android display cutouts.
- В Hero.tsx верхний padding меняется на `pt-[calc(7rem+env(safe-area-inset-top))] sm:pt-[calc(8rem+env(safe-area-inset-top))]` — компенсирует увеличение header'а на величину top inset.

На устройствах без выреза `env(safe-area-inset-top) = 0px`, и все три класса collapse'ятся к нулю — поведение для не-iPhone пользователей идентично текущему production. Никакой регрессии.

**Альтернативы.**
- **Раздельные промпты для P-5 и P-9.** Отклонено: технически неразделимо. После только-P-5 (safe-area классы без viewport-fit) — no-op для iPhone, лишний код. После только-P-9 (viewport-fit без safe-area) — Header заходит под notch, видимая регрессия для пользователей iPhone в проде между двумя деплоями. Объединённый промпт даёт атомарный переход через GitHub Actions auto-merge.
- **CSS-переменная `--safe-top` в `globals.css` вместо Tailwind arbitrary values.** Отклонено: ради трёх использований в двух файлах добавлять глобальную переменную — overkill. Tailwind arbitrary value `pt-[env(safe-area-inset-top)]` локализует решение в самом классе и читается без cross-file lookup.
- **`scaleSnap`/`scalable` `false` для блокировки zoom**. Отклонено: блокирует accessibility (pinch-zoom для visually impaired). Современная конвенция — позволять зум.
- **`overflowAnchor` или другие viewport poly-fields.** Отклонено: не относятся к safe-area; за scope текущего промпта.

**Последствия.**
- (+) iPhone 14/15 Pro в portrait — header больше не клипуется notch'ом, Hero card стартует с visible margin'ом ниже header'а.
- (+) iPhone в landscape — боковой notch не закрывает логотип/контакты.
- (+) Android Chrome (real device) — address bar тинтуется в брендовый `#1E3A5F`. На iOS Safari `themeColor` действует только в standalone PWA mode — это known platform limitation, не баг проекта.
- (−) Android устройства с display cutout — не тестировались физически, только через DevTools simulation. При первом обнаружении регрессии — добавить device-specific fix, не пытаться угадать сейчас.
- (−) Если в будущем нужно отключить viewport-fit (например, при добавлении встраиваемого режима), три safe-area класса в Header.tsx и calc() в Hero.tsx останутся — на устройствах без notch это no-op, удалить можно отдельным промптом без срочности.
- (Knowledge) Все будущие fixed-header'ы и absolute-positioned элементы у краёв должны учитывать safe-area-inset. Это структурное правило для проекта; зафиксировано в ADR Consequences для будущей сверки.

## [2026-04-29] Mobile audit P-4 — HowItWorks unified responsive layout

**Контекст.** В `src/components/sections/HowItWorks.tsx` 5 шагов процесса рендерились **двумя дублирующими JSX-блоками**: desktop (`hidden md:grid md:grid-cols-5 md:gap-4` с большими кружками h-14 и lucide-иконками) и mobile (`md:hidden space-y-8` с маленькими кружками h-6 и цифрами вместо иконок). Итого 90 DOM-узлов (5 × 2 × 9), один блок всегда `display: none` на конкретном устройстве. Каждый шаг — отдельный `<m.div>` с whileInView анимацией, итого 10 motion-инстансов на странице (5+5). Дополнительная проблема — потеря информационной семантики: на mobile пользователь видит номера 1-5 (порядок), на desktop — иконки (тип шага), но не оба сигнала одновременно ни на одном breakpoint'е.

**Решение.** Заменить два блока одним unified responsive блоком `mt-12 grid gap-8 md:grid-cols-5 md:gap-4` с одним `.map()`. Каждый шаг — один `<m.div>` с адаптивным flex (`flex gap-4` на mobile, `md:flex-col md:items-center md:gap-0 md:text-center` на desktop). Иконка-кружок h-12 w-12 несёт оба сигнала на каждом breakpoint'е: lucide-икону + small badge h-5 w-5 в правом-нижнем углу с номером 1-5 (`absolute -bottom-1 -right-1 bg-secondary text-white ring-2 ring-surface-alt`). Connector-линии остаются двух-вариантными (вертикальная `md:hidden` + горизонтальная `hidden md:block`) — это decorative dual-div, не контент, accepted exception. Результат: 90 DOM-узлов → 45, 10 motion-инстансов → 5, ноль информационной потери между breakpoint'ами.

**Альтернативы.**
- **Vertical-everywhere** (один column-layout на всех viewport'ах): отклонено — desktop теряет преимущество horizontal timeline, который интуитивно читается как "процесс слева направо".
- **Container queries** (`@container` Tailwind 4): отклонено как overengineering для секции, у которой parent — full-width container, а responsive-логика ровно одна (mobile vs desktop). Container queries оправданы когда несколько embedded-сценариев (например, sidebar vs main content) — здесь не наш случай.
- **Numbers-only на всех breakpoint'ах** (без lucide-икон): отклонено — иконки даны редактором копии, они carry semantic meaning per step (MessageCircle = заявка, Ship = доставка, и т.д.), убрать их = регрессия по копирайтингу.
- **Icons-only на всех breakpoint'ах** (без номеров): отклонено — номер 1-5 даёт sequential cue ("шаг N из 5"), важный для процессного нарратива. Иконка одна не передаёт порядок без mental load.

**Последствия.**
- (+) Прецедент для будущих timeline-подобных секций: единый responsive layout вместо dual-render. Этот паттерн ещё может встретиться в других секциях главной (Values, FAQ); при следующих P-промптах серии — проверять и применять тот же подход.
- (+) Decorative connector-линии остаются как dual-div (`md:hidden` + `hidden md:block`) — это accepted exception, потому что геометрия линий принципиально разная (вертикаль vs горизонталь). Один connector через `flex-direction`-aware абсолютное позиционирование был бы overengineering.
- (−) Mobile animation trade-off: было `x:-20 → x:0` (slide-from-left), стало `y:20 → y:0` (fade-up). Функционально эквивалентно (signal "элемент появляется"), визуальное различие минимально. Принято за code unification.
- (Knowledge) RULE-комментарий внутри блока фиксирует зависимость connector-line offsets от размера кружка (h-12 = 48px) и parent gap (mobile gap-8 = 2rem, desktop gap-4 = 16px). Любое изменение размера кружка требует синхронной правки calc()-выражений.

## [2026-04-29] Mobile audit P-3 — LazyMotion + m migration on home page

**Контекст.** Все 10 client-секций главной импортировали `motion` напрямую из framer-motion, что включает в initial bundle полный feature-set (~34 KB gzipped) — даже когда используется только `initial`/`animate`/`whileInView`/`viewport`/`transition`. На мобильной CPU это бьёт по INP (порог "good" ≤ 200ms по CWV 2026).

**Решение.** Один глобальный client-wrapper `MotionProvider` с `<LazyMotion features={domAnimation}>` в `src/app/layout.tsx` вокруг `<main>`. Все 10 секций главной мигрированы с `motion.div` на `m.div` через `import * as m from "framer-motion/m"`. Bundle framer-motion: ~34 KB → ~4.6 KB initial.

**Альтернативы.**
- Локальный LazyMotion в каждой секции. Отклонено: 10 дублирующихся обёрток vs один файл MotionProvider.
- Замена framer-motion на Motion One или CSS keyframes. Отклонено: framer-motion интегрирован в проект, миграция на другую библиотеку — отдельная T3 задача с гораздо большим scope.
- Убрать декоративные scroll-триггерные анимации с главной полностью. Отклонено: продуктовое решение, не входит в P-3 — может быть рассмотрено отдельно.
- Включить `strict` на LazyMotion сразу. Отклонено: CarCard/NoscutCard/tools-страницы ещё используют `motion` напрямую (рендерятся на /catalog, /catalog/noscut, /tools/*). `strict` сразу — runtime errors на этих страницах. Включим финальным промптом серии после полной миграции.

**Последствия.**
- Все будущие client-компоненты в src/ должны использовать `m.X` вместо `motion.X` для tree-shake'инга. Это зафиксировано в `@rule` JSDoc-шапки MotionProvider.tsx.
- При следующей сессии Claude Code, добавляющего новые анимации — нужно явно проверять, что используется `m`, не `motion`. После включения `strict` это будет автоматически (runtime error).
- CarCard.tsx, NoscutCard.tsx, tools-страницы и другие неподёрнутые motion-импорты — known техдолг, planned серия. Зарегистрировать в Technical Debt секции roadmap.md (если уже не зарегистрировано).

## [2026-04-29] Mobile audit P-1+P-2 — enable Next.js image optimizer + compress hero-bg

**Контекст.** Стартовая инвентаризация мобильной адаптации главной выявила два пункта с наибольшим LCP-эффектом: (а) `images: { unoptimized: true }` в next.config.ts полностью отключал встроенный оптимизатор; (б) `public/images/hero-bg.png` весил 6.62 MB и был LCP-элементом Hero. На медианном мобильном канале в России (37.42 Mbps) только загрузка hero-bg занимала ~1.5s.

**Решение.** Снять `unoptimized: true`, активировать `formats: ['image/avif', 'image/webp']` с deviceSizes включающими мобильные брейкпоинты 360/414. Перенести sharp в production dependencies. Pre-compress hero-bg.png в hero-bg.jpg quality=85 progressive=true mozjpeg=true целевой ширины 1920 — оптимизатор далее сделает AVIF/WebP responsive variants on-demand. Фактический результат компрессии: 6.62 MB → 148 KB (97.8%).

**Альтернативы.**
- Оставить unoptimized + руками генерить WebP/AVIF varianты в build-time через скрипт. Отклонено: дублирует работу Next.js, требует поддержки.
- Внешний CDN для image optimization (Cloudinary/Imgix). Отклонено: лишняя зависимость и стоимость для нашего объёма.
- Только pre-compression без включения оптимизатора. Отклонено: теряем AVIF (~50% выигрыш) и responsive resizing для мобильных.

**Последствия.**
- На /_next/image теперь идёт нагрузка sharp на VDS — нужен мониторинг CPU после прод-релиза. Кэш minimumCacheTTL=86400 снимает повторные запросы.
- Все будущие <Image> компоненты на сайте автоматически получают оптимизацию без дополнительных правок.
- Удалён hero-bg.png — все ссылки на /images/hero-bg.png в репо сломаются. Проверено: используется только в Hero.tsx, других ссылок нет.

**Post-deploy fix.** После первого деплоя обнаружен 400 Bad Request на /_next/image. Причина: Next.js 16 требует обязательного поля `qualities` в блоке images — это security-механизм против DoS через произвольные значения q= в URL. Без allowlist'а любой q= → 400. Решено добавлением `qualities: [75, 85]` (75 — дефолт Next.js, 85 — наш Hero). Параллельно добавлен `localPatterns` для путей `/images/**` — best practice 2026 для явного allowlist'а локальных картинок. Урок: при включении продвинутых features Next.js после major-апгрейда — сверять changelog обязательных полей конфига, а не полагаться на то, что отсутствие поля = пермиссивный дефолт.

**Post-deploy fix #2.** После первого fix (qualities + localPatterns: /images/**) и nginx-патча на VDS (WebSocket upgrade map) optimizer заработал на hero-bg.jpg, но картинки каталога из `/storage/` продолжали возвращать 400. Причина: `localPatterns` валидирует пути по allowlist, и `/storage/**` под него не подпадал. Решено расширением массива до двух паттернов: `/images/**` (статические ассеты) и `/storage/**` (динамические фото каталога через симлинк public/storage → /var/www/jckauto/storage).

Урок (в дополнение к Post-deploy fix #1): при добавлении allowlist-полей (localPatterns, remotePatterns, CSP source-list, CORS origins) — обязательная инвентаризация всех источников через grep по src/, а не реакция на конкретную сломанную картинку. Цена нарушения этого правила: 4 итерации диагностики + bug hunt по другой связанной проблеме (nginx WebSocket misconfiguration), вместо одного полного fix'а в первом промпте P-1+P-2.

Также: первая неудача fix'а после деплоя — обязательная браузерная верификация (DevTools Console), не только curl. Curl без браузерных headers (особенно Accept-header с image/avif,...) скрыл от меня и реальные 400 на /storage/, и реальный механизм через nginx upgrade-headers. Браузерные DevTools — primary источник истины для прод-багов с фронтендом.

**Closure & lessons (2026-04-29 vecher).** P-1+P-2 функционально завершён: AVIF/WebP отдаются всем пользователям. Bug hunt по 400 на /_next/image занял 4 итерации, потому что было три разных корневых причины, последовательно скрывавших друг друга:

1. Next.js 16 требует `qualities` allowlist (security feature, не было задано) → 400 из самого optimizer.
2. nginx с хардкодом `Connection 'upgrade'` для всех запросов в location / превращал обычные браузерные GET в попытки WebSocket handshake → 400 от Next.js на не-WebSocket endpoint.
3. `localPatterns` allowlist не покрывал `/storage/**` → 400 для всех картинок каталога.

Каждый последующий fix вскрывал следующий слой. Это **не патология** — это нормальное layered failure mode для production-стека с несколькими компонентами. Патология — что я пытался найти все три причины через curl, не открывая DevTools Console. **Curl без браузерных Accept-headers пропустил баг #2 целиком**, потому что nginx ведёт себя по-разному для запросов с/без headers.

**Главный урок:** при первом 400 на /_next/image (или любом другом frontend-ресурсе) — primary источник истины **всегда DevTools Console + Network tab**, не curl. Curl — supplemental tool для проверки гипотез после визуального инвентаризатора через DevTools. Это правило вынесено в rules.md как `R-FE-1`.

**Второй урок:** allowlist-поля (localPatterns, remotePatterns, CSP, CORS) требуют **полной инвентаризации источников** при первом задании. Метод: `grep -r '<Image src=' src/ | sort -u | awk -F'src="' '{print $2}' | awk -F'"' '{print $1}' | head` — посмотреть все уникальные пути prefix'ы. У нас были два (`/images/`, `/storage/`), а в первый fix я внёс только один. Это `R-FE-2` в rules.md.

