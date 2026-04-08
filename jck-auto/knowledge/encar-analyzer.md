# Анализатор Encar.com
> Обновлено: 2026-04-08

## Обзор

Пользователь вставляет ссылку на авто с fem.encar.com → получает характеристики на русском, расчёт стоимости, PDF-отчёт.

## Файлы

| Файл | Роль |
|------|------|
| src/lib/encarClient.ts | API клиент, mapToResult, translateEncarFields, estimateEnginePower |
| src/app/api/tools/encar/route.ts | POST endpoint — анализ + мощность + перевод + расчёт |
| src/app/api/tools/encar/pdf/route.ts | POST endpoint — PDF отчёт (PDFKit + Roboto) |
| src/app/tools/encar/EncarClient.tsx | Клиентский компонент (форма, результат, лайтбокс) |
| src/app/tools/encar/page.tsx | Страница (SEO, FAQ, CTA) |

## Поток данных

```
URL → extractCarId() → fetchVehicle() + fetchInspection() → mapToResult()
                                                                 ↓
                            Promise.all:  estimateEnginePower() + translateEncarFields()
                                                                 ↓
                                              calculateTotal() → costBreakdown
                                                                 ↓
                                              JSON response → EncarClient.tsx
```

## Перевод Korean → Russian (translateEncarFields)

- Единый DeepSeek вызов для всех полей (description, dealerName, dealerFirm, address → city)
- In-memory кэш 24ч по carId
- Никогда не бросает исключений — при ошибке возвращает оригинал с `failed: true`
- Результат: `descriptionRu`, `dealerName` (транслитерация), `dealerFirm`, `city`

## Мощность двигателя (estimateEnginePower)

- DeepSeek определяет л.с. по марке/модели/объёму/году
- Формат ответа: JSON `{ power, unit, confidence }`
- Пользователь может переопределить вручную

## Grade mapping

- Предпочтение English полям: `gradeEnglishName ?? gradeName`, `gradeDetailEnglishName ?? gradeDetailName`
- Пример: «1.6 Turbo 2WD Modern» вместо корейского текста

## Лайтбокс

- Клик по фото → полноэкранный оверлей
- Закрытие: Escape / клик по фону / кнопка X
- Клик на фото внутри НЕ закрывает (stopPropagation)
- Body scroll заблокирован при открытом лайтбоксе

## Продавец (блок UI)

- dealerName: из partnership.dealer.name (переведено), fallback на contact.userId
- dealerFirm: из partnership.dealer.firm.name (переведено)
- city: извлечено из address (переведено), вместо raw Korean region

## Rate limiter

3 запроса/день на IP. Общий для всех AI-инструментов (src/lib/rateLimiter.ts).
