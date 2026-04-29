<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources + strategic initiatives
  @updated:     2026-04-29
  @version:     1.31
  @lines:       377
-->

# Roadmap

> For detailed open bugs see bugs.md

## Recent Activity

> Журнал последних сессий. Новые записи на верх. После 10 записей — старые
> переносятся в roadmap-archive-N.md.

### 2026-04-29 — Mobile audit P-1+P-2: enable Next.js image optimizer + compress hero-bg

- **Сделано:** в `next.config.ts` снят `unoptimized: true` и добавлен блок `images: { formats, deviceSizes, imageSizes, minimumCacheTTL }` с AVIF в приоритете и брейкпоинтами 360/414. `sharp` перенесён из devDependencies в dependencies для production runtime. Файл `public/images/hero-bg.png` (6.62 MB) пережат через одноразовый `scripts/compress-hero-bg.ts` в `public/images/hero-bg.jpg` (148 KB, ≤ 500 KB). Ссылка в `src/components/sections/Hero.tsx` обновлена. После деплоя production-проверка через `curl -H "Accept: image/avif,image/webp" /_next/image?url=...` должна вернуть `content-type: image/avif` или `image/webp`.
- **Прервались на:** ожидание результата curl-проверки на VDS после auto-merge | **Следующий шаг:** P-3 (Framer Motion → LazyMotion + m component) если AC прошли; либо разбор регрессии если nginx режет /_next/image.
- **Контекст:** P-1+P-2 — первый промпт фазы 2 серии "Главная — мобильная адаптация". Из реестра 11 пунктов, эти два дают наибольший эффект на LCP мобильного. Серия будет идти P-1 → P-11 по порядку приоритета.
- **Структурные уроки:** (1) sharp в devDependencies при production runtime под PM2 — латентный баг, который не проявлялся только потому что `unoptimized: true` отключал оптимизатор целиком. После включения оптимизатора без sharp в dependencies был бы 500 на /_next/image; (2) pre-compression source перед оптимизатором (PNG 6.62 MB → JPEG 148 KB, 97.8% reduction) — стандартная практика; оптимизатор не делает чудес из неоптимизированного source.
- **Ссылки:** этот коммит.

### 2026-04-28 — Б-7 закрыт: pm2 restart вместо startOrReload для jckauto

- **Сделано:** в `.github/workflows/deploy.yml` после `ln -sfn` symlink swap заменено `pm2 startOrReload ... --only jckauto,jckauto-bot` на `pm2 startOrReload --only jckauto-bot` + `pm2 restart jckauto --update-env`. Bot deploy-path не меняется. Site (jckauto) теперь делает hard restart, чтобы drop'нуть in-memory Next.js chunks из старого слота и читать новый slot с нуля.
- **Прервались на:** Б-7 закрыт; верификация на следующем deploy через `pm2 describe jckauto | grep restarts` — restarts должны стабилизироваться. | **Следующий шаг:** Б-7 closing подтверждается следующим деплоем; дальше — Technical Debt хвост (pendingSource TTL, JSDoc audit, TS hygiene, DRY noscut.ts) или новые задачи.
- **Контекст бага:** 269 рестартов на jckauto за 7 часов (~каждые 94 секунды) с ENOENT на `.next/BUILD_ID`. Корневая причина — graceful reload через `pm2 startOrReload` сохранял in-memory chunks из старого slot после swap. Smoking gun: stack-trace `at async Module.N (.next-b/server/...)` — код старого slot читал BUILD_ID нового slot.
- **Структурные уроки:** (1) `pm2 startOrReload` ≠ `pm2 restart` для уже-online процесса. Та же ловушка ранее проявилась как Б-13 (бот не подхватил `.env.local`); там исправлено через `delete + start`, но симметричный фикс для сайта не был сделан. Урок: при ловле graceful-reload бага ВСЕГДА проверять, не страдает ли симметричный процесс. (2) Skill `bug-hunting` сработал по своей роли — диагностика через реальные pm2-данные дала smoking gun за один раунд. Без `pm2 describe` (uptime + restarts counter) и `pm2 logs --err` (стек с `.next-b/...` в путях файлов) — мы бы гадали ещё несколько итераций.
- **Ссылки:** этот коммит. ADR `[2026-04-28] Б-7 closed — pm2 restart instead of startOrReload for jckauto after slot swap` в `decisions.md`.

### 2026-04-28 — Серия encar-site-photo закрыта (2 промпта): главное фото на /tools/encar

- **Сделано:** два последовательных промпта закрыли продуктовый баг «выбирается неудачное фото» на /tools/encar. (1) `cddc93c` — бот: фиксация status-quo «фото не отправляются» через @rule в encar.ts JSDoc + строку в bot.md. (2) `<sha-этого-коммита>` — сайт: сортировка `raw.photos` по полю `code` в `mapToResult` (encarClient.ts), расширение типа `EncarVehicleRaw.photos` на поля `code` и `type`. После фикса `photoUrls[0]` всегда `_001.jpg` (главное фото-экстерьер, как в галерее encar.com).
- **Прервались на:** серия закрыта, баг исправлен. | **Следующий шаг:** другие открытые задачи или закрытие сессии.
- **Контекст бага:** Encar API endpoint `/v1/readside/vehicle/{carid}` возвращает массив `photos` в произвольном порядке. На сайте encar.com галерея рендерится в порядке возрастания поля `code` ("001", "002", ..., "024"). Наш код в `mapToResult` брал `raw.photos` без сортировки, поэтому `photoUrls[0]` оказывался случайным фото — часто `type="OPTION"` (детали салона). Пользователь, открывая /tools/encar, видел «странное» фото вместо машины.
- **Структурные уроки серии:** (1) Перед написанием промпта на «непонятное поведение API» — открыть HTML страницы поставщика через web_fetch и посмотреть `__PRELOADED_STATE__`. Реальные данные API часто сериализованы в HTML SPA-каркаса. Это дешевле диагностического скрипта. (2) Тип `EncarVehicleRaw.photos` описывал только `path` — поля `code` и `type` существовали в API с самого начала, но игнорировались. Урок: при добавлении нового парсинга внешнего API смотреть полный пример ответа, не только поля используемые в первой итерации. (3) Промпт-1 серии (бот: @rule «фото не отправляются») был осознанным фиксированием status-quo, не cosmetic. Будущая дискуссия «давай добавим фото в бота» теперь явно начинается с уже зарегистрированного решения.
- **Ссылки:** два коммита серии — `cddc93c`, `<sha-этого-коммита>`.

### 2026-04-28 — noscut-fix серия (3 промпта): production bug закрыт через single-source-of-truth helper

- **Сделано:** три последовательных промпта закрыли production bug, обнаруженный сегодня по скриншоту в Telegram. (1) `760fa0e` — `noscut.ts`: новый exported helper `sendNoscutInstructions(bot, chatId)` — атомарно шлёт инструкцию и armит `awaitingQuery` state. Slash-handler `/noscut` без аргументов переключён на helper (заодно длинный текст вместо короткого хинта — тот же UX что у кнопки). (2) `4325ab0` — `start.ts`: callback `noscut_info` (тапанье «🔧 Ноускаты» в главном меню) переключён на helper, inline-копия длинного текста удалена. Prod-баг закрыт. (3) этот коммит — knowledge: ADR + эта запись + Done bullet + INDEX. bugs.md НЕ трогаем — баг никогда не был в bugs.md (одна-сессия-баг).
- **Прервались на:** серия закрыта, баг исправлен. | **Следующий шаг:** другие открытые задачи или закрытие сессии.
- **Контекст бага:** commit `c9e2fed` (Б-новый-A 2/6, 2026-04-27) добавил inline-кнопку «🔧 Ноускаты» с callback'ом, который шлёт длинную инструкцию «отправьте марку и модель», но **не армит** `awaitingQuery: Map` в noscut.ts. State армится только в slash-handler `/noscut` без аргументов. Plain-text branch в noscut.ts молча игнорирует сообщения если state не armed. Юзер видит инструкцию → пишет «Toyota RAV4» → бот молчит.
- **Структурные уроки серии:** (1) Inline-кнопки, которые шлют instruction-message и ожидают follow-up plain-text от юзера, ДОЛЖНЫ армить state-machine, если такая есть в инструменте. Класс бага опознаваем: button callback → instruction → silent ignore reply. Любая будущая такая кнопка требует аудита: «есть ли state machine которое нужно armить?». (2) Архитектурная асимметрия (helper в `lib/` vs в `handlers/`) приемлема и оправдана когда есть state coupling — `sendAuctionInstructions`/`sendEncarInstructions` в `lib/instructionMessages.ts` (без state), `sendNoscutInstructions` в `handlers/noscut.ts` (со state). Перенос в lib потребовал бы либо экспорта Map'ы, либо дублирования state. (3) Bug-of-record для одной-сессии-багов фиксируется только в ADR, не в bugs.md — convention "After fix → ADR + entry removed", а entry'а никогда не было.
- **Ссылки:** три коммита серии — `760fa0e`, `4325ab0`, этот коммит. ADR `[2026-04-28] noscut-fix — single-source-of-truth helper for instruction + state-arm` в `decisions.md`. Bug introduced `c9e2fed` (Б-новый-A 2/6).

### 2026-04-27 — Серия Б-новый-A закрыта (6 промптов): bot menu redesign + BotFather sync from code

- **Сделано:** шесть последовательных промптов закрыли серию Б-новый-A. (1) `1eb76b9` — `customs.ts`: callback handler `customs_start` (entry-point из inline-меню), симметрично с существующим `calc_start` в calculator.ts. (2) `c9e2fed` — `start.ts`: новое inline-меню (3×2 сервисов + Связаться + Поделиться), welcome-текст укорочен и расширен до «автомобили и запчасти», новый callback handler `noscut_info`, share-URL мигрирован на `encodeURIComponent` template literal с обновлённым текстом упоминающим все 5 главных сервисов. (3) `444b7bb` — `auctionSheet.ts`: новый `/auction` slash-handler с instruction-message (зеркало callback `auction_info` в start.ts). (4) `5737088` — `encar.ts`: новый `/encar` slash-handler + защитный guard `if (msg.text?.startsWith('/')) return;` в existing URL-detection handler — предотвращает двойной ответ на сообщение типа `/encar https://encar.com/...`. (5) `b53e639` — новый файл `src/bot/lib/syncBotCommands.ts` (экспорт `BOT_COMMANDS` массив 7 команд + функция `syncBotCommands(bot)`), интеграция в `src/bot/index.ts` через fire-and-forget вызов после регистрации handlers; tsconfig target ES2017 не позволяет top-level await, поэтому без `await` с try-catch внутри функции. (6) этот коммит — knowledge: bugs.md удаление Б-новый-A, ADR `[2026-04-27]` в decisions.md, roadmap.md (эта запись + Done bullet + 1 Technical Debt bullet), INDEX.md обновление дат и описаний.
- **Прервались на:** серия Б-новый-A закрыта полностью | **Следующий шаг:** возврат в нормальную очередь — закрыть admin.ts hygiene (T1, дешёвый), потом другие открытые баги Б-5/Б-6/Б-7/Б-8 или новые задачи по приоритету.
- **Контекст:** баг зарегистрирован 2026-04-26 на основании скриншота двойного меню в чате стратегического партнёра. Главный продуктовый вопрос — какой из 4 вариантов дизайна меню выбрать (a/b/c/d из bugs.md плюс предложенный командой Variant B с подменю «🔧 Ещё инструменты»). Vasily отверг Variant B (noscut в подменю), выбрал «всё на одном экране» с порядком отражающим продуктовую стратегию: catalog/noscut (товары) → calc/customs (числа) → auction/encar (инструменты исследования).
- **Структурные уроки серии:** (1) Порядок промптов в серии меню важен: handler для callback'а должен предшествовать промпту, добавляющему кнопку с этим callback'ом — иначе окно поведенческой регрессии в проде, где кнопка нажимается, но не работает. Применено дважды: customs_start handler в промпте 1 перед start.ts кнопкой в промпте 2; /auction и /encar handlers в 3-4 перед setMyCommands в 5. (2) `setMyCommands` идемпотентен и подходит для fire-and-forget на startup даже без top-level await (ES2017 target). Try-catch внутри функции защищает бот от падения на network-сбое Telegram API. (3) Линvistical drift «ноускат» vs «носкат» — продуктовая копия должна следовать поисковым запросам пользователей (Wordstat-доминирование), не лингвистической корректности. Зафиксировано в ADR Consequences чтобы вопрос не возвращался. (4) API Error на промпте 2 был transient (повтор того же промпта прошёл) — гипотеза «infrastructure flake», не «нарушение в моём промпте»; повторять промпт без изменений до второго падения, тогда уже разбираться.
- **Ссылки:** шесть коммитов серии — `1eb76b9`, `c9e2fed`, `444b7bb`, `5737088`, `b53e639`, этот коммит. ADR `[2026-04-27] Б-новый-A closed — bot menu redesigned + BotFather command list synced from code` в `decisions.md`.

### 2026-04-27 — Серия Б-новый-B закрыта (6 промптов): bot leads carry tool-context source

- **Сделано:** шесть последовательных промптов закрыли серию Б-новый-B. (1) `6b873ec` — `request.ts`: получатель (`finishRequest`/`appendLeadLog`/два contact-handler'а) очищен — четыре occurrences `"Telegram-бот (прямая заявка)"` заменены на `"Telegram-бот"`, дубликат строки `Источник: Telegram-бот` удалён. (2) `a296f2a` — `noscut.ts`: 4 точки записи в `pendingSource` (slash + plain-text branches × found + empty), локальный helper `buildNoscutSource` с truncate query до 50 символов, импорт `pendingSource`. (3) `c8d38d9` — `calculator.ts` + `customs.ts` парой: симметричные правки через общий `siteRequestAndAgainButtons` helper и `COUNTRY_CURRENCY[country].label`. Source форматы: `расчёт стоимости (Корея)` и `расчёт таможни (Корея)`. (4) `28e4801` — `auctionSheet.ts`: один `pendingSource.set` ВНУТРИ try-block после formatter'ов. Source без OCR-полей (защита от японских символов и parse_error fragility). (5) `38e5c9e` — `encar.ts`: один `pendingSource.set` ПЕРЕД try-block после `formatEncarResult`. Source включает `carId` для прямого перехода менеджера на encar.com. (6) этот коммит — knowledge: bugs.md удаление Б-новый-B, ADR `[2026-04-27]` в decisions.md, roadmap.md (эта запись + Done bullet + 2 Technical Debt bullet'а), INDEX.md обновление дат и описаний.
- **Прервались на:** серия Б-новый-B закрыта полностью | **Следующий шаг:** возврат в нормальную очередь — Б-новый-A (меню бота, T3, требует продуктового решения), pendingSource TTL (T2, зарегистрирован в Technical Debt), handler JSDoc audit (T2, зарегистрирован), либо другие открытые баги Б-5/Б-6/Б-7/Б-8.
- **Контекст:** баг Б-новый-B зарегистрирован 2026-04-26 на основании реальной production заявки. Изначальная гипотеза (расширить сигнатуру `handleRequestCommand` с `source?` параметром) была отвергнута на этапе исследования: callback_query handler в request.ts не знает source в момент клика. Существующий механизм `pendingSource: Map<number, string>` уже использовался catalog.ts'ом, остальные 5 tools его не наполняли. Серия закрыла gap.
- **Структурные уроки серии:** (1) Урок про `fs_read_file` целевого файла перед составлением каждого промпта подтвердился — в промпте 1 я пропустил 3 из 4 occurrences fallback-строки в request.ts, потому что писал по памяти; Claude Code корректно расширил scope через rule 4 (Goal over steps), но это была компенсация моей ошибки. Урок зафиксирован в memory. (2) Position `pendingSource.set` относительно try-block адаптируется к структуре каждого файла — в auctionSheet.ts внутри try (формeruters могут throw), в encar.ts перед try (formatter уже завершён). Net behavior симметричный, разница не баг — это корректная адаптация. (3) `pendingSource` без TTL — структурная проблема, surfaced 5 раз за серию; зарегистрирована как T2 follow-up. (4) Calc и customs не имеют `@dependencies` JSDoc field — convention inconsistent across bot handlers; зарегистрировано как T2 audit follow-up.
- **Ссылки:** шесть коммитов серии — `6b873ec`, `a296f2a`, `c8d38d9`, `28e4801`, `38e5c9e`, этот коммит. ADR `[2026-04-27] Б-новый-B closed — bot leads now carry tool-context source` в `decisions.md`.

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

- [x] **2026-04-29 — Mobile audit P-1+P-2 закрыт.** В next.config.ts включён image optimizer (AVIF/WebP, mobile-first deviceSizes 360/414). sharp в production dependencies. hero-bg переcжат с 6.62 MB до 148 KB JPEG. Ссылка в Hero обновлена. Production curl-проверка `/_next/image` подтвердила выдачу AVIF/WebP с правильным content-type. См. ADR `[2026-04-29] Mobile audit P-1+P-2`.
- [x] **2026-04-28 — Б-7 закрыт: pm2 restart вместо startOrReload для jckauto после slot swap.** В `.github/workflows/deploy.yml` после symlink swap заменено `pm2 startOrReload ... --only jckauto,jckauto-bot` на `startOrReload --only jckauto-bot` + `pm2 restart jckauto --update-env`. Корневая причина 720+ рестартов из bugs.md подтверждена smoking gun stack-trace `at async Module.N (.next-b/server/...)` — graceful reload сохранял in-memory chunks из старого slot после swap. Hard restart drop'ает все file descriptors и in-memory state, deploy запускается с чистым slot. Downtime несколько секунд (идентично текущему поведению bot deploy через delete+start). Симметрия с Б-13 теперь восстановлена. См. ADR `[2026-04-28] Б-7 closed — pm2 restart instead of startOrReload`.
- [x] **2026-04-28 — noscut-fix серия (3 промпта): production bug закрыт.** Три коммита (`760fa0e` noscut.ts → `4325ab0` start.ts → этот коммит knowledge). Inline-кнопка «🔧 Ноускаты» в главном меню (введена в commit `c9e2fed` 2026-04-27) шла instruction-message без `awaitingQuery.set`, поэтому юзер тапал кнопку, видел инструкцию, писал марку — и бот молчал. Решение: новый exported helper `sendNoscutInstructions(bot, chatId)` в `src/bot/handlers/noscut.ts`, который атомарно шлёт инструкцию И armит state. Оба call site (start.ts callback `noscut_info` + noscut.ts slash-without-args) используют единственный helper. Архитектурная асимметрия: auction/encar helpers в `lib/instructionMessages.ts` без state, noscut helper в `handlers/noscut.ts` со state — оправдано coupling'ом text↔state. Бонус: `/noscut` без аргументов теперь показывает ту же длинную инструкцию что и кнопка (была короткая «Примеры:...»). См. ADR `[2026-04-28] noscut-fix — single-source-of-truth helper for instruction + state-arm`.
- [x] **2026-04-27 — Серия Б-новый-A закрыта: bot menu redesign + BotFather sync from code.** Шесть последовательных промптов (`1eb76b9` customs.ts → `c9e2fed` start.ts → `444b7bb` auctionSheet.ts → `5737088` encar.ts → `b53e639` syncBotCommands.ts new + index.ts → этот коммит knowledge). Inline-меню /start теперь содержит 6 сервисов в 3×2 + Связаться + Поделиться (было 4 сервиса). Все 6 сервисов — `🚗 Каталог авто`, `🔧 Ноускаты`, `💰 Калькулятор авто`, `📋 Калькулятор пошлин`, `🔍 Аукционный лист`, `🇰🇷 Анализ Encar` — с emoji, в порядке отражающем продуктовую стратегию. BotFather native command list (нативное «Меню» Telegram) синхронизируется с кодом на каждом старте бота через `bot.setMyCommands(BOT_COMMANDS)` где `BOT_COMMANDS` — экспортированный массив 7 команд в `src/bot/lib/syncBotCommands.ts`. Дрейф между двумя menu surfaces структурно закрыт: source of truth — массив в коде; рестарт бота re-applies sync. Welcome text расширен на «автомобили и запчасти». Share-text мигрирован на `encodeURIComponent` template literal с обновлённым текстом упоминающим 5 главных сервисов. Новые `/auction` и `/encar` slash-команды (информационные, шлют instruction-message), плюс slash-prefix guard в encar.ts URL-handler'е чтобы избежать двойного ответа на `/encar https://encar.com/...`. См. ADR `[2026-04-27] Б-новый-A closed — bot menu redesigned + BotFather command list synced from code`.
- [x] **2026-04-27 — Серия Б-новый-B закрыта: bot leads carry tool-context source.** Шесть последовательных промптов (`6b873ec` request.ts → `a296f2a` noscut.ts → `c8d38d9` calc+customs → `28e4801` auctionSheet → `38e5c9e` encar → этот коммит knowledge). Все пять tools (noscut, calc, customs, auction-sheet, encar) теперь записывают meaningful source в `pendingSource: Map<number, string>` перед отправкой результата с кнопкой «Оставить заявку». Receiver (`finishRequest`) уже читал из этой Map'ы — gap был только в writers. Source формат для каждого инструмента: `Telegram-бот: ноускаты (запрос: "...")`, `расчёт стоимости (Корея)`, `расчёт таможни (Корея)`, `расшифровка аукционного листа`, `Encar (carId=...)`. Дополнительно очищены 4 occurrences hardcoded `"Telegram-бот (прямая заявка)"` в request.ts (display + audit log + два contact handler'а), удалён дубликат `Источник: Telegram-бот` строки. Менеджеры теперь видят tool context в каждой заявке. См. ADR `[2026-04-27] Б-новый-B closed — bot leads now carry tool-context source`.
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
- [ ] **`pendingSource` Map без TTL.** `src/bot/handlers/request.ts` экспортирует `pendingSource: Map<number, string>` без механизма expiration. Запись очищается только при оформлении lead'а через явный `pendingSource.delete(chatId)`. Если пользователь видит кнопку «Оставить заявку» (после noscut/calc/customs/auction-sheet/encar) и не нажимает её — entry остаётся в Map'е до следующего захода через тот же tool (overwrite) или до restart процесса. Theoretical memory drift при долгой uptime, но keys=chatId ограничено userbase'ом (несколько тысяч). Архитектурная неопрятность, surfaced 5 раз в out-of-scope reports серии Б-новый-B (2026-04-27). Один T2 промпт: добавить TTL 5–10 минут аналогично паттерну `awaitingQuery: Map` в `noscut.ts` (lazy cleanup при обращении + `AWAITING_TTL_MS` константа). Без поведенческих изменений в нормальных сценариях.
- [ ] **Handler JSDoc audit — `@dependencies` field.** Convention inconsistent across `src/bot/handlers/*.ts`: некоторые файлы (`noscut.ts`, `auctionSheet.ts`, `encar.ts`, `request.ts`) имеют полноценный `@dependencies` блок в JSDoc-шапке, другие (`calculator.ts`, `customs.ts`, `start.ts`, `admin.ts`) — нет. Surfaced out-of-scope в промпте 3 серии Б-новый-B (calc/customs не получили обновление @dependencies на новый pendingSource импорт, потому что это поле отсутствовало целиком). Один T2 промпт: пройти все handler-файлы, добавить или дополнить `@dependencies` где отсутствует/неполный, зафиксировать конвенцию в `code-markup-standard` skill. Зацепка для skill-update: критерии "что включать в @dependencies" — runtime requirements (env vars, JSON files, sibling modules с side-effects) обязательно, чистые helpers — опционально.

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
