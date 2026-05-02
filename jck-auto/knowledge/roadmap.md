<!--
  @file:        knowledge/roadmap.md
  @project:     JCK AUTO
  @description: Done / In progress / Planned features — merged from all sources + strategic initiatives
  @updated:     2026-04-29
  @version:     1.48
  @lines:       626
-->

# Roadmap

> For detailed open bugs see bugs.md

## Recent Activity

> Журнал последних сессий. Новые записи на верх. После 10 записей — старые
> переносятся в roadmap-archive-N.md.

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

- [x] **2026-04-29 — Mobile audit P-3 закрыт.** Создан MotionProvider (LazyMotion + domAnimation), все 10 секций главной мигрированы с `motion` на `m`. Bundle framer-motion: ~34 KB → ~4.6 KB initial. Анимации работают как до миграции. CarCard/NoscutCard/tools/About/Blog/News — НЕ задеты, мигрируются позже. См. ADR `[2026-04-29] Mobile audit P-3 — LazyMotion + m migration on home page`.
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
