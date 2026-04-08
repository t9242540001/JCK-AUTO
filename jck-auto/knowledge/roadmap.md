# Roadmap
> Обновлено: 2026-04-08

## Сделано [x]

- [x] Калькулятор для Китая, Кореи, Японии (единый движок calculator.ts)
- [x] Раздел «Сервисы» — /tools хаб с 4 карточками
- [x] Калькулятор «под ключ» (/tools/calculator)
- [x] Калькулятор пошлин (/tools/customs) — физ + юрлицо
- [x] AI-расшифровка аукционных листов (/tools/auction-sheet)
- [x] Анализатор Encar.com (/tools/encar) — анализ + перевод + PDF
- [x] Новостной pipeline (RSS → DeepSeek → обложки → JSON → /news)
- [x] Генератор SEO-статей (topic → Qwen3.5-Plus → MDX → /blog)
- [x] Раздел /news на сайте (каталог + детальная + теги)
- [x] Beta badges на всех /tools/* (BETA_MODE флаг)
- [x] VTB курсы через sravni.ru scraper + CBR fallback с markup
- [x] «Ориентировочный курс» — лейблы на всех калькуляторах + боте
- [x] /api/exchange-rates endpoint (server-side, без CORS)
- [x] CalculatorCore shared компонент (главная + /tools/calculator)
- [x] PDF отчёты с Roboto TTF (кириллица) + ссылка jckauto.ru
- [x] Encar перевод Korean→Russian через DeepSeek (batch, кэш 24ч)
- [x] Knowledge base — документация в knowledge/

## В работе [~]

- [~] Фаза 2: Мониторинг нормативки (check-tariffs.ts + cron)
- [~] Фаза 5: Финализация (SEO-аудит, мобильная проверка, sitemap)
- [~] Merge всех веток в main

## Запланировано — Сайт [ ]

- [ ] Мобильная адаптивность — полный аудит по страницам
- [ ] Добавить изображения к первым 12 статьям блога
- [ ] Регистрация в Yandex.Webmaster и Google Search Console
- [ ] Кнопка «Оставить заявку» на странице авто → /api/lead → группа

## Запланировано — Бот [ ]

- [ ] Перегенерировать токен бота — засветился в чатах (security!)
- [ ] Автопостинг новых авто в канал t.me/jckauto_import_koreya
- [ ] AI-консультант (Claude API + база знаний)

## Запланировано — Инфра [ ]

- [ ] Мониторинг/алертинг PM2 процессов
- [ ] Автоматизация деплоя через GitHub Actions (push → build → restart)
