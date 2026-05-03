<!--
  @file:        knowledge/bugs.md
  @project:     JCK AUTO
  @description: Open / verify-status / won't-fix bugs tracker — site and bot
  @updated:     2026-05-02
  @version:     1.27
  @lines:       ~190
-->

# Bugs — open issues tracker

> Updated: 2026-05-02
> Source of truth for open and verify-status bugs.
> After fix → ADR in decisions.md, entry MOVED to bugs-archive-N.md (NOT deleted).
> Hypotheses listed only when diagnosis requires choosing between alternatives.
> Auto-archive trigger: when this file exceeds 250 lines, run a knowledge-cleanup
> pass to move closed entries into the next archive file.
> Related: roadmap.md (high-level status), telegram-bot.md (bot architecture), tools-auction-sheet.md.

## Critical (visible to all users, blocks core flows)

> No critical bugs currently open. New critical bugs go here. Closed
> entries: С-1, Б-11, Б-13 → bugs-archive-1.md.

## Important (noticeable but workarounds exist)

### Б-16 — нет автоскролла к результату на /tools/encar и /tools/auction-sheet
- **Pages:** /tools/encar, /tools/auction-sheet
- **Severity:** Important — анализ выполняется корректно, но
  пользователь не понимает что он завершён. На мобильных результат
  уходит ниже второго экрана и физически не виден без ручного скролла.
  На десктопе симптом мягче, но hero-блок страницы остаётся в
  верхней части viewport и продолжает занимать внимание.
- **Symptom:** state переходит idle → loading → result, рендер
  результата выполняется ниже формы, но `window.scrollTo` /
  `element.scrollIntoView` не вызывается. Пользователь после клика
  «Анализировать» видит ту же страницу что и до клика, иногда
  пробует кликнуть кнопку повторно или закрывает страницу.
- **Hypothesis:** ни в `EncarClient.tsx`, ни в `AuctionSheetClient.tsx`
  (в новой архитектуре — `useAuctionSheetJob` hook + orchestrator)
  нет вызова scrollTo/scrollIntoView при переходе в state="result"
  или при появлении результата на DOM. Подтверждено
  `grep -rn "scrollTo\|scrollIntoView" src/app/tools/` 2026-04-28 —
  0 совпадений по всему дереву /tools.
- **Discovered:** 2026-04-28 by Vasily during visual verification of
  encar-site-photo series fix on /tools/encar.
- **Action:** один общий fix для обоих инструментов. Минимально:
  ref на первом блоке результата + useEffect на смену state →
  `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
  Желательно добавить визуальный сигнал «✓ Анализ завершён» (мини-toast
  или короткая анимация появления карточки результата) — на мобильных
  smooth-scroll длится ~500ms, без визуального cue пользователь может
  не заметить движение страницы. Перед фиксом проверить также
  /tools/calculator и /tools/customs — те же tools с тем же паттерном
  «форма → результат», скорее всего страдают от того же класса бага.
- **Out of scope for fix:** редизайн hero-блока, перенос результата
  выше формы, любые изменения api-контракта инструментов. Цель —
  только сообщить пользователю «ваш результат вот тут».


## Verify status (potentially stale)

### С-5 — auction sheet fails on handwritten HAA sheets (Allion case)
- **Page:** /tools/auction-sheet
- **Symptom (original):** "Ошибка сети. Проверьте подключение." specifically on
  handwritten HAA-format sheets (reproducible on Toyota Allion test photo).
  Normal printed USS sheets (like Toyota Wish) work fine.
- **Started after:** Multi-pass OCR pipeline deployed 2026-04-16.
  Architecture itself is sound — the bug is in Step 2 fallback cascade.
- **Diagnostics captured:**
  - Pass 1 OCR: chars=271 (compared to 510 on printed sheets — OCR quality
    lower on handwritten input, but not empty)
  - Pass 2 OCR: chars=17 ("no codes") — OK for Allion, damages minimal
  - Pass 3 OCR: chars=71 — OK
  - Step 2 primary (DeepSeek): "Failed to parse DeepSeek API response as
    JSON" — 3 retries, all fail identically
  - Step 2 fallback (qwen3.5-flash): DashScope timeout after 60s (DashScope
    text models unreliable from VDS — see ADR [2026-04-15] DeepSeek primary)
  - Total: >70s, nginx closes connection, user sees "Ошибка сети"
- **Status Update 2026-04-18:** User-impact symptom closed. Async queue
  contract (ADR [2026-04-18]) + DeepSeek timeout 180s / 2 retries
  (ADR [2026-04-18]) + nginx 200s per-endpoint timeout together prevent
  the cascade from ever surfacing as "Ошибка сети". The underlying root
  cause — DeepSeek occasionally emitting non-JSON for specific OCR
  content patterns — is NOT yet explained, but no longer user-visible.
  Moved to Verify status: needs live retest on Allion photo to confirm
  it now produces a usable analysis (or a graceful `parse_error:` failure
  with result screen), not a timeout.
- **Action:** live retest on Toyota Allion handwritten sheet. If result
  card appears → close. If still fails → the old Prompt 09.3.7 plan
  (log first 500 chars of DeepSeek response on parse failure) resurfaces.

### Б-5 — ~10-15% car photos rejected by Telegram
- **Symptom:** "wrong type of the web page content" via Worker, even though server returns valid JPEG
- **First reported:** March 2026
- **Status:** unknown — fallback to text card may have masked it
- **Action:** confirm with Vasily if still actual. If yes — investigate file_id caching
  (POST sendPhoto once, save returned file_id, reuse).


## Won't fix (low value, documented workaround)


> Bugs здесь признаны не блокирующими, с понятным workaround. Файлы
> кода/конфигов оставлены в репо на случай возврата к задаче. Каждая
> запись фиксирует что пытались, почему остановились, и условие
> возможного возврата.

### Б-8 — Capture Deploy Log workflow не регистрируется в GitHub Actions
- **File:** .github/workflows/deploy-log-capture.yml (переименован из capture-deploy-log.yml 2026-04-28)
- **Status:** Won't fix 2026-04-28. Файл оставлен в репо.
- **Симптом:** workflow физически в репо, но GitHub Actions его не
  регистрирует — workflow отсутствует в Actions UI sidebar, ни одного
  run в истории за 14+ дней, папка `/var/www/jckauto/deploy-logs/`
  не наполняется новыми файлами.
- **История попыток:**
  - 2026-04-14 — workflow добавлен как `capture-deploy-log.yml`
    (Prompt 05).
  - 2026-04-15 (Prompt 08.6) — добавлен `workflow_dispatch:` как
    второй триггер для принудительной регистрации. Не помогло.
  - 2026-04-28 (commit `004d1a6`) — переименование файла в
    `deploy-log-capture.yml` (стандартный GitHub fallback для
    форсирования регистрации). Не помогло. Deploy to VDS #416
    отработал чисто, capture-run не появился.
- **Цель workflow была:** сохранение полного лога каждого Deploy to
  VDS run на VDS в `/var/www/jckauto/deploy-logs/`, чтобы Claude
  через JCK AUTO Files MCP мог читать лог при диагностике без
  необходимости открывать Actions UI вручную.
- **Workaround (используется по умолчанию):** при падении деплоя
  оператор открывает Actions UI на github.com, заходит в нужный
  Deploy to VDS run, копирует релевантный фрагмент лога в чат.
  Стоимость workaround — ~30 секунд за инцидент. Инциденты
  деплоя редки (последний 2026-04-10).
- **Условие возврата:** если после изменений в GitHub Actions
  поведении workflow начнёт регистрироваться сам по себе, или если
  частота deploy-инцидентов вырастет настолько, что ручной обход
  станет дорогим — попробовать путь «удалить файл одним коммитом,
  добавить заново вторым коммитом» (двух-шаговая стратегия,
  отличная от чистого rename). Этот путь не пробовали.
- **Что НЕ удалять:** `.github/workflows/deploy-log-capture.yml`
  остаётся в репо как готовая инфраструктура. `@rule`-ссылка на
  него в `.github/workflows/deploy.yml` остаётся валидной.
  `knowledge/deploy.md` §5 описывает корректную архитектуру для
  случая, когда workflow заработает.

