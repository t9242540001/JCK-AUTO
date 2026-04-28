<!--
  @file:        knowledge/deploy.md
  @project:     JCK AUTO
  @description: Deploy pipeline: two-slot build, self-healing, observability via runner-side log capture
  @updated:     2026-04-28
  @version:     1.1
  @lines:       164
-->

# Deploy Pipeline

## 1. Обзор пайплайна

Разработка ведётся в ветках `claude/**`, продакшен — `main`. VDS всегда синхронизирован с `main` через `git reset --hard origin/main`, никаких ручных правок на сервере.

Цепочка релиза:

1. `git push` в любую ветку `claude/**`.
2. `.github/workflows/auto-merge.yml` триггерится на push и мёржит ветку в `main` через `git merge --no-ff`, затем `git push origin main`.
3. `.github/workflows/deploy.yml` триггерится по `workflow_run` (после auto-merge) **или** по прямому push в `main` — поэтому ручной коммит в `main` тоже запускает деплой.
4. Deploy step SSH-ится на VDS через `appleboy/ssh-action@v1.0.0`, обновляет код, собирает Next.js, переключает symlink, рестартит pm2.
5. Три пост-деплой step-а на runner сохраняют лог Actions на VDS (см. §5).

Два независимых workflow, а не один монолит — чтобы прямой push в `main` (например, hotfix руками мейнтейнера) тоже приводил к деплою, минуя auto-merge.

**Нюанс `workflow_run`:** когда деплой триггерится через `workflow_run`, GitHub использует версию `deploy.yml` **из main на момент триггера, а не из коммита, который запустил auto-merge**. Это встроенная защита от self-modifying workflows: первый запуск после изменения `deploy.yml` использует ПРЕДЫДУЩУЮ версию, новая вступает в силу со следующего коммита. При диагностике «почему мои новые step-ы не сработали» — первым делом смотреть, был ли это первый run после merge.

## 2. Двух-слотовая сборка

**Цель:** zero-downtime деплой на VDS с 1.8 GB RAM, где сборка занимает ~60–90 секунд.

Два слота: `.next-a` и `.next-b`. `.next` — это **symlink**, указывающий на активный слот. `next start` читает файлы через symlink, не зная о слотах.

Алгоритм:

1. Определить активный слот: `CURRENT_SLOT=$(readlink .next)`.
2. Выбрать неактивный как цель сборки (`NEXT_SLOT=".next-b"`, если активен `.next-a`, и наоборот).
3. Очистить неактивный слот: `rm -rf "$NEXT_SLOT"`.
4. Собрать в него: `NEXT_DIST_DIR="$NEXT_SLOT" npm run build`.
5. Атомарно переключить symlink: `ln -sfn "$NEXT_SLOT" .next`.
6. `pm2 restart jckauto` подхватывает новый бандл.

Пока идёт сборка, сайт продолжает обслуживаться из старого слота. Переключение symlink — атомарный `rename(2)` syscall, промежуточное состояние невидимо процессу Next.js.

Предыдущая схема собирала в `.next/` напрямую: Next.js 16 Turbopack пишет манифесты файлов (`page_client-reference-manifest.js` и др.) в финальной фазе билда, поэтому между «файл удалён» и «файл записан» любой GET давал `InvariantError: client reference manifest does not exist` → 500/502 на всех роутах в течение ~100 секунд. Двух-слотовая схема это закрывает.

Ключевая инвариантность: `next.config.ts` должен содержать `distDir: process.env.NEXT_DIST_DIR || '.next'` с fallback-значением `'.next'`. Без fallback `next start` (без env-переменной) прочитает не тот каталог и отдаст 500 на всём.

## 3. Self-healing блок

Между `git reset --hard` и `npm ci` в `deploy.yml` стоит блок, восстанавливающий двух-слотовую структуру, если её кто-то сломал.

**Условие срабатывания:** `.next` существует **как обычная директория**, а не symlink (`[ -d ".next" ] && [ ! -L ".next" ]`).

**Почему это возможно:** кто-то запустил `npm run build` без `NEXT_DIST_DIR` — прямо на VDS из shell, или из cron-скрипта, или из sync-catalog до фикса 2026-04-04. Next.js создал настоящий каталог `.next/` поверх symlink-а.

**Что делает блок:**
- Если внутри `.next/` есть `BUILD_ID` (валидный билд) — сохраняет директорию как `.next-a`, восстанавливает symlink `.next → .next-a`. Билд не теряется.
- Если `BUILD_ID` нет (битый недобилд) — удаляет `.next/`, восстанавливает symlink на любой уцелевший слот (`.next-a`, потом `.next-b`). Если оба слота тоже пусты — `exit 1`, деплой падает явно, а не молча.

Все события логируются как `[build] WARNING: ...` — это маркер «что-то пошло не так до этого деплоя, разобраться». Без него битое состояние пережило бы следующий билд и сломало прод повторно.

## 4. npm ci wrapper и npm 10.8.2 reify bug

В Actions (non-TTY окружение) `npm ci` с ~50 platform-specific optional-зависимостями (`sharp`, `@next/swc-*`, `lightningcss`, `@tailwindcss/oxide`, `@rollup/rollup-*`) возвращает **exit 1 даже при успешной установке**. Это известный баг npm 10.8.2 в фазе reify — часть платформенных сборок «фейлится» (их и не должно быть на Linux x64), но npm считает это ошибкой всего процесса.

Обёртка в `deploy.yml`:

```bash
if npm ci --no-audit --no-fund; then
  NPM_EXIT=0
else
  NPM_EXIT=$?
fi
# далее проверяется существование node_modules/{next,react,sharp,@next/swc-linux-x64-gnu}
```

Если ключевые пакеты на месте — продолжаем, игнорируя ложный exit code. Если хоть одного нет — `exit 1`, деплой падает.

**Почему не `npm ci || true`:** `appleboy/ssh-action` по умолчанию запускается с `script_stop: true`, что **перехватывает ненулевые exit code в конструкциях вида `cmd || fallback`, внутри `if [ A ] && [ B ]` и внутри `var=$(cmd1 || cmd2)` — ДО того, как bash успевает применить свой `||`**. Это эмпирически установлено в инцидентах deploy-рунов #74–#80 (пять подряд провальных деплоев).

Форма `if cmd; then ... else NPM_EXIT=$?; fi` — единый синтаксический юнит по POSIX, по спеке errexit не распространяется на команды в условии `if`. Эта форма переживает любой слой обработки errexit (и bash, и appleboy).

## 5. Observability: runtime-логи деплоя

**Где искать первым делом:** `/var/www/jckauto/deploy-logs/deploy-latest.log` — symlink на лог последнего прогона.

**Читается через JCK AUTO Files MCP** (FILESYSTEM_ROOTS ограничен `/var/www/jckauto/` — поэтому логи и лежат там, а не в `/var/log/`).

**Как устроено.** Захват лога вынесен в отдельный workflow `.github/workflows/deploy-log-capture.yml`, не в `deploy.yml`. Триггер — `workflow_run` от `Deploy to VDS` с `types: [completed]`. Дополнительный триггер `workflow_dispatch:` оставлен для ручного запуска при отладке.

Job `capture` имеет `if: always()` — лог сохраняется и при упавшем деплое. Три step-а:

1. **`Fetch completed Actions log`** — `gh run view ${DEPLOY_RUN_ID} --log` (где `DEPLOY_RUN_ID = github.event.workflow_run.id`) пишет полный лог завершённого deploy-run в `/tmp/deploy-log/YYYY-MM-DD_HHMMSS_run<id>.log`. При сбое `gh` пишется минимальный fallback-лог с run_id (вместо exit 1, чтобы не терять симлинк). Имя файла экспортируется в `$GITHUB_ENV` как `LOG_NAME`.

2. **`Upload log to VDS`** — `appleboy/scp-action@v0.1.7` копирует файл в `/var/www/jckauto/deploy-logs/`, `strip_components: 4` убирает лишние сегменты пути.

3. **`Update symlink and rotate old logs`** — `appleboy/ssh-action@v1.0.0` обновляет `deploy-latest.log` на свежий файл и ротирует: оставляет последние 30 `.log`-файлов, исключая сам symlink через `grep -v`.

**Permissions** workflow: `contents: read, actions: read`. `actions: read` обязателен для `gh run view --log`. GitHub автоматически маскирует значения секретов в выводе (`***`), поэтому в сохранённый лог не попадают ни `VDS_SSH_KEY`, ни `VDS_HOST`, ни `GITHUB_TOKEN`.

**Почему отдельный workflow, а не post-SSH step-ы в deploy.yml.** Прямой `gh run view --log` не может прочитать **свой собственный** in-progress run — возвращает ~34-байтный stub. Ждать собственного завершения изнутри run'а тоже нельзя (deadlock). `appleboy/scp-action` запускается в отдельном Docker-контейнере без доступа к `/tmp/` runner-host'а, поэтому переложить файл со scp-step'а на upload-step непросто. Отдельный workflow, дождавшийся `workflow_run: completed`, видит уже финализированный лог. Решение зафиксировано в ADR `[2026-04-15] Separate workflow for runner-side deploy log capture`.

**@rule:** имя файла workflow (`deploy-log-capture.yml`) синхронизировано с комментарием `@rule` в `deploy.yml` («Log capture is handled by the separate `.github/workflows/deploy-log-capture.yml` workflow»). Переименование workflow-файла требует одновременной правки этого комментария — иначе ссылка станет битой и следующая диагностика уйдёт в ложный путь.

**История регистрации (2026-04-15 → 2026-04-28).** Workflow был добавлен 2026-04-14 как `capture-deploy-log.yml`. GitHub Actions не зарегистрировал его автоматически — за 14 дней ноль реальных запусков на 750 workflow runs репо. 2026-04-28 файл переименован в `deploy-log-capture.yml`, что форсирует перерегистрацию (стандартный GitHub fallback). Подтверждение работоспособности — появление новых файлов в `/var/www/jckauto/deploy-logs/` после первого deploy-run после переименования.

## 6. Observability contract — echo-маркеры

В `deploy.yml` после каждого значимого шага стоит `echo` со своим маркером:

- `[deploy] building commit <sha>` — после `git reset`, идентифицирует билдящийся коммит.
- `[wrapper] step 1..6` — обёртка вокруг `npm ci` (старт, результат, верификация пакетов, итог).
- `[build] step 1..8` — слотовая сборка (определение слота, очистка, next build, symlink swap, рестарт jckauto, рестарт бота, финал).
- `[build] WARNING: ...` — срабатывание self-healing.

**Эти маркеры нельзя удалять.** Это единственный способ локализовать падение внутри `appleboy/ssh-action`, где stderr ненадёжен, а `set -x` взорвёт объём лога. При добавлении новых блоков — **добавлять новые маркеры** (`[log]`, `[heal]`, `[verify]` и т.п.), **не перенумеровывая и не переименовывая существующие**.

Если при диагностике в логе отсутствует какой-то маркер — это значит до этой точки скрипт не дошёл. Точка отказа — сразу после последнего видимого маркера.

## 7. Диагностика падения — шпаргалка

Порядок важен. Нарушение порядка (начать с `pm2 logs`) уведёт на ложные гипотезы.

1. **Первый источник — `/var/www/jckauto/deploy-logs/deploy-latest.log` через MCP.** Искать последний видимый маркер `[wrapper]`/`[build]` — это точка отказа. Все `[build] WARNING` — это self-healing сработал, значит кто-то ломал слоты.
2. **Второй источник — Actions UI**: репозиторий → Actions → «Deploy to VDS» → последний run → вкладка Jobs. Нужен, если MCP-лог не загрузился или если надо посмотреть пред-SSH step-ы (auto-merge, checkout).
3. **Третий источник (только если сайт реально упал) — `pm2 logs jckauto --lines 100 --nostream` на VDS.** Показывает **симптом** (`InvariantError: client reference manifest`, `Cannot find module 'dotenv/config'` и т.п.), а не причину. Причину показывают первые два источника.

Правило: pm2 logs без Actions log часто приводят к «починке симптома» (удалить node_modules, пересобрать руками) вместо починки корня (например, в deploy.yml случайно убрали `NEXT_DIST_DIR`).

## 8. Критические правила deploy.yml

- `set -e` как первая строка скрипта. **Не использовать `script_stop: true`** в `appleboy/ssh-action` — см. §4.
- Echo-маркеры `[wrapper]`/`[build]`/`[deploy]` не удалять, не переименовывать. Новые блоки — новые маркеры.
- `npm run build` — **только** с `NEXT_DIST_DIR`, **только** в `deploy.yml`. Cron-скрипты не собирают (каталог — force-dynamic), sync-catalog не собирает.
- `distDir` в `next.config.ts` — всегда `process.env.NEXT_DIST_DIR || '.next'` с fallback.
- Бот: `pm2 delete jckauto-bot` + `pm2 start ...`, **не `pm2 restart`** — `restart` не перечитывает `.env.local`.
- Старт бота — через `node_modules/.bin/tsx -r dotenv/config ...`, **не `npx tsx`**: `tsx` лежит в `devDependencies`, глобальный `tsx` не найдёт локальный `dotenv/config` и бот упадёт с `Cannot find module 'dotenv/config'`.
- Секреты в новых `echo` — никогда. Лог Actions выкладывается на VDS в plain-text, `secrets.*` GitHub маскирует автоматически, но хардкодить токены в `echo` нельзя.
- Любой промпт, меняющий код в build path (`.ts`/`.tsx`/`next.config.ts`/`package.json`), обязан включать `npm run build` в acceptance criteria.

## 9. Emergency manual deploy

Использовать **только** при неработающих Actions (всё остальное — через git push, пайплайн сам отработает).

```bash
cd /var/www/jckauto/app/jck-auto
git fetch origin && git reset --hard origin/main

# fresh install обходит npm 10.8.2 reify bug — другой code path, чем инкрементальная установка
rm -rf node_modules && npm install --no-audit --no-fund

# определить слот и собрать в неактивный
CURRENT_SLOT=$(readlink .next 2>/dev/null || echo "none")
if [ "$CURRENT_SLOT" = ".next-a" ]; then NEXT_SLOT=".next-b"; else NEXT_SLOT=".next-a"; fi
rm -rf "$NEXT_SLOT"
NEXT_DIST_DIR="$NEXT_SLOT" npm run build

# swap + restart
ln -sfn "$NEXT_SLOT" .next
pm2 restart jckauto
pm2 delete jckauto-bot || true
pm2 start "node_modules/.bin/tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save && pm2 status
```

**Что нельзя:**
- Запускать `npm run build` без `NEXT_DIST_DIR` — превратит `.next` из symlink в каталог, следующий деплой поймает self-healing `[build] WARNING`.
- Использовать `pm2 restart jckauto-bot` вместо `delete + start` — бот поедет со старым `.env.local`.
- Коммитить правки прямо на VDS: VDS делает `git reset --hard`, все локальные правки пропадут в следующем деплое.
