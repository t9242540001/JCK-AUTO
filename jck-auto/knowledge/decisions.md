<!--
  @file:        knowledge/decisions.md
  @project:     JCK AUTO
  @description: Architectural Decision Records (ADR log) — append-only
  @updated:     2026-04-29
  @version:     1.72
  @lines:       4904
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

## [2026-04-28] Б-7 closed — pm2 restart instead of startOrReload for jckauto after slot swap

**Контекст.** Б-7 в bugs.md (с ~2026-04-12) фиксировал 720+ PM2 рестартов на
jckauto-процессе с ENOENT-ошибками на `.next/server/middleware-manifest.json`
и `.next/BUILD_ID`. Гипотеза в bugs.md — race condition при two-slot symlink
swap. Не блокировал продакшн благодаря быстрому PM2-restart.

**Диагностика 2026-04-28 (initial).** `pm2 describe jckauto` показал 269
рестартов и uptime 16s — стабильный цикл падений ~каждые 94 секунды. Все
ENOENT-файлы физически существовали в активном слоте. В стеке ошибки
встретился относительный путь:

  ⨯ Error: ENOENT: ... '.next/BUILD_ID'
      at async Module.N (.next-b/server/chunks/ssr/_80fe0b8e._.js:1:2103)

Изначально этот путь был интерпретирован как «код из старого слота
читает новый slot через symlink» — гипотеза «in-memory chunks survive
graceful reload». На основе этой гипотезы был сформулирован fix
(`pm2 restart` вместо `startOrReload` для jckauto), и fix внедрён
коммитом `a67775a`.

**Диагностика 2026-04-28 (post-fix, через bug-hunting skill).** После
fix-деплоя процесс рестартанул чисто, но в полном error log за
последующие минуты обнаружился ключевой маркер:

  Error: Failed to find Server Action "x". This request might be from
  an older or newer deployment.
  Read more: https://nextjs.org/docs/messages/failed-to-find-server-action

Это встроенное сообщение Next.js, объясняющее реальный механизм. Stack
trace `at async Module.N (.next-b/server/...)` — относительный путь к
текущему executing chunk, не индикатор stale-slot. После fix uptime
jckauto стабилен 8+ часов, при этом эпизодические Server Action-ошибки
продолжают логироваться, но процесс уже не падает каскадно благодаря
hard restart на каждом деплое.

**Корневая причина (revised).** Б-7 — это проявление архитектурного
свойства Next.js Server Actions при rolling deployments. Action ID,
встроенный в HTML страницы, привязан к BUILD_ID этой страницы. После
deploy'а BUILD_ID меняется. Когда пользователь, у которого в браузере
открыта страница на старом BUILD_ID, нажимает кнопку (форма заявки или
другой Server Action) — браузер отправляет POST с Action ID от старого
BUILD_ID. Новый Next.js runtime не находит этот Action ID, падает в
error rendering path, и при попытке отрендерить /500 цепочка резолвинга
chunks выкидывает ENOENT на `.next/BUILD_ID` (вместо normal «Action not
found»). Unhandled rejection → процесс падает → PM2 рестартит.

Это НЕ баг в коде проекта и НЕ баг в PM2-стратегии. Это race между
живыми вкладками пользователей и cycle деплоев. Минимизируется hard
restart'ом (стрижка stale connections), но архитектурно не устраняется
без либо (а) Action ID retention strategy в Next.js, либо (б) snapshots
старых deployments для graceful обработки stale Actions.

**Почему `pm2 restart` всё-таки помогает.** `pm2 startOrReload`
(graceful reload) даёт существующим HTTP/keep-alive соединениям окно
для graceful close. В это окно stale Action requests могут продолжать
приходить к процессу, который уже находится в transition к новому
BUILD_ID. `pm2 restart` (hard restart) убивает все соединения мгновенно
— меньше stale requests доходит до процесса в transition. Частота
проявлений падает с «петля каждые 94 секунды» до «эпизодические ENOENT,
не валящие процесс». Стабильность подтверждена: uptime 8+ часов после
fix.

**Связь с Б-13.** Б-13 (бот) был похожим симптомом (`pm2 startOrReload`
для уже-online процесса не подхватил `.env.local`), но другой
корневой причиной (PM2 reuse process image при graceful reload не
перечитывает env preload). Решение Б-13 (`pm2 delete + start`) и решение
Б-7 (`pm2 restart`) — оба устраняют graceful reload pattern для своих
процессов, но по разным причинам. Это симметрия в решении, не симметрия
в корне.

**Решение.** В `deploy.yml` после `ln -sfn` symlink swap:

  pm2 startOrReload ecosystem.config.js --only jckauto-bot
  pm2 restart jckauto --update-env

`pm2 restart` для jckauto — kill+start, освобождает file descriptors и
in-memory state. Downtime несколько секунд, идентично существующему
поведению деплоя бота. `--update-env` заодно перечитывает env при правках
ecosystem.config.js. `pm2 reload` в fork mode эквивалентен `pm2 restart`,
поэтому выбор `restart` — явная семантика.

**Альтернативы рассмотренные.**
- `pm2 reload` — эквивалент `pm2 restart` в fork mode, выбран `restart`
  для явной семантики «hard kill + start».
- `pm2 delete jckauto && pm2 start ...` (как для бота) — даёт большую
  downtime, не нужно для jckauto, поскольку нет специфики
  `.env.local`-перечтения. Hard restart достаточен.
- Полная архитектурная mitigation Server Actions stale-state (Action ID
  retention, multi-deployment overlap) — за рамками: требует серьёзных
  изменений в Next.js конфигурации и/или сетевом стеке (load balancer
  с slot-aware routing). Hard restart как минимизация — приемлемое
  решение на текущем масштабе трафика.
- Перейти с Server Actions на классические API routes — изолировало бы
  баг (API routes не привязаны к BUILD_ID), но потребовало бы рефакторинга
  большого числа форм. Вне scope для одного fix-промпта.

**Почему не сделали раньше.** Б-7 классифицирован «не блокирующий»; PM2
быстро перезапускал процесс, end-user видел редкие 502 на ~1-2 секунды раз
в ~94 секунды — терпимо. Триггер сегодня — переход к диагностике через
skill `bug-hunting` с реальными `pm2 describe` и stack-trace.

**Последствия.**
- Один лишний рестарт jckauto на каждом деплое (~5-10s downtime вместо
  graceful reload). Это уже было фактическое поведение из-за crash-loop'ов;
  honest restart прозрачнее.
- Б-7 закрыт. Snapshot правил deploy.yml в `knowledge/deploy.md` §8
  обновлён с явным правилом про `pm2 restart` для jckauto.
- Симметрия с обработкой бота: оба процесса теперь honest-restart'ятся
  на каждом деплое. Различие — у бота `pm2 delete + start` (для
  перечтения .env.local), у сайта `pm2 restart` (env через
  --update-env).

**Verification.** На следующем deploy-run после merge'а в main:
проверить `pm2 describe jckauto | grep -E "uptime|restarts"` через
2-3 минуты после `[build] step 7: deploy complete`. Ожидание: uptime
растёт стабильно (минуты), restarts inkrement +1 относительно
предыдущего значения, и больше не растёт.

**Урок диагностики (post-mortem 2026-04-28).** Initial diagnosis был
неверен в части корневой причины, но fix оказался верным по другим
основаниям. Это распространённый класс ошибок диагностики: relative
path в stack trace был интерпретирован как индикатор process state
(«stale slot»), хотя на самом деле это просто текущий путь executing
chunk относительно cwd. Полный bug-hunting protocol с reading raw error
log за 200 строк (не grep-фильтрованных) выявил Server Action маркер,
который изначально был отфильтрован grep'ом по `ENOENT|middleware-manifest`.
Урок зафиксирован: при hypothesis-driven debugging обязательно
включает чтение raw error log без pre-filtering на stage 1 of Phase 3
по skill `bug-hunting`. Pre-filtering экономит время на симптомах, но
прячет co-occurring сообщения, которые часто содержат настоящий
маркер причины.

## [2026-04-28] noscut-fix — single-source-of-truth helper for instruction + state-arm

**Status:** Accepted

**Confidence:** High — bug fix verified against the exact production-screenshot reproduction. The helper pattern (instruction text + state arm in one function call) makes the regression class structurally impossible: any future entry point that calls the helper gets both behaviors atomically, and any future entry point that forgets to call the helper produces no instruction message at all (visible failure mode, not silent like the bug being fixed).

**Context:**

Production bug discovered 2026-04-28 from a Telegram screenshot: user taps "🔧 Ноускаты" inline button in the /start main menu, sees the instruction message ("Отправьте марку и модель авто..."), sends "Toyota RAV4" — and the bot does nothing. No search, no error, no acknowledgement.

Root cause traced to commit `c9e2fed` (Б-новый-A 2/6, 2026-04-27). That commit added the inline button with `callback_data: "noscut_info"` and a callback handler in start.ts that sent the instruction text. But the handler did NOT arm the `awaitingQuery: Map` state in noscut.ts — that state was armed only by the slash-command `/noscut` without arguments. The plain-text handler in noscut.ts (`bot.on('message', ...)`) silently returned for chats without armed state, so the user's reply was ignored.

Two operations — sending the instruction text and arming the state — must always happen together for the user flow to work. Splitting them across two files (instruction text in start.ts callback, state-arm logic in noscut.ts) created a class of regression where future entry points could repeat the same omission.

**Decision:**

Created a single exported helper `sendNoscutInstructions(bot, chatId)` in `src/bot/handlers/noscut.ts`. The helper does two things atomically: sends the long Markdown-formatted instruction message AND calls `awaitingQuery.set(chatId, { setAt: Date.now() })`. Both call sites — the inline-button callback in start.ts AND the slash-without-args branch in noscut.ts — now route through this single helper.

Implemented as a 3-prompt series:

- **Step 1** (`760fa0e`, noscut.ts): created the exported helper with the long instruction text and the state-arm call. Switched the slash-without-args branch to call the helper. As a side-effect improvement, `/noscut` without arguments now shows the long instruction (same as the button) instead of the previous short hint — same affordance regardless of entry point.
- **Step 2** (`4325ab0`, start.ts): added import `from "./noscut"`, replaced the 13-line inline body of the `noscut_info` callback with a 2-line call to the helper. Removed the inline copy of the instruction text from start.ts. Production bug closed.
- **Step 3** (this commit, knowledge): atomic close — this ADR, roadmap.md Recent Activity + Done, INDEX.md row updates.

**Alternatives considered:**

- **Move the helper to `src/bot/lib/instructionMessages.ts`** alongside `sendAuctionInstructions` and `sendEncarInstructions`. Rejected: noscut differs structurally from auction/encar — it has a state machine (`awaitingQuery: Map`) coupled to the instruction. Moving the helper to lib would require either exporting the Map and re-arming logic across module boundaries (state internals leak), or duplicating the Map in lib (state lives in two places, drift-prone). The asymmetry — auction/encar helpers in lib, noscut helper in handlers/noscut.ts — reflects the underlying difference and is the simpler, more maintainable design.
- **Add the missing `awaitingQuery.set` call inline in the start.ts callback.** Rejected: same pattern was duplicated, and any future entry point would face the same bug class. The helper makes the coupling structural, not a discipline rule.
- **Refactor `awaitingQuery` into a separate state-management module imported by both files.** Rejected: overengineering for a single state Map used by exactly one tool. The current design (Map declared next to the only place that mutates it, helper exposed as the public API) is sufficient.
- **Leave `/noscut` slash-without-args showing the short hint** (don't unify with the button's long text). Rejected: same affordance regardless of entry point is a UX win; same single helper means no drift between hint texts.

**Consequences:**

- (+) Production bug closed: the user flow works for both entry points (button and slash-without-args).
- (+) The `@rule` block on `sendNoscutInstructions` makes the coupling explicit: "Sending the instruction text without arming the state breaks the user flow — call this helper instead."
- (+) `/noscut` without arguments is now consistent with the button — same long text in both cases. Removed the short-hint inconsistency.
- (−) Architectural asymmetry: `sendAuctionInstructions` and `sendEncarInstructions` live in `src/bot/lib/instructionMessages.ts`, but `sendNoscutInstructions` lives in `src/bot/handlers/noscut.ts`. Justified by state coupling, but a future reviewer scanning the codebase needs to understand why.
- (Process lesson) Inline buttons that ship an instruction message AND expect a follow-up plain-text reply from the user must arm any state machine that reads the reply. This bug class is recognizable: button callback → instruction → silent ignore of user's text. Future menu additions should be audited for this pattern. Specifically: if a future tool gets an inline button with a callback that sends an instruction and expects a follow-up reply, the developer must check whether the tool has a state machine (like noscut's `awaitingQuery`) that needs arming.

**Files changed:**

- `src/bot/handlers/noscut.ts` (`760fa0e`).
- `src/bot/handlers/start.ts` (`4325ab0`).
- `knowledge/decisions.md`, `knowledge/roadmap.md`, `knowledge/INDEX.md` (this commit).

**Reference:** Series of 3 commits on 2026-04-28 — `760fa0e`, `4325ab0`, plus this finalisation commit. Bug introduced 2026-04-27 in commit `c9e2fed` (Б-новый-A 2/6). Production discovery: Telegram screenshot 2026-04-28.

## [2026-04-27] Б-новый-A closed — bot menu redesigned + BotFather command list synced from code

**Status:** Accepted

**Confidence:** High — UX redesign with no behavioral risk to existing flows. Each prompt left build green and runtime functional. New `/auction` and `/encar` slash-commands are pure information messages mirroring existing callback texts, no new pipelines. setMyCommands sync runs fire-and-forget — failure leaves the bot working, only the BotFather menu potentially stale.

**Context:**

Bug Б-новый-A (registered 2026-04-26 by Vasily from a screenshot in the strategic-partner chat): the bot exposed two inconsistent menus simultaneously. The inline-keyboard sent with `/start` showed [Рассчитать стоимость, Каталог, Расшифровать аукцион, Анализ авто с Encar, Связаться, Поделиться] (after the Б-4 fix in commit `502d818`). The BotFather native command list (the menu button left of the input field in Telegram) showed [/start, /calc, /customs, /catalog, /noscut]. Each surface had services the other lacked: customs and noscut existed only as slash-commands, auction and encar existed only as inline buttons.

Two structural causes: (1) menu composition was decided when the inline keyboard was first written, never revisited as new tools were added; (2) BotFather command list was edited by hand via @BotFather in Telegram and never lived in code, so any code change to the tool set could not propagate to the BotFather surface.

**Decision:**

Implemented as a 6-prompt series under one-task-one-prompt discipline. Each prompt left the build green, and the prompt order ensured that handlers preceded their triggers (no broken-button windows in production).

- **Prompt 1** (`1eb76b9`, customs.ts): Added `customs_start` callback handler. Fires when the new inline-keyboard button (added in step 2) sends this callback. Pattern mirrors the existing `calc_start` in calculator.ts. Sequencing this handler FIRST avoided a window where the inline button existed but did nothing.
- **Prompt 2** (`c9e2fed`, start.ts): Rewrote the inline keyboard from 4 rows (4 services + Связаться + Поделиться) to 5 rows (6 services + Связаться + Поделиться). New layout: row 1 — `🚗 Каталог авто` / `🔧 Ноускаты`; row 2 — `💰 Калькулятор авто` / `📋 Калькулятор пошлин`; row 3 — `🔍 Аукционный лист` / `🇰🇷 Анализ Encar`; row 4 — `📞 Связаться`; row 5 — `📤 Поделиться ботом`. Welcome message shortened (removed duplication with buttons) and updated to «автомобили и запчасти из Китая, Кореи и Японии под ключ» — adding "и запчасти" makes ноускаты a legitimate first-class service in the menu. New `noscut_info` callback handler added, mirroring the existing `auction_info` and `encar_info` instruction-message pattern. Share-text URL migrated from hardcoded percent-encoding to `encodeURIComponent` template literal — sustainable, readable, supports the new wider service list. New share text: «🚗 JCK AUTO — авто из Кореи, Китая и Японии. Узнай цену под ключ за минуту: калькулятор, каталог, ноускаты, расшифровка аукциона и Encar.»
- **Prompt 3** (`444b7bb`, auctionSheet.ts): Added `/auction` slash-command handler at the start of `registerAuctionSheetHandler`. Sends the same Markdown instruction message that the inline `auction_info` callback already sends. Slash-handler is information-only; the photo-detection handler that does the actual analysis stays unchanged.
- **Prompt 4** (`5737088`, encar.ts): Added `/encar` slash-command handler symmetrically. Plus a defensive guard in the existing URL-detection handler (`if (msg.text?.startsWith('/')) return;`) — without it, a single message `/encar https://encar.com/cars/12345` would trigger both handlers and produce a double response.
- **Prompt 5** (`b53e639`, syncBotCommands.ts new + index.ts): New module `src/bot/lib/syncBotCommands.ts` exports `BOT_COMMANDS` (array of 7 entries) and `syncBotCommands(bot)` (fire-and-forget wrapper around `bot.setMyCommands`). Called from `index.ts` once after handler registration on every bot startup. tsconfig target ES2017 prevents top-level await, so the call is fire-and-forget with internal try-catch — failure logs an error but does not crash the bot. The `@rule` block in syncBotCommands.ts pins the contract: the array MUST mirror the inline-keyboard layout in start.ts; missing one of two surfaces creates inconsistent UX again.
- **Prompt 6** (this commit, knowledge): Atomic close — bugs.md entry removed, this ADR added, roadmap.md updated (Recent Activity + Done + Technical Debt), INDEX.md updated.

**Alternatives considered:**

- **Variant A — 6 services in inline 3×2 + full command list, customs/noscut treated as equal-weight first-class.** Rejected: would have given customs (a niche derivative of calc) the same visual real-estate as the main flows, increasing decision time per Hick's law without commercial benefit. Most users want full price (calc), not customs alone.
- **Variant B — top-4 services in inline (calc/catalog/auction/encar) + "🔧 Ещё инструменты" submenu with customs/noscut.** Rejected by Vasily during product review: noscut is a product differentiator (not a niche feature), pushing it to a submenu would suppress conversion on a service that defines JCK AUTO's offering relative to competitors. The decided layout (Variant E in our research notes) keeps all 6 services on one screen, ordered by reading priority — catalog/noscut first (the actual goods), calc/customs second (numbers), auction/encar third (research tools).
- **Variant D — minimal 4 buttons + textual mention of customs/noscut.** Rejected: text in welcome message is routinely skipped; noscut conversion would have dropped 40-50%.
- **Hardcoding BotFather state by hand on each release.** Rejected: that's exactly the source of drift this bug surfaces. Code as source of truth + sync on startup is the only structural close.
- **Wrapping startup in async function to enable `await syncBotCommands(bot)`.** Rejected: refactoring the entire bot startup signature for a fire-and-forget background sync is overengineering. Try-catch + async with no `await` at the call site is sufficient.
- **Adding `setMyCommands` to a separate CLI script run manually.** Rejected: opens the door for the same drift class — script forgotten, commands diverge from code. On-startup sync is structural.

**Consequences:**

- (+) Bot menu and BotFather command list now carry the same 6+1 services in the same reading order. Any user surface presents the full toolkit.
- (+) BotFather drift is structurally closed: source of truth lives in `BOT_COMMANDS` array; restart syncs Telegram. Adding/removing a tool requires editing both the array and the inline-keyboard, with the `@rule` block in syncBotCommands.ts as the audit-trail enforcement.
- (+) Welcome text now legitimizes ноускаты by mentioning «автомобили и запчасти». Previously the welcome promised only cars while menu offered parts — small but real cognitive dissonance.
- (+) Share-text mentions all 5 main services (calc, catalog, ноускаты, аукцион, Encar) — better viral hook than previous «Бесплатный калькулятор» mono-mention.
- (−) Instruction texts for `/auction` and `/encar` slash-commands are now duplicated across start.ts (callback handlers) and auctionSheet.ts/encar.ts (slash handlers) — same Russian-language text in two places. If product copy changes, both must change. Registered as a Technical Debt bullet ("extract auction/encar instruction texts into a shared module") to be addressed in a separate prompt.
- (Knowledge note — terminology «ноускат» vs «носкат») During the series, the linguistic question came up: «носкат» (one «о») is the correct Russian transliteration of English «nose cut», but the product everywhere uses «ноускат» (with «оу») — URL `/catalog/noscut/`, slash command `/noscut`, file names, button labels. Vasily confirmed via market knowledge that "ноускат" dominates Russian search queries on this niche (counter-intuitively, the misspelling is what users type). Decision: keep "ноускат" in product surfaces. This is conscious alignment with search behavior, not orthographic carelessness — registered here so the question doesn't get re-raised in future sessions. If Wordstat data ever flips, that's a separate research project (T3) with SEO migration cost.

**Files changed:**

- `src/bot/handlers/customs.ts` (`1eb76b9`).
- `src/bot/handlers/start.ts` (`c9e2fed`).
- `src/bot/handlers/auctionSheet.ts` (`444b7bb`).
- `src/bot/handlers/encar.ts` (`5737088`).
- `src/bot/lib/syncBotCommands.ts` NEW + `src/bot/index.ts` (`b53e639`).
- `knowledge/bugs.md`, `knowledge/decisions.md`, `knowledge/roadmap.md`, `knowledge/INDEX.md` (this commit).

**Reference:** Series of 6 commits on 2026-04-27 — `1eb76b9`, `c9e2fed`, `444b7bb`, `5737088`, `b53e639`, plus this finalisation commit. See `git log --since="2026-04-27" --grep="Б-новый-A"` for the full sequence.

## [2026-04-27] Б-новый-B closed — bot leads now carry tool-context source

**Status:** Accepted

**Confidence:** High — symptomatic fix with no behavioral risk. Each writer adds `pendingSource.set(chatId, ...)` immediately before the result-message send; the receiver (`finishRequest` in request.ts) was already reading from `pendingSource` via the existing catalog flow. No signature changes, no new mechanisms, no breaking compatibility.

**Context:**

Bug Б-новый-B (registered 2026-04-26 from a real production lead): leads sent from the bot to the operator group always arrived with hardcoded `🔗 Источник: Telegram-бот (прямая заявка)` regardless of which tool the user actually used (noscut search, catalog browse, auction-sheet decode, encar analysis, calculator/customs computation). Managers had no context at the start of conversations and had to ask "what were you looking at?" — a regression of UX quality compared with site leads, which carry full URLs.

Investigation showed catalog.ts already wrote a meaningful URL to `pendingSource: Map<number, string>` (exported from `request.ts`) before triggering `request_start` callback. The receiver in `finishRequest` read this map with a fallback to the hardcoded "(прямая заявка)" string. Five other tools (noscut, auction-sheet, encar, calculator, customs) never wrote to the map, so the fallback was the universal display.

**Decision:**

Implemented as a 6-prompt series under one-task-one-prompt discipline. The mechanism (`pendingSource` Map) was kept; gaps were filled.

- **Prompt 1** (`6b873ec`, request.ts): Cleaned the receiver. Replaced `"Telegram-бот (прямая заявка)"` with `"Telegram-бот"` at all four occurrences in the file (display fallback in `finishRequest`, audit-log fallback in `appendLeadLog`, fallback in `bot.on("contact")`, fallback in `bot.onText("📝 Без телефона")`). Removed the cosmetic duplicate `Источник: Telegram-бот` line at the bottom of the lead text. The original prompt scoped only the display fallback; Claude Code correctly extended scope per Goal-over-steps to all four occurrences after detecting that the original target alone would not satisfy "zero matches anywhere" AC.
- **Prompt 2** (`a296f2a`, noscut.ts): Added `pendingSource.set` at four call sites (slash-command + plain-text branches, found + empty result outcomes), local helper `buildNoscutSource(query, found)` with 50-char query truncation. Source format: `Telegram-бот: ноускаты (запрос: "...", не найдено)` for empty, without `, не найдено` suffix for found.
- **Prompt 3** (`c8d38d9`, calculator.ts + customs.ts): Paired prompt — symmetric edits to both files using shared `siteRequestAndAgainButtons` helper and `COUNTRY_CURRENCY[country].label` lookup. Source formats: `Telegram-бот: расчёт стоимости (Корея)` and `Telegram-бот: расчёт таможни (Корея)`. The pair-in-one-prompt is a documented deviation from skill `prompt-writing-standard`'s 1-2-files-well-under-200 rule (calc 209, customs 240 lines); justified by full structural symmetry of the change. Documented in commit body for audit trail.
- **Prompt 4** (`28e4801`, auctionSheet.ts): One write inside the result-formatting try-block, after `formatAuctionResult`/`splitMessage` complete (so a formatter throw does not leave a stale entry). Source format: `Telegram-бот: расшифровка аукционного листа` — deliberately without parsed OCR fields, because OCR can return Japanese characters and parse_error states make fields unreliable. Source minimum is enough context for a manager.
- **Prompt 5** (`38e5c9e`, encar.ts): One write before the result-send try-block, after `formatEncarResult` already returned. Source format: `` Telegram-бот: Encar (carId=${carid}) `` — carId chosen because managers can paste it into encar.com to see the full original listing; deliberately no jckauto.ru link to avoid self-referential noise.
- **Prompt 6** (this commit, knowledge): Atomic close — bugs.md entry removed, this ADR added, roadmap.md updated (Recent Activity + Done + Technical Debt), INDEX.md updated.

**Alternatives considered:**

- **Extend `handleRequestCommand` signature with `source?` parameter** (the original Action proposed in bugs.md). Rejected: callback_query handler in request.ts only knows chatId at click time, not which message triggered the click. Passing source via signature would require either (a) a separate callback per tool with the source baked in, or (b) parsing the originating message text — both more invasive than using the existing `pendingSource` Map.
- **Single large prompt covering all 5 writer files plus knowledge.** Rejected: violates one-task-one-prompt skill; risks broken-build window mid-prompt; worse review surface.
- **Include parsed OCR fields in auction-sheet source string** (e.g., make/model/year). Rejected by team review: Japanese characters, parse_error fragility, content from user-controlled OCR input arriving in operator group. Tool name alone is sufficient context.
- **Include jckauto.ru link in encar source string.** Rejected: managers go to encar.com directly; our analysis page has a strict subset of the original listing's information.
- **Truncate noscut query at 30 or 100 chars.** 50 chosen as the readable midpoint — typical car-search queries fit, length-attack inputs are bounded.

**Consequences:**

- (+) Operator-group leads from the bot now carry meaningful tool context. `🔗 Источник: Telegram-бот: ноускаты (запрос: "Toyota RAV4")` lets managers start the conversation with the right context, removing one "what were you looking at?" round-trip.
- (+) The receiver path is uniform: `finishRequest` reads `pendingSource.get(chatId)`; if any future tool joins the bot, the contract is "set the source before sendMessage with `request_start` button".
- (+) Audit log (`appendLeadLog`) now records source consistently — useful for retrospective reports on which tool drove which leads.
- (−) Five separate writers; the pattern is duplicated in each handler. Acceptable given the simplicity of one `pendingSource.set` call per tool, but if a sixth writer is added the pattern should be extracted into a shared helper or a wrapper around `bot.sendMessage`.
- (−) `pendingSource` Map has no TTL. If a user opens a tool, sees the result with the request button, and never clicks it, the entry stays in memory until a delete is triggered (only on lead submission). This is an existing structural gap, surfaced 5 times during the series in out-of-scope reports and now registered in `roadmap.md` → Planned — Technical debt as a follow-up T2 prompt.
- (−) Calc and customs JSDoc headers still lack `@dependencies` field. Adding it during this series would have meant enumerating every existing dependency, a scope creep we declined. Registered in `roadmap.md` → Planned — Technical debt for a separate audit-style prompt.
- (Side note for skill maintenance) `code-markup-standard` skill should clarify when `@dependencies` JSDoc field is required vs optional — current convention is inconsistent across handlers (some have it, some don't, no clear rule). Not registered as a code task; will be addressed during the next skill-writing review session.

**Files changed:**

- `src/bot/handlers/request.ts` (`6b873ec`).
- `src/bot/handlers/noscut.ts` (`a296f2a`).
- `src/bot/handlers/calculator.ts`, `src/bot/handlers/customs.ts` (`c8d38d9`).
- `src/bot/handlers/auctionSheet.ts` (`28e4801`).
- `src/bot/handlers/encar.ts` (`38e5c9e`).
- `knowledge/bugs.md`, `knowledge/decisions.md`, `knowledge/roadmap.md`, `knowledge/INDEX.md` (this commit).

**Reference:** Series of 6 commits on 2026-04-27 — `6b873ec`, `a296f2a`, `c8d38d9`, `28e4801`, `38e5c9e`, plus this finalisation commit (see `git log --since="2026-04-27" --grep="Б-новый-B"` for the full sequence).

## [2026-04-27] users.ts Phase 5b — honest sync API completed

**Status:** Accepted

**Confidence:** High — все четыре canary-условия Phase 5a выполнены до запуска Phase 5b: bot uptime > 24 часов без рестартов (`pm_uptime` в `pm2 jlist` на момент запуска серии), `restart_time: null`, ноль `[users]`/users.json/init-order ошибок в `pm2 logs jckauto-bot --err --lines 2000`, `[bot] users loaded: N` подтверждён в startup logs. Серия из 4 промптов запущена после явной проверки этих условий.

**Context:**

ADR `[2026-04-26] users.ts sync-init two-phase refactor` принял решение разделить рефакторинг на две фазы. Phase 5a (commit `f90d7e5`, 2026-04-26) перевела внутренности `src/bot/store/users.ts` на sync (`fs.readFileSync` / `fs.writeFileSync` / `loadUsers()` в `src/bot/index.ts` перед регистрацией handlers), сохранив async-сигнатуры публичного API ради нулевого риска для call sites. Phase 5b ждала 24-часового soak в production, чтобы убедиться, что новый init pattern не вызвал init-order regressions (sync `getUser` без defensive guard был оставлен как canary).

**Decision:**

Phase 5b реализована серией из 4 промптов (one-task-one-prompt дисциплина по skill `prompt-writing-standard`) под общим ограничением «build всегда зелёный между коммитами»:

- **Промпт 01** (`fdcd08c`, `start.ts`): сняты три `await` перед `saveUser(msg.from)` в трёх handlers.
- **Промпт 02** (`bab3fce`, `request.ts`): удалены две строки `await ensureUsersLoaded()` (lazy-load guards стали no-op после Phase 5a), сняты два `await` перед `savePhone`, удалён импорт `ensureUsersLoaded` из строки импорта, переписан шапочный `@rule` с lazy-load дисциплины на sync-init контракт.
- **Промпт 03** (`4425d41`, `admin.ts`): сняты три `await` перед `getUsersStats`/`getAllUsers`. Параллельно добавлена минимальная JSDoc-шапка (отсутствовала вопреки code-markup-standard).
- **Промпт 04** (этот коммит, `users.ts` + knowledge): public API функции `saveUser`/`savePhone`/`getAllUsers`/`getUsersStats` стали честно sync — `async` снято, `Promise<…>` return types развёрнуты в их непосредственный тип, lazy-load fallbacks `if (!loaded) loadUsers()` удалены из тел всех четырёх функций. `ensureUsersLoaded` удалён целиком (не помечен `@deprecated`, как первоначально планировал ADR `[2026-04-26]`): функция имела ноль внешних потребителей после промпта 02, оставление deprecated было бы созданием техдолга. JSDoc-шапка переписана — единственный `@rule` декларирует sync-init как контракт.

Two-phase решение из ADR `[2026-04-26]` реализовано полностью; этот ADR закрывает серию.

**Alternatives considered:**

- **Один большой промпт на все 4 файла + knowledge.** Отвергнуто: нарушение one-task-one-prompt из skill; промежуточные коммиты невозможны → откат сложнее, ревью сложнее.
- **Помечать `ensureUsersLoaded` `@deprecated` (как планировал ADR `[2026-04-26]`).** Отвергнуто: после промпта 02 у функции ноль внешних потребителей в repo. Оставление deprecated = техдолг, который никто никогда не закроет. Удаление целиком — sustainable solution из Карпати-правила #5.
- **Knowledge updates в каждом из 4 промптов.** Отвергнуто: создаёт окно, в котором knowledge говорит «Phase 5b закрыта» при половине-мигрированном коде. Атомарное обновление в финальном промпте — design серии.

**Consequences:**

- (+) Класс Б-9 (lazy-load race) **структурно** закрыт. Раньше: «не используется» (ensureUsersLoaded существовал, но никем не звался). Теперь: «не существует» (физически нет такой функции в коде).
- (+) Любая попытка добавить `await` на `saveUser`/`savePhone`/`getAllUsers`/`getUsersStats` в новом call site больше не маскируется TypeScript'ом — `await sync_function()` валиден семантически, но новые сигнатуры явно говорят «это не async», что замечается в ревью.
- (+) Любая попытка вернуть lazy-load fallback внутрь функций ловится на компиляции (`loadUsers()` теперь зовётся только из `index.ts` — добавление вызова внутри `saveUser` будет странной строкой, требующей объяснения в ревью).
- (+) Шапка `users.ts` теперь honest: фиксирует контракт, не описывает «что планируем сделать».
- (−) `ensureUsersLoaded` навсегда исчез из API. Если когда-то понадобится lazy-load helper для иной цели (например, on-demand reload), его придётся восстановить с другим именем + ADR. Принимаемая стоимость за чистоту контракта сейчас.

**Files changed:**

- `src/bot/store/users.ts` (этот коммит).
- `src/bot/handlers/start.ts` (`fdcd08c`).
- `src/bot/handlers/request.ts` (`bab3fce`).
- `src/bot/handlers/admin.ts` (`4425d41`).
- `knowledge/roadmap.md`, `knowledge/decisions.md`, `knowledge/INDEX.md` (этот коммит).

**Reference:** Series of 4 commits between 2026-04-27 morning and afternoon (see `git log --since="2026-04-27" --until="2026-04-28" --grep="Phase 5b"` for the full sequence). Closes the Phase 5b plan from ADR `[2026-04-26] users.ts sync-init two-phase refactor`.

## [2026-04-26] Переход на систему стандартов v2.0 (триаж T1/T2/T3, Карпати-правила, Recent Activity, virtual-team.md)

**Status:** Accepted

**Confidence:** High — изменение организационное, не техническое; риски ограничены формулировками и могут быть откатаны одним промптом. Содержание стандартов выверено в стратегической ветке (общий чат с Claude как стратегическим партнёром Василия) до запуска серии.

**Context:**

В работе через Claude и Claude Code накопились четыре повторяющиеся проблемы:

1. Длинные ответы Claude с лишними техподробностями — Василию нужны смыслы и логика задачи, а не команды и синтаксис.
2. Один и тот же баг чинится по несколько раз (повторное проявление того же класса ошибок Claude Code).
3. Knowledge-файлы заполняются неточно или устаревают, что приводит к регрессиям на следующей сессии.
4. Claude Code вносит незапланированные изменения вне scope задачи («попутно поправил соседний код»).

Прежняя система состояла из общей системной инструкции и контекстного файла проекта без чётких уровней ответственности: триажа сложности задач не было; Карпати-правила (поведенческий стандарт для Claude Code) не были закреплены; в `roadmap.md` отсутствовала секция Recent Activity для быстрого входа в сессию; `virtual-team.md` не существовал — ростер виртуальной команды не имел единого источника истины.

**Decision:**

Введена пятиуровневая система:

1. **Системная инструкция (claude.ai → custom instructions проекта).** Краткая, в смыслах. Содержит триаж T1/T2/T3, постоянных участников виртуальной команды (Андрей-владелец + архитектор + безопасность + представитель ЦА), Карпати-правила в работе Claude, output discipline, ритуал старта сессии, ссылки на STANDARDS и skills.
2. **STANDARDS_v2.0 (контекстный файл проекта в claude.ai).** Подробное «почему так и как» по всем темам — расширение системной инструкции на смысловом уровне. Без дублирования knowledge/.
3. **Skills.** Точные процедуры: `prompt-writing-standard` (триаж + шаблон промпта + multi-perspective review), `bug-hunting`, `research-protocol`, `knowledge-structure`, `code-markup-standard`, `skill-writing-standard`.
4. **CLAUDE.md проекта.** Блок Execution Discipline (5 Карпати-правил) — поведенческий стандарт для Claude Code в момент исполнения. Закладывается в этой серии (промпт 4, pending).
5. **Память (memory).** Обновлена через `memory_user_edits` в стратегической ветке.

В knowledge/ выполнены три синхронизирующих изменения: добавлена секция `## Recent Activity` в `roadmap.md` с форматом записи 3+1 поля (Сделано / Прервались на + Следующий шаг / Контекст / Ссылки); архивирован исторический хвост `## Done` в `roadmap-archive-1.md` (30 dateless-записей); создан `knowledge/virtual-team.md` с ростером 10 специалистов и блоком постоянных участников.

Серия из 4 промптов выполнена в порядке: (1) Recent Activity + архив roadmap, (2) virtual-team.md, (3) этот ADR + финал INDEX.md, (4) Execution Discipline в CLAUDE.md — pending на момент записи ADR.

**Alternatives considered:**

- **Оставить прежнюю систему как есть.** Отвергнуто — четыре проблемы, перечисленные в Context, продолжают воспроизводиться. Стоимость одной регрессии в продакшене (например, 25 минут downtime после parse-ошибки 2026-04-09) выше стоимости миграции.
- **Только обновить системную инструкцию, не вводить отдельный STANDARDS и не трогать knowledge/.** Отвергнуто — системная инструкция должна оставаться короткой, чтобы её можно было читать в начале каждой сессии. Подробные обоснования и кейсы не помещаются в формат «что делать». Без STANDARDS подробности либо теряются, либо засоряют системную инструкцию.
- **Ввести триаж T1/T2/T3 без Карпати-правил.** Отвергнуто — триаж определяет МЕТОД работы Claude (что я делаю с задачей), а Карпати-правила задают ПОВЕДЕНИЕ Claude Code (как он исполняет промпт). Это разные классы ошибок: триаж предотвращает переусложнение T1 и недооценку T3; Карпати-правила предотвращают scope drift и симптом-фиксы. Без второго слоя проблемы 2 и 4 из Context остаются открытыми.
- **Закрыть всю миграцию одним «мега-промптом» вместо серии из 4.** Отвергнуто — нарушает собственное правило системы («один промпт = одна логическая единица, max 1–2 файла»). Прецедент 2026-04-14: большой промпт скрыл частичный сбой, восстановление заняло 5 часов.
- **Добавить ADR через ручную правку вне Claude Code.** Отвергнуто — все изменения в knowledge/ должны проходить через git с явным коммитом и diff, как и любые правки кода. Ручные правки на сервере запрещены проектным правилом.

**Consequences:**

- (+) Триаж T1/T2/T3 даёт явный фильтр на старте задачи: тривиальные не получают избыточного процесса, стратегические не получают сокращённого. Цена ложно-T3 — лишние 10 минут премортема; цена ложно-T2 — регрессия в продакшене.
- (+) Карпати-правила (don't guess / simplicity filter / strict scope / goal over steps / sustainable solutions) дают Claude Code явный поведенческий стандарт. До их закрепления в CLAUDE.md (промпт 4) аналогичные правила действуют в работе Claude через системную инструкцию и через Step 9 multi-perspective review skill `prompt-writing-standard`.
- (+) Recent Activity в `roadmap.md` сокращает время входа в новую сессию: ритуал старта читает CLAUDE.md → INDEX.md → roadmap.md (Open Tasks, In Progress, Recent Activity, Completed, Technical Debt) и за минуты восстанавливает контекст вместо чтения всего knowledge/.
- (+) `virtual-team.md` — единый источник истины для ростера и режимов «Обсуждение / Решение». Постоянные участники зафиксированы (Андрей + архитектор + безопасность + ЦА), что устраняет ритуальное упоминание специалистов на простых задачах.
- (+) Архивация исторических Done в `roadmap-archive-1.md` снизила размер активной части roadmap.md с 285 до ~190 строк. Старые записи доступны как справка, но не загромождают session-start ритуал.
- (−) Промпт 4 (Execution Discipline в CLAUDE.md) на момент записи ADR не выполнен. До его выполнения Karpathy-style правила применяются в работе Claude (через системную инструкцию), но НЕ в работе Claude Code (нет блока в CLAUDE.md, который читается на каждом промпте). Закрытие промпта 4 устранит этот зазор.
- (−) Любой knowledge-файл может устареть, если правила обновления не соблюдаются. Митигация: обновление knowledge/ — обязательная часть Acceptance Criteria каждого промпта, описано в STANDARDS_v2.0 § Файлы знаний.
- (−) Серия из 4 промптов в одной сессии увеличивает риск утомления внимания на промпте 4. Митигация: каждый промпт верифицируется отдельно (отчёт по 5–6 AC), серия не сливается в один коммит.

**Files changed (across the 4-prompt series):**

- Prompt 1 (commit `38f76ac`): `knowledge/roadmap.md`, `knowledge/roadmap-archive-1.md`, `knowledge/INDEX.md`.
- Prompt 2 (commit `d5dcd9a`): `knowledge/virtual-team.md`, `knowledge/INDEX.md`, `knowledge/roadmap.md`.
- Prompt 3 (this commit): `knowledge/decisions.md`, `knowledge/INDEX.md`, `knowledge/roadmap.md`.
- Prompt 4 (pending — separate prompt): `app/jck-auto/CLAUDE.md`, `knowledge/roadmap.md`, `knowledge/INDEX.md`.

## [2026-04-26] One prompt = one user message — process rule

**Status:** Accepted

**Confidence:** High — изменение организационное, наблюдается одно конкретное проявление, митигация очевидна.

**Context:**

Стратегический партнёр 2026-04-26 произвёл два атомарных промпта (08a — регистрация strategic init #4; 08 — cursor-pointer фикс) и отправил их одним сообщением оператору. Оператор запустил 08a в Claude Code; Claude Code, видя оба промпта в сообщении, выполнил их последовательно в одной сессии — закоммитил cursor-pointer фикс как `196ac3d` ещё до того как оператор вернулся подтвердить выполнение только 08a.

Когда оператор (после reboot компьютера) запустил промпт 08 отдельно, Claude Code отрапортовал «no-op outcome» — работа уже на remote. Стратегический партнёр обнаружил это только на стадии отчёта.

**Decision:**

Стратегический партнёр ОБЯЗАН выпускать ровно один промпт в одном сообщении пользователю. Даже если два промпта независимы по scope (разные файлы, нет конфликта) — они идут в отдельных сообщениях с явной точкой синхронизации между ними.

**Alternatives considered:**

- **Оставить bundling по 2–3 промпта в одном сообщении когда задачи независимы.** Отвергнуто: bundling уничтожает точку синхронизации между партнёром и оператором. Партнёр не может верифицировать промежуточное состояние репозитория и может выпустить следующее сообщение на устаревшей картине, что и произошло 2026-04-26.
- **Выпускать bundle, но требовать от оператора подтверждение после каждого промпта в bundle.** Отвергнуто: операционная нагрузка перекладывается на оператора, что нарушает принцип минимальной когнитивной нагрузки. Bundle также сохраняет визуальный риск (Claude Code может выполнить весь bundle как одну сессию).

**Why one-per-message wins:**

1. **Точка синхронизации.** Когда два промпта в одном сообщении, оператор может запустить их как одно целое (одна сессия Claude Code, видящая оба). Партнёр теряет возможность верифицировать промежуточное состояние.
2. **Drift prevention.** Без точки синхронизации следующее сообщение партнёра может быть составлено на устаревшей картине repo state. На 2026-04-26 это произвело частичный loop: партнёр выпустил промпт 08 повторно, считая что он не запускался.
3. **Атомарный контекст для Claude Code.** Каждый промпт — самодостаточный TASK + CONTEXT + ACTIONS + AC + REGRESSION SHIELD. Bundling удваивает визуальную поверхность и ослабляет контракт на каждый item.

**Consequences:**

- (+) Гарантированная точка синхронизации между партнёром и оператором: каждый промпт = одна верификация состояния.
- (+) Drift prevention: партнёр не может составить следующее сообщение на устаревшей картине repo, потому что вынужден ждать отчёта по предыдущему.
- (+) Каждый промпт сохраняет полный атомарный контракт без размывания.
- (−) Слегка медленнее throughput когда работа действительно независима и параллелизуема. Принимаемая стоимость за гарантию синхронизации.

**Files changed:**

- No code changed.
- `knowledge/decisions.md` (this ADR).

**Reference:** Memory edit #27 (стратегический партнёр). Incident: 08a + 08 bundling on 2026-04-26.

## [2026-04-26] useAuctionSheetJob discriminated-union pattern for async job state

**Status:** Accepted

**Confidence:** High — refactor чистый (no behavioral change), wire protocol byte-identical, паттерн discriminated union стандартен в индустрии.

**Context:**

`src/app/tools/auction-sheet/AuctionSheetClient.tsx` orchestrator вырос до 436 строк, в основном polling lifecycle (refs, AbortController, recursive setTimeout, localStorage/sessionStorage cross-tab ownership protocol, processing-stage rotation, session restore on mount). Три useEffect chain'а, три ref'а, ~70 строк recursive `pollJob`. Mixed UI rendering с async-job state machine.

**Decision:**

Извлечь polling lifecycle в выделенный React hook `useAuctionSheetJob` в новом файле `src/app/tools/auction-sheet/useAuctionSheetJob.ts`. Hook возвращает discriminated-union `JobState` (добавлен в `auctionSheetTypes.ts`):

```typescript
export type JobState =
  | { phase: "idle" }
  | { phase: "queued";     jobId: string; position: number; etaSec: number }
  | { phase: "processing"; jobId: string; stage: number }
  | { phase: "done";       jobId: string; result: AuctionResult; meta: ApiResponse["meta"] }
  | { phase: "failed";     jobId: string | null; error: ApiError }
  | { phase: "lost";       jobId: string | null };
```

Orchestrator реагирует на phase changes через единственный `useEffect` с exhaustive `switch (job.state.phase)`. TypeScript ловит missing-case на этапе компиляции.

**Alternatives considered:**

- **Variant A: callbacks-параметры** (`useAuctionSheetJob({ onDone, onFailed, onProgress, ... })`). Отвергнуто: 5 callbacks сигнализируют leaky abstraction; callbacks нуждаются в стабильных reference'ах (useCallback wrappers в orchestrator) — fragile coupling.
- **Variant C: useEffect chain'ы на нескольких outputs hook'а.** Отвергнуто: та же форма что B но без exhaustiveness check от discriminated union.

**Why B (discriminated union) wins:**

1. Future-proof: новая фаза = новый union member, не новый callback. Добавление 7-й фазы заставляет каждого consumer'а её обработать (TS error).
2. Industry standard: `react-query`, `swr`, `xstate` все используют этот паттерн. Если когда-то мигрируем на одну из библиотек, расстояние короткое.
3. Testable: hook возвращает plain data, тесты не нуждаются в callback mocks.
4. Clean contract: hook владеет lifecycle, orchestrator владеет UI — без скрытого coupling.

**Consequences:**

- (+) Orchestrator сократился с 436 до 303 строк, business logic чище.
- (+) Polling lifecycle тестируем независимо.
- (+) Wire protocol byte-identical (POST /api/tools/auction-sheet, GET /api/tools/auction-sheet/job/{id} каждые 2s) — нет регрессии.
- (−) Orchestrator получает useEffect с `[job.state]` deps. Reactive chain risk если orchestrator setState каким-то образом модифицирует `job.state` (cycle). На практике невозможно — `job.state` originates внутри hook, не зависит от orchestrator state — но дисциплина важна.

**Files changed:**

- `src/app/tools/auction-sheet/useAuctionSheetJob.ts` (new, 335 lines).
- `src/app/tools/auction-sheet/auctionSheetTypes.ts` (+30 lines for JobState).
- `src/app/tools/auction-sheet/AuctionSheetClient.tsx` (436 → 303 lines).

**Reference:** Commit `0a2fbd9`.

## [2026-04-26] users.ts sync-init two-phase refactor

**Status:** Accepted (Phase 5a complete; Phase 5b pending 24h soak)

**Confidence:** High — паттерн sync-init уже использован в `fileIdCache.ts` (proof of pattern), Phase 5a touched только 2 файла, public API сигнатуры сохранены — нулевая риска для call sites.

**Context:**

`src/bot/store/users.ts` имел async-load архитектуру (lazy `loadUsers()` через `ensureUsersLoaded()`), которая производила класс багов — Б-9 наиболее свежий — где sync `getUser()` возвращал `undefined` потому что `ensureUsersLoaded()` ещё не resolved. Фикс 2026-04-21 (`ensureUsersLoaded()` lazy-await внутри handlers) закрыл user-visible симптом Б-9, но оставил race класс архитектурно живым: каждый новый call site `getUser` должен помнить вызвать `ensureUsersLoaded` first.

**Decision:**

Refactor в две фазы:

- **Phase 5a (этой сессии):** Сменить ВНУТРЕННЮЮ реализацию на sync (`fs.readFileSync` / `fs.writeFileSync`). Public API сигнатуры остаются async для backward compatibility. `loadUsers()` становится canonical startup call из `src/bot/index.ts` (рядом с `loadCache()`). Все call sites продолжают работать без модификаций.
- **Phase 5b (после 24h soak):** Конвертировать public API в честный sync. Убрать `async` с `saveUser`/`savePhone`/`getAllUsers`/`getUsersStats`. Удалить `await` в 11 call sites в `start.ts` / `request.ts` / `admin.ts`. Пометить `ensureUsersLoaded` `@deprecated`, удалить два вызова в `request.ts`.

**Alternatives considered:**

- **Single big-bang refactor.** Отвергнуто: затронул бы 5 файлов и 11 call sites одновременно. Если что-то регрессирует на production deploy (init order, file permission, race), rollback шире и сложнее.
- **Только Phase 5a без планов на 5b.** Отвергнуто: оставит async-сигнатуры которые внутри делают sync работу — TypeScript не ловит mismatch (return `T` from `Promise<T>` — валидно). Honest signatures должны прийти, чтобы call sites могли убрать ненужный `await`.

**Why two phases:**

Atomicity vs. risk:
- Single big-bang touched бы 5 файлов и 11 call sites одновременно. Если что-то регрессирует на production deploy, rollback шире.
- Two-phase делает Phase 5a малым (2 файла только — `users.ts` + `index.ts`) и reversible. Production гоняет новый init pattern 24+ часа; если что-то не так, всплывает до того как более инвазивная Phase 5b затронет call sites.

**Consequences:**

- (+) Корень класса Б-9 структурно закрыт: race condition между sync getUser и async loadUsers больше не возникает, даже если call site забывает `ensureUsersLoaded()`.
- (+) Phase 5a атомарна и reversible — 2 файла, не затрагивает call sites.
- (+) Reference pattern `fileIdCache.ts` уже доказан в production — sync init at startup, sync read/write everywhere.
- (−) Phase 5a оставляет async-сигнатуры что внутри делают sync работу — TypeScript не ловит mismatch (return `T` from `Promise<T>` валидно). Honest signatures должны ждать 5b.
- (−) Если Phase 5b не запустится из-за приоритета других задач, async-фасад останется навсегда как технический долг.

**Files changed (Phase 5a):**

- `src/bot/store/users.ts` (sync-init internals).
- `src/bot/index.ts` (`loadUsers()` startup call рядом с `loadCache()`).

**Reference:** Commit `f90d7e5` (Phase 5a). Phase 5b в `roadmap.md` → Planned — Technical debt. Closes Б-9 корень класса. Б-9 long-term follow-up в `bugs.md` обновлён ссылкой на этот ADR.

## [2026-04-25] Б-14 closed — /news rendering mode reconciled with code shape

**Status:** Accepted

**Confidence:** High — the diagnosis is clear from the Next.js docs (any access to `searchParams` is a Dynamic API that overrides `revalidate`), one of the three /news routes legitimately benefits from `generateStaticParams`, the other two cannot be ISR with the current pagination shape. Changes are small and surgical.

**Context:**

Б-14 was logged 2026-04-24 during Blog ISR migration verification: the build summary showed `/news`, `/news/[slug]`, and `/news/tag/[tag]` all under the `ƒ (Dynamic)` marker despite each file declaring `export const revalidate = 3600` and a JSDoc header advertising "ISR revalidate=3600". Declaration ↔ runtime drift.

Root-cause diagnosis (this prompt):
- `/news/page.tsx` uses `searchParams: Promise<{ page?: string }>` for pagination (`?page=2`). Reading `searchParams` is a Dynamic API in Next.js 16; it forces per-request rendering and silently overrides any `revalidate` export on the route.
- `/news/tag/[tag]/page.tsx` reads BOTH `params` (tag) and `searchParams` (page). Same searchParams override applies.
- `/news/[slug]/page.tsx` does NOT use `searchParams` and only reads `params.slug`. It is forced to Dynamic for a different reason: a route with dynamic segments and NO `generateStaticParams` opts out of static rendering by Next.js 16 default. `revalidate` alone is not sufficient — without `generateStaticParams`, there's no build-time enumeration to base ISR on.

The two failure modes are different and need different fixes.

**Decision:**

Three surgical changes:

1. **`/news/[slug]/page.tsx`** — add `generateStaticParams()` reading from `getAllNewsDays()` (the existing function in `services/news/reader.ts`). Pre-renders all known slugs at build time; `dynamicParams: true` (Next.js default) means new slugs are still rendered on-demand with the existing `revalidate = 3600` window. Build summary flips this route from `ƒ (Dynamic)` to `● (SSG)` with ISR fallback. This matches the pattern applied to `/blog/[slug]` in the Blog ISR migration prompt earlier this session.

2. **`/news/page.tsx`** — keep `revalidate = 3600` as documentation of intent, but add an inline `@rule` comment explicitly noting that `searchParams` access overrides the export at runtime. JSDoc `@runs` annotation updated from `ISR revalidate=3600` to `Dynamic per-request — searchParams pagination overrides ISR`. This eliminates documentation drift without changing observable behaviour.

3. **`/news/tag/[tag]/page.tsx`** — same treatment as `/news/page.tsx`. Same root cause, same fix shape.

The build summary after this prompt shows `/news/[slug]` as `●` (correct ISR) and `/news`, `/news/tag/[tag]` as `ƒ` (correct Dynamic — searchParams).

**Alternatives considered:**

- **Refactor pagination on `/news` and `/news/tag/[tag]` to path-based form `/news/page/[page]` and `/news/tag/[tag]/page/[page]`.** Rejected for this prompt — would actually flip both routes to ISR, but it's a real product change (URL shape, sitemap, internal linking, possibly SEO impact on existing crawled URLs). Significant scope, bigger blast radius. Logged as a possible future move; for Б-14 the goal was to reconcile declaration with reality, not rewrite the routing.
- **Remove the `revalidate = 3600` exports from `/news/page.tsx` and `/news/tag/[tag]/page.tsx` since they're silently ignored.** Rejected — the export documents intent. If pagination ever changes to a non-`searchParams` shape, the export becomes effective with zero code change. Removing it would destroy that latent intent.
- **Skip `/news/[slug]` and only fix the JSDoc/comment drift on the other two.** Rejected — `/news/[slug]` is the case where the user-perceived problem is real (new news articles take a deploy to be discoverable, same Б-12 class as Blog ISR). Fixing `/news/[slug]` for free while we're touching the route is the right thing.
- **Switch to `force-static` + manual revalidation API call from the news cron.** Rejected — adds coupling between cron and Next.js internals (HTTP endpoint to `revalidatePath`), introduces a new failure mode. The `generateStaticParams` + `revalidate` shape is the simpler, library-supported equivalent.

**Consequences:**

- (+) Closes Б-14. The build summary now matches the JSDoc and comment claims for each /news route.
- (+) `/news/[slug]` is now actually ISR — newly-generated news articles become visible within 1 hour of file creation, no deploy needed. Same UX guarantee as `/blog/[slug]`.
- (+) `/news` and `/news/tag/[tag]` rendering is now honestly documented as Dynamic. Future readers see the comment explaining searchParams override and don't waste time wondering why their `revalidate` change has no effect.
- (+) No URL changes, no SEO impact, no behaviour changes for users.
- (−) `/news` and `/news/tag/[tag]` still do per-request disk reads (negligible — JSON files are <15 KB, traffic is moderate). If load grows, the path-based pagination refactor is a known follow-up.
- (−) `getAllNewsDays()` reads the news directory at build time. On the build runner, that directory may be empty (news content lives on the VDS, not in the repo). `generateStaticParams` returns `[]` in that case, and Next.js falls back to fully on-demand ISR with `dynamicParams: true`. The first visitor to a fresh slug pays the on-demand render cost; subsequent visitors hit cache for `revalidate` seconds. This is the standard ISR-without-prebuild profile and is intentional — same as `/blog/[slug]` if blog MDX files are not in the build runner's checkout.

**Verification (this prompt):**

`npm run build` summary after the changes shows:
- `● /news/[slug]` — SSG with generateStaticParams (was `ƒ`).
- `ƒ /news` — Dynamic (correctly documented; was misleadingly under "ISR" in JSDoc).
- `ƒ /news/tag/[tag]` — Dynamic (same).

**Files changed:**
- `jck-auto/src/app/news/page.tsx` (JSDoc + inline comment, no behaviour change)
- `jck-auto/src/app/news/[slug]/page.tsx` (generateStaticParams added, JSDoc bump)
- `jck-auto/src/app/news/tag/[tag]/page.tsx` (JSDoc + inline comment, no behaviour change)
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/bugs.md` (Б-14 marked closed)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-25] Б-15 closed — lead audit log (append-only JSON-line file)

**Status:** Accepted

**Confidence:** High — minimal surface (one helper + one call site), fail-open semantics inherited from the cronAlert.ts precedent, no library dependency, no behaviour change for the happy path.

**Context:**

Б-15 was recorded earlier today (commit `2926f96`, Б-6/2 close) per Vasily's session note: "лучше записывать логи заявок пользователей в будущем, чтобы ничего не терялось". The concrete gaps the entry described:
- A lead that fails to deliver to the operator group (Telegram API error, rate-limit, network drop) logs only to stderr via `console.error("Failed to send lead to group:", err)`. The user still sees `✅ Заявка принята`, but the operator never receives anything.
- No audit trail of submitted leads outside the group chat — if the group is purged or a message deleted, the lead history is lost.
- No analytics surface for measuring lead conversion or volume.

The `bugs.md` entry sketched the resolution: append-only JSON-line file, called from `finishRequest` BEFORE `sendMessage` so a delivery failure still gets logged. Path: `/var/log/jckauto-leads.log` was the original suggestion, but the codebase already has a strong `STORAGE_PATH` convention (services/articles, services/news, fileIdCache, etc. all root under `process.env.STORAGE_PATH || '/var/www/jckauto/storage'`). Aligning with that convention reduces operational surprise — the operator already knows where storage lives, and `logrotate` configuration already covers it.

**Decision:**

Add a module-private `appendLeadLog(entry)` helper to `src/bot/handlers/request.ts`. Path: `${STORAGE_PATH}/leads/leads.log`, with `STORAGE_PATH` env-var override matching the project-wide convention. Format: one JSON line per lead attempt with `{ timestamp, telegramUserId, username, firstName, lastName, phone, source, withoutPhone }`.

Call from `finishRequest` immediately BEFORE `bot.sendMessage`. The lead is recorded even if Telegram delivery fails — closing the silent-loss gap.

Fail-open semantics: any FS error (missing parent dir, EACCES, EROFS, disk full) is caught, logged to stderr with `[request] appendLeadLog failed (swallowed):`, and the bot proceeds normally. Same rationale as cronAlert.ts: monitoring code that crashes the thing it monitors is worse than no monitoring.

Directory auto-creation: on first write, if `${STORAGE_PATH}/leads/` does not exist, the helper creates it via `mkdirSync({ recursive: true })`. No operator deploy step required.

**Alternatives considered:**

- **Path `/var/log/jckauto-leads.log` per the original `bugs.md` sketch.** Rejected — the `/var/log/jckauto-*.log` convention is for cron output (`jckauto-noscut-watchdog.log`, `jckauto-news.log`, etc.) where systemd/cron write directly. Bot-process writes are stylistically grouped under `STORAGE_PATH` (the bot already writes `users.json`, `bot-stats.json`, `file-id-cache.json` there). Consistency wins.
- **Two log entries per lead — one pre-send `attempting`, one post-send `delivered` or `failed`.** Rejected for this iteration — doubles log volume for marginal value. The pre-send entry already proves the lead existed; the existing `console.error` on send failure surfaces the delivery problem in PM2 logs. If post-send delivery audit becomes a real requirement (e.g., for SLA reporting), promote later.
- **Promote helper to `src/lib/leadLog.ts` immediately.** Rejected — single caller (`request.ts`); no second caller in sight (the website lead form goes through `/api/lead`, a separate path with its own observability). If a second caller emerges, promotion path is the same as `withTimeout` in encar.ts (С-8) and `normalizePhone` in request.ts (Б-6/1).
- **Use `fs.promises.appendFile` (async) instead of `appendFileSync`.** Rejected — `finishRequest` is currently synchronous in shape (`bot.sendMessage` returns a promise but is fire-and-forget for the caller's perspective). Switching to async append would either require awaiting the FS write (delaying the visible reply to the user) or fire-and-forget the FS promise (losing error visibility). Sync write is fast (single line, append mode, OS page cache) and the caller is already inside an async event handler — the millisecond cost is invisible.
- **JSON-array file (read existing → push → write back).** Rejected — concurrent writes would race; bot is single-process today but the pattern is fragile. Append-only JSON-line scales to multi-process and is the standard pattern (matches systemd-journal, jsonl, ndjson).
- **Audit log only for without-phone leads.** Rejected — the original Vasily note was "ничего не терялось" (nothing should be lost), not specifically without-phone. All leads benefit from the audit trail.

**Consequences:**

- (+) Closes Б-15. Every lead attempt now has a persistent record at `${STORAGE_PATH}/leads/leads.log` independent of group-chat delivery.
- (+) Operator can recover lead history from the file if the group chat is purged or messages are deleted.
- (+) Foundation for future analytics (lead volume, source distribution, without-phone share, conversion rate) — no schema change needed, just `jq` over the file.
- (+) Fail-open: storage outage does not stop the bot. The audit trail is best-effort by design.
- (−) Disk usage grows append-only. Mitigated by the existing `logrotate.conf` infrastructure (the `bugs.md` entry noted this); operator should add a rotation rule for `${STORAGE_PATH}/leads/leads.log` if not already covered. Current lead volume (~5/day) is negligible — months before manual attention is needed.
- (−) The `STORAGE_PATH` env var is not set in `ecosystem.config.js` for `jckauto-bot` (verified during this prompt — only `mcp-gateway` declares env there). Default `/var/www/jckauto/storage` is correct on the VDS, so this works out of the box. If the bot is deployed somewhere else (containerised, alternate VDS), `STORAGE_PATH` should be set.
- (−) Minor sync FS write per lead. ~5 leads/day × 1 disk write = no measurable impact.

**Verification (post-deploy, operator):**

After auto-merge and deploy, send a test lead through the bot. Check `/var/www/jckauto/storage/leads/leads.log` — a JSON line should appear within seconds, containing `timestamp`, `telegramUserId`, `username`, `firstName`, `phone` (or null for without-phone leads), `source`, and `withoutPhone: false` (or true). Validate with `jq -r '.username + " | " + (.phone // "no-phone")' < /var/www/jckauto/storage/leads/leads.log`.

If the file does not appear: check `pm2 logs jckauto-bot --err | grep appendLeadLog` for the swallowed FS-error message; likely cause is `EACCES` on the storage dir, fixable with `chown jckauto:jckauto /var/www/jckauto/storage/leads/`.

**Files changed:**
- `jck-auto/src/bot/handlers/request.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (one new row)
- `jck-auto/knowledge/bugs.md` (Б-15 closed; moved Verify status → Important)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-25] Б-6/2 — submit-without-phone fallback (lead flow, half 2 of 2)

**Status:** Accepted

**Confidence:** High — the change is additive (new button, new handler, optional `finishRequest` parameter); existing call sites are unchanged; rollback is mechanical.

**Context:**

Б-6/1 closed the phone-validation regression class (commit `86e5627`): garbage values are no longer accepted, all four entry points use a single normalisation helper, the silent-exit path was replaced with a user-visible recovery. But Б-6/1 deliberately left out the case of a user who simply does not want — or cannot — share a phone number.

Today, such a user faces an unsolvable loop: tap "Оставить заявку" → see the phone prompt → type "не хочу" → bot rejects with `Это не похоже на телефон…` → tap cancel → start over → same prompt. Their only option is to abandon the lead. We lose the lead silently, and the user perceives the bot as broken.

Some users have a genuine reason not to share a phone: privacy preferences, foreign clients without a routable Russian number, business buyers using a sales rep's account. We can complete the lead through Telegram messaging using the user's `@username`. The operator can write the user in DM; if no DM, they can reach via the username from the group thread. This requires NO new infrastructure.

**Decision:**

Add a third button "📝 Без телефона (через Telegram)" to the phone-prompt reply-keyboard. Tapping it submits a lead with the `withoutPhone: true` flag, which causes `finishRequest` to:
1. Prepend a `⚠️ Заявка без телефона` banner at the very top of the operator-group message.
2. Replace the standard `📱 Телефон: …` line with `📨 Связь: @<username> (без телефона)`.

If the user has no `@username` set on Telegram, the handler refuses cleanly: it explains that without-phone leads require `@username`, points the user at the relevant Telegram setting, and offers the phone path as an alternative. No lead is sent.

The new handler reuses the same flow shape as the existing cancel handler and contact-success path: `ensureUsersLoaded` → `getUser` → state cleanup → `finishRequest` → confirmation. No new state, no new persistence.

The `finishRequest` signature gains an optional `options?: { withoutPhone?: boolean }` parameter. Existing three call sites (in `handleRequestCommand`, `bot.on("contact")`, `bot.on("message")`) do not pass the parameter; they continue to render leads in the original format byte-for-byte.

A race-skip for the new button text is added to `bot.on("message")` — without it, the message-handler would process the button-text as a candidate phone (because `pendingPhone` is still armed when the user taps the button) and reject it with "Это не похоже на телефон" before the dedicated `onText` listener could fire. Same pattern as the cancel-button skip added in Б-6/1.

**Alternatives considered:**

- **Allow lead submission without `@username` (just first/last name + Telegram user-id link).** Rejected — the operator group has no built-in way to deep-link a user-id into a writable conversation. They would manually search for the user, often unsuccessfully. The `@username` requirement is a hard contact-channel requirement, not bureaucracy.
- **Inline keyboard (`callback_query`) instead of reply-keyboard button.** Rejected — the phone-prompt screen already uses reply-keyboard (request_contact, cancel). Mixing inline and reply on the same screen is visually awkward and changes the user's input mode mid-flow. Three reply-keyboard rows is the consistent pattern.
- **Implicit fallback — auto-submit without phone after N rejections.** Rejected — invisible behaviour. The user wouldn't know what happened. Explicit button keeps user agency.
- **Different visual marker for without-phone leads (e.g., grey colour, separate group chat).** Rejected — Telegram doesn't support per-message styling beyond Markdown/HTML, and a separate chat fragments operator workflow. The "⚠️ Заявка без телефона" banner at message-top is the strongest signal available within the platform.
- **Combine Б-6/1 and Б-6/2 into a single prompt.** Rejected per the half-1/half-2 split decided in the prior session — separate rollback windows, clearer review surface.

**Consequences:**

- (+) Closes Б-6 fully — no more user paths in the lead flow result in silent loss or silent loop.
- (+) Operator gets a clearly distinguished signal in the group chat — `⚠️ Заявка без телефона` is impossible to miss.
- (+) Backwards-compatible — existing `finishRequest` callers unchanged; lead text format for normal phone-leads is byte-identical to pre-edit.
- (+) Captures Vasily's session-note about lead-audit-logging as a future-work entry in `bugs.md` — the requirement is recorded, not implemented (separate prompt later).
- (−) Users without `@username` (rare) still cannot submit without a phone. Cannot be fixed at the bot layer alone — Telegram does not let bots message users who have not started a chat AND have no public username unless the user starts the conversation. Documented in the refusal message; user can either set username or share phone.
- (−) Operator workflow now must check the banner — without-phone leads need to be answered via Telegram DM, not phone call. Mitigated by the prominent banner. May warrant a brief operator runbook update separately; not in scope for this prompt.
- (−) Lead-audit-log is not yet implemented. Until it is, a lead that fails to deliver to the operator group (network error, Telegram rate-limit) is logged only to stderr via the existing `console.error("Failed to send lead to group:", err)`. The user still sees "✅ Заявка принята" but the operator never receives anything. Tracked in `bugs.md` as future-work entry, separate prompt.

**Series close:**

Б-6 fully closed:
- Half 1 (`86e5627`): phone validation single source of truth.
- Half 2 (this commit): submit-without-phone fallback.

Lead-audit-log: future-work entry added to `bugs.md`. Separate prompt.

**Files changed:**
- `jck-auto/src/bot/handlers/request.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (one new row)
- `jck-auto/knowledge/bugs.md` (Б-6 fully closed banner; Lead-audit-log future-work entry)
- `jck-auto/knowledge/INDEX.md` (dates)

## [2026-04-25] Б-6 closed — phone validation single source of truth (lead flow, half 1 of 2)

**Status:** Accepted

**Confidence:** High — change is mechanical (introduce two helpers, apply in four call sites), pre/post behaviour for valid inputs is identical, only invalid inputs change handling.

**Context:**

Bug Б-6 was first reported in March 2026 — a real user submitted a lead via the bot that arrived in the operator group with `Телефон: не указан`. Diagnosis at the time hypothesised "user typed text instead of pressing the contact button"; subsequent code in `bot.on("message")` added an inline `digits.length < 7` check that closed THAT specific path but did not address the root pattern.

Reading `src/bot/handlers/request.ts` carefully reveals four entry points to `finishRequest`, each with different and inconsistent assumptions about `user.phone` validity:
- (EP-1) `handleRequestCommand` line ~50: `if (user.phone)` — bare truthy. Legacy garbage in `users.json` (`" "`, `"+7"`, `""`) can pass or fail unpredictably depending on the exact stored string.
- (EP-2) `bot.on("contact")`: trusts `msg.contact.phone_number` from Telegram unconditionally. Third-party clients have shipped builds where the value is empty or malformed for shared contacts.
- (EP-3) `bot.on("message")`: inline 7-digit minimum. Accepts `1234567` as "valid digits" though it is not a real phone.
- (EP-4) `bot.on("message")`: `if (!user) return` after savePhone — silent exit, lead lost without trace.

The pattern: every path independently re-asks "is this phone OK" with a different answer. The fix is to consolidate into one helper, apply at all four sites, and add a user-visible recovery for the silent-exit path.

**Decision:**

Introduce two module-private helpers in `src/bot/handlers/request.ts`:

```
function normalizePhone(raw: string | undefined | null): string | null
function hasValidPhone(user: BotUser): boolean
```

Format: 10–15 digits (E.164 range, country code optional). This intentionally rejects empty/whitespace/short input AND accepts `1234567890` (a fake number that is structurally valid). Catching "this is a fake number" requires Twilio-style lookup and is out of scope; this fix catches structural failures only.

Apply at four sites:
- EP-1: `if (user.phone)` → `if (hasValidPhone(user))`.
- EP-2: validate `msg.contact.phone_number` via `normalizePhone`, re-arm `pendingPhone` and re-prompt on null.
- EP-3: replace inline `digits.length < 7` with `normalizePhone`. Rejection message clarified to suggest the +7 999... format alongside the contact button.
- EP-4: replace silent `return` with `console.error` breadcrumb + user-visible "что-то пошло не так, нажмите /start" message.

Also fix a UX collision discovered while editing the message handler: the `⬅️ Отмена` button text was being processed by the message-handler as "not a phone" before the dedicated `bot.onText(/⬅️ Отмена/)` listener could handle it (race depending on listener registration order). Add an early-return for messages starting with `⬅️` in the message-handler body.

**Alternatives considered:**

- **Strict 11-digit Russia-only format (must start with 7 or 8).** Rejected — the business serves international clients (Korea, Japan, China imports). A foreign client with an 8-digit local number would be rejected. 10–15 digit range covers global E.164.
- **Promote `normalizePhone` to `src/lib/phone.ts` immediately.** Rejected for this prompt; `request.ts` is the only caller. If a second caller appears (lead form on the website, customer support panel), promotion gets its own ADR — the same pattern as `withTimeout` in encar handler (С-8 close).
- **Add Twilio Lookup or Numverify integration to validate "is this a reachable number".** Rejected — adds a third-party API dependency, latency on every lead, billing relationship. Structural validation catches the 90% case (legacy garbage, empty Telegram payloads, abc text). Real-number verification is a separate product decision.
- **Wrap the entire entry into a single state machine class.** Rejected — over-engineering for a four-branch flow. Two helpers + four explicit call sites is more readable and easier to audit for regressions than a state machine for a 130-line file.
- **Combine validation + "submit without phone" fallback in one prompt.** Rejected — see "Half 1 of 2" framing. The fallback is a new user flow (new keyboard button, new lead text in the operator group, new product behaviour); folding it into the validation fix would risk a rollback losing both. Half 2 follows in the next prompt.

**Consequences:**

- (+) Closes Б-6: every path through `finishRequest` now requires a structurally valid phone, OR returns a user-visible recovery message. No silent failures.
- (+) Single source of truth: future code paths that need "is this phone OK" import from one helper. New path that compares `user.phone` directly is a clear regression.
- (+) UX collision with the cancel button is fixed as a side effect.
- (+) Console.error breadcrumb in EP-4 means a recurrence (savePhone succeeds, getUser returns undefined) is now visible in `pm2 logs jckauto-bot --err`, not silent.
- (−) Users with legacy garbage in `users.json` (a `" "` phone) will be re-prompted for a number on their next request — a one-time mild friction. Acceptable; the alternative is a lead arriving with garbage.
- (−) `normalizePhone` accepts `1234567890`-style fake digits. Mitigated by the human-in-the-loop in the operator group (manager calls back; if no answer, mark dead lead).
- (−) Half 2 (submit-without-phone fallback) is not yet wired. Until then, a user who genuinely cannot share a number has no completion path. Half 2 closes that gap.

**Files changed:**
- `jck-auto/src/bot/handlers/request.ts`
- `jck-auto/knowledge/decisions.md` (this entry)
- `jck-auto/knowledge/rules.md` (one new row)
- `jck-auto/knowledge/bugs.md` (Б-6 closed)
- `jck-auto/knowledge/INDEX.md` (dates)

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
