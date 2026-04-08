# Telegram бот — @jckauto_help_bot
> Обновлено: 2026-04-08

## Команды

| Команда | Файл | Функция |
|---------|------|---------|
| `/start` | src/bot/handlers/start.ts | Приветствие + inline-клавиатура |
| `/calc` | src/bot/handlers/calculator.ts | Калькулятор (Китай/Корея/Япония, 4 возраста) |
| `/catalog` | src/bot/handlers/catalog.ts | 5 авто с фото |
| `/contact` | src/bot/handlers/contact.ts | Контакты компании |
| Заявка | src/bot/handlers/request.ts | Сбор данных → пересылка в группу менеджеров |
| `/stats` | src/bot/handlers/admin.ts | Статистика (только ADMIN_IDS) |
| `/broadcast` | src/bot/handlers/admin.ts | Массовая рассылка (только ADMIN_IDS) |

## Конфигурация

- **ADMIN_IDS:** `[1664298688, 355285735]` — в `src/bot/config.ts`
- **Группа заявок:** chat_id `-1003706902240`
- **Хранилище пользователей:** `/var/www/jckauto/storage/users.json`
- **Entry point:** `scripts/start-bot.ts` → `src/bot/index.ts`
- **Telegram API:** через Worker URL `https://tg-proxy.t9242540001.workers.dev`

## Калькулятор в боте

- Вызывает `fetchCBRRates()` напрямую (server-side, без CORS)
- Вызывает `calculateTotal()` из calculator.ts
- Лейбл: «Ориентировочный курс: 1 CNY ≈ 11.89 ₽» (НЕ «Курс ЦБ РФ»)
- Дисклеймер: «Расчёт ориентировочный. Реальный курс уточняется при оформлении заявки»
- Кнопка «На сайт» → https://jckauto.ru/tools/calculator

## Ограничения

- Режим **polling** (не webhook) — не требует входящий порт/nginx
- `pm2 restart` НЕ перечитывает `.env.local` — только `pm2 delete` + `pm2 start`
- Токен бота засветился в чатах — **нужна перегенерация** (security issue)
- Telegram API заблокирован на VDS — работает через Cloudflare Worker

## Запуск / перезапуск

```bash
pm2 delete jckauto-bot
pm2 start "npx tsx -r dotenv/config scripts/start-bot.ts dotenv_config_path=.env.local" --name jckauto-bot
pm2 save
```
